import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createHash, generateKeyPairSync } from "node:crypto"
import { deflateSync, gzipSync } from "node:zlib"
import { generateSigningKeys, initializeRegistry, publishRemoteApprovedRelease,
  revokeRelease, readRegistry, verifyEnvelope, packReviewedSource, compareSemver,
  satisfiesRange, hash } from "../lib.mjs"
import { createRegistryServer } from "../server.mjs"
import { unpackAddonTgz, validateSubmission } from "../verify-release.mjs"

const SHA_A="a".repeat(40), SHA_B="b".repeat(40)
function crc32(b) {
  let crc=0xffffffff
  for(const value of b){crc ^= value;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
  return (crc^0xffffffff)>>>0
}
function chunk(type, bytes) {
  const name=Buffer.from(type),header=Buffer.alloc(4),tail=Buffer.alloc(4)
  header.writeUInt32BE(bytes.length)
  tail.writeUInt32BE(crc32(Buffer.concat([name,bytes])))
  return Buffer.concat([header,name,bytes,tail])
}
function png() {
  const hdr=Buffer.alloc(13)
  hdr.writeUInt32BE(64,0);hdr.writeUInt32BE(64,4);hdr[8]=8;hdr[9]=6
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    chunk("IHDR",hdr),chunk("IDAT",deflateSync(Buffer.alloc(64*(64*4+1)))),chunk("IEND",Buffer.alloc(0))])
}
function fixture() {
  const root=mkdtempSync(join(tmpdir(),"ng-registry-v1-"))
  const keys=generateSigningKeys(join(root,"offline"))
  const privateKey=readFileSync(keys.privateFile,"utf8")
  const publicKey=readFileSync(keys.publicFile,"utf8")
  const dataDir=join(root,"data")
  initializeRegistry(dataDir,privateKey)
  const source=join(root,"source")
  mkdirSync(join(source,"content"),{recursive:true})
  const manifest={schemaVersion:1,id:"acme.hello-world",name:"Hello World",
    summary:"Example documentation",description:"A small, safe documentation-only add-on.",
    version:"0.1.0",author:{name:"Acme"},
    repository:"https://github.com/acme/hello-world",license:"MIT",category:"content",
    icon:"icon.png",keywords:["documentation"],
    compatibility:{mode:"account",nextguide:">=1.0.0 <2.0.0"},
    permissions:[],entrypoints:{content:"content"}}
  const store=()=>writeFileSync(join(source,"nextguide-addon.json"),JSON.stringify(manifest))
  store()
  writeFileSync(join(source,"content","index.md"),"# Hello\n")
  writeFileSync(join(source,"icon.png"),png())
  return {root,source,manifest,store,privateKey,publicKey,dataDir,
    cleanup:()=>rmSync(root,{recursive:true,force:true})}
}
function remote(f,sha=SHA_A) {
  return {manifest:structuredClone(f.manifest),commit:sha,tag:"v"+f.manifest.version,
    assetUrl:"https://github.com/acme/hello-world/releases/download/v"+f.manifest.version+
      "/nextguide-addon-"+f.manifest.version+".tgz",
    digest:createHash("sha256").update(sha).digest("hex"),size:852}
}
async function withServer(opts,callback) {
  const server=createRegistryServer(opts)
  await new Promise(ok=>server.listen(0,"127.0.0.1",ok))
  try {return await callback("http://127.0.0.1:"+server.address().port)}
  finally{await new Promise((ok,no)=>server.close(e=>e?no(e):ok()))}
}
function tar(entries) {
  const chunks=[]
  for(const [name,content] of entries) {
    const h=Buffer.alloc(512)
    h.write(name,0,100);h.write("0000644\0",100,8);h.write("0000000\0",108,8);h.write("0000000\0",116,8)
    h.write(content.length.toString(8).padStart(11,"0")+"\0",124,12)
    h.write("00000000000\0",136,12);h.fill(32,148,156);h.write("0",156)
    const checksum=h.reduce((a,b)=>a+b,0)
    h.write(checksum.toString(8).padStart(6,"0")+"\0 ",148,8)
    chunks.push(h,content,Buffer.alloc((512-content.length%512)%512))
  }
  chunks.push(Buffer.alloc(1024))
  return gzipSync(Buffer.concat(chunks))
}
test("signed registry initializes with an empty index",()=>{
  const f=fixture()
  try{
    assert.equal(readRegistry(f.dataDir,f.publicKey).payload.releases.length,0)
    assert.throws(()=>generateSigningKeys(join(f.root,"offline")),/Refusing to overwrite/)
  }finally{f.cleanup()}
})
test("source packaging retains the developer's icon and disallows unsafe content",()=>{
  const f=fixture()
  try{
    const archive=packReviewedSource(f.source).archive
    assert.equal(archive.icon.path,"icon.png")
    assert.deepEqual(Buffer.from(archive.icon.base64,"base64"),png())
    f.manifest.compatibility.mode="developer";f.store()
    assert.throws(()=>packReviewedSource(f.source),/Account Mode/)
    f.manifest.compatibility.mode="account";f.manifest.permissions=["network"];f.store()
    assert.throws(()=>packReviewedSource(f.source),/Executable permissions/)
    f.manifest.permissions=[];f.manifest.icon="../unsafe.png";f.store()
    assert.throws(()=>packReviewedSource(f.source),/safe relative PNG/)
    f.manifest.icon="icon.png";f.store()
    writeFileSync(join(f.source,"icon.png"),"<svg onload='alert(1)'></svg>")
    assert.throws(()=>packReviewedSource(f.source),/PNG/)
  }finally{f.cleanup()}
})
test("tar verifier checks a real PNG icon and rejects executable archive entries",()=>{
  const f=fixture()
  try{
    const manifest=Buffer.from(JSON.stringify(f.manifest))
    const valid=tar([["nextguide-addon.json",manifest],["icon.png",png()],["content/index.md",Buffer.from("# Hello")]])
    const result=unpackAddonTgz(valid)
    assert.equal(result.manifest.icon,"icon.png")
    assert.equal(result.files.get("icon.png").length,png().length)
    const missing=tar([["nextguide-addon.json",manifest],["content/index.md",Buffer.from("# Hello")]])
    assert.throws(()=>unpackAddonTgz(missing),/icon is missing/)
    const malicious=tar([["nextguide-addon.json",manifest],["icon.png",png()],["script.js",Buffer.from("alert(1)")]])
    assert.throws(()=>unpackAddonTgz(malicious),/unsupported file/)
  }finally{f.cleanup()}
})
test("signed catalog serves pinned GitHub icon URLs and approved updates only",async()=>{
  const f=fixture()
  try{
    publishRemoteApprovedRelease(f.dataDir,f.privateKey,remote(f),"owner")
    f.manifest.version="0.2.0";f.store()
    publishRemoteApprovedRelease(f.dataDir,f.privateKey,remote(f,SHA_B),"owner")
    await withServer({dataDir:f.dataDir,publicKey:f.publicKey},async base=>{
      const get=async path=>{const response=await fetch(base+path);return {code:response.status,body:await response.json()}}
      const list=await get("/v1/addons?nextguide=1.0.0")
      assert.equal(list.code,200);assert.equal(list.body.total,1)
      assert.equal(list.body.items[0].version,"0.2.0")
      assert.equal(list.body.items[0].icon.url,"https://raw.githubusercontent.com/acme/hello-world/"+SHA_B+"/icon.png")
      assert.equal((await get("/v1/addons?nextguide=2.0.0")).body.total,0)
      assert.equal((await get("/v1/addons?limit=100")).code,400)
      assert.equal((await get("/v1/addons/acme.hello-world/versions")).body.versions.length,2)
      assert.equal((await get("/v1/addons/acme.hello-world/updates?from=0.1.0&nextguide=1.0.0")).body.update.version,"0.2.0")
      assert.equal((await get("/v1/addons/acme.hello-world/updates?from=0.1.0&nextguide=2.0.0")).body.update,null)
      assert.equal((await get("/marketplace")).code,404)
      assert.equal((await get("/admin")).code,503)
      const signed=await get("/v1/registry")
      assert.equal(verifyEnvelope(signed.body,f.publicKey).releases.length,2)
    })
    revokeRelease(f.dataDir,f.privateKey,"acme.hello-world","0.2.0")
    await withServer({dataDir:f.dataDir,publicKey:f.publicKey},async base=>{
      const list=await (await fetch(base+"/v1/addons")).json()
      assert.equal(list.items[0].version,"0.1.0")
    })
  }finally{f.cleanup()}
})
test("publisher cannot overwrite versions or change the publisher repository",()=>{
  const f=fixture()
  try{
    publishRemoteApprovedRelease(f.dataDir,f.privateKey,remote(f),"owner")
    assert.throws(()=>publishRemoteApprovedRelease(f.dataDir,f.privateKey,remote(f),"owner"),/already published/)
    f.manifest.version="0.2.0";f.manifest.repository="https://github.com/another/repo";f.store()
    const r=remote(f,SHA_B)
    assert.throws(()=>publishRemoteApprovedRelease(f.dataDir,f.privateKey,r,"owner"),/Publisher repository mismatch/)
  }finally{f.cleanup()}
})
test("tampered signed metadata and wrong keys are rejected",()=>{
  const f=fixture()
  try{
    const envelope=readRegistry(f.dataDir,f.publicKey).envelope
    const wrong=generateKeyPairSync("ed25519").publicKey.export({type:"spki",format:"pem"})
    assert.throws(()=>verifyEnvelope(envelope,wrong),/Wrong registry signing key/)
    const corrupt={...envelope,signature:Buffer.alloc(64).toString("base64url")}
    assert.throws(()=>verifyEnvelope(corrupt,f.publicKey),/signature verification failed/)
  }finally{f.cleanup()}
})
test("publisher posts verified release to review queue, owner approves with CSRF and session",async()=>{
  const f=fixture()
  try{
    const approved=remote(f)
    const opts={dataDir:f.dataDir,publicKey:f.publicKey,privateKey:f.privateKey,
      adminSecret:"a".repeat(48),sessionSecret:"b".repeat(48),origin:"https://ngapi.m1nsook.com",
      verify:async()=>structuredClone(approved)}
    await withServer(opts,async base=>{
      const req={repository:approved.manifest.repository,tag:approved.tag,
        commit:approved.commit,sha256:approved.digest,assetUrl:approved.assetUrl}
      const sub=await fetch(base+"/v1/submissions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(req)})
      assert.equal(sub.status,202)
      const id=(await sub.json()).id
      const before=await (await fetch(base+"/admin")).text()
      assert.match(before,/Owner login/)
      assert.doesNotMatch(before,/Pending add-on publications/)
      const unauth=await fetch(base+"/admin/review/"+id+"/approve",{method:"POST",headers:{Origin:opts.origin,"Content-Type":"application/x-www-form-urlencoded"},body:"csrf=invalid",redirect:"manual"})
      assert.equal(unauth.status,401)
      const login=await fetch(base+"/admin/login",{method:"POST",redirect:"manual",
        headers:{Origin:opts.origin,"Content-Type":"application/x-www-form-urlencoded"},
        body:new URLSearchParams({secret:opts.adminSecret})})
      assert.equal(login.status,303)
      const cookie=login.headers.get("set-cookie").split(";")[0]
      const dashboard=await (await fetch(base+"/admin",{headers:{Cookie:cookie}})).text()
      assert.match(dashboard,/Pending add-on publications/)
      const csrf=dashboard.match(/name='csrf' value='([^']+)'/)?.[1]
      assert.ok(csrf)
      const approve=await fetch(base+"/admin/review/"+id+"/approve",{method:"POST",redirect:"manual",
        headers:{Origin:opts.origin,Cookie:cookie,"Content-Type":"application/x-www-form-urlencoded"},
        body:new URLSearchParams({csrf})})
      assert.equal(approve.status,303)
      assert.equal(readRegistry(f.dataDir,f.publicKey).payload.releases.length,1)
    })
  }finally{f.cleanup()}
})
test("stable SemVer compatibility enforces explicit intervals",()=>{
  assert.equal(compareSemver("1.1.0","1.0.9"),1)
  assert.equal(satisfiesRange("1.2.0",">=1.0.0 <2.0.0"),true)
  assert.equal(satisfiesRange("2.0.0",">=1.0.0 <2.0.0"),false)
  assert.equal(satisfiesRange("1.0.0","*"),false)
})
test("submission URL validation rejects arbitrary hosts and malformed hashes",()=>{
  const f=fixture()
  try{
    const x=remote(f)
    const value={repository:x.manifest.repository,tag:x.tag,commit:x.commit,assetUrl:x.assetUrl,sha256:x.digest}
    assert.equal(validateSubmission(value).commit,SHA_A)
    assert.throws(()=>validateSubmission({...value,assetUrl:"https://evil.example/file.tgz"}),/Artifact must be a GitHub Release/)
    assert.throws(()=>validateSubmission({...value,sha256:"00"}),/SHA-256/)
  }finally{f.cleanup()}
})
