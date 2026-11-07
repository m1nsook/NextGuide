"use client"

import { Suspense, useDeferredValue, useEffect, type AnchorHTMLAttributes, type ReactNode } from "react"
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
  return <Link href={href} prefetch={true} {...props}>{children}</Link>
}

/**
 * Next.js App Router bridge for generated documentation sites.
 *
 * The public sidebar stays framework-agnostic. This adapter requests full\n * page content in advance instead of only the Next.js 16 partial route shell.\n * It provides real
 * client-side navigation and a reactive pathname; otherwise the default <a>
 * links cause a full document reload and reset expanded sidebar folders.
 */
export function NextDocsSiteSidebar(props: Omit<DocsSiteSidebarProps, "activeHref" | "linkAs"> & { prewarm?: boolean }) {
  const { prewarm = false, ...sidebarProps } = props
  const pathname = usePathname()
  const router = useRouter()

  // Developer Mode MDX is file-backed; warm a bounded number of pages at idle
  // so the article, not only the Next.js route shell, is ready for next clicks.
  // Mutable Account Mode leaves this off to avoid prefetching stale CMS content.
  useEffect(() => {
    if (!prewarm) return
    const targets: string[] = []
    const seen = new Set<string>()
    const current = window.location.pathname
    const base = sidebarProps.basePath || "/docs"
    function visit(items: DocsSiteSidebarProps["items"]) {
      for (const item of items) {
        const href = item.href
        if (targets.length >= 18) return
        if (href && href.startsWith("/") && !href.startsWith("//") && href !== current &&
            (base === "/" || href === base || href.startsWith((base.endsWith("/") ? base.slice(0, -1) : base) + "/")) &&
            !seen.has(href)) {
          seen.add(href)
          targets.push(href)
        }
        if (item.items?.length) visit(item.items)
      }
    }
    visit(sidebarProps.items)
    let index = 0
    let interval: number | undefined
    const begin = window.setTimeout(() => {
      interval = window.setInterval(() => {
        const next = targets[index++]
        if (!next) { if (interval) window.clearInterval(interval); return }
        router.prefetch(next)
      }, 110)
    }, 300)
    return () => { clearTimeout(begin); if (interval) window.clearInterval(interval) }
  }, [prewarm, router, sidebarProps.items, sidebarProps.basePath])

  return <DocsSiteSidebar {...sidebarProps} activeHref={pathname ?? undefined} linkAs={NextDocsNavigationLink} />
}

/**
 * Markdown links are rendered through next/link with a full-route prefetch, so they never
 * trigger a browser document navigation in an installed NextGuide site.
 * Explicit external links and download links retain normal anchor behavior.
 */
export function NextDocsSiteMdxLink({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (!href || /^(?:https?:)?\/\//i.test(href) || /^(?:mailto|tel):/i.test(href) ||
      props.download !== undefined || (props.target && props.target !== "_self")) {
    return <a href={href} {...props} />
  }
  return <Link href={href} prefetch={true} {...props} />
}


/** Retain the previously rendered reading pane during React's deferred route update. */
function DocsReadingPlaceholder() {
  return (
    <div className="mx-auto max-w-[76rem] px-5 pt-10 pb-24 sm:px-10 lg:pt-14" role="status" aria-label="Loading documentation page">
      <span className="sr-only">Loading documentation page</span>
      <div className="max-w-3xl space-y-6 animate-pulse">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="h-9 w-3/5 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-4/5 rounded bg-muted" />
        <div className="mt-10 h-36 rounded-lg bg-muted" />
      </div>
    </div>
  )
}

/**
 * Defer reading-pane content updates so React can keep the previous article
 * visible while the next route resolves. Use a visible placeholder, not an
 * empty page, if a Suspense boundary must reveal its fallback on first load.
 */
export function NextDocsSiteContent({ children }: { children: ReactNode }) {
  const deferredChildren = useDeferredValue(children)
  return (
    <Suspense fallback={<DocsReadingPlaceholder />}>
      <div className="min-w-0" data-ng-docs-content>{deferredChildren}</div>
    </Suspense>
  )
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
