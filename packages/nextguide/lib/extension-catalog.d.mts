export interface RegistryAddonRelease {
  manifest: {
    schemaVersion: 1
    id: string
    name: string
    version: string
    category: "content"
    repository: string
    compatibility: { mode: "account"; nextguide: string }
    permissions: []
  }
  commit: string
  digest: string
  assetUrl: string
  size: number
  tag: string
  reviewer: string
  approvedAt: string
  status: "active" | "revoked"
}
export interface VerifiedRegistryPayload {
  schemaVersion: 1
  updatedAt: string
  releases: RegistryAddonRelease[]
}
export interface RegistryClient {
  fetchVerified(): Promise<VerifiedRegistryPayload>
  listApproved(): Promise<RegistryAddonRelease[]>
}
export declare function verifySignedRegistryEnvelope(envelope: unknown, pinnedPublicKeyPem: string): VerifiedRegistryPayload
export declare function listVerifiedAddons(payload: unknown): RegistryAddonRelease[]
export declare function createVerifiedRegistryClient(args: {
  registryUrl: string
  pinnedPublicKeyPem: string
  fetchImpl?: typeof fetch
}): RegistryClient
