import type {
  V2Capability,ReviewedV2Release
} from "./extension-v2-catalog.mjs"
export interface StagedV2Addon {
  id:string
  name:string
  version:string
  digest:string
  requestedPermissions:V2Capability[]
  grantedPermissions:V2Capability[]
  availableVersions:string[]
  reviewer:string
  reviewedAt:string
  execution:"blocked"
}
export interface V2Activity {
  revision:number
  at:string
  operation:"stage"|"update"|"grant"|"revoke"|"rollback"|"uninstall"
  id:string
  version:string
}
export interface V2StagingCatalog {
  configured:boolean
  registryUnavailable:boolean
  releases:Array<ReviewedV2Release & {compatible:boolean}>
  installed:{revision:number;addons:StagedV2Addon[];history:V2Activity[]}
  nextguideVersion:string
  executionAvailable:false
}
export declare function createAccountV2AddonManager(options?:{
  project?:string
  dataDir?:string
  nextguideVersion?:string
  registryUrl?:string
  pinnedPublicKeyPem?:string
  now?:()=>number
  registryFetch?:typeof fetch
  resolver?:(...args:any[])=>Promise<Array<{address:string;family:number}>>
  transport?:(...args:any[])=>any
}):{
  catalog():Promise<V2StagingCatalog>
  stage(input:{
    id:string;version:string;expectedRevision:number;consent:true
  }):Promise<{revision:number;addon:StagedV2Addon;executionAvailable:false}>
  grant(input:{
    id:string;version:string;digest:string
    permissions:V2Capability[]
    expectedRevision:number;consent:true
  }):Promise<{revision:number;addon:StagedV2Addon;executionAvailable:false}>
  revoke(input:{
    id:string;expectedRevision:number;consent:true
  }):{revision:number;addon:StagedV2Addon;executionAvailable:false}
  rollback(input:{
    id:string;version:string;expectedRevision:number;consent:true
  }):Promise<{revision:number;addon:StagedV2Addon;executionAvailable:false}>
  uninstall(input:{
    id:string;expectedRevision:number;consent:true
  }):{revision:number;removed:string;privateDataPreserved:true;executionAvailable:false}
}
