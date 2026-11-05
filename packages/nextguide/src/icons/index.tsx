"use client"

import * as React from "react"
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight,
  Code2, Copy, ExternalLink, FileText, Home, Info, Link, Menu,
  Moon, Palette, Search, Settings, Sun, Terminal, X,
} from "lucide-react"
import {
  siDiscord, siGithub, siInstagram, siNpm, siReact, siTiktok,
  siVercel, siYoutube,
} from "simple-icons"

export {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight,
  Code2, Copy, ExternalLink, FileText, Home, Info, Link, Menu,
  Moon, Palette, Search, Settings, Sun, Terminal, X,
}
export type { LucideIcon, LucideProps } from "lucide-react"

const uiIcons = {
  "arrow-left": ArrowLeft, "arrow-right": ArrowRight, "book-open": BookOpen,
  check: Check, "chevron-down": ChevronDown, "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight, code: Code2, copy: Copy, "external-link": ExternalLink,
  file: FileText, home: Home, info: Info, link: Link,
  menu: Menu, moon: Moon, palette: Palette, search: Search,
  settings: Settings, sun: Sun, terminal: Terminal, x: X,
} as const

const brandIcons = {
  discord: siDiscord, github: siGithub, instagram: siInstagram,
  npm: siNpm, react: siReact,
  tiktok: siTiktok, vercel: siVercel, youtube: siYoutube,
} as const

export const uiIconNames = Object.keys(uiIcons) as (keyof typeof uiIcons)[]
export const brandIconNames = Object.keys(brandIcons) as (keyof typeof brandIcons)[]
export type UIIconName = keyof typeof uiIcons
export type BrandIconName = keyof typeof brandIcons

export function UIIcon({ name, ...props }: { name: UIIconName } & React.SVGProps<SVGSVGElement>) {
  const Component = uiIcons[name]
  return <Component aria-hidden="true" {...props} />
}

/** An SVG drawn from Simple Icons' locally bundled paths, with no runtime CDN. */
export function BrandIcon({
  name, title, color = "currentColor", ...props
}: { name: BrandIconName; title?: string; color?: string } & React.SVGProps<SVGSVGElement>) {
  const icon = brandIcons[name]
  return (
    <svg viewBox="0 0 24 24" fill={color} role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true} aria-label={title} {...props}>
      {title ? <title>{title}</title> : null}
      <path d={icon.path} />
    </svg>
  )
}
