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
  const site = join(root, "site")
  assert.throws(() => accountFile(site, join(site, "public")), /must point outside/)
  const { token, file } = createBootstrap(site, { dataDir: directory })
  assert.equal(file, accountFile(site, directory))
  if (process.platform !== "win32") assert.equal(statSync(file).mode & 0o777, 0o600)
  assert.throws(() => createBootstrap(site, { dataDir: directory }), /already initialized/)
  // The runtime and CLI share the same data directory.
  const previous = process.env.NEXTGUIDE_DATA_DIR
  process.env.NEXTGUIDE_DATA_DIR = directory
  try {
    assert.deepEqual(accountStatus(site), { initialized: false, authenticated: false })
    await assert.rejects(beginEnrollment(site, "wrong", { qr: async () => "qr" }), /Invalid setup token/)
    const rotation = rotateBootstrap(site)
    assert.notEqual(rotation.token, token)
    await assert.rejects(beginEnrollment(site, token, { qr: async uri => uri }), /Invalid setup token/)
    const newToken = rotation.token
    const first = await beginEnrollment(site, newToken, { qr: async uri => uri })
    assert.ok(first.manualKey.length >= 32)
    assert.match(first.qrDataUrl, /^otpauth:\/\/totp\//)
    const now = Date.now()
    const secret = JSON.parse(readFileSync(file, "utf8")).pending.secret
    const firstCode = totp(secret, now)
    const invalidCode = firstCode === "000000" ? "000001" : "000000"
    assert.throws(() => finishEnrollment(site, newToken, invalidCode, now), /Invalid authenticator code/)
    const complete = finishEnrollment(site, newToken, firstCode, now)
    assert.equal(complete.recoveryCodes.length, 10)
    assert.equal(verifySession(site, complete.session), true)
    assert.equal(accountStatus(site).initialized, true)
    assert.throws(() => rotateBootstrap(site), /already registered/)
    assert.throws(() => finishEnrollment(site, token, firstCode, now), /already been registered/)
    assert.throws(() => signIn(site, firstCode, now), /already-used code/)
    const other = signIn(site, totp(secret, now + 30_000), now + 30_000)
    assert.equal(verifySession(site, other.session), true)
    signOut(site, other.session)
    assert.equal(verifySession(site, other.session), false)
    const backup = signIn(site, complete.recoveryCodes[0], now + 31_000)
    assert.equal(backup.usedRecovery, true)
    assert.throws(() => signIn(site, complete.recoveryCodes[0], now + 32_000), /already-used code/)
    const authenticatorRotation = await beginAuthenticatorRotation(site, backup.session, totp(secret, now + 60_000), {
      time: now + 60_000, qr: async uri => uri,
    })
    assert.match(authenticatorRotation.qrDataUrl, /^otpauth:\/\/totp\//)
    assert.notEqual(authenticatorRotation.manualKey, secret)
    const refreshed = finishAuthenticatorRotation(site, backup.session, totp(authenticatorRotation.manualKey, now + 60_000), now + 60_000)
    assert.equal(refreshed.recoveryCodes.length, 10)
    assert.equal(verifySession(site, backup.session), false)
    assert.equal(verifySession(site, refreshed.session), true)
    assert.throws(() => signIn(site, totp(secret, now + 90_000), now + 90_000), /already-used code|Invalid/)
    const newCodes = renewRecoveryCodes(site, refreshed.session, totp(authenticatorRotation.manualKey, now + 90_000), now + 90_000)
    assert.equal(newCodes.recoveryCodes.length, 10)
    assert.throws(() => signIn(site, refreshed.recoveryCodes[0], now + 91_000), /already-used code/)
    assert.equal(revokeAllSessions(site, refreshed.session).ok, true)
    assert.equal(verifySession(site, refreshed.session), false)
  } finally {
    if (previous === undefined) delete process.env.NEXTGUIDE_DATA_DIR
    else process.env.NEXTGUIDE_DATA_DIR = previous
  }
}))

test("rate limit persists across login requests", () => fixture(async root => {
  const site = join(root, "site")
  const previous = process.env.NEXTGUIDE_DATA_DIR
  process.env.NEXTGUIDE_DATA_DIR = join(root, "account")
  try {
    const { token } = createBootstrap(site)
    const now = Date.now()
    const enrollment = await beginEnrollment(site, token, { time: now, qr: async () => "" })
    const { session } = finishEnrollment(site, token, totp(enrollment.manualKey, now), now)
    assert.equal(verifySession(site, session), true)
    for (let i = 0; i < 5; i++) assert.throws(() => signIn(site, "bad", now + 1), /Invalid or already-used/)
    assert.throws(() => signIn(site, "bad", now + 1), /Too many attempts/)
    const ok = signIn(site, totp(enrollment.manualKey, now + 120_000), now + 120_000)
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
