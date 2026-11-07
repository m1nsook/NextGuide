// Account Mode server-only authentication. Never import this file in client components.
// Single-owner, single-server persistent storage. Node.js >=20; no database service.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { closeSync, chmodSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"

const PERIOD_MS = 30_000
const SESSION_MS = 12 * 60 * 60_000
const ENROLLMENT_MS = 10 * 60_000
const WINDOW_MS = 60_000
const BLOCK_MS = 60_000
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
export const ACCOUNT_COOKIE = "ng_account_session"

export class AccountError extends Error {
  constructor(message, status = 400, retryAfter = 0) {
    super(message)
    this.name = "AccountError"
    this.status = status
    this.retryAfter = retryAfter
  }
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex")
}

function equal(a, b) {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  return left.length === right.length && timingSafeEqual(left, right)
}

export function accountFile(project = process.cwd(), dataDir) {
  const projectId = digest(resolve(project)).slice(0, 24)
  const configured = dataDir ?? process.env.NEXTGUIDE_DATA_DIR
  const directory = configured
    ? resolve(isAbsolute(configured) ? configured : resolve(project, configured))
    : join(homedir(), ".nextguide", "account-sites", projectId)
  const projectRoot = resolve(project)
  const inside = relative(projectRoot, directory)
  // Never permit private owner secrets in a served project tree. Even an
  // accidental dataDir=public path would otherwise expose the TOTP seed.
  if (inside === "" || (inside !== ".." && !inside.startsWith(".." + sep) && !isAbsolute(inside))) {
    throw new AccountError("NEXTGUIDE_DATA_DIR must point outside the Next.js project directory.", 400)
  }
  return join(directory, "state.json")
}

function assertPrivateFile(path) {
  if (!existsSync(path)) throw new AccountError("Account storage is missing. Run nextguide init --account first.", 503)
  if (lstatSync(path).isSymbolicLink()) throw new AccountError("Refusing symbolic-link account storage.", 503)
}

function readState(path) {
  assertPrivateFile(path)
  let state
  try { state = JSON.parse(readFileSync(path, "utf8")) }
  catch { throw new AccountError("Account storage is unreadable.", 503) }
  if (state?.schemaVersion !== 1 || !Array.isArray(state.sessions)) {
    throw new AccountError("Unsupported account storage version.", 503)
  }
  return state
}

function withLock(project, operation) {
  const file = accountFile(project)
  const lock = file + ".lock"
  assertPrivateFile(file)
  let fd
  try { fd = openSync(lock, "wx", 0o600) }
  catch (error) {
    if (error?.code !== "EEXIST") throw error
    // A hard-killed server can leave a stale lock. Operations are synchronous
    // and short, so a lock older than two minutes cannot be legitimate here.
    try {
      const metadata = lstatSync(lock)
      if (metadata.isSymbolicLink()) throw new Error("Unsafe account lock")
      if (Date.now() - metadata.mtimeMs > 120_000) {
        unlinkSync(lock)
        fd = openSync(lock, "wx", 0o600)
      }
    } catch { /* fail closed on ambiguous lock state */ }
    if (fd === undefined) throw new AccountError("Another account operation is in progress. Retry shortly.", 503, 2)
  }
  try {
    const state = readState(file)
    const result = operation(state)
    const temp = file + "." + randomBytes(8).toString("hex") + ".tmp"
    try {
      writeFileSync(temp, JSON.stringify(state) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 })
      renameSync(temp, file)
    } finally {
      if (existsSync(temp)) unlinkSync(temp)
    }
    return result
  } finally {
    closeSync(fd)
    unlinkSync(lock)
  }
}

