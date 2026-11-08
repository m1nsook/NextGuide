/**
 * Signed v2 executable-release catalog verification (read-only).
 *
 * Protocol draft for private ngapi: an independent reviewer signs a complete
 * immutable GitHub Release, source revision, compiled byte hashes and capability
 * list. V1 signatures cannot be replayed as v2 approvals.
 *
 * This module deliberately does not install, grant, import or run executable
 * extensions. No private registry signing key is used by NextGuide sites.
 */
import { createHash, createPublicKey, verify as verifyEd25519 } from "node:crypto"

const MAX_ENVELOPE = 4 * 1024 * 1024
const MAX_BODY = 2 * 1024 * 1024
const MAX_RELEASES = 5_000
const MAX_AGE = 6 * 60 * 60 * 1000
const FUTURE_SKEW = 5 * 60 * 1000
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const GITHUB = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/?$/
const SHA256 = /^[a-f0-9]{64}$/
const SHA40 = /^[a-f0-9]{40}$/
const B64URL = /^[A-Za-z0-9_-]+$/
const CAPABILITIES = new Set([
  "docs.pages","mdx.blocks","ui.components","admin.pages","theme.tokens",
  "icons.packs","i18n.locales","ai.providers","auth.providers",
  "server.routes","server.jobs","storage.read","storage.write",
  "network.fetch","secrets.read",
])
const CATEGORIES = new Set([
  "content","theme","icons","language","ai","oauth",
  "integration","accessibility","other",
])
const manifestKeys = new Set([
  "$schema","schemaVersion","id","name","summary","description","version",
  "author","repository","license","category","keywords","compatibility",
  "permissions","entrypoints","icon",
])
const seenVerified = new WeakMap()
function fail(message) { throw Error("NextGuide v2 registry: " + message) }
function record(v) { return v !== null && typeof v === "object" && !Array.isArray(v) }
function limited(v, len) { return typeof v === "string" && v.length > 0 && v.length <= len }
function sha(v) { return createHash("sha256").update(v).digest("hex") }
function exactKeys(value, names) {
  return record(value) && Object.keys(value).every(x => names.has(x))
}
function keyIdentifier(key) {
  return sha(key.export({type:"spki",format:"der"})).slice(0,24)
}
function isoTime(value) {
  return typeof value === "string" &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
}
function semverNewer(a,b) {
  const aa=a.split(".").map(BigInt), bb=b.split(".").map(BigInt)
  for(let i=0;i<3;i++)if(aa[i]!==bb[i])return aa[i]>bb[i]
  return false
}
function stable(value) {
  if (Array.isArray(value)) return "["+value.map(stable).join(",")+"]"
  if (record(value)) return "{"+Object.keys(value).sort()
    .map(key=>JSON.stringify(key)+":"+stable(value[key])).join(",")+"}"
  return JSON.stringify(value)
}
export function validateV2Manifest(manifest) {
  if (!exactKeys(manifest,manifestKeys) || manifest.schemaVersion!==2 ||
      !ID.test(manifest.id) || manifest.id.length>100 ||
      !VERSION.test(manifest.version) ||
      !limited(manifest.name,80) || manifest.name.length<3 ||
      !GITHUB.test(manifest.repository) ||
      !CATEGORIES.has(manifest.category) ||
      !record(manifest.compatibility) ||
      Object.keys(manifest.compatibility).sort().join(",")!=="mode,nextguide" ||
      manifest.compatibility.mode!=="account" ||
      typeof manifest.compatibility.nextguide!=="string" ||
      !/^>=\d+\.\d+\.\d+\s+<\d+\.\d+\.\d+$/.test(manifest.compatibility.nextguide) ||
      !Array.isArray(manifest.permissions) ||
      manifest.permissions.length>16 ||
      manifest.permissions.some(p=>!CAPABILITIES.has(p)) ||
      new Set(manifest.permissions).size!==manifest.permissions.length ||
      !exactKeys(manifest.entrypoints,new Set(["server"])) ||
      manifest.entrypoints.server!=="dist/server.mjs") {
    fail("Invalid v2 Account Mode server manifest or capabilities")
  }
  if (manifest.$schema!==undefined && !limited(manifest.$schema,512)) fail("Invalid schema path")
  if (manifest.summary!==undefined && !limited(manifest.summary,160)) fail("Invalid summary")
  if (manifest.description!==undefined && !limited(manifest.description,2000)) fail("Invalid description")
  if (manifest.license!==undefined && !limited(manifest.license,80)) fail("Invalid license")
  if (manifest.author!==undefined &&
      (!exactKeys(manifest.author,new Set(["name","url"])) ||
       !limited(manifest.author.name,100))) fail("Invalid author")
  if (manifest.icon!==undefined &&
      (typeof manifest.icon!=="string" || manifest.icon.length>100 ||
       !/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.png$/.test(manifest.icon))) {
    fail("Invalid icon path")
  }
  if (manifest.keywords!==undefined &&
      (!Array.isArray(manifest.keywords) || manifest.keywords.length>12 ||
       new Set(manifest.keywords).size!==manifest.keywords.length ||
       manifest.keywords.some(p=>typeof p!=="string" || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(p)))) {
    fail("Invalid keywords")
  }
  return manifest
}
function validateRelease(release) {
  if (!record(release) || !record(release.manifest)) fail("Invalid release record")
  const m=validateV2Manifest(release.manifest)
  const owner=GITHUB.exec(m.repository)
  const tag="v"+m.version
  const assetUrl="https://github.com/"+owner[1]+"/"+owner[2]+
    "/releases/download/"+tag+"/nextguide-addon-v2-"+m.version+".tgz"
  if (release.assetUrl!==assetUrl || release.tag!==tag ||
      !SHA40.test(release.commit) ||
      !SHA256.test(release.digest) ||
      !Number.isSafeInteger(release.size) || release.size<32 ||
      release.size>3*1024*1024 ||
      !["active","revoked"].includes(release.status) ||
      !record(release.review) ||
      !exactKeys(release.review,new Set([
        "policy","reviewer","approvedAt","sourceCommit","sourcePath",
        "sourceSha256","serverSha256","manifestSha256","buildTool","format"
      ])) ||
      release.review.policy!=="independent-human" ||
      !limited(release.review.reviewer,100) ||
      !isoTime(release.review.approvedAt) ||
      release.review.sourceCommit!==release.commit ||
      !/^src\/server\.(?:ts|js|mjs)$/.test(release.review.sourcePath) ||
      !SHA256.test(release.review.sourceSha256) ||
      !SHA256.test(release.review.serverSha256) ||
      !SHA256.test(release.review.manifestSha256) ||
      release.review.buildTool!=="bun" ||
      release.review.format!=="nextguide-single-server-v2") {
    fail("Invalid v2 reviewed release metadata or immutable GitHub artifact")
  }
}
function validateSignedPayload(payload, now) {
  if (!record(payload) || payload.schemaVersion!==2 ||
      !isoTime(payload.updatedAt) || !isoTime(payload.expiresAt) ||
      !Array.isArray(payload.releases) || payload.releases.length>MAX_RELEASES) {
    fail("Invalid signed v2 payload")
  }
  const issued=Date.parse(payload.updatedAt), expires=Date.parse(payload.expiresAt)
  if (expires<=issued || expires-issued>MAX_AGE ||
      now<issued-FUTURE_SKEW || now>=expires) {
    fail("Signed v2 catalog is expired, future-dated or exceeds its lifetime")
  }
  const encountered=new Set()
  for (const release of payload.releases) {
    validateRelease(release)
    const key=release.manifest.id+"@"+release.manifest.version
    if (encountered.has(key)) fail("Duplicate v2 release")
    encountered.add(key)
  }
  return payload
}

