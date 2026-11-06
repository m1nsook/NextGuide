"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Docs } from "nextguide/components"
import type { NavItem } from "nextguide/core"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "nextguide/ui"
import { site } from "@/lib/site"
import { GitHubIcon } from "./icons"
import { Logo } from "./logo"
import { SearchButton } from "./search"
import { ThemeToggle } from "./theme-toggle"
import { DocsVersionSelector } from "./version-selector"

function SidebarBody({ items, version, onNavigate }: { items: NavItem[]; version: string; onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-4 px-4 pt-5 pb-4">
        <Link href="/" onClick={onNavigate} aria-label={`${site.name} home`} className="flex px-2 text-[17px]">
          <Logo />
        </Link>
        <SearchButton />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <div className="mb-5"><DocsVersionSelector version={version} onNavigate={onNavigate} /></div>
        <Docs.Nav items={items} activeHref={pathname} linkAs={Link} onNavigate={onNavigate} />
      </div>
      <div className="flex items-center justify-between border-t px-6 py-3">
        <a
          href={site.github}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub repository"
          className="text-muted-foreground hover:text-foreground -ml-2 inline-flex size-9 items-center justify-center rounded-md transition-colors"
        >
          <GitHubIcon />
        </a>
        <ThemeToggle />
      </div>
    </div>
  )
}

/** Desktop: sticky sidebar. Mobile: a top bar with search and a drawer. */
export function DocsSidebar({ items, version }: { items: NavItem[]; version: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <aside className="bg-background sticky top-0 hidden h-dvh border-r lg:block">
        <SidebarBody items={items} version={version} />
      </aside>

      <header className="bg-background/90 sticky top-0 z-30 flex h-14 items-center gap-1 border-b pr-2 pl-4 backdrop-blur lg:hidden">
        <Link href="/" aria-label={`${site.name} home`} className="flex flex-1 text-base">
          <Logo />
        </Link>
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
            <SidebarBody items={items} version={version} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>
    </>
  )
}
