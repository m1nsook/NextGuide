import test from "node:test"
import assert from "node:assert/strict"
import { createHash, generateKeyPairSync, sign } from "node:crypto"
import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import {
  existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync,
  readdirSync, rmSync, writeFileSync, symlinkSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { gzipSync } from "node:zlib"
import { accountFile, createBootstrap } from "../lib/account-auth.mjs"
import { createAccountV2AddonManager } from "../lib/extension-v2-site-manager.mjs"
import { fullStudioRouteSource } from "../lib/account-studio-template.mjs"

const keys=generateKeyPairSync("ed25519")
const pem=keys.publicKey.export({format:"pem",type:"spki"})
const keyId=createHash("sha256").update(keys.publicKey.export({
  format:"der",type:"spki"})).digest("hex").slice(0,24)
const sha=b=>createHash("sha256").update(b).digest("hex")
const NOW=Date.parse("2026-11-09T12:30:00Z")
const source="export async function activate({request}) { await request('extension.info') }\n"
const bundle="throw new Error('never run downloaded code');\nexport async function activate() {}\n"
function member(path,bytes) {
  bytes=Buffer.from(bytes)
  const h=Buffer.alloc(512)
  h.write(path,0,100);h.write("0000644\0",100,8)
  h.write("0000000\0",108,8);h.write("0000000\0",116,8)
  h.write(bytes.length.toString(8).padStart(11,"0")+"\0",124,12)
  h.write("00000000000\0",136,12);h.fill(32,148,156)
  h.write("0",156);h.write("ustar\0",257);h.write("00",263)
  h.write(h.reduce((a,b)=>a+b,0).toString(8).padStart(6,"0")+"\0 ",148,8)
  return Buffer.concat([h,bytes,Buffer.alloc((512-bytes.length%512)%512)])
}
function versioned(version,permissions=["storage.read","admin.pages"],extra=[]){
  const manifest={
    schemaVersion:2,id:"acme.storage",name:"Storage Example",version,
    repository:"https://github.com/acme/storage",category:"integration",
    compatibility:{mode:"account",nextguide:">=1.0.0 <2.0.0"},
    entrypoints:{server:"dist/server.mjs"},permissions,
  }
  const manifestBytes=Buffer.from(JSON.stringify(manifest))
  const src=Buffer.from(source)
  const code=Buffer.from(bundle)
  const ref=(path,bytes)=>({path,size:bytes.length,sha256:sha(bytes)})
  const index={
    schemaVersion:2,format:"nextguide-single-server-v2",
    manifest:ref("nextguide-addon.json",manifestBytes),
    source:ref("src/server.js",src),
    server:ref("dist/server.mjs",code),
    permissions,
  }
  const archive=gzipSync(Buffer.concat([
    member("nextguide-addon.json",manifestBytes),
    member("src/server.js",src),
    member("dist/server.mjs",code),
    member("nextguide-integrity.json",JSON.stringify(index)),
    ...extra.map(([path,bytes])=>member(path,bytes)),
    Buffer.alloc(1024),
  ]),{mtime:0})
  const release={
    manifest,tag:"v"+version,commit:"a".repeat(40),
    digest:sha(archive),size:archive.length,status:"active",
    assetUrl:"https://github.com/acme/storage/releases/download/v"+version+
      "/nextguide-addon-v2-"+version+".tgz",
    review:{
      policy:"independent-human",reviewer:"staff-independent",
      approvedAt:"2026-11-09T12:00:00Z",
      sourceCommit:"a".repeat(40),sourcePath:"src/server.js",
      sourceSha256:sha(src),serverSha256:sha(code),
      manifestSha256:sha(manifestBytes),buildTool:"bun",
      format:"nextguide-single-server-v2",
    },
  }
  return {archive,release}
}
function signed(releases,expire="2026-11-09T13:00:00Z"){
  const bytes=Buffer.from(JSON.stringify({
    schemaVersion:2,updatedAt:"2026-11-09T12:00:00Z",expiresAt:expire,releases
  }))
  return {schemaVersion:2,algorithm:"Ed25519",keyId,
    body:bytes.toString("base64url"),
    signature:sign(null,bytes,keys.privateKey).toString("base64url")}
}
function transportFor(artifacts){
  const calls=[]
  return {
    calls,
    transport(opts,respond){
      const req=new EventEmitter()
      req.destroy=()=>{}
      req.end=()=>{
        calls.push(opts)
        const match=artifacts.find(x=>
          new URL(x.release.assetUrl).pathname===opts.path)
        queueMicrotask(()=>{
          const stream=new PassThrough()
          stream.statusCode=match?200:404
          stream.headers=match?{"content-length":String(match.archive.length)}:{}
          respond(stream)
          stream.end(match?.archive??"missing")
        })
      }
      return req
    },
  }
}
function fixture({artifacts=[versioned("1.0.0")],releases=artifacts.map(a=>a.release),
  version="1.0.0",expire,mode="account",online=true}={}){
  const base=mkdtempSync(join(tmpdir(),"ng-v2-account-stage-"))
  const project=join(base,"site"),dataDir=join(base,"private")
  mkdirSync(project)
  writeFileSync(join(project,"nextguide.config.json"),JSON.stringify({
    mode,contentDir:"content/docs",
  }))
  createBootstrap(project,{dataDir})
  const network=transportFor(artifacts)
  let envelope=signed(releases,expire)
  const manager=()=>createAccountV2AddonManager({
    project,dataDir,nextguideVersion:version,now:()=>NOW,
    registryUrl:"https://registry.example/v2/registry",
    pinnedPublicKeyPem:pem,
    registryFetch:async()=>{
      if(!online)throw Error("registry offline")
      return new Response(JSON.stringify(envelope),{
        headers:{"content-type":"application/json"}
      })
    },
    resolver:async()=>[{address:"93.184.216.34",family:4}],
    transport:network.transport,
  })
  return {
    manager,network,project,dataDir,
    offline:()=>{online=false},
    envelope:(value)=>{envelope=value},
    cleanup:()=>rmSync(base,{recursive:true,force:true}),
  }
}
const stage=(manager,version="1.0.0",expectedRevision=0)=>manager.stage({
  id:"acme.storage",version,expectedRevision,consent:true,
})
const grant=(manager,addon,revision,permissions=addon.requestedPermissions)=>manager.grant({
  id:addon.id,version:addon.version,digest:addon.digest,
  expectedRevision:revision,permissions,consent:true,
})

test("reviewed v2 packages are staged privately and NEVER executable",async()=>{
  const f=fixture()
  try{
    const m=f.manager()
    assert.equal((await m.catalog()).releases.length,1)
    await assert.rejects(m.stage({id:"acme.storage",version:"1.0.0",
      expectedRevision:0,consent:false}),/owner consent/)
    assert.equal(f.network.calls.length,0)
    const result=await stage(m)
    assert.equal(result.revision,1)
    assert.equal(result.executionAvailable,false)
    assert.equal(result.addon.execution,"blocked")
    assert.deepEqual(result.addon.grantedPermissions,[])
    assert.deepEqual(result.addon.requestedPermissions,["storage.read","admin.pages"])
    assert.equal((await m.catalog()).installed.addons[0].execution,"blocked")
    const root=join(dirname(accountFile(f.project,f.dataDir)),"addons-v2")
    assert.equal(readdirSync(join(root,"blobs")).length,1)
    assert.ok(existsSync(join(root,"staged.json")))
    assert.equal(lstatSync(join(root,"staged.json")).mode&0o777,0o600)
    assert.equal(f.network.calls[0].rejectUnauthorized,true)
  }finally{f.cleanup()}
})

test("permission grants are digest pinned, exact, explicitly consented and non-executable",async()=>{
  const f=fixture()
  try{
    const m=f.manager()
    const {addon}=await stage(m)
    await assert.rejects(grant(m,addon,0),/changed/)
    await assert.rejects(m.grant({id:addon.id,version:addon.version,
      digest:addon.digest,permissions:addon.requestedPermissions,
      expectedRevision:1,consent:false}),/owner consent/)
    await assert.rejects(grant(m,addon,1,["storage.read"]),/every requested/)
    await assert.rejects(grant(m,addon,1,["storage.read","network.fetch"]),/every requested|comparison|Invalid permission/)
    await assert.rejects(grant(m,{...addon,digest:"f".repeat(64)},1),/revoked|changed|incompatible|not approved/i)
    const granted=await grant(m,addon,1)
    assert.equal(granted.addon.execution,"blocked")
    assert.deepEqual(granted.addon.grantedPermissions,addon.requestedPermissions)
    assert.equal(granted.revision,2)
    const revoked=m.revoke({id:addon.id,expectedRevision:2,consent:true})
    assert.deepEqual(revoked.addon.grantedPermissions,[])
    assert.equal(revoked.revision,3)
  }finally{f.cleanup()}
})

test("updates and rollback clear old permissions; downgrade requires explicit rollback",async()=>{
  const a=versioned("1.0.0"),b=versioned("1.1.0",["storage.read","network.fetch"])
  const f=fixture({artifacts:[a,b]})
  try{
    const m=f.manager()
    const first=await stage(m)
    await grant(m,first.addon,1)
    const upgrade=await stage(m,"1.1.0",2)
    assert.equal(upgrade.revision,3)
    assert.deepEqual(upgrade.addon.grantedPermissions,[])
    assert.deepEqual(upgrade.addon.requestedPermissions,["storage.read","network.fetch"])
    await assert.rejects(stage(m,"1.0.0",3),/explicit rollback/)
    const rolled=await m.rollback({id:a.release.manifest.id,version:"1.0.0",
      expectedRevision:3,consent:true})
    assert.equal(rolled.addon.version,"1.0.0")
    assert.deepEqual(rolled.addon.grantedPermissions,[])
    assert.equal(rolled.addon.execution,"blocked")
    assert.deepEqual((await m.catalog()).installed.history.map(x=>x.operation),[
      "stage","grant","stage","rollback"
    ])
    await assert.rejects(grant(m,upgrade.addon,4),/Pinned release changed/)
  }finally{f.cleanup()}
})

test("revoked and expired records fail closed BEFORE downloading",async()=>{
  const a=versioned("1.0.0")
  const f=fixture({artifacts:[a],releases:[{...a.release,status:"revoked"}]})
  try{
    const m=f.manager()
    assert.equal((await m.catalog()).releases.length,0)
    await assert.rejects(stage(m),/revoked|incompatible|missing/)
    assert.equal(f.network.calls.length,0)
  }finally{f.cleanup()}
  const expired=fixture({artifacts:[a],expire:"2026-11-09T12:20:00Z"})
  try{
    assert.equal((await expired.manager().catalog()).registryUnavailable,true)
    await assert.rejects(stage(expired.manager()),/expired/)
    assert.equal(expired.network.calls.length,0)
  }finally{expired.cleanup()}
})

test("malformed reviewed archive, tampering and forged registry signatures cannot stage",async()=>{
  const a=versioned("1.0.0")
  const modified=Buffer.from(a.archive);modified[modified.length-1]^=1
  const f=fixture({artifacts:[{archive:modified,release:a.release}]})
  try{
    const m=f.manager()
    await assert.rejects(stage(m),/SHA-256|mismatch|archive/i)
    assert.equal((await m.catalog()).installed.revision,0)
    assert.deepEqual((await m.catalog()).installed.addons,[])
    f.envelope({...signed([a.release]),signature:"a".repeat(86)})
    await assert.rejects(stage(m),/signature|signed/)
    assert.equal(f.network.calls.length,1)
  }finally{f.cleanup()}
  const extra=versioned("1.0.0",["storage.read"],[["inject.mjs","throw Error('hi')"]])
  const bad=fixture({artifacts:[extra]})
  try{
    await assert.rejects(stage(bad.manager()),/unreviewed|unexpected/)
    assert.equal((await bad.manager().catalog()).installed.revision,0)
  }finally{bad.cleanup()}
})

test("offline revocation and uninstall remain possible; stale grants cannot survive corruption",async()=>{
  const f=fixture()
  try{
    const m=f.manager()
    const first=await stage(m)
    await grant(m,first.addon,1)
    f.offline()
    const other=f.manager()
    assert.equal((await other.catalog()).registryUnavailable,true)
    assert.deepEqual((await other.catalog()).installed.addons[0].grantedPermissions,
      ["storage.read","admin.pages"])
    await assert.rejects(grant(other,first.addon,2),/offline|registry/i)
    const revoked=other.revoke({id:first.addon.id,expectedRevision:2,consent:true})
    assert.deepEqual(revoked.addon.grantedPermissions,[])
    const removed=other.uninstall({id:first.addon.id,expectedRevision:3,consent:true})
    assert.equal(removed.privateDataPreserved,true)
    assert.equal((await other.catalog()).installed.addons.length,0)
  }finally{f.cleanup()}
})

test("Account Mode only; v1 journal never accepts v2; alpha compatibility blocks staging",async()=>{
  const f=fixture({version:"0.0.1-alpha.2"})
  try{
    const m=f.manager()
    assert.equal((await m.catalog()).releases[0].compatible,false)
    await assert.rejects(stage(m),/incompatible/)
    assert.equal(f.network.calls.length,0)
  }finally{f.cleanup()}
  const denied=fixture({mode:"developer"})
  try{
    assert.throws(()=>denied.manager(),/exclusive to Account Mode/)
  }finally{denied.cleanup()}
})

test("private journal refuses symlink replacement and survives interrupted revision conflict",async()=>{
  const f=fixture()
  try{
    const m=f.manager()
    await stage(m)
    await assert.rejects(stage(m),/changed|conflict|refresh/i)
    const path=join(dirname(accountFile(f.project,f.dataDir)),"addons-v2","staged.json")
    const backup=readFileSync(path)
    rmSync(path)
    symlinkSync(join(f.project,"nextguide.config.json"),path)
    assert.throws(()=>m.revoke({id:"acme.storage",expectedRevision:1,consent:true}),
      /symlink|linked|damaged/i)
    rmSync(path)
    writeFileSync(path,backup,{mode:0o600})
    assert.equal((await m.catalog()).installed.revision,1)
  }finally{f.cleanup()}
})


test("generated Account Mode studio gates every v2 action behind owner session and origin",()=>{
  for(const typed of [true,false]){
    const route=fullStudioRouteSource(typed)
    assert.match(route,/if \(!authorized\(request\)\)/)
    assert.match(route,/if \(!sameOrigin\(request\)\)/)
    assert.match(route,/action === "addons-v2"/)
    for(const action of ["stage","grant","revoke","rollback","uninstall"]){
      assert.ok(route.includes('action === "addon-v2-'+action+'"'),
        "missing owner-authenticated v2 route "+action)
    }
    assert.ok(route.indexOf('if (action.startsWith("addon-v2-"))') <
      route.indexOf('if (action.startsWith("addon-"))'),
      "v2 routes must not accidentally dispatch to the v1 content installer")
    assert.match(route,/createAccountV2AddonManager\(\{ project: process\.cwd\(\) \}\)/)
  }
})
