"use client"

import Link from "next/link"
import { Check, ChevronsUpDown, ExternalLink, Tag } from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "nextguide/ui"

// Official NextGuide documentation only. Not included in the npm package,
// the NextGuide docs layout primitives, or the generated Developer Mode sites.
export function DocsVersionSelector({ version, onNavigate }: {
  version: string
  onNavigate?: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Documentation version: development, v${version}`}
        className="text-foreground hover:bg-muted flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors"
      >
        <span className="text-[var(--ng-accent)] flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--ng-accent)]/35 bg-[var(--ng-accent)]/10">
          <Tag aria-hidden="true" className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold">Development</span>
          <span className="text-muted-foreground block truncate text-xs">v{version}</span>
        </span>
        <ChevronsUpDown aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-64">
        <DropdownMenuLabel>Documentation versions</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/docs" onClick={onNavigate}>
            <Check aria-hidden="true" className="size-4 text-[var(--ng-accent)]" />
            <span className="flex-1">Development</span>
            <span className="text-muted-foreground text-xs">v{version}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="https://github.com/m1nsook/NextGuide/releases" target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" className="size-4" />
            <span>Release history</span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
