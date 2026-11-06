"use client"

import { useEffect, useState, type ComponentType } from "react"
import { Menu } from "lucide-react"
import { DocsNav, type LinkComponentProps } from "../docs/nav.js"
import type { NavItem } from "../../core/index.js"
import { ScrollArea, ScrollAreaViewport, ScrollBar, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, Tooltip, TooltipContent, TooltipTrigger } from "../../ui/interactive.js"
import { GitHubIcon } from "./icons.js"
import { Logo } from "./logo.js"
import { SearchButton } from "./search.js"
import { ThemeToggle } from "./theme-toggle.js"
import { DocsVersionSelector } from "./version-selector.js"

export interface DocsSiteSidebarProps {
  items: NavItem[]
  version: string
  siteName?: string
  basePath?: string
  homeHref?: string
  githubUrl?: string
  releaseUrl?: string
  activeHref?: string
  linkAs?: ComponentType<LinkComponentProps>
}
function SidebarBody({ items, version, onNavigate, siteName = "NextGuide", basePath = "/docs", homeHref = "/",
  githubUrl, releaseUrl, activeHref, linkAs }: DocsSiteSidebarProps & { onNavigate?: () => void }) {
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
        <a href={homeHref} onClick={onNavigate} aria-label={`${siteName} home`} className="flex px-2 text-[17px]">
          <Logo name={siteName} />
        </a>
        <SearchButton />
        <DocsVersionSelector version={version} basePath={basePath} releaseUrl={releaseUrl} onNavigate={onNavigate} />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ScrollAreaViewport className="h-full px-4 pb-6">
          <DocsNav items={items} activeHref={activeHref ?? pathname} linkAs={linkAs} onNavigate={onNavigate} />
        </ScrollAreaViewport>
        <ScrollBar />
      </ScrollArea>
      <div className="flex items-center justify-between border-t px-6 py-3">
        {githubUrl ? <Tooltip><TooltipTrigger asChild><a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub repository"
          className="text-muted-foreground hover:text-foreground -ml-2 inline-flex size-9 items-center justify-center rounded-md transition-colors"
        >
          <GitHubIcon />
        </a></TooltipTrigger><TooltipContent side="right">View source code</TooltipContent></Tooltip> : <span />}
        <ThemeToggle />
      </div>
    </div>
  )
}

/** Desktop: sticky sidebar. Mobile: a top bar with search and a drawer. */
export function DocsSiteSidebar(props: DocsSiteSidebarProps) {
  const { items, version, siteName = "NextGuide", homeHref = "/" } = props
  const [open, setOpen] = useState(false)

  return (
    <>
      <aside className="bg-background sticky top-0 hidden h-dvh border-r lg:block">
        <SidebarBody {...props} items={items} version={version} />
      </aside>

      <header className="bg-background/90 sticky top-0 z-30 flex h-14 items-center gap-1 border-b pr-2 pl-4 backdrop-blur lg:hidden">
        <a href={homeHref} aria-label={`${siteName} home`} className="flex flex-1 text-base">
          <Logo name={siteName} />
        </a>
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
