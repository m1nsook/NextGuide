import test from "node:test"
import assert from "node:assert/strict"
import { createHash, generateKeyPairSync, sign } from "node:crypto"
import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import { gzipSync } from "node:zlib"
import { downloadVerifiedContentRelease } from "../lib/extension-download.mjs"

const keys=generateKeyPairSync("ed25519")
const pem=keys.publicKey.export({type:"spki",format:"pem"})
const keyId=createHash("sha256").update(keys.publicKey.export({
  type:"spki",format:"der"
})).digest("hex").slice(0,24)
const manifest={
  schemaVersion:1,id:"acme.docs-addon",name:"Docs Addon",version:"1.0.0",
  category:"content",repository:"https://github.com/acme/docs-addon",
  compatibility:{mode:"account",nextguide:">=1.0.0 <2.0.0"},
  entrypoints:{content:"content"},icon:"icon.png",permissions:[]
}
function member(path,bytes) {
  bytes=Buffer.from(bytes)
  const h=Buffer.alloc(512)
  h.write(path,0,100)
  h.write("0000644\0",100,8)
  h.write("0000000\0",108,8)
  h.write("0000000\0",116,8)
  h.write(bytes.length.toString(8).padStart(11,"0")+"\0",124,12)
  h.write("00000000000\0",136,12)
  h.fill(32,148,156);h.write("0",156);h.write("ustar\0",257);h.write("00",263)
  const sum=h.reduce((acc,n)=>acc+n,0)
  h.write(sum.toString(8).padStart(6,"0")+"\0 ",148,8)
  return Buffer.concat([h,bytes,Buffer.alloc((512-bytes.length%512)%512)])
}
function packed() {
  const icon=Buffer.alloc(48)
  Buffer.from([137,80,78,71,13,10,26,10]).copy(icon)
  icon.writeUInt32BE(13,8);icon.write("IHDR",12)
  icon.writeUInt32BE(48,16);icon.writeUInt32BE(48,20)
  return gzipSync(Buffer.concat([
    member("nextguide-addon.json",JSON.stringify(manifest)),
    member("icon.png",icon),
    member("content/index.md","# Verified content\n"),
    Buffer.alloc(1024)
  ]),{mtime:0})
}
const archive=packed()
const digest=createHash("sha256").update(archive).digest("hex")
const assetUrl="https://github.com/acme/docs-addon/releases/download/v1.0.0/nextguide-addon-1.0.0.tgz"
function envelope(status="active") {
  const release={
    manifest,tag:"v1.0.0",commit:"a".repeat(40),digest,
    assetUrl,size:archive.length,status,reviewer:"approved",
    approvedAt:"2026-11-08T00:00:00Z",
  }
  const body=Buffer.from(JSON.stringify({
    schemaVersion:1,updatedAt:"2026-11-08T00:00:00Z",releases:[release]
  }))
  return {schemaVersion:1,algorithm:"Ed25519",keyId,
    body:body.toString("base64url"),signature:sign(null,body,keys.privateKey).toString("base64url")}
}
const publicDNS=async()=>[{family:4,address:"93.184.216.34"}]
const args=(extra={})=>({
  envelope:envelope(),pinnedPublicKeyPem:pem,id:manifest.id,
  version:manifest.version,resolver:publicDNS,...extra,
})
function mockedTransport(responses) {
  const calls=[]
  function transport(options, callback) {
    const req=new EventEmitter()
    req.destroy=()=>{}
    req.end=()=> {
      calls.push(options)
      const next=responses.shift()
      if (!next) throw Error("unexpected request")
      queueMicrotask(()=>{
        const incoming=new PassThrough()
        incoming.statusCode=next.status??200
        incoming.headers={
          ...(next.redirect?{location:next.redirect}:{}),
          ...(next.length!==false?{"content-length":String(next.body?.length??0)}:{}),
          ...(next.headers??{})
        }
        callback(incoming)
        incoming.end(next.body??Buffer.alloc(0))
      })
    }
    return req
  }
  return {transport,calls}
}
const cdnUrl="https://release-assets.githubusercontent.com/github-production-release-asset/1234/archive?token=reviewed"

