import { createElement } from "react"
import { NextGuideOgCard } from "nextguide/og"
import { ImageResponse } from "next/og"
import { docs, componentDocs } from "@/lib/source"
import { site } from "@/lib/site"

export const dynamicParams = false

export async function generateStaticParams() {
  const groups = [{ section: "docs", source: docs }, { section: "components", source: componentDocs }]
  return (await Promise.all(groups.map(async ({ section, source }) =>
    (await source.getPagePaths()).map((path) => {
      const slug = path.split("/").filter(Boolean)
      if (!slug.length) slug.push("index")
      slug[slug.length - 1] += ".png"
      return { section, slug }
    })))).flat()
}

export async function GET(_request: Request, { params }: { params: Promise<{ section: string; slug: string[] }> }) {
  const { section, slug: routeSlug } = await params
  const source = section === "docs" ? docs : section === "components" ? componentDocs : null
  if (!source) return new Response("Unknown section", { status: 404 })
  const parts = [...routeSlug]
  if (!parts.at(-1)?.endsWith(".png")) return new Response("Not found", { status: 404 })
  parts[parts.length - 1] = parts[parts.length - 1].slice(0, -4)
  const joined = parts.join("/")
  const slug = joined === "index" ? "" : joined
  const frontmatter = await source.getFrontmatter<{ title?: string; description?: string }>({ slug })
  return new ImageResponse(
    createElement(NextGuideOgCard, {
      siteName: site.name,
      title: frontmatter.title ?? (section === "docs" ? "Documentation" : "Components"),
      description: frontmatter.description,
      section: section === "docs" ? "Documentation" : "Components",
    }),
    { width: 1200, height: 630 },
  )
}
