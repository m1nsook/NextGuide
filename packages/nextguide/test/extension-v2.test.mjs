import test from "node:test"
import assert from "node:assert/strict"
import { createHash, generateKeyPairSync, sign } from "node:crypto"
import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import { gzipSync } from "node:zlib"
import {
  verifySignedV2RegistryEnvelope, listReviewedV2Releases,
  compareV2Permissions, createVerifiedV2RegistryClient,
} from "../lib/extension-v2-catalog.mjs"
import { verifyReviewedV2Archive } from "../lib/extension-v2-artifacts.mjs"
import { downloadReviewedV2Release } from "../lib/extension-download.mjs"

const keys=generateKeyPairSync("ed25519")
const other=generateKeyPairSync("ed25519")
const pem=keys.publicKey.export({format:"pem",type:"spki"})
const keyId=createHash("sha256").update(
  keys.publicKey.export({format:"der",type:"spki"})).digest("hex").slice(0,24)
const NOW=Date.parse("2026-11-08T16:30:00Z")
const hash=bytes=>createHash("sha256").update(bytes).digest("hex")
const code="throw new Error('NEVER_EXECUTE_UNTRUSTED_CODE');\nexport async function activate() {}\n"
const source="export async function activate({ request }) { await request('extension.info') }\n"
function manifest(){
  return {
    $schema:"../../schema/nextguide-addon-v2.schema.json",
    schemaVersion:2,id:"acme.storage",name:"Storage Extension",version:"1.0.0",
    summary:"Reviewed v2 sample",description:"Sample server module with no host side effects.",
    author:{name:"Acme Inc"},repository:"https://github.com/acme/storage",
    license:"MIT",category:"integration",keywords:["storage","extension"],
    compatibility:{mode:"account",nextguide:">=1.0.0 <2.0.0"},
    permissions:["storage.read","admin.pages"],
    entrypoints:{server:"dist/server.mjs"},
  }
}
function member(path,bytes,type="0"){
  bytes=Buffer.from(bytes)
  const h=Buffer.alloc(512)
  h.write(path,0,100)
  h.write("0000644\0",100,8);h.write("0000000\0",108,8)
  h.write("0000000\0",116,8)
  h.write(bytes.length.toString(8).padStart(11,"0")+"\0",124,12)
  h.write("00000000000\0",136,12)
  h.fill(32,148,156);h.write(type,156)
  h.write("ustar\0",257);h.write("00",263)
  const checksum=h.reduce((a,b)=>a+b,0)
  h.write(checksum.toString(8).padStart(6,"0")+"\0 ",148,8)
  return Buffer.concat([h,bytes,Buffer.alloc((512-bytes.length%512)%512)])
}
function tar(files) {
  return gzipSync(Buffer.concat([...files.map(([name,bytes,type])=>member(name,bytes,type)),
    Buffer.alloc(1024)]),{mtime:0})
}
function archiveFor({m=manifest(),moduleCode=code,sourceCode=source,
  extra=[],type="0"}={}) {
  const manifestBytes=Buffer.from(JSON.stringify(m))
  const sourceBytes=Buffer.from(sourceCode)
  const serverBytes=Buffer.from(moduleCode)
  const record=(path,bytes)=>({path,size:bytes.length,sha256:hash(bytes)})
  const index={
    schemaVersion:2,format:"nextguide-single-server-v2",
    manifest:record("nextguide-addon.json",manifestBytes),
    source:record("src/server.js",sourceBytes),
    server:record("dist/server.mjs",serverBytes),
    permissions:m.permissions,
  }
  const files=[
    ["nextguide-addon.json",manifestBytes],
    ["src/server.js",sourceBytes],
    ["dist/server.mjs",serverBytes,type],
    ["nextguide-integrity.json",Buffer.from(JSON.stringify(index))],
    ...extra,
  ]
  const archive=tar(files)
  const release={
    manifest:m,assetUrl:"https://github.com/acme/storage/releases/download/v1.0.0/nextguide-addon-v2-1.0.0.tgz",
    tag:"v1.0.0",commit:"a".repeat(40),digest:hash(archive),
    size:archive.length,status:"active",
    review:{
      policy:"independent-human",reviewer:"nextguide-independent-reviewer",
      approvedAt:"2026-11-08T16:00:00Z",sourceCommit:"a".repeat(40),
      sourcePath:"src/server.js",sourceSha256:hash(sourceBytes),
      serverSha256:hash(serverBytes),manifestSha256:hash(manifestBytes),
      buildTool:"bun",format:"nextguide-single-server-v2",
    },
  }
  return {archive,release,index}
}
function envelope(releases,{schemaVersion=2,
  updatedAt="2026-11-08T16:00:00Z",
  expiresAt="2026-11-08T17:00:00Z",key=keys}={}) {
  const body=Buffer.from(JSON.stringify({schemaVersion,updatedAt,expiresAt,releases}))
  return {schemaVersion,algorithm:"Ed25519",keyId,
    body:body.toString("base64url"),
    signature:sign(null,body,key.privateKey).toString("base64url")}
}
const verify=(bytes,release,override={})=>
  verifyReviewedV2Archive({envelope:envelope([release]),pinnedPublicKeyPem:pem,
    id:"acme.storage",version:"1.0.0",archive:bytes,now:NOW,...override})

