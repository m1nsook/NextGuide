"use client"

import { useEffect, useState, type ComponentType, type ReactNode } from "react"
import { Menu } from "lucide-react"
import { DocsNav, type LinkComponentProps } from "../docs/nav.js"
import type { NavItem } from "../../core/index.js"
import { ScrollArea, ScrollAreaViewport, ScrollBar, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, Tooltip, TooltipContent, TooltipTrigger } from "../../ui/interactive.js"
import { GitHubIcon } from "./icons.js"
import { Logo } from "./logo.js"
import { NextGuideBuildBadge } from "./build-badge.js"
import { SearchButton } from "./search.js"
import { ThemeToggle } from "./theme-toggle.js"
import { DocsVersionSelector } from "./version-selector.js"

export interface DocsSiteSidebarProps {
  items: NavItem[]
  version: string
  /** Show the prerelease/version picker on the official NextGuide site only. */
  showVersionSelector?: boolean
  siteName?: string
  basePath?: string
  homeHref?: string
  githubUrl?: string
  releaseUrl?: string
  activeHref?: string
  linkAs?: ComponentType<LinkComponentProps>
  /** undefined keeps the official NextGuide mark; "" shows the site's initial. */
  siteLogo?: string
  siteLogoAlt?: string
  /** Completely override the header brand, including name and icon. */
  siteBrand?: ReactNode
  /** Bottom sidebar attribution; installed sites enable it via ngCopyright. */
  footerEnabled?: boolean
  footerText?: string
  footerHref?: string
  /** User-supplied React component rendered instead of the default attribution. */
  footerContent?: ReactNode
}
function SiteHeaderBrand({ name, logo, alt, custom }: { name: string; logo?: string; alt?: string; custom?: ReactNode }) {
  if (custom !== undefined && custom !== null) return <>{custom}</>
  if (logo === undefined) return <Logo name={name} />
  return (
    <span className="inline-flex min-w-0 items-center gap-2 font-semibold tracking-tight">
      {logo ? <img src={logo} alt={alt || ""} className="size-5 shrink-0 object-contain" /> :
        <span aria-hidden="true" className="bg-muted text-foreground inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] text-xs font-semibold">{name.trim().charAt(0).toUpperCase() || "D"}</span>}
      <span className="truncate">{name}</span>
    </span>
  )
}
function SidebarCustomAttribution({ enabled, content }: {
  enabled?: boolean; content?: ReactNode
}) {
  if (!enabled || content == null) return null
  return <div className="border-t px-5 py-3 text-xs text-muted-foreground">{content}</div>
}
function SidebarBody({ items, version, onNavigate, siteName = "NextGuide", basePath = "/docs", homeHref = "/",
  githubUrl, releaseUrl, activeHref, linkAs, showVersionSelector = false,
  siteLogo, siteLogoAlt, siteBrand, footerEnabled, footerText, footerHref, footerContent }: DocsSiteSidebarProps & { onNavigate?: () => void }) {
  // Next.js Link is injected by the official docs. Installed sites keep regular
  // links, while basePath deployments automatically resolve /NextGuide correctly.
  const HeaderLink = linkAs ?? "a"
  const [pathname, setPathname] = useState("")
  useEffect(() => {
    setPathname(window.location.pathname)
    const update = () => setPathname(window.location.pathname)
    window.addEventListener("popstate", update)
    return () => window.removeEventListener("popstate", update)
  }, [])

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-4 px-4 pt-5 pb-4">
        <HeaderLink href={homeHref} onClick={onNavigate} aria-label={`${siteName} home`} className="flex px-2 text-[17px]">
          <SiteHeaderBrand name={siteName} logo={siteLogo} alt={siteLogoAlt} custom={siteBrand} />
        </HeaderLink>
        <SearchButton />
        {showVersionSelector ? <DocsVersionSelector version={version} basePath={basePath} releaseUrl={releaseUrl} onNavigate={onNavigate} linkAs={linkAs} /> : null}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ScrollAreaViewport className="h-full px-4 pb-6">
          <DocsNav items={items} activeHref={activeHref ?? pathname} linkAs={linkAs} onNavigate={onNavigate} />
        </ScrollAreaViewport>
        <ScrollBar />
      </ScrollArea>
      <SidebarCustomAttribution enabled={footerEnabled} content={footerContent} />
      <div className="flex items-center justify-between border-t px-6 py-3">
        <div className="-ml-2 flex items-center gap-2">
          {footerEnabled && footerContent == null ? (
            <NextGuideBuildBadge version={version} label={footerText} href={footerHref} />
          ) : null}
          {githubUrl ? <Tooltip><TooltipTrigger asChild><a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
            className="text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-md transition-colors"
          >
            <GitHubIcon />
          </a></TooltipTrigger><TooltipContent side="right">View source code</TooltipContent></Tooltip> : null}
        </div>
        <ThemeToggle />
      </div>
    </div>
  )
}

/** Desktop: sticky sidebar. Mobile: a top bar with search and a drawer. */
export function DocsSiteSidebar(props: DocsSiteSidebarProps) {
  const { items, version, siteName = "NextGuide", homeHref = "/", linkAs, siteLogo, siteLogoAlt, siteBrand } = props
  const HeaderLink = linkAs ?? "a"
  const [open, setOpen] = useState(false)

  return (
    <>
      <aside className="bg-background sticky top-0 hidden h-dvh border-r lg:block">
        <SidebarBody {...props} items={items} version={version} />
      </aside>

      <header className="bg-background/90 sticky top-0 z-30 flex h-14 items-center gap-1 border-b pr-2 pl-4 backdrop-blur lg:hidden">
        <HeaderLink href={homeHref} aria-label={`${siteName} home`} className="flex flex-1 text-base">
          <SiteHeaderBrand name={siteName} logo={siteLogo} alt={siteLogoAlt} custom={siteBrand} />
        </HeaderLink>
        <SearchButton compact />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            aria-label="Open navigation"
            className="text-muted-foreground hover:text-foreground inline-flex size-10 items-center justify-center rounded-md"
          >
            <Menu className="size-[18px]" />
          </SheetTrigger>
          <SheetContent side="left" className="w-[19rem] gap-0 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <SidebarBody {...props} items={items} version={version} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>
    </>
  )
}