/** Pinned-key Ed25519; freshness/revocation checked on EVERY verification. */
export function verifySignedV2RegistryEnvelope(envelope,pinnedPublicKeyPem,{now=Date.now()}={}) {
  if (!record(envelope) || envelope.schemaVersion!==2 ||
      envelope.algorithm!=="Ed25519" ||
      !limited(envelope.keyId,64) || !limited(envelope.body,MAX_ENVELOPE) ||
      !limited(envelope.signature,120) ||
      !B64URL.test(envelope.body) || !B64URL.test(envelope.signature) ||
      typeof pinnedPublicKeyPem!=="string" ||
      !Number.isFinite(now)) fail("Invalid signed v2 envelope or trusted key")
  let key
  try { key=createPublicKey(pinnedPublicKeyPem) }
  catch { fail("Invalid pinned v2 key") }
  if (key.asymmetricKeyType!=="ed25519" ||
      envelope.keyId!==keyIdentifier(key)) fail("Untrusted v2 signing key")
  const body=Buffer.from(envelope.body,"base64url")
  const sig=Buffer.from(envelope.signature,"base64url")
  if (body.length>MAX_BODY || sig.length!==64 ||
      body.toString("base64url")!==envelope.body ||
      sig.toString("base64url")!==envelope.signature ||
      !verifyEd25519(null,body,key,sig)) fail("V2 Ed25519 signature verification failed")
  let payload
  try { payload=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(body)) }
  catch { fail("Invalid signed v2 JSON") }
  validateSignedPayload(payload,now)
  seenVerified.set(payload,sha(stable(payload)))
  return payload
}
export function listReviewedV2Releases(payload,{now=Date.now()}={}) {
  if (!record(payload) || seenVerified.get(payload)!==sha(stable(payload))) {
    fail("V2 catalog is not authenticated or was modified")
  }
  validateSignedPayload(payload,now)
  const selected=new Map()
  for(const release of payload.releases){
    if(release.status!=="active")continue
    const prev=selected.get(release.manifest.id)
    if(!prev || semverNewer(release.manifest.version,prev.manifest.version)) {
      selected.set(release.manifest.id,release)
    }
  }
  return [...selected.values()].map(r=>JSON.parse(JSON.stringify(r)))
}
/** Presentation-only diff. Grants still require trusted site owner consent. */
export function compareV2Permissions(previous,next,approved=[]) {
  if (![previous,next,approved].every(Array.isArray) ||
      [...previous,...next,...approved].some(x=>!CAPABILITIES.has(x)) ||
      [previous,next,approved].some(x=>new Set(x).size!==x.length)) {
    fail("Invalid permission comparison")
  }
  const old=new Set(previous), now=new Set(next), grants=new Set(approved)
  const added=next.filter(x=>!old.has(x))
  const removed=previous.filter(x=>!now.has(x))
  const ungranted=next.filter(x=>!grants.has(x))
  return {added,removed,ungranted,requiresOwnerApproval:ungranted.length>0}
}
export function createVerifiedV2RegistryClient({registryUrl,pinnedPublicKeyPem,fetchImpl=fetch,now=()=>Date.now()}={}) {
  let url
  try { url=new URL(registryUrl) } catch { fail("Invalid v2 registry URL") }
  if (url.protocol!=="https:" || url.username || url.password ||
      url.search || url.hash || url.pathname!=="/v2/registry" ||
      url.port || typeof pinnedPublicKeyPem!=="string" || !pinnedPublicKeyPem) {
    fail("A pinned-key HTTPS /v2/registry is required")
  }
  return {
    async fetchSignedEnvelope() {
      const response=await fetchImpl(url.toString(),{
        method:"GET",redirect:"error",cache:"no-store",
        signal:AbortSignal.timeout(8000),
        headers:{Accept:"application/json"}
      })
      if (!response.ok || !response.body) fail("V2 registry HTTP request failed")
      const stated=response.headers.get("content-length")
      if (stated!==null && (!/^\d+$/.test(stated) ||
          Number(stated)>MAX_ENVELOPE)) fail("Oversized v2 catalog response")
      const chunks=[]
      let total=0
      for await(const part of response.body){
        total+=part.length
        if(total>MAX_ENVELOPE)fail("Oversized v2 catalog response")
        chunks.push(Buffer.from(part))
      }
      let envelope
      try { envelope=JSON.parse(Buffer.concat(chunks).toString("utf8")) }
      catch { fail("Invalid v2 catalog response JSON") }
      verifySignedV2RegistryEnvelope(envelope,pinnedPublicKeyPem,{now:now()})
      return envelope
    },
    async fetchVerified(){
      return verifySignedV2RegistryEnvelope(
        await this.fetchSignedEnvelope(),pinnedPublicKeyPem,{now:now()})
    },
    async listReviewed(){
      return listReviewedV2Releases(await this.fetchVerified(),{now:now()})
    },
  }
}