test("a fresh, separately signed v2 approval matches the exact reviewed source and bundle",()=>{
  const {archive,release}=archiveFor()
  const signed=envelope([release])
  const payload=verifySignedV2RegistryEnvelope(signed,pem,{now:NOW})
  const listed=listReviewedV2Releases(payload,{now:NOW})
  assert.equal(listed.length,1)
  assert.equal(listed[0].review.policy,"independent-human")
  const verified=verify(archive,release)
  assert.equal(verified.manifest.id,"acme.storage")
  assert.equal(verified.archiveSha256,hash(archive))
  assert.equal(verified.compiled.sha256,release.review.serverSha256)
  assert.equal(verified.compiled.code,code)
  assert.equal(verified.source.sha256,release.review.sourceSha256)
  assert.equal(verified.source.text,source)
})

test("v2 catalog expiry, key rotation, tampering, duplicate and v1 replay are rejected",()=>{
  const {release}=archiveFor()
  const signed=envelope([release])
  assert.throws(()=>verifySignedV2RegistryEnvelope(signed,pem,{
    now:Date.parse("2026-11-08T18:00:00Z")}),/expired/)
  assert.throws(()=>verifySignedV2RegistryEnvelope(signed,
    other.publicKey.export({format:"pem",type:"spki"}),{now:NOW}),/Untrusted/)
  assert.throws(()=>verifySignedV2RegistryEnvelope({...signed,signature:"a".repeat(86)},
    pem,{now:NOW}),/signature/)
  assert.throws(()=>verifySignedV2RegistryEnvelope(envelope([release],{
    schemaVersion:1}),pem,{now:NOW}),/Invalid signed v2 envelope/)
  assert.throws(()=>verifySignedV2RegistryEnvelope(envelope([release,release]),
    pem,{now:NOW}),/Duplicate/)
  assert.throws(()=>verifySignedV2RegistryEnvelope(envelope([release],{
    updatedAt:"2026-11-08T00:00:00Z",expiresAt:"2026-11-08T18:00:00Z"
  }),pem,{now:NOW}),/exceeds/)
  const changed={...release,review:{...release.review,policy:"self-approved"}}
  assert.throws(()=>verifySignedV2RegistryEnvelope(envelope([changed]),
    pem,{now:NOW}),/Invalid v2 reviewed release/)
  const forged={...release,assetUrl:"https://evil.example/unreviewed.tgz"}
  assert.throws(()=>verifySignedV2RegistryEnvelope(envelope([forged]),
    pem,{now:NOW}),/Invalid v2 reviewed release/)
  const payload=verifySignedV2RegistryEnvelope(signed,pem,{now:NOW})
  payload.releases[0].manifest.permissions.push("network.fetch")
  assert.throws(()=>listReviewedV2Releases(payload,{now:NOW}),/not authenticated or was modified/)
})

test("permissions show new owner approval required; they never imply an execution grant",()=>{
  assert.deepEqual(compareV2Permissions(
    ["storage.read"],["storage.read","network.fetch"],["storage.read"]),{
      added:["network.fetch"],removed:[],ungranted:["network.fetch"],
      requiresOwnerApproval:true,
    })
  assert.deepEqual(compareV2Permissions(
    ["storage.read","network.fetch"],["storage.read"],["storage.read"]),{
      added:[],removed:["network.fetch"],ungranted:[],
      requiresOwnerApproval:false,
    })
  assert.throws(()=>compareV2Permissions([],["shell.execute"]),/Invalid permission/)
  assert.throws(()=>compareV2Permissions([],["storage.read","storage.read"]),/Invalid permission/)
})