export function createBootstrap(project = process.cwd(), { dataDir } = {}) {
  const file = accountFile(project, dataDir)
  const folder = dirname(file)
  if (existsSync(file)) throw new AccountError("Account Mode is already initialized. Refusing to replace its owner.", 409)
  mkdirSync(folder, { recursive: true, mode: 0o700 })
  if (lstatSync(folder).isSymbolicLink()) throw new AccountError("Refusing symbolic-link account directory.", 503)
  if (process.platform !== "win32") chmodSync(folder, 0o700)
  const token = randomBytes(24).toString("base64url")
  const state = {
    schemaVersion: 1,
    bootstrapHash: digest(token),
    pending: null,
    owner: null,
    recovery: [],
    lastAcceptedStep: -1,
    sessions: [],
    rate: { started: 0, failed: 0, blockedUntil: 0 },
  }
  writeFileSync(file, JSON.stringify(state) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 })
  return { token, file }
}

export function rotateBootstrap(project = process.cwd()) {
  const token = withLock(project, state => {
    if (state.owner) throw new AccountError("An account owner is already registered. Enrollment cannot be reset with this command.", 409)
    const newToken = randomBytes(24).toString("base64url")
    state.bootstrapHash = digest(newToken)
    state.pending = null
    clearFailures(state)
    return newToken
  })
  return { token, file: accountFile(project) }
}

export function base32Encode(bytes) {
  let output = "", bits = 0, buffer = 0
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += ALPHABET[(buffer >>> (bits -= 5)) & 31]
    }
  }
  if (bits) output += ALPHABET[(buffer << (5 - bits)) & 31]
  return output
}

function base32Decode(value) {
  const cleaned = String(value).replace(/=+$/, "").toUpperCase()
  if (!/^[A-Z2-7]+$/.test(cleaned)) throw new AccountError("Invalid authenticator key.")
  let buffer = 0, bits = 0
  const bytes = []
  for (const character of cleaned) {
    buffer = (buffer << 5) | ALPHABET.indexOf(character)
    bits += 5
    if (bits >= 8) bytes.push((buffer >>> (bits -= 8)) & 255)
  }
  return Buffer.from(bytes)
}

export function totp(secret, time = Date.now()) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(time / PERIOD_MS)))
  const hash = createHmac("sha1", base32Decode(secret)).update(counter).digest()
  const offset = hash[hash.length - 1] & 15
  const value = (hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(value).padStart(6, "0")
}

export function matchingTotpStep(secret, code, time = Date.now(), minimum = -1) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return null
  const step = Math.floor(time / PERIOD_MS)
  for (const offset of [-1, 0, 1]) {
    const candidate = step + offset
    if (candidate < 0 || candidate <= minimum) continue
    if (equal(totp(secret, candidate * PERIOD_MS), code)) return candidate
  }
  return null
}

