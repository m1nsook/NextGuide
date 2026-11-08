import test from "node:test"
import assert from "node:assert/strict"
import { createHash, generateKeyPairSync, sign } from "node:crypto"
import { gzipSync } from "node:zlib"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync,
  symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { accountFile, createBootstrap } from "../lib/account-auth.mjs"
import { createAccountAddonStore, compatibleAddonRange } from "../lib/extension-install-state.mjs"

const FIXED_NOW = Date.parse("2026-11-08T16:00:00Z")
const keys = generateKeyPairSync("ed25519")
const pem = keys.publicKey.export({ format:"pem", type:"spki" })
const keyId = createHash("sha256").update(keys.publicKey.export({
  format: "der", type: "spki",
})).digest("hex").slice(0,24)
function manifest(version, id = "acme.readme") {
  return {
    schemaVersion:1, id, name:"Documentation Add-on",version,
    category:"content", repository:"https://github.com/acme/readme",
    compatibility:{mode:"account",nextguide:">=1.0.0 <2.0.0"},
    permissions:[], entrypoints:{content:"content"},icon:"icon.png",
  }
}
function tarMember(path, bytes) {
  bytes=Buffer.from(bytes)
  const header=Buffer.alloc(512)
  header.write(path,0,100)
  header.write("0000644\0",100,8)
  header.write("0000000\0",108,8)
  header.write("0000000\0",116,8)
  header.write(bytes.length.toString(8).padStart(11,"0")+"\0",124,12)
  header.write("00000000000\0",136,12)
  header.fill(32,148,156)
  header.write("0",156)
  header.write("ustar\0",257)
  header.write("00",263)
  const checksum=header.reduce((a,n)=>a+n,0)
  header.write(checksum.toString(8).padStart(6,"0")+"\0 ",148,8)
  return Buffer.concat([header,bytes,Buffer.alloc((512-bytes.length%512)%512)])
}
function png() {
  const bytes=Buffer.alloc(48)
  Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes,0)
  bytes.writeUInt32BE(13,8)
  bytes.write("IHDR",12)
  bytes.writeUInt32BE(32,16)
  bytes.writeUInt32BE(32,20)
  return bytes
}
function packed(version) {
  const m=manifest(version)
  const tar=Buffer.concat([
    tarMember("nextguide-addon.json",JSON.stringify(m)),
    tarMember("icon.png",png()),
    tarMember("content/index.md","# Verified add-on "+version+"\n"),
    Buffer.alloc(1024)
  ])
  const archive=gzipSync(tar,{level:9,mtime:0})
  const digest=createHash("sha256").update(archive).digest("hex")
  return {
    manifest:m,archive,release: {
      manifest:m,tag:"v"+version,commit:"a".repeat(40),digest,
      assetUrl:"https://github.com/acme/readme/releases/download/v"+version+
        "/nextguide-addon-"+version+".tgz",
      size:archive.length,status:"active",reviewer:"ngapi-reviewer",
      approvedAt:"2026-11-08T15:59:00Z"
    }
  }
}
function signed(releases, updatedAt="2026-11-08T15:59:00Z") {
  const payload=Buffer.from(JSON.stringify({schemaVersion:1,updatedAt,releases}))
  return {schemaVersion:1,algorithm:"Ed25519",keyId,
    body:payload.toString("base64url"),
    signature:sign(null,payload,keys.privateKey).toString("base64url")}
}
function fixture(version = "1.0.0", mode = "account") {
  const base=mkdtempSync(join(tmpdir(),"nextguide-install-journal-"))
  const project=join(base,"site")
  const dataDir=join(base,"private")
  mkdirSync(project)
  writeFileSync(join(project,"nextguide.config.json"),JSON.stringify({
    mode,contentDir:"content/docs"
  }))
  createBootstrap(project,{dataDir})
  const now=()=>FIXED_NOW
  const store=createAccountAddonStore({project,dataDir,nextguideVersion:version,now})
  return {base,project,dataDir,store,cleanup(){rmSync(base,{recursive:true,force:true})}}
}
function request(archive, envelope, expectedRevision, key=pem) {
  return {id:"acme.readme",version:archive.manifest.version,
    archive:archive.archive,envelope,pinnedPublicKeyPem:key,expectedRevision}
}

test("stable range parser fails closed and prerelease sites cannot install stable add-ons",()=>{
  assert.equal(compatibleAddonRange(">=1.0.0 <2.0.0","1.4.3"),true)
  assert.equal(compatibleAddonRange(">=1.0.0 <2.0.0","2.0.0"),false)
  assert.equal(compatibleAddonRange(">=1.0.0 <2.0.0","0.0.1-alpha.2"),false)
  assert.equal(compatibleAddonRange("^1.0.0","1.0.0"),false)
  const f=fixture("0.0.1-alpha.2")
  try{
    assert.deepEqual(f.store.list(),{revision:0,addons:[],history:[]})
    const v1=packed("1.0.0")
    assert.throws(()=>f.store.install(request(v1,signed([v1.release]),0)),/incompatible/)
  }finally{f.cleanup()}
})

