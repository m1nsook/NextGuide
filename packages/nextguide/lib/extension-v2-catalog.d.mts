/** Read-only signed v2 registry protocol; never an execution permission grant. */
export type V2Capability =
  | "docs.pages" | "mdx.blocks" | "ui.components" | "admin.pages"
  | "theme.tokens" | "icons.packs" | "i18n.locales" | "ai.providers"
  | "auth.providers" | "server.routes" | "server.jobs"
  | "storage.read" | "storage.write" | "network.fetch" | "secrets.read"
export interface V2ExecutableManifest {
  schemaVersion: 2
  id: string
  name: string
  version: string
  repository: string
  category: string
  compatibility: { mode:"account"; nextguide:string }
  permissions: V2Capability[]
  entrypoints: {server:"dist/server.mjs"}
  icon?:string
  summary?:string
  description?:string
  author?:{name:string;url?:string}
  license?:string
  keywords?:string[]
  $schema?:string
}
export interface V2ReviewAttestation {
  policy:"independent-human"
  reviewer:string
  approvedAt:string
  sourceCommit:string
  sourcePath:string
  sourceSha256:string
  serverSha256:string
  manifestSha256:string
  buildTool:"bun"
  format:"nextguide-single-server-v2"
}
export interface ReviewedV2Release {
  manifest:V2ExecutableManifest
  assetUrl:string
  tag:string
  commit:string
  digest:string
  size:number
  status:"active"|"revoked"
  review:V2ReviewAttestation
}
export interface VerifiedV2Registry {
  schemaVersion:2
  updatedAt:string
  expiresAt:string
  releases:ReviewedV2Release[]
}
export declare function validateV2Manifest(value:unknown):V2ExecutableManifest
export declare function verifySignedV2RegistryEnvelope(
  envelope:unknown,pinnedPublicKeyPem:string,options?:{now?:number}
):VerifiedV2Registry
export declare function listReviewedV2Releases(
  payload:VerifiedV2Registry,options?:{now?:number}
):ReviewedV2Release[]
export declare function compareV2Permissions(
  previous:readonly V2Capability[],next:readonly V2Capability[],
  approved?:readonly V2Capability[]
):{
  added:V2Capability[]
  removed:V2Capability[]
  ungranted:V2Capability[]
  requiresOwnerApproval:boolean
}
export declare function createVerifiedV2RegistryClient(options:{
  registryUrl:string
  pinnedPublicKeyPem:string
  fetchImpl?:typeof fetch
  now?:()=>number
}):{
  fetchSignedEnvelope():Promise<unknown>
  fetchVerified():Promise<VerifiedV2Registry>
  listReviewed():Promise<ReviewedV2Release[]>
}
