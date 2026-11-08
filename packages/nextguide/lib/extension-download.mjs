/**
 * Strict, read-only downloader for signed, reviewed GitHub Release artifacts.
 *
 * This is host-side Node code, not an add-on network capability. The target
 * URL comes only from a verified signed registry release. GitHub's asset
 * redirects are permitted only to selected public GitHub CDN hostnames,
 * after public IPv4 DNS validation with per-socket IP pinning and TLS checks.
 * No credentials, proxy, arbitrary redirect or executable package support.
 */
import { lookup as dnsLookup } from "node:dns/promises"
import { request as httpsRequest } from "node:https"
import { verifySignedRegistryEnvelope } from "./extension-catalog.mjs"
import { verifyApprovedContentArchive } from "./extension-artifacts.mjs"
import { verifySignedV2RegistryEnvelope } from "./extension-v2-catalog.mjs"
import { verifyReviewedV2Archive } from "./extension-v2-artifacts.mjs"
import { isPublicExtensionIPv4 } from "./extension-network.mjs"

const MAX_BYTES = 3 * 1024 * 1024
const MAX_REDIRECTS = 3
const CDN = new Set([
  "release-assets.githubusercontent.com",
  "objects.githubusercontent.com",
  "github-releases.githubusercontent.com",
])
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

function fail(code, message) {
  const error = new Error("NextGuide release download: " + message)
  error.code = code
  throw error
}
function safeUrl(value, firstUrl, redirected) {
  let url
  try { url = new URL(value) }
  catch { fail("INVALID_URL", "Invalid reviewed release URL") }
  if (url.protocol !== "https:" || url.port || url.username || url.password ||
      url.hash || url.pathname.length > 4096 || url.search.length > 8192 ||
      !/^[a-z0-9.-]+$/.test(url.hostname)) {
    fail("INVALID_URL", "Disallowed release URL")
  }
  if (!redirected && url.toString() !== firstUrl) fail("INVALID_URL", "Source URL differs from signed release")
  if (redirected ? !CDN.has(url.hostname) : url.hostname !== "github.com") {
    fail("INVALID_REDIRECT", "Release URL left the trusted GitHub asset hosts")
  }
  return url
}
function cancelled() { return Object.assign(new Error("Release request was cancelled"), { code: "ABORTED" }) }
function abortable(promise, signal) {
  if (signal.aborted) return Promise.reject(cancelled())
  return new Promise((resolve,reject) => {
    const onAbort = () => reject(cancelled())
    signal.addEventListener("abort",onAbort,{once:true})
    Promise.resolve(promise).then(value => {
      signal.removeEventListener("abort",onAbort);resolve(value)
    },reason => {
      signal.removeEventListener("abort",onAbort);reject(reason)
    })
  })
}
async function pinnedGet(url, expectedSize, { resolver, transport, signal }) {
  const answers = await abortable(resolver(url.hostname, {
    family:4, all:true, verbatim:true
  }),signal)
  if (!Array.isArray(answers) || answers.length < 1 || answers.length > 32 ||
      answers.some(a => !a || a.family !== 4 || !isPublicExtensionIPv4(a.address))) {
    fail("UNSAFE_DNS", "GitHub asset DNS returned an unsafe address")
  }
  if (signal.aborted) throw cancelled()
  const address = answers[0].address
  return await new Promise((resolve,reject) => {
    let finished = false
    let response
    let req
    function finish(error, result) {
      if (finished) return
      finished = true
      signal.removeEventListener("abort",onAbort)
      if (error) reject(error)
      else resolve(result)
    }
    function onAbort() {
      try { req?.destroy?.() } catch { /* ignore */ }
      try { response?.destroy?.() } catch { /* ignore */ }
      finish(cancelled())
    }
    signal.addEventListener("abort",onAbort,{once:true})
    if (signal.aborted) { onAbort(); return }
    const options = {
      protocol:"https:", hostname:url.hostname, servername:url.hostname,
      port:443, path:url.pathname + url.search, method:"GET",
      agent:false, autoSelectFamily:false, family:4, rejectUnauthorized:true,
      signal,
      lookup(_name,_opts,callback) { callback(null,address,4) },
      headers: { accept:"application/octet-stream", "accept-encoding":"identity" },
    }
    try {
      req=transport(options, incoming => {
        response=incoming
        const status=response.statusCode ?? 0
        const encoding=String(response.headers?.["content-encoding"] || "identity").toLowerCase()
        if (encoding !== "identity") {
          response.resume()
          finish(Object.assign(new Error("Compressed HTTP response refused"),{code:"INVALID_RESPONSE"}))
          return
        }
        if (status === 301 || status === 302 || status === 303 ||
            status === 307 || status === 308) {
          const location=response.headers?.location
          response.resume()
          if (typeof location !== "string" || location.length > 12000) {
            finish(Object.assign(new Error("Invalid asset redirect"),{code:"INVALID_REDIRECT"}))
          } else finish(null,{redirect:location})
          return
        }
        if (status !== 200) {
          response.resume()
          finish(Object.assign(new Error("Release server rejected request"),{code:"DOWNLOAD_FAILED"}))
          return
        }
        const size = response.headers?.["content-length"]
        if (size !== undefined && (!/^\d+$/.test(String(size)) ||
            Number(size) !== expectedSize)) {
          response.resume()
          finish(Object.assign(new Error("Release response size differs from signed metadata"),{code:"SIZE_MISMATCH"}))
          return
        }
        const chunks=[]
        let total=0
        response.on("error", () => finish(Object.assign(new Error("Release body failed"),{code:"DOWNLOAD_FAILED"})))
        response.on("data", part => {
          total += part.length
          if (total > expectedSize || total > MAX_BYTES) {
            try { response.destroy() } catch { /* ignore */ }
            finish(Object.assign(new Error("Release body exceeded signed size"),{code:"SIZE_MISMATCH"}))
          } else chunks.push(Buffer.from(part))
        })
        response.on("end", () => {
          if (total !== expectedSize) {
            finish(Object.assign(new Error("Incomplete signed release"),{code:"SIZE_MISMATCH"}))
          } else finish(null,{bytes:Buffer.concat(chunks)})
        })
      })
      req.on("error", () => finish(Object.assign(new Error("HTTPS release request failed"),{code:"DOWNLOAD_FAILED"})))
      req.end()
    } catch {
      finish(Object.assign(new Error("Could not open release request"),{code:"DOWNLOAD_FAILED"}))
    }
  })
}

