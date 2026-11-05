/** Serializable font IDs persisted by the NextGuide setup wizard.
 * Fonts are loaded locally by Next.js next/font in the host application.
 * Segoe UI is a system font and must never be redistributed.
 */
export const FONT_FAMILIES = [
  { id: "inter", label: "Inter", category: "sans", source: "google", family: 'var(--ng-font-inter), "Inter", Arial, sans-serif', description: "Neutral, clear, and readable." },
  { id: "geist", label: "Geist", category: "sans", source: "google", family: 'var(--ng-font-geist), "Geist", Arial, sans-serif', description: "Modern, compact, and precise." },
  { id: "ibm-plex-sans", label: "IBM Plex Sans", category: "sans", source: "google", family: 'var(--ng-font-ibm-plex-sans), "IBM Plex Sans", Arial, sans-serif', description: "Technical with a distinct personality." },
  { id: "segoe-ui", label: "Segoe UI", category: "sans", source: "system", family: '"Segoe UI", system-ui, sans-serif', description: "Native Windows feel. Uses installed system fonts." },
  { id: "system", label: "System UI", category: "sans", source: "system", family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', description: "Respects each visitor's operating system." },
  { id: "jetbrains-mono", label: "JetBrains Mono", category: "mono", source: "google", family: 'var(--ng-font-jetbrains-mono), "JetBrains Mono", Consolas, monospace', description: "Clear coding punctuation and ligatures." },
  { id: "geist-mono", label: "Geist Mono", category: "mono", source: "google", family: 'var(--ng-font-geist-mono), "Geist Mono", Consolas, monospace', description: "Minimal modern code styling." },
  { id: "ibm-plex-mono", label: "IBM Plex Mono", category: "mono", source: "google", family: 'var(--ng-font-ibm-plex-mono), "IBM Plex Mono", Consolas, monospace', description: "Developer-oriented character shapes." },
  { id: "system-mono", label: "System Monospace", category: "mono", source: "system", family: 'ui-monospace, "Cascadia Code", Consolas, monospace', description: "Uses native system monospace fonts." },
] as const

export type FontId = typeof FONT_FAMILIES[number]["id"]
export type FontSelection = { body: FontId; heading: FontId; code: FontId }
export const DEFAULT_FONTS: FontSelection = { body: "inter", heading: "inter", code: "jetbrains-mono" }

export function getFontById(id: string) {
  return FONT_FAMILIES.find(font => font.id === id)
}
export function validateFontSelection(value: FontSelection): boolean {
  return (["body", "heading", "code"] as const).every(key => {
    const font = getFontById(value[key])
    return !!font && (key === "code" ? font.category === "mono" : font.category === "sans")
  })
}
