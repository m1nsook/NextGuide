import test from "node:test"
import assert from "node:assert/strict"
import { generateKeyPairSync, sign } from "node:crypto"
import { createCloudflareAccessVerifier } from "../access.mjs"

const domain = "test-team.cloudflareaccess.com"
const audience = "a".repeat(64)
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 })
const jwk = { ...keys.publicKey.export({ format: "jwk" }), kid: "testkey", alg: "RS256", use: "sig" }
const now = 1800000000000, seconds = Math.floor(now / 1000)

function token(override = {}, pair = keys, headerOverride = {}) {
  const header = { alg: "RS256", kid: "testkey", typ: "JWT", ...headerOverride }
  const payload = { iss: "https://" + domain, aud: [audience], exp: seconds + 3600,
    iat: seconds - 60, sub: "owner", ...override }
  const value = [header, payload].map(x => Buffer.from(JSON.stringify(x)).toString("base64url")).join(".")
  return value + "." + sign("RSA-SHA256", Buffer.from(value), pair.privateKey).toString("base64url")
}
const req = value => ({ headers: { "cf-access-jwt-assertion": value } })
const fakeFetch = async url => {
  assert.equal(url, "https://" + domain + "/cdn-cgi/access/certs")
  return { ok: true, json: async () => ({ keys: [jwk] }) }
}

test("accepts only signed Access assertions for the configured application", async () => {
  const verify = createCloudflareAccessVerifier({
    teamDomain: domain, audience, fetchImpl: fakeFetch, now: () => now
  })
  assert.equal(await verify(req(token())), true)
  assert.equal(await verify(req(token({ aud: ["other-application"] }))), false)
  assert.equal(await verify(req(token({ iss: "https://different.cloudflareaccess.com" }))), false)
  assert.equal(await verify(req(token({ exp: seconds - 1 }))), false)
  assert.equal(await verify(req(token({ nbf: seconds + 60 }))), false)
  assert.equal(await verify(req(token({}, keys, { alg: "none" }))), false)
  assert.equal(await verify(req(token({}, generateKeyPairSync("rsa", { modulusLength: 2048 })))), false)
  assert.equal(await verify(req(token().slice(0, -3) + "abc")), false)
  assert.equal(await verify(req("garbage")), false)
  assert.equal(await verify({ headers: {} }), false)
})

test("denies access if Cloudflare signing keys cannot be fetched", async () => {
  const verify = createCloudflareAccessVerifier({ teamDomain: domain, audience,
    fetchImpl: async () => { throw Error("offline") }, now: () => now })
  assert.equal(await verify(req(token())), false)
})

test("rejects unsafe verifier configuration", () => {
  assert.throws(() => createCloudflareAccessVerifier({teamDomain:"evil.com",audience}), /team hostname/)
  assert.throws(() => createCloudflareAccessVerifier({teamDomain:domain,audience:"short"}), /64-character/)
})