/**
 * Returns verified bytes only. Caller must separately check installed package
 * compatibility, signed index freshness and owner consent before installation.
 */
export async function downloadVerifiedContentRelease({
  envelope, pinnedPublicKeyPem, id, version,
  resolver = dnsLookup, transport = httpsRequest,
  signal, timeoutMs = 15_000,
} = {}) {
  if (!ID.test(id) || !VERSION.test(version)) fail("INVALID_RELEASE", "Invalid release identity")
  if (typeof resolver !== "function" || typeof transport !== "function" ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    fail("CONFIGURATION", "Invalid trusted downloader configuration")
  }
  const payload = verifySignedRegistryEnvelope(envelope,pinnedPublicKeyPem)
  const release=payload.releases.find(x => x.manifest.id===id && x.manifest.version===version)
  if (!release || release.status !== "active" || release.manifest.schemaVersion !== 1 ||
      release.manifest.category !== "content" || release.manifest.permissions.length ||
      !Number.isInteger(release.size) || release.size<32 || release.size>MAX_BYTES) {
    fail("NOT_APPROVED", "No approved signed v1 release")
  }
  const first=release.assetUrl
  let current=safeUrl(first,first,false)
  const timer=AbortSignal.timeout(timeoutMs)
  const active=signal ? AbortSignal.any([signal,timer]) : timer
  for (let attempt=0; attempt<=MAX_REDIRECTS;attempt++) {
    if (active.aborted) throw cancelled()
    const result=await pinnedGet(current,release.size,{resolver,transport,signal:active})
    if (result.bytes) {
      // Re-verify archive signature, hash, content type and safe file members
      // even though the caller will do so again before changing local state.
      verifyApprovedContentArchive({envelope,pinnedPublicKeyPem,id,version,archive:result.bytes})
      return result.bytes
    }
    if (attempt===MAX_REDIRECTS) fail("INVALID_REDIRECT", "GitHub asset redirected too many times")
    // Only a GitHub-owned CDN, never arbitrary relative / cross-site redirects.
    current=safeUrl(result.redirect,first,true)
  }
  return fail("DOWNLOAD_FAILED", "Could not download reviewed artifact")
}


/**
 * V2 read-only review intake: downloads only an active, nonexpired, signed
 * release, enforces public IPv4 DNS/TLS/CDN confinement, and verifies every
 * executable/source byte. It DOES NOT install, grant permissions or run code.
 *
 * This is intentionally independent of the v1 Account Mode installer. The
 * private registry must serve a separately signed /v2/registry index before
 * any public v2 release can pass these checks.
 */
export async function downloadReviewedV2Release({
  envelope,pinnedPublicKeyPem,id,version,
  resolver=dnsLookup,transport=httpsRequest,
  signal,timeoutMs=15000,now=()=>Date.now(),
}={}){
  if(!ID.test(id) || !VERSION.test(version) ||
     typeof resolver!=="function" || typeof transport!=="function" ||
     !Number.isSafeInteger(timeoutMs) || timeoutMs<100 || timeoutMs>30000 ||
     typeof now!=="function" || !Number.isFinite(now())){
    fail("CONFIGURATION","Invalid v2 release request or trusted downloader options")
  }
  // Authenticate and check expiry BEFORE ANY DNS request or HTTPS fetch.
  const catalog=verifySignedV2RegistryEnvelope(envelope,pinnedPublicKeyPem,{now:now()})
  const release=catalog.releases.find(r=>
    r.manifest.id===id && r.manifest.version===version)
  if(!release || release.status!=="active" ||
     release.size<32 || release.size>MAX_BYTES){
    fail("NOT_APPROVED","No active, reviewed signed v2 release")
  }
  const first=release.assetUrl
  let current=safeUrl(first,first,false)
  const timer=AbortSignal.timeout(timeoutMs)
  const active=signal?AbortSignal.any([signal,timer]):timer
  for(let attempt=0;attempt<=MAX_REDIRECTS;attempt++){
    if(active.aborted)throw cancelled()
    const result=await pinnedGet(current,release.size,{resolver,transport,signal:active})
    if(result.bytes){
      // The v2 release key and archive/source/bundle digest are rechecked
      // before returning the original bytes for private storage/review.
      const verified=verifyReviewedV2Archive({
        envelope,pinnedPublicKeyPem,id,version,archive:result.bytes,
        now:now(),
      })
      return {archive:result.bytes,verified}
    }
    if(attempt===MAX_REDIRECTS)fail("INVALID_REDIRECT","GitHub asset redirected too many times")
    current=safeUrl(result.redirect,first,true)
  }
  return fail("DOWNLOAD_FAILED","Reviewed v2 release could not be downloaded")
}
