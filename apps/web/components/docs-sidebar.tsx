"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { NavItem } from "nextguide/core"
import { DocsSiteSidebar } from "nextguide/site"
import { site } from "@/lib/site"

/** Official docs and generated consumers render the same sidebar component. */
export function DocsSidebar({ items, version, basePath = "/docs", siteName = site.name, homeHref = "/" }: {
  items: NavItem[]
  version: string
  basePath?: string
  siteName?: string
  homeHref?: string
}) {
  const pathname = usePathname()
  return (
    <DocsSiteSidebar items={items} version={version} siteName={siteName}
      basePath={basePath} homeHref={homeHref} githubUrl={site.github}
      releaseUrl="https://github.com/m1nsook/NextGuide/releases"
      activeHref={pathname} linkAs={Link} showVersionSelector />
  )
}
