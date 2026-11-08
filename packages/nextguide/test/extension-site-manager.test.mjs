import test from "node:test"
import assert from "node:assert/strict"
import { createHash, generateKeyPairSync, sign } from "node:crypto"
import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import { gzipSync } from "node:zlib"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createBootstrap } from "../lib/account-auth.mjs"
import { createAccountAddonManager } from "../lib/extension-site-manager.mjs"

const keys=generateKeyPairSync("ed25519")
const pem=keys.publicKey.export({type:"spki",format:"pem"})
const keyId=createHash("sha256").update(keys.publicKey.export({
  type:"spki",format:"der"
})).digest("hex").slice(0,24)
const NOW=Date.parse("2026-11-08T15:00:00Z")
function member(path,bytes) {
  bytes=Buffer.from(bytes)
  const h=Buffer.alloc(512)
  h.write(path,0,100)
  h.write("0000644\0",100,8)
  h.write("0000000\0",108,8)
  h.write("0000000\0",116,8)
  h.write(bytes.length.toString(8).padStart(11,"0")+"\0",124,12)
  h.write("00000000000\0",136,12)
  h.fill(32,148,156)
  h.write("0",156);h.write("ustar\0",257);h.write("00",263)
  const sum=h.reduce((a,b)=>a+b,0)
  h.write(sum.toString(8).padStart(6,"0")+"\0 ",148,8)
  return Buffer.concat([h,bytes,Buffer.alloc((512-bytes.length%512)%512)])
}
function png(){
  const b=Buffer.alloc(48)
  Buffer.from([137,80,78,71,13,10,26,10]).copy(b)
  b.writeUInt32BE(13,8);b.write("IHDR",12)
  b.writeUInt32BE(32,16);b.writeUInt32BE(32,20)
  return b
}
function versioned(version) {
  const manifest={
    schemaVersion:1,id:"acme.docs",name:"Docs Extension",version,
    category:"content",repository:"https://github.com/acme/docs",
    permissions:[],compatibility:{mode:"account",nextguide:">=1.0.0 <2.0.0"},
    entrypoints:{content:"content"},icon:"icon.png",
  }
  const archive=gzipSync(Buffer.concat([
    member("nextguide-addon.json",JSON.stringify(manifest)),
    member("icon.png",png()),
    member("content/index.md","# Welcome "+version+"\n"),
    Buffer.alloc(1024)
  ]),{mtime:0})
  const release={
    manifest,tag:"v"+version,commit:"a".repeat(40),
    digest:createHash("sha256").update(archive).digest("hex"),
    size:archive.length,
    assetUrl:"https://github.com/acme/docs/releases/download/v"+version+
      "/nextguide-addon-"+version+".tgz",
    status:"active",reviewer:"registry-reviewer",approvedAt:"2026-11-08T14:59:00Z",
  }
  return {archive,release}
}
function signed(releases,updatedAt="2026-11-08T14:59:00Z"){
  const bytes=Buffer.from(JSON.stringify({schemaVersion:1,updatedAt,releases}))
  return {schemaVersion:1,algorithm:"Ed25519",keyId,
    body:bytes.toString("base64url"),
    signature:sign(null,bytes,keys.privateKey).toString("base64url")}
}
function transportFor(releases) {
  const calls=[]
  const transport=(opts,respond)=>{
    const req=new EventEmitter()
    req.end=()=>{
      calls.push(opts)
      const release=releases.find(r=>opts.path===new URL(r.release.assetUrl).pathname)
      queueMicrotask(()=>{
        const response=new PassThrough()
        response.statusCode=release?200:404
        response.headers=release?{"content-length":String(release.archive.length)}:{}
        respond(response)
        response.end(release?.archive??"not found")
      })
    }
    req.destroy=()=>{}
    return req
  }
  return {calls,transport}
}
function fixture({version="1.0.0",signedReleases,artifacts,now=NOW}={}) {
  const base=mkdtempSync(join(tmpdir(),"nextguide-addon-manager-"))
  const project=join(base,"site"),dataDir=join(base,"private")
  mkdirSync(project)
  writeFileSync(join(project,"nextguide.config.json"),JSON.stringify({
    mode:"account",contentDir:"content/docs"
  }))
  createBootstrap(project,{dataDir})
  const network=transportFor(artifacts)
  const manager=createAccountAddonManager({
    project,dataDir,nextguideVersion:version,now:()=>now,
    registryUrl:"https://registry.example/v1/registry",pinnedPublicKeyPem:pem,
    registryFetch:async()=>new Response(JSON.stringify(signedReleases),{
      headers:{"Content-Type":"application/json"}
    }),
    resolver:async()=>[{family:4,address:"93.184.216.34"}],
    transport:network.transport,
  })
  return {manager,network,cleanup:()=>rmSync(base,{recursive:true,force:true})}
}

