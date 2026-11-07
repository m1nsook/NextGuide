/**
 * Ordinary <a> links from package MDX blocks do not go through next/link.
 * GitHub Pages deploys this site at /NextGuide; server-rendered link hrefs
 * therefore need the export prefix. Next.js Link handles basePath itself,
 * so NEVER apply this helper to a Link component.
 */
export function staticHref(href: string): string {
  if (process.env.NEXTGUIDE_PAGES !== "1") return href
  if (!href.startsWith("/") || href.startsWith("//")) return href
  if (href === "/NextGuide" || href.startsWith("/NextGuide/")) return href
  return "/NextGuide" + href
}
