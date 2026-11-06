"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { NavItem } from "nextguide/core"
import { DocsSiteSidebar } from "nextguide/site"
import { site } from "@/lib/site"

/** Official docs and generated consumers render the same sidebar component. */
export function DocsSidebar({ items, version }: { items: NavItem[]; version: string }) {
  const pathname = usePathname()
  return (
    <DocsSiteSidebar items={items} version={version} siteName={site.name}
      basePath="/docs" homeHref="/" githubUrl={site.github}
      releaseUrl="https://github.com/m1nsook/NextGuide/releases"
      activeHref={pathname} linkAs={Link} />
  )
}