test("owner catalog includes exact compatibility and durable installed state",async()=>{
  const a=versioned("1.0.0")
  const f=fixture({signedReleases:signed([a.release]),artifacts:[a]})
  try{
    const catalog=await f.manager.catalog()
    assert.equal(catalog.configured,true)
    assert.equal(catalog.installed.revision,0)
    assert.equal(catalog.releases[0].compatible,true)
    assert.equal(catalog.nextguideVersion,"1.0.0")
    await assert.rejects(f.manager.install({
      id:"acme.docs",version:"1.0.0",expectedRevision:0,consent:false
    }),/consent/)
    assert.equal(f.network.calls.length,0)
    const installed=await f.manager.install({
      id:"acme.docs",version:"1.0.0",expectedRevision:0,consent:true
    })
    assert.equal(installed.addon.enabled,false)
    assert.equal(installed.revision,1)
    assert.equal((await f.manager.catalog()).installed.addons[0].version,"1.0.0")
    const enabled=await f.manager.toggle({id:"acme.docs",enabled:true,expectedRevision:1})
    assert.equal(enabled.addon.enabled,true)
    const approved=await f.manager.readEnabled({id:"acme.docs"})
    assert.ok(pages[0].markdown.includes("Welcome 1.0.0"))
    const disabled=await f.manager.toggle({id:"acme.docs",enabled:false,expectedRevision:2})
    assert.equal(disabled.addon.enabled,false)
    assert.equal(await f.manager.readEnabled({id:"acme.docs"}),null)
    const removed=f.manager.uninstall({
      id:"acme.docs",expectedRevision:3,consent:true
    })
    assert.equal(removed.privateDataPreserved,true)
    assert.deepEqual((await f.manager.catalog()).installed.addons,[])
  }finally{f.cleanup()}
})

test("owner update + rollback retains only reviewed versions and re-enables explicitly",async()=>{
  const a=versioned("1.0.0"),b=versioned("1.1.0")
  const f=fixture({signedReleases:signed([a.release,b.release]),artifacts:[a,b]})
  try{
    await f.manager.install({id:"acme.docs",version:"1.0.0",expectedRevision:0,consent:true})
    await f.manager.install({id:"acme.docs",version:"1.1.0",expectedRevision:1,consent:true})
    assert.deepEqual((await f.manager.catalog()).installed.addons[0].availableVersions,
      ["1.0.0","1.1.0"])
    const result=await f.manager.rollback({
      id:"acme.docs",version:"1.0.0",expectedRevision:2,consent:true
    })
    assert.equal(result.addon.enabled,false)
    assert.equal(result.addon.version,"1.0.0")
    await assert.rejects(f.manager.rollback({
      id:"acme.docs",version:"1.1.0",expectedRevision:3,consent:false
    }),/consent/)
  }finally{f.cleanup()}
})

test("stale signed metadata, incompatible alpha versions and revoked releases are blocked",async()=>{
  const a=versioned("1.0.0")
  const stale=fixture({signedReleases:signed([a.release],"2026-11-06T00:00:00Z"),artifacts:[a]})
  try{
    const listed=await stale.manager.catalog()
    assert.equal(listed.configured,true)
    assert.equal(listed.catalogFresh,false)
    assert.equal(listed.releases.length,1)
    await assert.rejects(stale.manager.install({
      id:"acme.docs",version:"1.0.0",expectedRevision:0,consent:true
    }),/last hour/)
    assert.equal(stale.network.calls.length,0)
  }finally{stale.cleanup()}
  const alpha=fixture({
    version:"0.0.1-alpha.2",signedReleases:signed([a.release]),artifacts:[a]
  })
  try{
    assert.equal((await alpha.manager.catalog()).releases[0].compatible,false)
    await assert.rejects(alpha.manager.install({
      id:"acme.docs",version:"1.0.0",expectedRevision:0,consent:true
    }),/not reviewed, active or compatible/)
    assert.equal(alpha.network.calls.length,0)
  }finally{alpha.cleanup()}
  const revoked=fixture({
    signedReleases:signed([{...a.release,status:"revoked"}]),artifacts:[a]
  })
  try{
    await assert.rejects(revoked.manager.install({
      id:"acme.docs",version:"1.0.0",expectedRevision:0,consent:true
    }),/not reviewed/)
    assert.equal(revoked.network.calls.length,0)
  }finally{revoked.cleanup()}
})

test("public navigation includes only explicitly enabled signed Markdown pages",async()=>{
  const a=versioned("1.0.0")
  const f=fixture({signedReleases:signed([a.release]),artifacts:[a]})
  try {
    assert.deepEqual(await f.manager.publicPages(),[])
    assert.equal(f.network.calls.length,0,"disabled add-ons do not need registry requests")
    await f.manager.install({id:"acme.docs",version:"1.0.0",expectedRevision:0,consent:true})
    assert.deepEqual(await f.manager.publicPages(),[])
    await f.manager.toggle({id:"acme.docs",enabled:true,expectedRevision:1})
    const pages=await f.manager.publicPages()
    assert.equal(pages.length,1)
    assert.deepEqual(Object.keys(pages[0]).sort(),["group","id","markdown","slug","title","version"])
    assert.equal(pages[0].id,"acme.docs")
    assert.equal(pages[0].title,"Docs Extension")
    assert.equal(pages[0].slug,"")
    assert.ok(pages[0].markdown.includes("Welcome 1.0.0"))
    await f.manager.toggle({id:"acme.docs",enabled:false,expectedRevision:2})
    assert.deepEqual(await f.manager.publicPages(),[])
  } finally { f.cleanup() }
})