test("revoked, stale, altered or extra compiled members are never accepted",()=>{
  const good=archiveFor()
  const modified=Buffer.from(good.archive)
  modified[modified.length-1]^=1
  assert.throws(()=>verify(modified,good.release),/SHA-256 or size/)
  assert.throws(()=>verify(good.archive,{...good.release,status:"revoked"}),/revoked/)
  assert.throws(()=>verify(good.archive,good.release,{
    now:Date.parse("2026-11-09T00:00:00Z")}),/expired/)
  const unreviewed=archiveFor({extra:[["extra.js","console.log(1)"]]})
  assert.throws(()=>verify(unreviewed.archive,unreviewed.release),/unreviewed|duplicate/)
  const symlink=archiveFor({type:"2"})
  assert.throws(()=>verify(symlink.archive,symlink.release),/Only regular ustar/)
  const fakeReview={...good.release,
    review:{...good.release.review,serverSha256:"f".repeat(64)}}
  assert.throws(()=>verify(good.archive,fakeReview),/attestations/)
  const approvalChanged={...good.release,
    manifest:{...good.release.manifest,
      permissions:["storage.read","network.fetch"]}}
  assert.throws(()=>verify(good.archive,approvalChanged),/descriptor|manifest differs/)
})

test("verified v2 catalog client does not redirect or accept unreviewed HTTP",async()=>{
  const {release}=archiveFor()
  const signed=envelope([release])
  const requests=[]
  const client=createVerifiedV2RegistryClient({
    registryUrl:"https://ngapi.example/v2/registry",
    pinnedPublicKeyPem:pem,now:()=>NOW,
    fetchImpl:async(url,opts)=>{
      requests.push({url,opts})
      return new Response(JSON.stringify(signed),{
        headers:{"Content-Type":"application/json"}
      })
    }
  })
  const latest=await client.listReviewed()
  assert.equal(latest.length,1)
  assert.equal(requests[0].url,"https://ngapi.example/v2/registry")
  assert.equal(requests[0].opts.redirect,"error")
  assert.equal(requests[0].opts.cache,"no-store")
  assert.throws(()=>createVerifiedV2RegistryClient({
    registryUrl:"http://ngapi.example/v2/registry",
    pinnedPublicKeyPem:pem}),/HTTPS/)
})

function mockedTransport(responses){
  const calls=[]
  const transport=(opts,callback)=>{
    const req=new EventEmitter()
    req.destroy=()=>{}
    req.end=()=>{
      calls.push(opts)
      const response=responses.shift()
      if(!response)throw Error("unexpected downloader request")
      queueMicrotask(()=>{
        const stream=new PassThrough()
        stream.statusCode=response.status??200
        stream.headers={
          ...(response.redirect?{location:response.redirect}:{}),
          ...(response.bytes?{"content-length":String(response.bytes.length)}:{})
        }
        callback(stream)
        stream.end(response.bytes??Buffer.alloc(0))
      })
    }
    return req
  }
  return {transport,calls}
}
test("signed v2 intake reuses DNS-pinned TLS and verifies every byte",async()=>{
  const {archive,release}=archiveFor()
  const redirect="https://release-assets.githubusercontent.com/github-production-release-asset/abc?token=testing"
  const net=mockedTransport([{status:302,redirect},{bytes:archive}])
  const output=await downloadReviewedV2Release({
    envelope:envelope([release]),pinnedPublicKeyPem:pem,
    id:"acme.storage",version:"1.0.0",
    now:()=>NOW,transport:net.transport,
    resolver:async()=>[{family:4,address:"93.184.216.34"}],
  })
  assert.equal(output.archive.length,archive.length)
  assert.equal(output.verified.compiled.sha256,release.review.serverSha256)
  assert.deepEqual(net.calls.map(x=>x.hostname),[
    "github.com","release-assets.githubusercontent.com"
  ])
  for(const opts of net.calls){
    assert.equal(opts.rejectUnauthorized,true)
    assert.equal(opts.agent,false)
    assert.equal(opts.headers["accept-encoding"],"identity")
  }
})
test("revoked or expired v2 records cannot trigger outbound DNS or HTTPS",async()=>{
  const {archive,release}=archiveFor()
  let called=0
  for(const [signed,clock] of [
    [envelope([{...release,status:"revoked"}]),()=>NOW],
    [envelope([release]),()=>Date.parse("2026-11-08T19:00:00Z")],
  ]){
    await assert.rejects(downloadReviewedV2Release({
      envelope:signed,pinnedPublicKeyPem:pem,
      id:"acme.storage",version:"1.0.0",
      now:clock,resolver:async()=>{called++;throw Error("unexpected DNS")}
    }),/not active|No active|expired/)
  }
  assert.equal(called,0)
  assert.ok(archive.length>32)
})
