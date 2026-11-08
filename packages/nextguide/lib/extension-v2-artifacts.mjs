/**
 * Read-only byte verifier for reviewed NextGuide executable v2 archives.
 *
 * Requires a fresh Ed25519-signed private ngapi v2 release approval. Confirms
 * exact GitHub asset digest and immutable independently reviewed source, build
 * and capability metadata before returning bytes in memory.
 *
 * No path extraction, no import(), no code execution, no permission grants.
 */
import { createHash } from "node:crypto"
import { gunzipSync } from "node:zlib"
import { verifySignedV2RegistryEnvelope } from "./extension-v2-catalog.mjs"

const MAX_ARCHIVE=3*1024*1024
const MAX_TAR=3*1024*1024
const MAX_MEMBER=1024*1024
const MAX_SOURCE=512*1024
const MAX_MEMBERS=5
const HASH=/^[a-f0-9]{64}$/
const PATH=/^[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*$/
const PNG=Buffer.from([137,80,78,71,13,10,26,10])
const RECORD_KEYS=new Set(["path","size","sha256"])
const INDEX_KEYS=new Set([
  "schemaVersion","format","manifest","source","server","icon","permissions"
])
function fail(message){throw Error("NextGuide v2 artifact: "+message)}
function record(v){return v!==null && typeof v==="object" && !Array.isArray(v)}
function sha(bytes){return createHash("sha256").update(bytes).digest("hex")}
function utf8(bytes,label){
  try {return new TextDecoder("utf-8",{fatal:true}).decode(bytes)}
  catch {fail("Invalid UTF-8 in "+label)}
}
function parse(bytes,label){
  let obj
  try {obj=JSON.parse(utf8(bytes,label))}
  catch {fail("Invalid JSON in "+label)}
  if(!record(obj))fail(label+" must be a JSON object")
  return obj
}
function stable(value){
  if(Array.isArray(value))return "["+value.map(stable).join(",")+"]"
  if(record(value))return "{"+Object.keys(value).sort()
    .map(key=>JSON.stringify(key)+":"+stable(value[key])).join(",")+"}"
  return JSON.stringify(value)
}
function safePath(path){
  return typeof path==="string" && path.length<=100 &&
    PATH.test(path) && path.split("/").every(x=>
      x!=="." && x!==".." && !x.startsWith(".") && !x.endsWith("."))
}
function octal(bytes){
  const raw=bytes.toString("ascii").replace(/\0.*$/,"").trim()
  if(!/^[0-7]+$/.test(raw))fail("Malformed octal tar field")
  const n=Number.parseInt(raw,8)
  if(!Number.isSafeInteger(n))fail("Oversized tar number")
  return n
}
function archiveFiles(archive){
  if(!(archive instanceof Uint8Array) || archive.length<32 ||
      archive.length>MAX_ARCHIVE || archive[0]!==0x1f || archive[1]!==0x8b){
    fail("Expected bounded gzip archive")
  }
  let tar
  try{tar=gunzipSync(archive,{maxOutputLength:MAX_TAR})}
  catch{fail("Corrupt gzip or decompression quota exceeded")}
  const files=new Map()
  let offset=0,closed=false
  while(offset+512<=tar.length){
    const header=tar.subarray(offset,offset+512)
    if(header.every(x=>x===0)){
      if(tar.length-offset<1024 ||
          tar.subarray(offset).some(x=>x!==0))fail("Invalid tar terminator")
      closed=true
      break
    }
    if(header.subarray(257,263).toString("ascii")!=="ustar\0" ||
        header.subarray(263,265).toString("ascii")!=="00" ||
        header[156]!==48 ||
        header.subarray(345,500).some(x=>x!==0)) {
      fail("Only regular ustar files are supported (no links or extensions)")
    }
    const chksum=Buffer.from(header)
    chksum.fill(32,148,156)
    if(chksum.reduce((a,b)=>a+b,0)!==octal(header.subarray(148,156))) {
      fail("Tar header checksum changed")
    }
    const pathEnd=header.subarray(0,100).indexOf(0)
    const name=utf8(header.subarray(0,pathEnd<0?100:pathEnd),"tar path")
    if(!safePath(name) || files.has(name.toLowerCase()))fail("Unsafe or colliding tar path")
    const size=octal(header.subarray(124,136))
    const start=offset+512,finish=start+size
    const next=start+Math.ceil(size/512)*512
    if(size<1 || size>MAX_MEMBER || next>tar.length ||
        tar.subarray(finish,next).some(x=>x!==0))fail("Invalid archive member size or padding")
    files.set(name.toLowerCase(),{name,bytes:Buffer.from(tar.subarray(start,finish))})
    if(files.size>MAX_MEMBERS)fail("Too many executable archive members")
    offset=next
  }
  if(!closed)fail("Tar end-of-archive blocks missing")
  return files
}
function checkedFile(files,ref,label,maxSize){
  if(!record(ref) || Object.keys(ref).sort().join(",")!=="path,sha256,size" ||
      !safePath(ref.path) || !HASH.test(ref.sha256) ||
      !Number.isSafeInteger(ref.size) || ref.size<1 || ref.size>maxSize) {
    fail("Invalid "+label+" integrity record")
  }
  const found=files.get(ref.path.toLowerCase())
  if(!found || found.name!==ref.path || found.bytes.length!==ref.size ||
      sha(found.bytes)!==ref.sha256)fail("Reviewed "+label+" digest/size mismatch")
  return found.bytes
}
function checkedIndex(files,release){
  const indexMember=files.get("nextguide-integrity.json")
  const manifestMember=files.get("nextguide-addon.json")
  if(!indexMember || !manifestMember)fail("Missing v2 manifest or integrity index")
  const index=parse(indexMember.bytes,"nextguide-integrity.json")
  if(!Object.keys(index).every(x=>INDEX_KEYS.has(x)) ||
      index.schemaVersion!==2 ||
      index.format!=="nextguide-single-server-v2" ||
      !Array.isArray(index.permissions) ||
      stable(index.permissions)!==stable(release.manifest.permissions) ||
      !record(index.source) ||
      index.source.path!==release.review.sourcePath ||
      !record(index.server) || index.server.path!=="dist/server.mjs" ||
      !record(index.manifest) || index.manifest.path!=="nextguide-addon.json"){
    fail("Unapproved v2 integrity descriptor or permissions")
  }
  const manifestBytes=checkedFile(files,index.manifest,"manifest",65536)
  const sourceBytes=checkedFile(files,index.source,"source",MAX_SOURCE)
  const serverBytes=checkedFile(files,index.server,"server",MAX_MEMBER)
  if(sha(manifestBytes)!==release.review.manifestSha256 ||
      sha(sourceBytes)!==release.review.sourceSha256 ||
      sha(serverBytes)!==release.review.serverSha256) {
    fail("Reviewed v2 source/bundle attestations do not match the archive")
  }
  const manifest=parse(manifestBytes,"nextguide-addon.json")
  if(stable(manifest)!==stable(release.manifest))fail("Archive manifest differs from signed v2 release")
  const names=[
    "nextguide-integrity.json","nextguide-addon.json",
    index.source.path,"dist/server.mjs"
  ]
  if(manifest.icon!==undefined){
    names.push(manifest.icon)
    if(!record(index.icon) || index.icon.path!==manifest.icon){
      fail("Icon integrity record missing or inconsistent")
    }
    const icon=checkedFile(files,index.icon,"PNG icon",256*1024)
    if(icon.length<45 || !icon.subarray(0,8).equals(PNG) ||
        icon.subarray(12,16).toString("ascii")!=="IHDR" ||
        icon.readUInt32BE(8)!==13 ||
        icon.readUInt32BE(16)<32 || icon.readUInt32BE(20)<32 ||
        icon.readUInt32BE(16)>1024 || icon.readUInt32BE(20)>1024){
      fail("Invalid reviewed PNG icon")
    }
  } else if(index.icon!==undefined)fail("Unexpected unsigned icon")
  if(files.size!==names.length ||
      new Set(names.map(x=>x.toLowerCase())).size!==names.length ||
      names.some(x=>!files.has(x.toLowerCase()))) {
    fail("Executable archive contains unreviewed or duplicate members")
  }
  const code=utf8(serverBytes,"compiled server")
  // Only data is returned. Callers must still enforce grants and OS sandboxing.
  return {
    manifest:JSON.parse(JSON.stringify(manifest)),
    archiveSha256:release.digest,
    source:{path:index.source.path,sha256:index.source.sha256,
      text:utf8(sourceBytes,"reviewable source")},
    compiled:{path:"dist/server.mjs",sha256:index.server.sha256,code},
    review:JSON.parse(JSON.stringify(release.review)),
  }
}

/**
 * Verifies the exact release from the signed, expiry-bound v2 catalog.
 * An active release remains non-executable until an independently approved
 * installed-site permission grant and actual secure OS sandbox exist.
 */
export function verifyReviewedV2Archive({
  envelope,pinnedPublicKeyPem,id,version,archive,now=Date.now(),
}={}){
  const catalog=verifySignedV2RegistryEnvelope(envelope,pinnedPublicKeyPem,{now})
  const release=catalog.releases.find(r=>
    r.manifest.id===id && r.manifest.version===version)
  if(!release || release.status!=="active")fail("V2 release is missing or revoked")
  if(!(archive instanceof Uint8Array) ||
      archive.byteLength!==release.size ||
      sha(archive)!==release.digest){
    fail("Archive SHA-256 or size differs from signed v2 review")
  }
  const content=checkedIndex(archiveFiles(archive),release)
  return {...content,id,version}
}