test("install, re-enable, update, rollback and uninstall preserve safe private state",()=>{
  const f=fixture()
  try{
    const v1=packed("1.0.0"),v2=packed("1.1.0")
    const envelope=signed([v1.release,v2.release])
    const a=f.store.install(request(v1,envelope,0))
    assert.equal(a.revision,1)
    assert.equal(a.addon.enabled,false)
    assert.equal(a.addon.version,"1.0.0")
    assert.equal(f.store.readEnabled({id:"acme.readme",envelope,pinnedPublicKeyPem:pem}),null)
    const b=f.store.setEnabled({id:"acme.readme",enabled:true,expectedRevision:1,
      envelope,pinnedPublicKeyPem:pem})
    assert.equal(b.revision,2)
    const current=f.store.readEnabled({id:"acme.readme",envelope,pinnedPublicKeyPem:pem})
    assert.match(current.pages[0].markdown,/1\.0\.0/)
    const update=f.store.install(request(v2,envelope,2))
    assert.deepEqual(update.addon.availableVersions,["1.0.0","1.1.0"])
    assert.equal(update.addon.enabled,true)
    assert.match(f.store.readEnabled({id:"acme.readme",envelope,pinnedPublicKeyPem:pem})
      .pages[0].markdown,/1\.1\.0/)
    const back=f.store.rollback({id:"acme.readme",version:"1.0.0",expectedRevision:3,
      envelope,pinnedPublicKeyPem:pem})
    assert.equal(back.addon.version,"1.0.0")
    assert.equal(back.addon.enabled,false)
    const disable=f.store.setEnabled({id:"acme.readme",enabled:false,expectedRevision:4})
    assert.equal(disable.revision,5)
    // Reinstall a previously saved version never duplicates the rollback history.
    const forward=f.store.install(request(v2,envelope,5))
    assert.deepEqual(forward.addon.availableVersions,["1.0.0","1.1.0"])
    const reloaded=createAccountAddonStore({
      project:f.project,dataDir:f.dataDir,nextguideVersion:"1.0.0",now:()=>FIXED_NOW
    })
    assert.equal(reloaded.list().addons[0].version,"1.1.0")
    const removed=reloaded.uninstall({id:"acme.readme",expectedRevision:6})
    assert.equal(removed.privateDataPreserved,true)
    assert.deepEqual(reloaded.list().addons,[])
  }finally{f.cleanup()}
})

test("denied stale, revoked or modified releases cannot enable or roll back",()=>{
  const f=fixture()
  try{
    const v1=packed("1.0.0"),v2=packed("1.1.0")
    const current=signed([v1.release,v2.release])
    f.store.install(request(v1,current,0))
    f.store.install(request(v2,current,1))
    const revoked=signed([{...v1.release,status:"revoked"},v2.release])
    assert.throws(()=>f.store.rollback({
      id:"acme.readme",version:"1.0.0",expectedRevision:2,
      envelope:revoked,pinnedPublicKeyPem:pem,
    }),/revoked|changed/)
    assert.equal(f.store.list().revision,2)
    const changed=signed([v1.release,{...v2.release,digest:"f".repeat(64)}])
    assert.throws(()=>f.store.setEnabled({
      id:"acme.readme",enabled:true,expectedRevision:2,
      envelope:changed,pinnedPublicKeyPem:pem,
    }),/revoked|changed/)
    const stale=signed([v2.release],"2026-11-06T00:00:00Z")
    assert.throws(()=>f.store.setEnabled({
      id:"acme.readme",enabled:true,expectedRevision:2,
      envelope:stale,pinnedPublicKeyPem:pem,
    }),/too old/)
    assert.equal(f.store.list().revision,2)
  }finally{f.cleanup()}
})

