/**
 * Account Mode v2 review intake and private owner-consent journal.
 *
 * IMPORTANT: this stores verified executable packages as inert private BYTES.
 * No runtime handles, executable entrypoints, dynamic imports, browser scripts
 * or "enabled" state are exposed. Grants are version+digest+permission bound
 * but still DO NOT authorize execution until the separate isolation gate ships.
 *
 * V1 Markdown installations remain in their own independent journal.
 */
import { createHash, randomBytes } from "node:crypto"
import {
  closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync,
  realpathSync, renameSync, unlinkSync, writeFileSync, linkSync,
} from "node:fs"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { createRequire } from "node:module"
import { accountFile } from "./account-auth.mjs"
import { compatibleAddonRange } from "./extension-install-state.mjs"
import {
  createVerifiedV2RegistryClient, verifySignedV2RegistryEnvelope,
  listReviewedV2Releases, compareV2Permissions,
} from "./extension-v2-catalog.mjs"
import { verifyReviewedV2Archive } from "./extension-v2-artifacts.mjs"
import { downloadReviewedV2Release } from "./extension-download.mjs"

const require=createRequire(import.meta.url)
const FRAMEWORK_VERSION=require("../package.json").version
const ID=/^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/
const VERSION=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const PACKAGE_VERSION=/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const SHA=/^[a-f0-9]{64}$/
const MAX_ADDONS=64, MAX_VERSIONS=4, MAX_EVENTS=100
const MAX_FILE_SIZE=3*1024*1024
const ACTIONS=new Set(["stage","update","grant","revoke","rollback","uninstall"])
const clone=value=>JSON.parse(JSON.stringify(value))
const digest=bytes=>createHash("sha256").update(bytes).digest("hex")
function fail(code,message){
  const error=new Error("NextGuide v2 staging: "+message)
  error.code=code
  throw error
}
function object(x){return x!==null && typeof x==="object" && !Array.isArray(x)}
function validId(id){return typeof id==="string" && id.length<=100 && ID.test(id)}
function validVersion(v){return typeof v==="string" && VERSION.test(v)}
function validHash(s){return typeof s==="string" && SHA.test(s)}
function assertRegular(path){
  if(!existsSync(path))fail("MISSING_ARTIFACT","Required private file is missing")
  const info=lstatSync(path)
  if(!info.isFile() || info.isSymbolicLink())fail("UNSAFE_STORAGE","Refusing linked or nonregular file")
  return info
}
function cleanDir(path){
  if(!existsSync(path))mkdirSync(path,{recursive:true,mode:0o700})
  if(!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink()){
    fail("UNSAFE_STORAGE","Private directory must not be a symlink")
  }
}
function compare(a,b){
  const aa=a.split(".").map(BigInt), bb=b.split(".").map(BigInt)
  for(let i=0;i<3;i++)if(aa[i]!==bb[i])return aa[i]>bb[i]?1:-1
  return 0
}
function safeSnapshot(value){
  if(!object(value) || !validVersion(value.version) || !validHash(value.digest) ||
     !Number.isSafeInteger(value.size) || value.size<32 || value.size>MAX_FILE_SIZE ||
     typeof value.name!=="string" || value.name.length<3 || value.name.length>80 ||
     !Array.isArray(value.permissions) || value.permissions.length>16 ||
     !Array.isArray(value.grants) || value.grants.length>16 ||
     typeof value.reviewer!=="string" || value.reviewer.length>100 ||
     !Number.isFinite(Date.parse(value.reviewedAt)))return false
  try {
    compareV2Permissions([],value.permissions,value.grants)
    return value.grants.every(permission=>value.permissions.includes(permission))
  }catch{return false}
}
function safeState(value){
  if(!object(value) || value.schemaVersion!==2 ||
     !Number.isSafeInteger(value.revision) || value.revision<0 ||
     !object(value.addons) || Object.keys(value.addons).length>MAX_ADDONS ||
     !Array.isArray(value.history) || value.history.length>MAX_EVENTS){
    fail("DAMAGED_STATE","Invalid v2 private installation journal")
  }
  for(const [id,entry] of Object.entries(value.addons)){
    if(!validId(id) || !object(entry) || entry.id!==id ||
       !validVersion(entry.pinnedVersion) ||
       !Array.isArray(entry.versions) || !entry.versions.length ||
       entry.versions.length>MAX_VERSIONS ||
       new Set(entry.versions.map(v=>v.version)).size!==entry.versions.length ||
       !entry.versions.every(safeSnapshot) ||
       !entry.versions.some(v=>v.version===entry.pinnedVersion)){
      fail("DAMAGED_STATE","Invalid v2 private release entry")
    }
  }
  let last=0
  for(const event of value.history){
    if(!object(event) || !Number.isSafeInteger(event.revision) ||
       event.revision<=last || event.revision>value.revision ||
       !validId(event.id) || !validVersion(event.version) ||
       !ACTIONS.has(event.operation) || !Number.isFinite(Date.parse(event.at))) {
      fail("DAMAGED_STATE","Invalid v2 private activity history")
    }
    last=event.revision
  }
  return value
}
function initialState(){return {schemaVersion:2,revision:0,addons:{},history:[]}}
function publicEntry(entry){
  const selected=entry.versions.find(x=>x.version===entry.pinnedVersion)
  return {
    id:entry.id,name:selected.name,version:selected.version,
    digest:selected.digest,requestedPermissions:[...selected.permissions],
    grantedPermissions:[...selected.grants],
    availableVersions:entry.versions.map(x=>x.version),
    reviewer:selected.reviewer,reviewedAt:selected.reviewedAt,
    // Deliberately never an "enabled" flag; host execution is unavailable.
    execution:"blocked",
  }
}
function publicState(s){return {
  revision:s.revision,addons:Object.values(s.addons).map(publicEntry),
  history:clone(s.history),
}}

