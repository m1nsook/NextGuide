"use client"

import { ArrowUpRight, X } from "lucide-react"
import { useState } from "react"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger, Tooltip, TooltipContent, TooltipTrigger } from "../../ui/interactive.js"
import { LogoMark } from "./logo.js"

/**
 * Small NextGuide attribution badge for consumer documentation sites.
 *
 * Distinct from the official Next.js development overlay: this only explains
 * the site generator, contains links and the installed NextGuide version,
 * and does not inspect pages, execute tools, or collect diagnostics.
 */
export function NextGuideBuildBadge({
  version,
  label = "Built with NextGuide",
  href = "https://m1nsook.github.io/NextGuide/",
}: {
  version: string
  label?: string
  href?: string
}) {
  // Radix renders dialogs in a portal outside .ng-official-docs. Capture the
  // active site's computed font on open so the portal matches documentation
  // typography rather than falling back to the browser's Arial default.
  const [dialogFont, setDialogFont] = useState('"Inter", "Segoe UI", system-ui, sans-serif')
  return (
    <Dialog onOpenChange={open => {
      if (!open) return
      const docsRoot = document.querySelector<HTMLElement>(".ng-official-docs")
      if (docsRoot) setDialogFont(window.getComputedStyle(docsRoot).fontFamily)
    }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label={label}
              className="group relative inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-neutral-950/90 text-white shadow-[0_8px_22px_-8px_rgba(0,0,0,.6),inset_0_0_0_1px_rgba(255,255,255,.07)] backdrop-blur-xl transition-[transform,box-shadow,background] duration-200 hover:scale-105 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-95 motion-reduce:transition-none"
            >
              <LogoMark className="size-[18px] text-white" />
            </button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
      <DialogContent style={{ fontFamily: dialogFont }} className="w-[min(25rem,calc(100vw-2rem))] max-w-[25rem] overflow-hidden p-0">
        <div className="relative border-b bg-muted/35 px-5 pt-6 pb-5">
          <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl border bg-background shadow-sm">
            <LogoMark className="size-6 text-foreground" />
          </div>
          <DialogTitle className="text-lg font-semibold tracking-tight">{label}</DialogTitle>
          <DialogDescription className="mt-2 max-w-[21rem] text-sm leading-relaxed text-muted-foreground">
            This documentation site was created with NextGuide, an independent documentation toolkit for Next.js.
          </DialogDescription>
          <DialogClose asChild>
            <button
              type="button"
              aria-label="Close NextGuide information"
              className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="size-4" />
            </button>
          </DialogClose>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">NextGuide version</span>
            <code className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs text-foreground">{version}</code>
          </div>
          <div className="grid gap-2">
            <a href={href} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-between gap-2 rounded-lg border bg-foreground px-3 text-sm font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              Learn about NextGuide <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
            <a href="https://github.com/m1nsook/NextGuide" target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-between gap-2 rounded-lg border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              View source on GitHub <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
