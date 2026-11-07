/** NextGuide Account Mode server-only editor API. Authenticated API routes only. */
export type SiteSettings = {
  name: string
  description: string
  url: string
  ownerName: string
  ownerEmail: string
  ownerAvatar: string
  accent: "blue" | "red" | "green" | "purple" | "yellow" | "orange" | "teal" | "pink"
  theme: "light" | "dark" | "system"
  bodyFont: "inter" | "geist" | "ibm-plex-sans" | "segoe-ui" | "system"
  headingFont: "inter" | "geist" | "ibm-plex-sans" | "segoe-ui" | "system"
  codeFont: "jetbrains-mono" | "geist-mono" | "ibm-plex-mono" | "system-mono"
  setupComplete: boolean
}
export declare const DEFAULT_SITE: Readonly<SiteSettings>
export declare const ACCOUNT_ACCENTS: readonly string[]
export declare const ACCOUNT_MODES: readonly string[]
export declare const ACCOUNT_BODY_FONTS: readonly string[]
export declare const ACCOUNT_CODE_FONTS: readonly string[]
export declare function getStudioSettings(project?: string): SiteSettings
export declare function saveStudioSettings(project: string, input: SiteSettings): SiteSettings
export declare function listStudioPages(project?: string): Array<{ slug: string; title: string; description: string; version: string; bytes: number }>
export declare function readStudioPage(project: string, slug: string): { slug: string; title: string; description: string; body: string; version: string }
export declare function saveStudioPage(project: string, input: { slug: string; title: string; description: string; body: string; version: string | null }): { slug: string; title: string; description: string; body: string; version: string; created: boolean }
export declare function deleteStudioPage(project: string, slug: string, version: string): { deleted: string }
export type StudioNavigation = { folder: string; items: Array<{ slug: string; title: string; hidden: boolean }> }
export declare function getStudioNavigation(project: string, folder?: string): StudioNavigation
export declare function setStudioNavigation(project: string, input: StudioNavigation): StudioNavigation
export declare function listStudioMedia(project: string): Array<{ name: string; url: string }>
export declare function uploadStudioMedia(project: string, mime: string, base64: string): { name: string; url: string }
export declare function deleteStudioMedia(project: string, name: string): { deleted: string }
