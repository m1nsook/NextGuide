import { NextGuideOgCard } from "nextguide/og"
import { ImageResponse } from "next/og"
import { site } from "@/lib/site"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "NextGuide documentation preview"

import { componentDocs } from "@/lib/source"

export async function generateStaticParams() {
  return (await componentDocs.getPagePaths()).map((path) => ({ slug: path.split("/").filter(Boolean) }))
}

export default async function Image({ params }: { params: Promise<{ slug?: string[] }> }) {
  const slug = ((await params).slug ?? []).join("/")
  const frontmatter = await componentDocs.getFrontmatter<{ title?: string; description?: string }>({ slug })
  return new ImageResponse(
    <NextGuideOgCard
      siteName={site.name}
      title={frontmatter.title ?? "Components"}
      description={frontmatter.description}
      section="Components"
    />,
    size,
  )
}
