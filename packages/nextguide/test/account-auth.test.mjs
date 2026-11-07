import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { accountFile, accountStatus, base32Encode, beginEnrollment, createBootstrap, finishEnrollment, matchingTotpStep, otpUri, sameOrigin, signIn, signOut, rotateBootstrap, beginAuthenticatorRotation, finishAuthenticatorRotation, renewRecoveryCodes, revokeAllSessions, totp, verifySession } from "../lib/account-auth.mjs"

const make = () => mkdtempSync(join(tmpdir(), "nextguide-account-"))
function fixture(fn) {
  const root = make()
  return Promise.resolve().then(() => fn(root)).finally(() => rmSync(root, { recursive: true, force: true }))
}

test("RFC 6238 TOTP vector with six digits and 30-second periods", () => {
  const secret = base32Encode(Buffer.from("12345678901234567890"))
  assert.equal(totp(secret, 59_000), "287082")
  assert.equal(matchingTotpStep(secret, "287082", 59_000), 1)
  assert.equal(matchingTotpStep(secret, "287082", 59_000, 1), null)
  assert.equal(matchingTotpStep(secret, "nototp", 59_000), null)
  assert.match(otpUri(secret), /^otpauth:\/\/totp\//)
})

test("setup is terminal-token gated, owner is unique, code replay is rejected, and session is revoked", () => fixture(async root => {
  const directory = join(root, "private")
  const { token, file } = createBootstrap(root, { dataDir: directory })
  assert.equal(file, accountFile(root, directory))
  if (process.platform !== "win32") assert.equal(statSync(file).mode & 0o777, 0o600)
  assert.throws(() => createBootstrap(root, { dataDir: directory }), /already initialized/)
  // The runtime and CLI share the same data directory.
  const previous = process.env.NEXTGUIDE_DATA_DIR
  process.env.NEXTGUIDE_DATA_DIR = directory
  try {
    assert.deepEqual(accountStatus(root), { initialized: false, authenticated: false })
    await assert.rejects(beginEnrollment(root, "wrong", { qr: async () => "qr" }), /Invalid setup token/)
    const rotation = rotateBootstrap(root)
    assert.notEqual(rotation.token, token)
    await assert.rejects(beginEnrollment(root, token, { qr: async uri => uri }), /Invalid setup token/)
    const newToken = rotation.token
    const first = await beginEnrollment(root, newToken, { qr: async uri => uri })
    assert.ok(first.manualKey.length >= 32)
    assert.match(first.qrDataUrl, /^otpauth:\/\/totp\//)
    const now = Date.now()
    const secret = JSON.parse(readFileSync(file, "utf8")).pending.secret
    const firstCode = totp(secret, now)
    const invalidCode = firstCode === "000000" ? "000001" : "000000"
    assert.throws(() => finishEnrollment(root, newToken, invalidCode, now), /Invalid authenticator code/)
    const complete = finishEnrollment(root, newToken, firstCode, now)
    assert.equal(complete.recoveryCodes.length, 10)
    assert.equal(verifySession(root, complete.session), true)
    assert.equal(accountStatus(root).initialized, true)
    assert.throws(() => rotateBootstrap(root), /already registered/)
    assert.throws(() => finishEnrollment(root, token, firstCode, now), /already been registered/)
    assert.throws(() => signIn(root, firstCode, now), /already-used code/)
    const other = signIn(root, totp(secret, now + 30_000), now + 30_000)
    assert.equal(verifySession(root, other.session), true)
    signOut(root, other.session)
    assert.equal(verifySession(root, other.session), false)
    const backup = signIn(root, complete.recoveryCodes[0], now + 31_000)
    assert.equal(backup.usedRecovery, true)
    assert.throws(() => signIn(root, complete.recoveryCodes[0], now + 32_000), /already-used code/)
    const rotation = await beginAuthenticatorRotation(root, backup.session, totp(secret, now + 60_000), {
      time: now + 60_000, qr: async uri => uri,
    })
    assert.match(rotation.qrDataUrl, /^otpauth:\/\/totp\//)
    assert.notEqual(rotation.manualKey, secret)
    const refreshed = finishAuthenticatorRotation(root, backup.session, totp(rotation.manualKey, now + 60_000), now + 60_000)
    assert.equal(refreshed.recoveryCodes.length, 10)
    assert.equal(verifySession(root, backup.session), false)
    assert.equal(verifySession(root, refreshed.session), true)
    assert.throws(() => signIn(root, totp(secret, now + 90_000), now + 90_000), /already-used code|Invalid/)
    const newCodes = renewRecoveryCodes(root, refreshed.session, totp(rotation.manualKey, now + 90_000), now + 90_000)
    assert.equal(newCodes.recoveryCodes.length, 10)
    assert.throws(() => signIn(root, refreshed.recoveryCodes[0], now + 91_000), /already-used code/)
    assert.equal(revokeAllSessions(root, refreshed.session).ok, true)
    assert.equal(verifySession(root, refreshed.session), false)
  } finally {
    if (previous === undefined) delete process.env.NEXTGUIDE_DATA_DIR
    else process.env.NEXTGUIDE_DATA_DIR = previous
  }
}))

test("rate limit persists across login requests", () => fixture(async root => {
  const previous = process.env.NEXTGUIDE_DATA_DIR
  process.env.NEXTGUIDE_DATA_DIR = join(root, "account")
  try {
    const { token } = createBootstrap(root)
    const now = Date.now()
    const enrollment = await beginEnrollment(root, token, { time: now, qr: async () => "" })
    const { session } = finishEnrollment(root, token, totp(enrollment.manualKey, now), now)
    assert.equal(verifySession(root, session), true)
    for (let i = 0; i < 5; i++) assert.throws(() => signIn(root, "bad", now + 1), /Invalid or already-used/)
    assert.throws(() => signIn(root, "bad", now + 1), /Too many attempts/)
    const ok = signIn(root, totp(enrollment.manualKey, now + 120_000), now + 120_000)
    assert.ok(ok.session)
  } finally {
    if (previous === undefined) delete process.env.NEXTGUIDE_DATA_DIR
    else process.env.NEXTGUIDE_DATA_DIR = previous
  }
}))

test("mutations require a browser request from the same origin", () => {
  const makeReq = origin => ({ url: "https://docs.example.com/api/account", headers: { get: () => origin } })
  assert.equal(sameOrigin(makeReq("https://docs.example.com")), true)
  assert.equal(sameOrigin(makeReq("https://evil.example.com")), false)
  assert.equal(sameOrigin(makeReq(null)), false)
})