/**
 * No user-driven project paths or data roots may be passed from route input.
 * Only the owner-authenticated server constructs the manager.
 */
export function createAccountV2AddonManager({
  project=process.cwd(),dataDir,
  nextguideVersion=FRAMEWORK_VERSION,
  registryUrl=process.env.NEXTGUIDE_ADDON_V2_REGISTRY_URL,
  pinnedPublicKeyPem=process.env.NEXTGUIDE_ADDON_V2_PUBLIC_KEY_B64
    ? Buffer.from(process.env.NEXTGUIDE_ADDON_V2_PUBLIC_KEY_B64,"base64").toString("utf8"):"",
  now=()=>Date.now(), registryFetch,resolver,transport,
}={}){
  if(typeof nextguideVersion!=="string" || !PACKAGE_VERSION.test(nextguideVersion) ||
     typeof now!=="function" || !Number.isFinite(now())){
    fail("CONFIGURATION","Invalid local framework version or trusted clock")
  }
  const site=resolve(project)
  const configFile=join(site,"nextguide.config.json")
  assertRegular(configFile)
  let config
  try{config=JSON.parse(readFileSync(configFile,"utf8"))}
  catch{fail("INVALID_CONFIG","Invalid site configuration")}
  if(config?.mode!=="account" || config?.contentDir!=="content/docs"){
    fail("MODE_DENIED","Executable staging is exclusive to Account Mode")
  }
  const privateFile=accountFile(site,dataDir)
  assertRegular(privateFile)
  const privateRoot=dirname(privateFile)
  if(lstatSync(privateRoot).isSymbolicLink()){
    fail("UNSAFE_STORAGE","Private root cannot be a symlink")
  }
  const actualSite=realpathSync(site), actualPrivate=realpathSync(privateRoot)
  const rel=relative(actualSite,actualPrivate)
  if(rel==="" || (rel!==".." && !rel.startsWith(".."+sep) && !isAbsolute(rel))){
    fail("UNSAFE_STORAGE","Owner data must remain outside the served project")
  }
  const root=join(privateRoot,"addons-v2")
  const blobs=join(root,"blobs")
  cleanDir(root);cleanDir(blobs)
  const index=join(root,"staged.json")
  const lock=join(root,".lock")
  const configured=typeof registryUrl==="string" && registryUrl.length>0 &&
    typeof pinnedPublicKeyPem==="string" && pinnedPublicKeyPem.length>0
  const registry=configured?createVerifiedV2RegistryClient({
    registryUrl,pinnedPublicKeyPem,
    ...(registryFetch?{fetchImpl:registryFetch}:{}),now,
  }):null

  function state(){
    if(!existsSync(index))return initialState()
    const stat=assertRegular(index)
    if(stat.size>128*1024)fail("DAMAGED_STATE","Private v2 journal exceeds size quota")
    try{return safeState(JSON.parse(readFileSync(index,"utf8")))}
    catch{fail("DAMAGED_STATE","Private v2 journal is damaged")}
  }
  function blobFile(hash){
    if(!validHash(hash))fail("INVALID_DIGEST","Invalid artifact SHA-256")
    return join(blobs,hash+".tgz")
  }
  function checkedBlob(snapshot){
    const file=blobFile(snapshot.digest)
    const stat=assertRegular(file)
    if(stat.size!==snapshot.size)fail("CORRUPT_ARTIFACT","Stored executable archive size changed")
    const bytes=readFileSync(file)
    if(digest(bytes)!==snapshot.digest)fail("CORRUPT_ARTIFACT","Stored executable SHA-256 changed")
    return bytes
  }
  function immutableBlob(release,bytes){
    const path=blobFile(release.digest)
    if(existsSync(path)){
      checkedBlob(release)
      return
    }
    const temp=join(blobs,"."+randomBytes(16).toString("hex")+".tmp")
    try{
      writeFileSync(temp,bytes,{flag:"wx",mode:0o600})
      // Hard-link publication is exclusive. Never replace an existing
      // content-addressed blob in another site's concurrent write.
      try{linkSync(temp,path)}catch(err){if(err.code!=="EEXIST")throw err}
    }finally{if(existsSync(temp))unlinkSync(temp)}
    checkedBlob(release)
  }
  async function signed(){
    if(!registry)fail("NO_REGISTRY","Signed executable v2 registry is not configured")
    const envelope=await registry.fetchSignedEnvelope()
    const catalog=verifySignedV2RegistryEnvelope(envelope,pinnedPublicKeyPem,{now:now()})
    return {envelope,catalog}
  }
  function activeRelease(catalog,id,version,digestValue){
    if(!validId(id) || !validVersion(version))fail("INVALID_REQUEST","Invalid add-on identity")
    const release=catalog.releases.find(x=>
      x.manifest.id===id && x.manifest.version===version)
    if(!release || release.status!=="active" ||
       (digestValue && release.digest!==digestValue) ||
       !compatibleAddonRange(release.manifest.compatibility.nextguide,nextguideVersion)){
      fail("NOT_APPROVED","V2 release revoked, missing or incompatible with installed NextGuide")
    }
    return release
  }
  function approvalInput({id,expectedRevision,consent}){
    if(!validId(id) || !Number.isSafeInteger(expectedRevision) ||
       expectedRevision<0)fail("INVALID_REQUEST","An add-on ID and exact state revision are required")
    if(consent!==true)fail("CONSENT_REQUIRED","Explicit owner consent is required")
  }
  function mutate(expectedRevision,operation,id,action){
    if(!Number.isSafeInteger(expectedRevision) || expectedRevision<0){
      fail("INVALID_REQUEST","Expected state revision required")
    }
    let fd
    try{fd=openSync(lock,"wx",0o600)}
    catch{fail("BUSY","Another add-on operation is active")}
    try{
      const previous=state()
      if(previous.revision!==expectedRevision){
        fail("CONFLICT","Add-on journal changed; refresh and retry")
      }
      const next=clone(previous)
      const result=action(next)
      next.revision=previous.revision+1
      const record=next.addons[id]
      const version=record?.pinnedVersion??previous.addons[id]?.pinnedVersion
      next.history=[...previous.history,{
        revision:next.revision,at:new Date(now()).toISOString(),
        operation,id,version,
      }].slice(-MAX_EVENTS)
      safeState(next)
      const temp=join(root,"."+randomBytes(16).toString("hex")+".tmp")
      try{
        writeFileSync(temp,JSON.stringify(next)+"\n",{flag:"wx",mode:0o600})
        renameSync(temp,index)
      }finally{if(existsSync(temp))unlinkSync(temp)}
      return {revision:next.revision,...result}
    }finally{
      closeSync(fd)
      unlinkSync(lock)
    }
  }
  return {
    async catalog(){
      const installed=publicState(state())
      if(!registry)return {
        configured:false,registryUnavailable:true,releases:[],
        installed,nextguideVersion,executionAvailable:false,
      }
      try{
        const {catalog}=await signed()
        return {
          configured:true,registryUnavailable:false,
          releases:listReviewedV2Releases(catalog,{now:now()}).map(release=>({
            ...release,
            compatible:compatibleAddonRange(release.manifest.compatibility.nextguide,nextguideVersion),
          })),
          installed,nextguideVersion,executionAvailable:false,
        }
      }catch{
        return {configured:true,registryUnavailable:true,
          releases:[],installed,nextguideVersion,executionAvailable:false}
      }
    },
    /**
     * Download/verify and STAGE a reviewed, signed v2 release. No execution or
     * automatic permission grant, including on updates.
     */
    async stage({id,version,expectedRevision,consent}={}){
      approvalInput({id,expectedRevision,consent})
      if(!validVersion(version))fail("INVALID_REQUEST","Invalid reviewed release version")
      const {envelope,catalog}=await signed()
      const release=activeRelease(catalog,id,version)
      const {archive,verified}=await downloadReviewedV2Release({
        envelope,pinnedPublicKeyPem,id,version,
        now,...(resolver?{resolver}:{}),...(transport?{transport}:{}),
      })
      if(digest(archive)!==release.digest ||
         verified.compiled.sha256!==release.review.serverSha256){
        fail("CORRUPT_ARTIFACT","Downloaded v2 bundle changed")
      }
      // Latest signed revocation check at mutation time (not only before HTTPS).
      const fresh=await signed()
      activeRelease(fresh.catalog,id,version,release.digest)
      return mutate(expectedRevision,"stage",id,next=>{
        const prior=next.addons[id]
        if(!prior && Object.keys(next.addons).length>=MAX_ADDONS){
          fail("CAPACITY","Maximum staged executable add-on count reached")
        }
        if(prior && compare(version,prior.pinnedVersion)<=0){
          fail("DOWNGRADE","Use explicit rollback to restore a previous reviewed version")
        }
        const snapshot={
          version,digest:release.digest,size:release.size,
          name:release.manifest.name,
          permissions:[...release.manifest.permissions],
          grants:[],reviewer:release.review.reviewer,
          reviewedAt:release.review.approvedAt,
        }
        immutableBlob(release,archive)
        const versions=prior?
          [...prior.versions.filter(x=>x.version!==version),snapshot].slice(-MAX_VERSIONS):
          [snapshot]
        next.addons[id]={id,pinnedVersion:version,versions}
        return {addon:publicEntry(next.addons[id]),executionAvailable:false}
      })
    },
    /**
     * Consent must match the exact pinned release digest and all requested
     * capabilities. Even a granted record NEVER makes code runnable.
     */
    async grant({id,version,digest:expectedDigest,permissions,
      expectedRevision,consent}={}){
      approvalInput({id,expectedRevision,consent})
      if(!validVersion(version) || !validHash(expectedDigest) ||
         !Array.isArray(permissions)){
        fail("INVALID_REQUEST","Version, exact artifact digest and permissions are required")
      }
      const {envelope,catalog}=await signed()
      activeRelease(catalog,id,version,expectedDigest)
      return mutate(expectedRevision,"grant",id,next=>{
        const entry=next.addons[id]
        if(!entry || entry.pinnedVersion!==version)fail("NOT_INSTALLED","Pinned release changed")
        const snapshot=entry.versions.find(x=>x.version===version)
        if(!snapshot || snapshot.digest!==expectedDigest){
          fail("CONFLICT","Release hash changed; review permissions again")
        }
        const diff=compareV2Permissions([],snapshot.permissions,permissions)
        if(diff.ungranted.length || permissions.length!==snapshot.permissions.length){
          fail("PERMISSION_DENIED","Approval must match every requested capability")
        }
        verifyReviewedV2Archive({
          envelope,pinnedPublicKeyPem,id,version,
          archive:checkedBlob(snapshot),now:now(),
        })
        snapshot.grants=[...snapshot.permissions]
        return {addon:publicEntry(entry),executionAvailable:false}
      })
    },
    /** Revoke all grants OFFLINE, even when the registry has disappeared. */
    revoke({id,expectedRevision,consent}={}){
      approvalInput({id,expectedRevision,consent})
      return mutate(expectedRevision,"revoke",id,next=>{
        const entry=next.addons[id]
        if(!entry)fail("NOT_INSTALLED","No staged release")
        entry.versions.find(x=>x.version===entry.pinnedVersion).grants=[]
        return {addon:publicEntry(entry),executionAvailable:false}
      })
    },
    async rollback({id,version,expectedRevision,consent}={}){
      approvalInput({id,expectedRevision,consent})
      if(!validVersion(version))fail("INVALID_REQUEST","Invalid rollback version")
      const {envelope,catalog}=await signed()
      return mutate(expectedRevision,"rollback",id,next=>{
        const entry=next.addons[id]
        if(!entry)fail("NOT_INSTALLED","No staged executable add-on")
        const snapshot=entry.versions.find(x=>x.version===version)
        if(!snapshot || entry.pinnedVersion===version){
          fail("NOT_INSTALLED","Requested reviewed rollback version is unavailable")
        }
        activeRelease(catalog,id,version,snapshot.digest)
        verifyReviewedV2Archive({envelope,pinnedPublicKeyPem,id,version,
          archive:checkedBlob(snapshot),now:now()})
        entry.pinnedVersion=version
        snapshot.grants=[]
        return {addon:publicEntry(entry),executionAvailable:false}
      })
    },
    uninstall({id,expectedRevision,consent}={}){
      approvalInput({id,expectedRevision,consent})
      return mutate(expectedRevision,"uninstall",id,next=>{
        if(!next.addons[id])fail("NOT_INSTALLED","No staged executable add-on")
        delete next.addons[id]
        return {removed:id,privateDataPreserved:true,executionAvailable:false}
      })
    },
  }
}
