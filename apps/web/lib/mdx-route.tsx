import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { NavItem } from "nextguide/core"
import { isMdxNotFound, type DocsInstance } from "nextguide/mdx"
import { ClientMdx } from "@/components/mdx-client"
import { MdxPage } from "@/components/mdx-page"
import type { DocsBreadcrumbItem } from "nextguide/components"
import { getEditUrl, getNeighbours } from "./navigation"
import { site } from "./site"

interface Frontmatter {
  title?: string
  description?: string
  /** `client` renders the page with serializeMdx + MdxClient instead of RSC. */
  render?: "server" | "client"
}

export type MdxRouteProps = { params: Promise<{ slug?: string[] }> }

/** page / generateMetadata / generateStaticParams for a `[[...slug]]` MDX route at `base`. */
export function createMdxRoute(source: DocsInstance, base: string, getNavigation: () => Promise<NavItem[]>) {
  async function Page({ params }: MdxRouteProps) {
    const segments = (await params).slug ?? []
    const slug = segments.join("/")
    const href = segments.length === 0 ? base : `${base}/${slug}`

    try {
      const frontmatter = await source.getFrontmatter<Frontmatter>({ slug })
      const navigation = await getNavigation()
      const { previous, next } = getNeighbours(navigation, href)
      const markdown = await source.read({ slug })
      const findLabel = (items: NavItem[], target: string): string | undefined => {
        for (const item of items) {
          if (item.href === target) return item.title
          const nested = findLabel(item.items, target)
          if (nested) return nested
        }
        return undefined
      }
      const breadcrumbs: DocsBreadcrumbItem[] = [
        { title: base === "/docs" ? "Documentation" : base === "/components" ? "Components" : "Docs", href: base },
        ...segments.map((segment, index) => {
          const path = base + "/" + segments.slice(0, index + 1).join("/")
          const final = index === segments.length - 1
          return {
            title: final && frontmatter.title ? frontmatter.title
              : findLabel(navigation, path) ?? segment.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            ...(final ? {} : findLabel(navigation, path) ? { href: path } : {}),
          }
        }),
      ]
      const shared = {
        title: frontmatter.title,
        description: frontmatter.description,
        markdown,
        breadcrumbs,
        editUrl: getEditUrl(source, slug),
        previous,
        next,
      }

      if (frontmatter.render === "client") {
        const { serialized, toc } = await source.serialize({ slug })
        return (
          <MdxPage {...shared} toc={toc}>
            <ClientMdx serialized={serialized} />
          </MdxPage>
        )
      }

      const { MDX, toc } = await source.parse({ slug })
      return (
        <MdxPage {...shared} toc={toc}>
          {MDX}
        </MdxPage>
      )
    } catch (error) {
      if (isMdxNotFound(error)) notFound()
      throw error
    }
  }

  async function generateMetadata({ params }: MdxRouteProps): Promise<Metadata> {
    try {
      const frontmatter = await source.getFrontmatter<Frontmatter>({ slug: ((await params).slug ?? []).join("/") })
      const slug = ((await params).slug ?? []).join("/")
      const imagePath = `og${base}/${slug || "index"}.png`.replace(/^\//, "")
      const imageUrl = new URL(imagePath, site.url.replace(/\/?$/, "/")).toString()
      const title = frontmatter.title ?? "Documentation"
      const description = frontmatter.description
      return { title, description,
        openGraph: { title, description, images: [{ url: imageUrl, width: 1200, height: 630, alt: title }] },
        twitter: { card: "summary_large_image", images: [imageUrl] },
      }
    } catch {
      return {}
    }
  }

  async function generateStaticParams() {
    const paths = await source.getPagePaths()
    return paths.map((path) => ({ slug: path.split("/").filter(Boolean) }))
  }

  return { Page, generateMetadata, generateStaticParams }
}
