"use client"

import * as React from "react"
import { BookOpen, ChevronRight, Menu, Monitor, Moon, Search, Sun, X } from "lucide-react"
import type { NavItem } from "../../core/index.js"

export type DocsSearchItem = {
  title: string
  href: string
  description?: string
  text?: string
}

export interface DocsStarterShellProps {
  children: React.ReactNode
  navigation: NavItem[]
  searchIndex: DocsSearchItem[]
  siteName: string
  basePath: string
  mode?: "light" | "dark" | "system"
  accent?: string
}

function localHref(href: string, basePath: string): string {
  if (href === "/") return basePath
  return (basePath === "/" ? "" : basePath) + href
}

function StarterNavigation({
  items, basePath, depth = 0, onNavigate,
}: { items: NavItem[]; basePath: string; depth?: number; onNavigate: () => void }) {
  return (
    <ul className={depth === 0 ? "ng-site-nav" : "ng-site-nav-children"}>
      {items.filter((item) => item.nav).map((item) => item.items.length ? (
        <li key={item.href} className="ng-site-nav-group">
          <span className="ng-site-nav-group-label">{item.title}</span>
          <StarterNavigation items={item.items} basePath={basePath} depth={depth + 1} onNavigate={onNavigate} />
        </li>
      ) : (
        <li key={item.href}>
          <a className="ng-site-nav-link" href={localHref(item.href, basePath)} onClick={onNavigate}>
            <span>{item.title}</span><ChevronRight size={13} aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  )
}

/** A complete, framework-neutral documentation shell. Works without Tailwind or an account. */
export function DocsStarterShell({
  children, navigation, searchIndex, siteName, basePath, mode: defaultMode = "light", accent = "blue",
}: DocsStarterShellProps) {
  const [mode, setMode] = React.useState(defaultMode)
  const [systemDark, setSystemDark] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [highlight, setHighlight] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const searchTrigger = React.useRef<HTMLButtonElement>(null)
  const dark = mode === "dark" || (mode === "system" && systemDark)

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("nextguide:theme")
      if (saved === "light" || saved === "dark" || saved === "system") setMode(saved)
    } catch { /* storage may be unavailable */ }
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    setSystemDark(media.matches)
    const changed = () => setSystemDark(media.matches)
    media.addEventListener("change", changed)
    return () => media.removeEventListener("change", changed)
  }, [])

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen(true)
        setMobileOpen(false)
      } else if (event.key === "Escape") {
        setSearchOpen(false)
        setMobileOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  React.useEffect(() => {
    if (searchOpen) {
      inputRef.current?.focus()
      setHighlight(0)
    }
  }, [searchOpen])

  const results = React.useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    const matches = term
      ? searchIndex.filter((page) => (page.title + " " + (page.description ?? "") + " " + (page.text ?? "")).toLocaleLowerCase().includes(term))
      : searchIndex
    return matches.slice(0, 12)
  }, [query, searchIndex])

  function nextTheme() {
    const next = mode === "light" ? "dark" : mode === "dark" ? "system" : "light"
    setMode(next)
    try { localStorage.setItem("nextguide:theme", next) } catch { /* optional */ }
  }
  const ThemeIcon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor

  return (
    <div className="ng-starter" data-ng-theme={mode} data-ng-resolved={dark ? "dark" : "light"} data-ng-accent={accent}>
      <a className="ng-site-skip" href="#ng-site-main">Skip to content</a>
      <header className="ng-site-header">
        <div className="ng-site-header-content">
          <div className="ng-site-brand-group">
            <button type="button" className="ng-site-icon-button ng-site-mobile-trigger" onClick={() => setMobileOpen(!mobileOpen)}
              aria-expanded={mobileOpen} aria-label={mobileOpen ? "Close navigation" : "Open navigation"}>
              {mobileOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
            </button>
            <a className="ng-site-brand" href={basePath}><BookOpen size={20} aria-hidden="true" /><strong>{siteName}</strong><span>Docs</span></a>
          </div>
          <div className="ng-site-header-actions">
            <button ref={searchTrigger} type="button" className="ng-site-search-trigger" onClick={() => setSearchOpen(true)}>
              <Search size={16} aria-hidden="true" /><span>Search documentation</span><kbd>Ctrl K</kbd>
            </button>
            <button type="button" className="ng-site-icon-button" onClick={nextTheme} title={"Theme: " + mode}
              aria-label={"Theme: " + mode + ". Switch appearance"}>
              <ThemeIcon size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      {mobileOpen ? <button type="button" className="ng-site-mobile-overlay" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /> : null}
      <div className="ng-site-grid">
        <aside className={"ng-site-sidebar" + (mobileOpen ? " ng-site-sidebar-open" : "")} aria-label="Documentation navigation">
          <button type="button" className="ng-site-sidebar-search" onClick={() => { setMobileOpen(false); setSearchOpen(true) }}>
            <Search size={15} aria-hidden="true" /><span>Search pages</span><kbd>Ctrl K</kbd>
          </button>
          <nav aria-label="Documentation pages">
            <StarterNavigation items={navigation} basePath={basePath} onNavigate={() => setMobileOpen(false)} />
          </nav>
          <div className="ng-site-sidebar-footer">
            <a href="https://github.com/m1nsook/NextGuide" target="_blank" rel="noopener noreferrer">Built with NextGuide</a>
          </div>
        </aside>
        <main id="ng-site-main" className="ng-site-main">{children}</main>
      </div>
      {searchOpen ? (
        <div className="ng-site-search-overlay" onMouseDown={(event) => { if (event.currentTarget === event.target) { setSearchOpen(false); searchTrigger.current?.focus() } }}>
          <div className="ng-site-search-dialog" role="dialog" aria-modal="true" aria-label="Search documentation">
            <div className="ng-site-search-row">
              <Search size={20} aria-hidden="true" />
              <input ref={inputRef} aria-label="Search documentation" type="search" placeholder="Search documentation…"
                value={query} onChange={(event) => { setQuery(event.target.value); setHighlight(0) }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") { event.preventDefault(); setHighlight((value) => Math.min(value + 1, results.length - 1)) }
                  if (event.key === "ArrowUp") { event.preventDefault(); setHighlight((value) => Math.max(0, value - 1)) }
                  if (event.key === "Enter" && results[highlight]) window.location.assign(results[highlight].href)
                }}
              />
              <button type="button" aria-label="Close search" onClick={() => { setSearchOpen(false); searchTrigger.current?.focus() }}><X size={18} /></button>
            </div>
            <div className="ng-site-search-results" aria-label="Search results">
              {results.length ? results.map((entry, index) => (
                <a key={entry.href} href={entry.href} className={"ng-site-search-result" + (highlight === index ? " ng-site-search-active" : "")}
                  onMouseEnter={() => setHighlight(index)}>
                  <BookOpen size={17} aria-hidden="true" />
                  <span><strong>{entry.title}</strong>{entry.description ? <small>{entry.description}</small> : null}</span>
                  <ChevronRight size={15} aria-hidden="true" />
                </a>
              )) : <p className="ng-site-search-empty">No matching pages. Try another search.</p>}
            </div>
            <p className="ng-site-search-help">↑ ↓ Navigate · Enter Open · Esc Close</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
