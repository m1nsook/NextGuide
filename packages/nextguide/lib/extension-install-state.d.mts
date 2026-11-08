/** Node-only Account Mode signed content archive journal. No executable add-ons. */
export type InstalledAddon = {
  id: string
  enabled: boolean
  version: string
  name: string
  availableVersions: string[]
}
export declare function compatibleAddonRange(range: unknown, version: unknown): boolean
export declare function createAccountAddonStore(config: {
  project?: string
  /** Optional trusted override for the account's private data directory. */
  dataDir?: string
  /** The ACTUALLY installed NextGuide package version. */
  nextguideVersion: string
  /** Trusted clock injection for tests only. */
  now?: () => number
}): {
  list(): { revision: number; addons: InstalledAddon[] }
  install(input: {
    envelope: unknown
    pinnedPublicKeyPem: string
    id: string
    version: string
    archive: Uint8Array
    expectedRevision: number
  }): { revision: number; addon: InstalledAddon }
  setEnabled(input: {
    id: string
    enabled: boolean
    expectedRevision: number
    envelope?: unknown
    pinnedPublicKeyPem?: string
  }): { revision: number; addon: InstalledAddon }
  rollback(input: {
    id: string
    version: string
    expectedRevision: number
    envelope: unknown
    pinnedPublicKeyPem: string
  }): { revision: number; addon: InstalledAddon }
  uninstall(input: {
    id: string
    expectedRevision: number
  }): { revision: number; removed: string; privateDataPreserved: true }
  /** Requires fresh signed release status and approved, unmodified v1 bytes. */
  readEnabled(input: {
    id: string
    envelope: unknown
    pinnedPublicKeyPem: string
  }): null | {
    id: string
    version: string
    manifest: Record<string, unknown>
    icon: { path: string; bytes: Buffer }
    pages: Array<{ path: string; markdown: string }>
  }
}
