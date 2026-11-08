import type { InstalledAddon } from "./extension-install-state.mjs"
export type AccountAddonCatalog = {
  configured: boolean
  catalogFresh: boolean
  releases: Array<{
    manifest: {
      id: string
      name: string
      version: string
      category: string
      compatibility: { mode: "account"; nextguide: string }
      permissions: string[]
    }
    compatible: boolean
    digest: string
    size: number
    reviewer: string
    status: string
    [key: string]: unknown
  }>
  installed: { revision: number; addons: InstalledAddon[] }
  nextguideVersion: string
}
export declare function createAccountAddonManager(options?: {
  project?: string
  dataDir?: string
  /** Trusted test override; installed package version is used by default. */
  nextguideVersion?: string
  registryUrl?: string
  pinnedPublicKeyPem?: string
  now?: () => number
  registryFetch?: typeof fetch
  resolver?: (...args: any[]) => Promise<Array<{ address: string; family: number }>>
  transport?: (...args: any[]) => any
}): {
  catalog(): Promise<AccountAddonCatalog>
  install(input: {
    id: string
    version: string
    expectedRevision: number
    consent: true
  }): Promise<{revision: number; addon: InstalledAddon}>
  toggle(input: {
    id: string
    enabled: boolean
    expectedRevision: number
  }): Promise<{revision: number; addon: InstalledAddon}>
  rollback(input: {
    id: string
    version: string
    expectedRevision: number
    consent: true
  }): Promise<{revision: number; addon: InstalledAddon}>
  uninstall(input: {
    id: string
    expectedRevision: number
    consent: true
  }): {revision: number; removed: string; privateDataPreserved: true}
  publicPages(): Promise<Array<{id: string; version: string; slug: string; title: string; group: string; markdown: string}>>
  readEnabled(input: {id: string}): Promise<null | {
    id: string
    version: string
    manifest: { name: string; entrypoints: { content: string } } & Record<string, unknown>
    icon: { path: string; bytes: Buffer }
    pages: Array<{ path: string; markdown: string }>
  }>
}
