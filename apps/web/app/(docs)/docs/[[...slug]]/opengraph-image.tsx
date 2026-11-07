import { renderNextGuideOgImage } from "nextguide/og"
import { site } from "@/lib/site"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "NextGuide documentation preview"

import { docs } from "@/lib/source"

export async function generateStaticParams() {
  return (await docs.getPagePaths()).map((path) => ({ slug: path.split("/").filter(Boolean) }))
}

export default async function Image({ params }: { params: Promise<{ slug?: string[] }> }) {
  const slug = ((await params).slug ?? []).join("/")
  const frontmatter = await docs.getFrontmatter<{ title?: string; description?: string }>({ slug })
  return renderNextGuideOgImage({
    siteName: site.name,
    title: frontmatter.title ?? "Documentation",
    description: frontmatter.description,
    section: "Documentation",
  })
}
