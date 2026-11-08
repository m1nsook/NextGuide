import type {
  V2ExecutableManifest,V2ReviewAttestation
} from "./extension-v2-catalog.mjs"
/**
 * Approved source and compiled code BYTES in memory, not an execution grant.
 * Must never be imported into Next.js. OS sandbox and owner permissions required.
 */
export interface VerifiedV2Artifact {
  id:string
  version:string
  manifest:V2ExecutableManifest
  archiveSha256:string
  source:{path:string;sha256:string;text:string}
  compiled:{path:"dist/server.mjs";sha256:string;code:string}
  review:V2ReviewAttestation
}
export declare function verifyReviewedV2Archive(options:{
  envelope:unknown
  pinnedPublicKeyPem:string
  id:string
  version:string
  archive:Uint8Array
  now?:number
}):VerifiedV2Artifact
