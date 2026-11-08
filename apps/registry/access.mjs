import { createPublicKey, verify as verifySignature } from "node:crypto"

// Verify signed Cloudflare Access identity, not the presence of an HTTP header.
// The signing keys rotate; always retrieve and cache the team's published JWK set.
const MAX_ASSERTION_LENGTH = 16384
const KEY_CACHE_MS = 5 * 60 * 1000
const UNKNOWN_KEY_RETRY_MS = 30 * 1000

function decodeJson(segment) {
  if (typeof segment !== "string" || !/^[A-Za-z0-9_-]{1,12000}$/.test(segment)) return null
  try { return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) }
  catch { return null }
}

export function createCloudflareAccessVerifier({ teamDomain, audience, fetchImpl = fetch, now = Date.now }) {
  if (typeof teamDomain !== "string" ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(teamDomain)) {
    throw Error("NG_CF_ACCESS_TEAM_DOMAIN must be a Cloudflare Access team hostname")
  }
  if (typeof audience !== "string" || !/^[0-9a-f]{64}$/.test(audience)) {
    throw Error("NG_CF_ACCESS_AUD must be the 64-character Cloudflare Access application AUD")
  }
  const issuer = "https://" + teamDomain
  const certificates = issuer + "/cdn-cgi/access/certs"
  let cachedKeys = null, cachedAt = 0, refreshPromise = null, lastUnknownKeyRefresh = 0

  async function fetchKeys(force = false) {
    const current = now()
    if (!force && cachedKeys && current - cachedAt < KEY_CACHE_MS) return cachedKeys
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const response = await fetchImpl(certificates, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(5000)
        })
        if (!response.ok) throw Error("Could not fetch Cloudflare Access keys")
        const document = await response.json()
        if (!Array.isArray(document.keys) || document.keys.length === 0 || document.keys.length > 12) {
          throw Error("Invalid Cloudflare Access key set")
        }
        const keys = new Map()
        for (const key of document.keys) {
          if (key && key.kty === "RSA" && typeof key.kid === "string" &&
              /^[a-zA-Z0-9._-]{1,160}$/.test(key.kid) &&
              (!key.alg || key.alg === "RS256") && (!key.use || key.use === "sig")) {
            keys.set(key.kid, createPublicKey({ key, format: "jwk" }))
          }
        }
        if (!keys.size) throw Error("Cloudflare Access has no usable RSA keys")
        cachedKeys = keys
        cachedAt = now()
        return keys
      })().finally(() => { refreshPromise = null })
    }
    return await refreshPromise
  }

  return async function verifyCloudflareAccess(req) {
    try {
      const jwt = req.headers?.["cf-access-jwt-assertion"]
      if (typeof jwt !== "string" || jwt.length > MAX_ASSERTION_LENGTH) return false
      const segments = jwt.split(".")
      if (segments.length !== 3 || !segments.every(s => /^[A-Za-z0-9_-]+$/.test(s))) return false
      const [protectedHeader, claims, signature] = segments
      const header = decodeJson(protectedHeader), payload = decodeJson(claims)
      if (!header || !payload || typeof header !== "object" || typeof payload !== "object" ||
          Array.isArray(header) || Array.isArray(payload)) return false
      if (header.alg !== "RS256" || typeof header.kid !== "string" ||
          !/^[a-zA-Z0-9._-]{1,160}$/.test(header.kid)) return false
      const seconds = Math.floor(now() / 1000)
      if (payload.iss !== issuer ||
          !(payload.aud === audience || (Array.isArray(payload.aud) && payload.aud.includes(audience))) ||
          !Number.isSafeInteger(payload.exp) || payload.exp <= seconds ||
          (payload.nbf !== undefined && (!Number.isSafeInteger(payload.nbf) || payload.nbf > seconds)) ||
          (payload.iat !== undefined && (!Number.isSafeInteger(payload.iat) || payload.iat > seconds + 60))) return false
      let keys = await fetchKeys()
      let key = keys.get(header.kid)
      if (!key && now() - lastUnknownKeyRefresh > UNKNOWN_KEY_RETRY_MS) {
        lastUnknownKeyRefresh = now()
        keys = await fetchKeys(true)
        key = keys.get(header.kid)
      }
      if (!key) return false
      return verifySignature("RSA-SHA256", Buffer.from(protectedHeader + "." + claims), key,
        Buffer.from(signature, "base64url"))
    } catch {
      return false
    }
  }
}