test("follows only pinned GitHub release redirects, validates signed archive and TLS",async()=>{
  const network=mockedTransport([
    {status:302,redirect:cdnUrl},
    {status:200,body:archive},
  ])
  const bytes=await downloadVerifiedContentRelease(args({transport:network.transport}))
  assert.equal(Buffer.compare(bytes,archive),0)
  assert.equal(network.calls.length,2)
  assert.equal(network.calls[0].hostname,"github.com")
  assert.equal(network.calls[1].hostname,"release-assets.githubusercontent.com")
  for(const opts of network.calls) {
    assert.equal(opts.rejectUnauthorized,true)
    assert.equal(opts.agent,false)
    assert.equal(opts.autoSelectFamily,false)
    assert.equal(opts.headers["accept-encoding"],"identity")
    let pinned
    opts.lookup(opts.hostname,{},(_err,ip,family)=>{pinned={ip,family}})
    assert.deepEqual(pinned,{ip:"93.184.216.34",family:4})
  }
})

test("disallows redirects to non-GitHub, private hosts, IPs, URLs with port or credentials",async()=>{
  for(const redirect of [
    "https://evil.example/artifact.tgz","http://release-assets.githubusercontent.com/x",
    "https://127.0.0.1/x","https://release-assets.githubusercontent.com:8443/x",
    "https://person:secret@release-assets.githubusercontent.com/x",
    "/relative-location","https://release-assets.githubusercontent.com/x#fragment",
  ]) {
    const network=mockedTransport([{status:302,redirect}])
    await assert.rejects(downloadVerifiedContentRelease(args({transport:network.transport})),
      /Disallowed|Invalid reviewed|trusted GitHub asset hosts/)
    assert.equal(network.calls.length,1,redirect)
  }
})

test("refuses mixed public/private DNS before opening a network connection",async()=>{
  let called=0
  await assert.rejects(downloadVerifiedContentRelease(args({
    resolver:async()=>[{family:4,address:"93.184.216.34"},{family:4,address:"169.254.169.254"}],
    transport(){called++;throw Error("should not open")}
  })),/unsafe address/)
  assert.equal(called,0)
})

test("cancellation during DNS lookup prevents socket creation",async()=>{
  const controller=new AbortController()
  let called=0
  const result=downloadVerifiedContentRelease(args({
    signal:controller.signal,resolver:()=>new Promise(()=>{}),
    transport(){called++;throw Error("unexpected socket")}
  }))
  controller.abort()
  await assert.rejects(result,/cancelled/)
  assert.equal(called,0)
})

test("signed digest, exact response length and redirect count fail closed",async()=>{
  const corrupted=Buffer.from(archive);corrupted[corrupted.length-1]^=1
  const tamper=mockedTransport([{body:corrupted}])
  await assert.rejects(downloadVerifiedContentRelease(args({transport:tamper.transport})),
    /SHA-256 mismatch/)
  const short=mockedTransport([{body:archive.subarray(0,archive.length-1),length:false}])
  await assert.rejects(downloadVerifiedContentRelease(args({transport:short.transport})),
    /Incomplete signed release/)
  const wrongLength=mockedTransport([{body:archive,headers:{"content-length":"999"}}])
  await assert.rejects(downloadVerifiedContentRelease(args({transport:wrongLength.transport})),
    /size differs/)
  const looping=mockedTransport(Array.from({length:4},()=>({
    status:302,redirect:cdnUrl,
  })))
  await assert.rejects(downloadVerifiedContentRelease(args({transport:looping.transport})),
    /too many times/)
  assert.equal(looping.calls.length,4)
})

test("revoked release or forged envelope cannot open DNS or HTTPS",async()=>{
  let called=0
  for(const changes of [
    {envelope:envelope("revoked")},
    {envelope:{...envelope(),signature:"a".repeat(86)}},
  ]){
    await assert.rejects(downloadVerifiedContentRelease(args({
      ...changes,resolver(){called++;throw Error("no DNS")}
    })),/approved signed v1|signature/)
  }
  assert.equal(called,0)
})