test("tampered archives and stale revisions never change installation state",()=>{
  const f=fixture()
  try{
    const v1=packed("1.0.0"),v2=packed("1.1.0")
    const envelope=signed([v1.release,v2.release])
    f.store.install(request(v1,envelope,0))
    assert.throws(()=>f.store.install(request(v2,envelope,0)),/index changed/)
    const tampered={...v2,archive:Buffer.from(v2.archive)}
    tampered.archive[tampered.archive.length-1]^=1
    assert.throws(()=>f.store.install(request(tampered,envelope,1)),/SHA-256 mismatch/)
    assert.equal(f.store.list().addons[0].version,"1.0.0")
    const installed=f.store.setEnabled({id:"acme.readme",enabled:true,expectedRevision:1,
      envelope,pinnedPublicKeyPem:pem})
    assert.equal(installed.revision,2)
    const blob=join(dirname(accountFile(f.project,f.dataDir)),"addons","blobs",
      v1.release.digest+".tgz")
    const corrupted=Buffer.from(readFileSync(blob));corrupted[corrupted.length-1]^=1
    writeFileSync(blob,corrupted)
    assert.throws(()=>f.store.readEnabled({
      id:"acme.readme",envelope,pinnedPublicKeyPem:pem,
    }),/digest changed/)
    assert.throws(()=>f.store.setEnabled({
      id:"acme.readme",enabled:true,expectedRevision:2,
      envelope,pinnedPublicKeyPem:pem,
    }),/digest changed/)
    assert.equal(f.store.list().revision,2)
  }finally{f.cleanup()}
})

test("isolation rejects Developer Mode and symlink redirects to private state",()=>{
  const base=mkdtempSync(join(tmpdir(),"nextguide-store-guard-"))
  const project=join(base,"project"), dataDir=join(base,"data")
  mkdirSync(project)
  writeFileSync(join(project,"nextguide.config.json"),JSON.stringify({
    mode:"developer",contentDir:"content/docs"
  }))
  createBootstrap(project,{dataDir})
  try{
    assert.throws(()=>createAccountAddonStore({
      project,dataDir,nextguideVersion:"1.0.0"
    }),/only supported in Account Mode/)
    const config=join(project,"nextguide.config.json")
    rmSync(config)
    symlinkSync(join(dataDir,"state.json"),config)
    assert.throws(()=>createAccountAddonStore({
      project,dataDir,nextguideVersion:"1.0.0"
    }),/unsafe add-on file/)
  }finally{rmSync(base,{recursive:true,force:true})}
})

test("private journal records successful lifecycle changes, not denied transactions",()=>{
  const f=fixture()
  try {
    const v1=packed("1.0.0"),v2=packed("1.1.0")
    const envelope=signed([v1.release,v2.release])
    f.store.install(request(v1,envelope,0))
    f.store.setEnabled({id:"acme.readme",enabled:true,expectedRevision:1,
      envelope,pinnedPublicKeyPem:pem})
    assert.throws(()=>f.store.install(request(v2,envelope,0)),/index changed/)
    assert.deepEqual(f.store.list().history.map(e=>e.operation),["install","enable"])
    f.store.install(request(v2,envelope,2))
    f.store.rollback({id:"acme.readme",version:"1.0.0",expectedRevision:3,
      envelope,pinnedPublicKeyPem:pem})
    const history=f.store.list().history
    assert.deepEqual(history.map(e=>e.operation),["install","enable","update","rollback"])
    assert.deepEqual(history.map(e=>e.revision),[1,2,3,4])
    assert.ok(history.every(e=>e.at===new Date(FIXED_NOW).toISOString()))
    assert.ok(history.every(e=>Object.keys(e).sort().join(",")==="at,id,operation,revision,version"))
    f.store.rollback({id:"acme.readme",version:"1.1.0",expectedRevision:4,
      envelope,pinnedPublicKeyPem:pem})
    assert.equal(f.store.list().history.at(-1).operation,"rollback",
      "Restoring a newer cached version is still an explicit rollback")
    const refreshed=f.store.list().history
    const restarted=createAccountAddonStore({
      project:f.project,dataDir:f.dataDir,nextguideVersion:"1.0.0",now:()=>FIXED_NOW,
    })
    assert.deepEqual(restarted.list().history,refreshed)
    restarted.uninstall({id:"acme.readme",expectedRevision:5})
    assert.equal(restarted.list().history.at(-1).operation,"uninstall")
    assert.equal(restarted.list().addons.length,0)
  } finally { f.cleanup() }
})

test("older v1 installed indexes without activity history remain readable",()=>{
  const f=fixture()
  try {
    const v1=packed("1.0.0"),envelope=signed([v1.release])
    f.store.install(request(v1,envelope,0))
    const index=join(dirname(accountFile(f.project,f.dataDir)),"addons","installed.json")
    const old=JSON.parse(readFileSync(index,"utf8"))
    delete old.history
    writeFileSync(index,JSON.stringify(old))
    assert.deepEqual(f.store.list().history,[])
    f.store.setEnabled({id:"acme.readme",enabled:true,expectedRevision:1,
      envelope,pinnedPublicKeyPem:pem})
    assert.deepEqual(f.store.list().history.map(e=>e.revision),[2])
  } finally { f.cleanup() }
})
