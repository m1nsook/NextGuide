"use client"

import { useState } from "react"
import { Check, ChevronDown, ChevronRight, Copy, MessageCircleQuestion, Pencil } from "lucide-react"
import { siGithub } from "simple-icons"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator,
} from "../../ui/interactive.js"

export interface DocsBreadcrumbItem {
  title: string
  href?: string
}

export function DocsBreadcrumbs({ items }: { items: DocsBreadcrumbItem[] }) {
  if (!items.length) return null
  return (
    <nav className="ng-breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={(item.href ?? item.title) + index}>
            {index !== 0 ? <ChevronRight size={14} aria-hidden="true" /> : null}
            {item.href && index < items.length - 1
              ? <a href={item.href}>{item.title}</a>
              : <span aria-current={index === items.length - 1 ? "page" : undefined}>{item.title}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export interface DocsPageActionsProps {
  /** Entire original MDX source. Copy-page copies this verbatim. */
  markdown: string
  title: string
  /** Optional edit URL, often a GitHub edit or blob URL. */
  editUrl?: string
}

/**
 * Build a source-aware prompt for the page tools. The URL comes from the
 * current browser location, so it includes the actual deployed base path
 * (e.g. GitHub Pages) instead of a guessed docs route.
 */
export function buildDocsChatGPTPrompt({ title, markdown, pageUrl }: {
  title: string
  markdown: string
  pageUrl: string
}): string {
  const url = new URL(pageUrl)
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Documentation page must have an HTTP(S) URL")
  }
  url.hash = ""
  url.search = ""
  const excerpt = markdown.length > 2200
    ? markdown.slice(0, 2200) + "\n[Excerpt truncated]"
    : markdown
  return [
    "Please help me understand this documentation page and answer my questions about it.",
    "Open the source URL for the complete documentation if you can access it.",
    "If you cannot access the URL, use the provided excerpt and say when context is missing.",
    "",
    "Page title: " + title,
    "Source URL: " + url.href,
    "",
    "Documentation excerpt:",
    excerpt,
  ].join("\n")
}

export function DocsPageActions({ markdown, title, editUrl }: DocsPageActionsProps) {
  const [copied, setCopied] = useState(false)

  async function copyPage() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable")
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  function askChatGPT() {
    const prompt = buildDocsChatGPTPrompt({
      title,
      markdown,
      pageUrl: window.location.href,
    })
    window.open("https://chatgpt.com/?q=" + encodeURIComponent(prompt), "_blank", "noopener,noreferrer")
  }

  const gitHubLink = !!editUrl && /^https:\/\/github\.com\//i.test(editUrl)
  return (
    <div className="ng-page-actions" aria-label="Documentation page actions">
      <button type="button" className="ng-page-action-copy" onClick={() => void copyPage()}
        aria-label={copied ? "Page copied as Markdown" : "Copy page as Markdown"}>
        {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
        <span>{copied ? "Copied" : "Copy page"}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="ng-page-action-menu" aria-label="More page actions">
            <ChevronDown size={15} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onSelect={() => void copyPage()}>
            <Copy size={15} aria-hidden="true" /> Copy Markdown
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={askChatGPT}>
            <MessageCircleQuestion size={15} aria-hidden="true" /> Ask ChatGPT
          </DropdownMenuItem>
          {editUrl ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href={editUrl} target="_blank" rel="noopener noreferrer">
                  {gitHubLink ? <svg width={15} height={15} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d={siGithub.path} /></svg> : <Pencil size={15} aria-hidden="true" />}
                  {gitHubLink ? "Edit on GitHub" : "Edit source"}
                </a>
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="ng-page-action-status" role="status" aria-live="polite">
        {copied ? "Page copied to clipboard" : ""}
      </span>
    </div>
  )
}
