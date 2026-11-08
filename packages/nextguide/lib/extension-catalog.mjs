/**
 * Signed, read-only NextGuide registry catalog. Node-only.
 *
 * The trusted public key MUST come from the installed NextGuide configuration,
 * not from the same registry response being verified. This client never
 * executes downloaded code or installs artifacts.
 */
import { createPublicKey, createHash, verify } from "node:crypto"

const MAX_ENVELOPE = 4 * 1024 * 1024
const MAX_BODY = 2 * 1024 * 1024
const MAX_RELEASES = 20000
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const HEX64 = /^[a-f0-9]{64}$/
const HEX40 = /^[a-f0-9]{40}$/
const BASE64URL = /^[A-Za-z0-9_-]+$/
const REPO = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/?$/
const verifiedPayloads = new WeakMap()

function fail(message) { throw Error("NextGuide signed registry: " + message) }
function record(value) { return value !== null && typeof value === "object" && !Array.isArray(value) }
function safeString(value, max = 1024) { return typeof value === "string" && value.length > 0 && value.length <= max }
function keyId(publicKey) {
  return createHash("sha256").update(publicKey.export({ type: "spki", format: "der" }))
    .digest("hex").slice(0, 24)
}

function validatePayload(payload) {
  if (!record(payload) || payload.schemaVersion !== 1 ||
      !Array.isArray(payload.releases) || payload.releases.length > MAX_RELEASES ||
      !Number.isFinite(Date.parse(payload.updatedAt))) fail("Invalid index structure")
  const seen = new Set()
  for (const [index, release] of payload.releases.entries()) {
    if (!record(release) || !record(release.manifest)) fail("Invalid release " + index)
    const m = release.manifest
    if (m.schemaVersion !== 1 || !ID.test(m.id) || !VERSION.test(m.version) ||
        !safeString(m.name, 80) || m.category !== "content" ||
        !record(m.compatibility) || m.compatibility.mode !== "account" ||
        !Array.isArray(m.permissions) || m.permissions.length !== 0) fail("Invalid release manifest")
    const owner = REPO.exec(m.repository || "")
    if (!owner || !safeString(release.assetUrl, 500)) fail("Invalid source repository")
    let url
    try { url = new URL(release.assetUrl) } catch { fail("Invalid release asset URL") }
    const tag = "v" + m.version
    const prefix = "/" + owner[1] + "/" + owner[2] + "/releases/download/" + tag + "/"
    if (url.protocol !== "https:" || url.hostname !== "github.com" ||
        url.username || url.password || url.search || url.hash ||
        !url.pathname.startsWith(prefix) ||
        !/^nextguide-addon-\d+\.\d+\.\d+\.tgz$/.test(url.pathname.slice(prefix.length)) ||
        url.pathname.slice(prefix.length) !== "nextguide-addon-" + m.version + ".tgz") fail("Invalid release artifact")
    if (release.tag !== tag || !HEX40.test(release.commit) || !HEX64.test(release.digest) ||
        !Number.isInteger(release.size) || release.size < 32 || release.size > 3 * 1024 * 1024 ||
        !["active", "revoked"].includes(release.status) ||
        !safeString(release.reviewer, 100) ||
        !Number.isFinite(Date.parse(release.approvedAt))) fail("Invalid release metadata")
    const unique = m.id + "@" + m.version
    if (seen.has(unique)) fail("Duplicate release")
    seen.add(unique)
  }
  return payload
}

export function verifySignedRegistryEnvelope(envelope, pinnedPublicKeyPem) {
  if (!record(envelope) || envelope.schemaVersion !== 1 ||
      envelope.algorithm !== "Ed25519" ||
      !safeString(envelope.keyId, 64) ||
      !safeString(envelope.body, MAX_ENVELOPE) ||
      !safeString(envelope.signature, 120) ||
      !BASE64URL.test(envelope.body) ||
      !BASE64URL.test(envelope.signature)) fail("Invalid signature envelope")
  const publicKey = createPublicKey(pinnedPublicKeyPem)
  if (publicKey.asymmetricKeyType !== "ed25519" || envelope.keyId !== keyId(publicKey)) {
    fail("Untrusted registry signing key")
  }
  const body = Buffer.from(envelope.body, "base64url")
  const signature = Buffer.from(envelope.signature, "base64url")
  if (body.length > MAX_BODY || signature.length !== 64 ||
      !verify(null, body, publicKey, signature)) fail("Registry signature verification failed")
  let payload
  try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) }
  catch { fail("Invalid registry payload encoding") }
  const verified = validatePayload(payload)
  verifiedPayloads.set(verified, createHash("sha256").update(JSON.stringify(verified)).digest("hex"))
  return verified
}

/** Latest active v1 releases, with revocations excluded from NEW installs. */
export function listVerifiedAddons(payload) {
  const expectedHash = record(payload) ? verifiedPayloads.get(payload) : null
  if (!expectedHash || createHash("sha256").update(JSON.stringify(payload)).digest("hex") !== expectedHash) {
    fail("Catalog was not verified or was modified after verification")
  }
  const checked = validatePayload(payload)
  const latest = new Map()
  function newer(a, b) {
    const x = a.split(".").map(BigInt), y = b.split(".").map(BigInt)
    for (let i = 0; i < 3; i++) {
      if (x[i] !== y[i]) return x[i] > y[i]
    }
    return false
  }
  for (const release of checked.releases) {
    if (release.status !== "active") continue
    const id = release.manifest.id
    const prev = latest.get(id)
    if (!prev || newer(release.manifest.version, prev.manifest.version)) latest.set(id, release)
  }
  return [...latest.values()].map(release => JSON.parse(JSON.stringify(release)))
}

/** Fetches the signed index without redirects and fails closed on invalid data. */
export function createVerifiedRegistryClient({ registryUrl, pinnedPublicKeyPem, fetchImpl = fetch }) {
  let url
  try { url = new URL(registryUrl) } catch { fail("Invalid HTTPS registry URL") }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      url.pathname !== "/v1/registry") fail("Expected an HTTPS /v1/registry URL")
  if (!pinnedPublicKeyPem) fail("Pinned registry public key is required")
  // Validate the configured signing key before attempting any network call.
  const publicKey = createPublicKey(pinnedPublicKeyPem)
  if (publicKey.asymmetricKeyType !== "ed25519") fail("Pinned key must be Ed25519")
  return {
    async fetchVerified() {
      const response = await fetchImpl(url.toString(), {
        method: "GET", redirect: "error", cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" }
      })
      if (!response.ok) fail("Registry HTTP " + response.status)
      if (Number(response.headers.get("content-length") || "0") > MAX_ENVELOPE) fail("Index too large")
      if (!response.body) fail("Registry response has no body")
      const chunks = []
      let bytes = 0
      for await (const chunk of response.body) {
        bytes += chunk.length
        if (bytes > MAX_ENVELOPE) {
          await response.body.cancel().catch(() => {})
          fail("Index too large")
        }
        chunks.push(Buffer.from(chunk))
      }
      let envelope
      try { envelope = JSON.parse(Buffer.concat(chunks).toString("utf8")) }
      catch { fail("Invalid registry response JSON") }
      return verifySignedRegistryEnvelope(envelope, pinnedPublicKeyPem)
    },
    async listApproved() {
      return listVerifiedAddons(await this.fetchVerified())
    }
  }
}
