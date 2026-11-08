/** Account Mode only: augment generated navigation/search with approved Markdown. */
const TAIL = "\n/** Per-request cache: one signed catalog fetch for sidebar and search. */\nconst getInstalledAddonPages = cache(async () => {\n  try {\n    return await createAccountAddonManager({ project: process.cwd() }).publicPages()\n  } catch {\n    // No unsigned/stale fallback; keep core docs usable if registry is offline.\n    return []\n  }\n})\nexport async function getSidebar() {\n  const [baseSections, verifiedPages] = await Promise.all([\n    getBaseSidebar(), getInstalledAddonPages(),\n  ])\n  if (!verifiedPages.length) return baseSections\n  const ids = [...new Set(verifiedPages.map(page => page.id))]\n  const addonItems = ids.map(id => {\n    const pages = verifiedPages.filter(page => page.id === id)\n    const path = prefix + \"/addons/\" + encodeURIComponent(id)\n    return {\n      title: pages[0].group,\n      href: path + \"/\",\n      nav: true, props: {},\n      items: pages.map(page => ({\n        title: page.title,\n        href: path + \"/\" + (page.slug ? page.slug.split(\"/\").map(encodeURIComponent).join(\"/\") + \"/\" : \"\"),\n        nav: true, props: {}, items: [],\n      })),\n    }\n  })\n  return [...baseSections, section(\"Add-ons\", \"#addons\", addonItems)]\n}\nexport async function getSearchIndex() {\n  const [baseEntries, verifiedPages] = await Promise.all([\n    getBaseSearchIndex(), getInstalledAddonPages(),\n  ])\n  return [...baseEntries, ...verifiedPages.map(page => ({\n    href: prefix + \"/addons/\" + encodeURIComponent(page.id) + \"/\" +\n      (page.slug ? page.slug.split(\"/\").map(encodeURIComponent).join(\"/\") + \"/\" : \"\"),\n    title: page.title,\n    section: \"Add-ons\",\n    group: page.group,\n    keywords: page.markdown,\n  }))]\n}\n"

export function accountAddonNavigationLibSource(original) {
  if (typeof original !== "string" ||
      !original.includes('import { createDocs } from "nextguide/mdx"') ||
      !original.includes("export async function getSidebar() {") ||
      !original.includes("export async function getSearchIndex() {")) {
    throw Error("Generated NextGuide docs library cannot be extended safely")
  }
  return original
    .replace('import { createDocs } from "nextguide/mdx"',
      'import { createDocs } from "nextguide/mdx"\\nimport { cache } from "react"\\nimport { createAccountAddonManager } from "nextguide/extensions/site-manager"'.replaceAll("\\\\n", "\\n"))
    .replace("export async function getSidebar() {", "async function getBaseSidebar() {")
    .replace("export async function getSearchIndex() {", "async function getBaseSearchIndex() {") +
    "\\n" + TAIL
}
