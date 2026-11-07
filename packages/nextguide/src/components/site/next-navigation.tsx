"use client"

import { useEffect, type AnchorHTMLAttributes, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { DocsSiteSidebar, type DocsSiteSidebarProps } from "./sidebar.js"
import type { LinkComponentProps } from "../docs/nav.js"
import { SearchProvider, type SearchEntry } from "./search.js"

/**
 * Adapt Next.js Link to the docs sidebar's zero-argument onNavigate callback.
 *
 * A plain Next.js Link also accepts mouse event callbacks, but that wider
 * React prop contract is not a ComponentType<LinkComponentProps> in strict TS.
 * Keeping the adapter here avoids unsafe casts and preserves client routing.
 */
function NextDocsNavigationLink({ href, children, ...props }: LinkComponentProps) {
  return <Link href={href} {...props}>{children}</Link>
}

/**
 * Next.js App Router bridge for generated documentation sites.
 *
 * The public sidebar stays framework-agnostic. This adapter provides real
 * client-side navigation and a reactive pathname; otherwise the default <a>
 * links cause a full document reload and reset expanded sidebar folders.
 */
export function NextDocsSiteSidebar(props: Omit<DocsSiteSidebarProps, "activeHref" | "linkAs">) {
  const pathname = usePathname()
  return <DocsSiteSidebar {...props} activeHref={pathname ?? undefined} linkAs={NextDocsNavigationLink} />
}

/**
 * Markdown links are rendered through next/link, so they prefetch and never
 * trigger a browser document navigation in an installed NextGuide site.
 * Explicit external links and download links retain normal anchor behavior.
 */
export function NextDocsSiteMdxLink({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (!href || /^(?:https?:)?\/\//i.test(href) || /^(?:mailto|tel):/i.test(href) ||
      props.download !== undefined || (props.target && props.target !== "_self")) {
    return <a href={href} {...props} />
  }
  return <Link href={href} {...props} />
}

/** Search results use App Router transitions rather than location.assign. */
export function NextDocsSiteSearchProvider({ entries, children }: { entries: SearchEntry[]; children: ReactNode }) {
  const router = useRouter()
  return <SearchProvider entries={entries} onNavigate={href => router.push(href)}>{children}</SearchProvider>
}

/**
 * MDX renders ordinary HTML <a> elements, and component cards/breadcrumbs
 * also contain normal anchors. Upgrade same-origin docs links to App Router
 * navigation without rewriting user MDX or intercepting modifier clicks,
 * external websites, downloads, new tabs, and same-page anchor jumps.
 * Next.js Link already prevents its handled clicks; we skip those.
 */
export function NextDocsSiteClientNavigation({ basePath = "/docs" }: { basePath?: string }) {
  const router = useRouter()
  useEffect(() => {
    const prefix = basePath === "/" ? "/" : basePath.replace(/\/+$/, "")
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey ||
          event.metaKey || event.shiftKey || !(event.target instanceof Element)) return
      const anchor = event.target.closest("a[href]")
      if (!(anchor instanceof HTMLAnchorElement) || !anchor.closest(".ng-official-docs")) return
      if (anchor.hasAttribute("download") ||
          (anchor.target && anchor.target !== "_self") ||
          anchor.rel.split(/\s+/).includes("external")) return
      let target: URL
      try { target = new URL(anchor.href, window.location.href) }
      catch { return }
      if (target.origin !== window.location.origin || !["http:", "https:"].includes(target.protocol)) return
      const inDocs = prefix === "/" || target.pathname === prefix || target.pathname.startsWith(prefix + "/")
      if (!inDocs) return
      // Keep native hash scrolling, history semantics, and back/forward.
      if (target.pathname === window.location.pathname && target.search === window.location.search) return
      event.preventDefault()
      router.push(target.pathname + target.search + target.hash)
    }
    // The docs component catalog uses ordinary anchors in cards and previous/
    // next buttons. Warm those pages in advance just as Next's <Link> does,
    // and prevent a hard reload when the owner follows them.
    const warmed = new Set<string>()
    const prefetch = (event: MouseEvent | FocusEvent) => {
      if (!(event.target instanceof Element)) return
      const anchor = event.target.closest("a[href]")
      if (!(anchor instanceof HTMLAnchorElement) || !anchor.closest(".ng-official-docs") ||
          anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return
      let url: URL
      try { url = new URL(anchor.href, window.location.href) }
      catch { return }
      if (url.origin !== window.location.origin ||
          (prefix !== "/" && url.pathname !== prefix && !url.pathname.startsWith(prefix + "/")) ||
          url.pathname === window.location.pathname || warmed.has(url.pathname)) return
      warmed.add(url.pathname)
      router.prefetch(url.pathname)
    }
    document.addEventListener("click", onClick)
    document.addEventListener("mouseover", prefetch, { passive: true })
    document.addEventListener("focusin", prefetch, { passive: true })
    return () => {
      document.removeEventListener("click", onClick)
      document.removeEventListener("mouseover", prefetch)
      document.removeEventListener("focusin", prefetch)
    }
  }, [basePath, router])
  return null
}