export function otpUri(secret, label = "Owner", issuer = "NextGuide") {
  return `otpauth://totp/${encodeURIComponent(issuer + ":" + label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}

function rateLimit(state, now) {
  const r = state.rate
  if (r.blockedUntil > now) throw new AccountError("Too many attempts. Try again later.", 429, Math.ceil((r.blockedUntil - now) / 1000))
  if (now - r.started >= WINDOW_MS) {
    r.started = now
    r.failed = 0
    r.blockedUntil = 0
  }
}

function failedAttempt(state, now) {
  const r = state.rate
  if (now - r.started >= WINDOW_MS) { r.started = now; r.failed = 0 }
  r.failed++
  if (r.failed >= 5) r.blockedUntil = now + BLOCK_MS
}

function clearFailures(state) {
  state.rate = { started: 0, failed: 0, blockedUntil: 0 }
}

function issueSession(state, now) {
  const token = randomBytes(32).toString("base64url")
  state.sessions = state.sessions.filter(item => item.expiresAt > now).slice(-7)
  state.sessions.push({ hash: digest(token), expiresAt: now + SESSION_MS })
  return token
}

function safeBootstrap(state, token) {
  return !state.owner && typeof token === "string" && token.length <= 512 &&
    typeof state.bootstrapHash === "string" && equal(digest(token), state.bootstrapHash)
}

export function accountStatus(project = process.cwd(), sessionToken) {
  const state = readState(accountFile(project))
  const now = Date.now()
  return {
    initialized: Boolean(state.owner),
    authenticated: Boolean(state.owner && typeof sessionToken === "string" && state.sessions.some(s => s.expiresAt > now && equal(digest(sessionToken), s.hash))),
  }
}

export function verifySession(project = process.cwd(), token) {
  return accountStatus(project, token).authenticated
}

export async function beginEnrollment(project, bootstrapToken, { time = Date.now(), qr } = {}) {
  const result = withLock(project, state => {
    rateLimit(state, time)
    if (state.owner) throw new AccountError("Account owner has already been registered.", 409)
    if (!safeBootstrap(state, bootstrapToken)) {
      failedAttempt(state, time)
      return { error: new AccountError("Invalid setup token.", 401) }
    }
    clearFailures(state)
    const secret = base32Encode(randomBytes(20))
    state.pending = { secret, createdAt: time }
    return { secret, uri: otpUri(secret) }
  })
  if (result.error) throw result.error
  const makeQr = qr ?? (async uri => {
    const module = await import("qrcode")
    return (module.default ?? module).toDataURL(uri, { width: 248, margin: 2, errorCorrectionLevel: "M" })
  })
  return { manualKey: result.secret, qrDataUrl: await makeQr(result.uri) }
}

function recoveryCode() {
  return "NG-" + randomBytes(10).toString("hex").toUpperCase().match(/.{4}/g).join("-")
}

export function finishEnrollment(project, bootstrapToken, code, time = Date.now()) {
  const result = withLock(project, state => {
    rateLimit(state, time)
    if (state.owner) throw new AccountError("Account owner has already been registered.", 409)
    if (!safeBootstrap(state, bootstrapToken)) {
      failedAttempt(state, time)
      return { error: new AccountError("Invalid setup token.", 401) }
    }
    if (!state.pending || time - state.pending.createdAt > ENROLLMENT_MS) {
      return { error: new AccountError("QR setup expired. Scan a new code.", 410) }
    }
    const step = matchingTotpStep(state.pending.secret, code, time)
    if (step === null) {
      failedAttempt(state, time)
      return { error: new AccountError("Invalid authenticator code.", 401) }
    }
    const codes = Array.from({ length: 10 }, () => recoveryCode())
    state.owner = { totpSecret: state.pending.secret, createdAt: time }
    state.pending = null
    state.bootstrapHash = null
    state.recovery = codes.map(value => digest(value.replace(/-/g, "")))
    state.lastAcceptedStep = step
    state.sessions = []
    clearFailures(state)
    return { session: issueSession(state, time), recoveryCodes: codes }
  })
  if (result.error) throw result.error
  return result
}

export function signIn(project, code, time = Date.now()) {
  const result = withLock(project, state => {
    if (!state.owner) throw new AccountError("Finish setup first.", 409)
    rateLimit(state, time)
    const step = matchingTotpStep(state.owner.totpSecret, code, time, state.lastAcceptedStep)
    let recovered = false
    if (step !== null) state.lastAcceptedStep = step
    else if (typeof code === "string" && /^NG-(?:[\da-fA-F]{4}-){4}[\da-fA-F]{4}$/.test(code)) {
      const hash = digest(code.replace(/-/g, "").toUpperCase())
      const index = state.recovery.findIndex(item => equal(item, hash))
      if (index !== -1) { state.recovery.splice(index, 1); recovered = true }
    }
    if (step === null && !recovered) {
      failedAttempt(state, time)
      return { error: new AccountError("Invalid or already-used code.", 401) }
    }
    clearFailures(state)
    return { session: issueSession(state, time), usedRecovery: recovered }
  })
  if (result.error) throw result.error
  return result
}

export function signOut(project, sessionToken) {
  if (!sessionToken) return
  withLock(project, state => {
    const hash = digest(sessionToken)
    state.sessions = state.sessions.filter(item => !equal(item.hash, hash))
  })
}

function requireOwnerSession(state, token, time) {
  if (!state.owner || typeof token !== "string" ||
      !state.sessions.some(session => session.expiresAt > time && equal(session.hash, digest(token)))) {
    throw new AccountError("Your session has expired. Sign in again.", 401)
  }
}

function confirmCurrentAuthenticator(state, code, time) {
  rateLimit(state, time)
  const step = matchingTotpStep(state.owner.totpSecret, code, time, state.lastAcceptedStep)
  if (step === null) {
    failedAttempt(state, time)
    return false
  }
  state.lastAcceptedStep = step
  clearFailures(state)
  return true
}

// Changing the authenticator always requires a fresh code from the current
// device in addition to the signed-in session. No recovery bypass is exposed.
export async function beginAuthenticatorRotation(project, session, code, { time = Date.now(), qr } = {}) {
  const result = withLock(project, state => {
    requireOwnerSession(state, session, time)
    if (!confirmCurrentAuthenticator(state, code, time)) {
      return { error: new AccountError("Invalid or already-used current authenticator code.", 401) }
    }
    const secret = base32Encode(randomBytes(20))
    state.pendingRotation = { secret, createdAt: time }
    return { secret, uri: otpUri(secret) }
  })
  if (result.error) throw result.error
  const toDataURL = qr ?? (async uri => {
    const module = await import("qrcode")
    return (module.default ?? module).toDataURL(uri, { width: 248, margin: 2 })
  })
  return { manualKey: result.secret, qrDataUrl: await toDataURL(result.uri) }
}

export function finishAuthenticatorRotation(project, session, code, time = Date.now()) {
  const result = withLock(project, state => {
    requireOwnerSession(state, session, time)
    rateLimit(state, time)
    if (!state.pendingRotation || time - state.pendingRotation.createdAt > ENROLLMENT_MS) {
      return { error: new AccountError("New authenticator setup expired. Start again.", 410) }
    }
    const step = matchingTotpStep(state.pendingRotation.secret, code, time)
    if (step === null) {
      failedAttempt(state, time)
      return { error: new AccountError("Invalid new authenticator code.", 401) }
    }
    const codes = Array.from({ length: 10 }, () => recoveryCode())
    state.owner.totpSecret = state.pendingRotation.secret
    state.pendingRotation = null
    state.recovery = codes.map(value => digest(value.replace(/-/g, "")))
    state.lastAcceptedStep = step
    state.sessions = []
    clearFailures(state)
    return { recoveryCodes: codes, session: issueSession(state, time) }
  })
  if (result.error) throw result.error
  return result
}

export function renewRecoveryCodes(project, session, code, time = Date.now()) {
  const result = withLock(project, state => {
    requireOwnerSession(state, session, time)
    if (!confirmCurrentAuthenticator(state, code, time)) {
      return { error: new AccountError("Invalid or already-used authenticator code.", 401) }
    }
    const recoveryCodes = Array.from({ length: 10 }, () => recoveryCode())
    state.recovery = recoveryCodes.map(value => digest(value.replace(/-/g, "")))
    return { recoveryCodes }
  })
  if (result.error) throw result.error
  return result
}

export function revokeAllSessions(project, session) {
  return withLock(project, state => {
    requireOwnerSession(state, session, Date.now())
    state.sessions = []
    return { ok: true }
  })
}

export function sameOrigin(request, configuredUrl = process.env.NEXTGUIDE_PUBLIC_URL) {
  const origin = request.headers.get("origin")
  if (!origin) return false
  try {
    const target = new URL(configuredUrl || request.url)
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)
    // Never derive an external production origin solely from an untrusted Host
    // header. Deployments behind nginx must explicitly configure the HTTPS URL.
    if (process.env.NODE_ENV === "production" && !local &&
        (!configuredUrl || target.protocol !== "https:")) return false
    return origin === target.origin
  } catch { return false }
}
