import Link from "next/link"
import { ArrowRight, BookOpen, Code2, Layers3, LockKeyhole, Palette, ServerCog } from "lucide-react"
import { Logo } from "@/components/logo"
import { SearchButton } from "@/components/search"
import { ThemeToggle } from "@/components/theme-toggle"
import { site } from "@/lib/site"

const features = [
  { title: "MDX documentation", description: "Documentation pages, search, navigation, code blocks, and reusable components.", icon: BookOpen, href: "/docs" },
  { title: "API reference", description: "OpenAPI-powered references built using the Aria Docs rendering engine.", icon: Layers3, href: "/reference" },
  { title: "App and Pages Router", description: "Next.js is required. We are building adapters for both router styles.", icon: Code2, href: "/docs/getting-started/routing" },
  { title: "Setup wizard", description: "Planned guided installation with site branding, themes, and an ownership token.", icon: Palette, href: "/docs/getting-started/account-mode" },
  { title: "Admin panel", description: "Planned browser CMS for pages, navigation, media, settings, and API definitions.", icon: LockKeyhole, href: "/docs/getting-started/administration" },
  { title: "File-based development", description: "Planned developer mode for MDX and configuration managed directly in your editor.", icon: ServerCog, href: "/docs/getting-started/developer-mode" },
]

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-5 px-5 sm:px-6">
          <Link href="/" aria-label="NextGuide home"><Logo /></Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <Link href="/docs" className="hover:text-foreground">Documentation</Link>
            <Link href="/components" className="hover:text-foreground">Components</Link>
            <Link href="/reference" className="hover:text-foreground">API Reference</Link>
            <a href={site.github} className="hover:text-foreground" target="_blank" rel="noopener noreferrer">GitHub</a>
          </nav>
          <div className="flex items-center gap-2"><SearchButton compact /><ThemeToggle /></div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
          <div className="relative mx-auto max-w-5xl px-5 py-24 sm:py-32">
            <span className="mb-6 inline-flex rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">Development preview · 0.1.0</span>
            <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.045em] text-balance sm:text-7xl">Documentation that starts simple and grows with you.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">NextGuide builds on Aria Docs and Next.js. Write MDX, publish API references, and follow our progress toward a guided installer and browser-based editor.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/docs/getting-started/installation" className="inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-medium text-background hover:opacity-90">Get started <ArrowRight className="size-4" /></Link>
              <a href={site.github} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md border bg-background px-5 py-3 text-sm font-medium hover:bg-muted">View source</a>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">Requires Next.js · App Router and Pages Router integration planned · Bun-first development</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
          <div className="mb-8">
            <h2 className="text-3xl font-semibold tracking-tight">Explore NextGuide</h2>
            <p className="mt-2 text-muted-foreground">A working documentation renderer today, with more authoring tools on the roadmap.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ title, description, href, icon: Icon }) => (
              <Link key={title} href={href} className="group rounded-lg border bg-card p-6 transition-colors hover:bg-muted/50">
                <Icon aria-hidden className="mb-5 size-5 text-[var(--aria-accent)]" />
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium group-hover:underline">Read more <ArrowRight className="size-3.5" /></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:grid-cols-2 sm:px-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Built with NextGuide</h2>
              <p className="mt-3 max-w-xl text-muted-foreground">This documentation website is the project’s own reference implementation. GitHub Pages serves its static export; future account-mode sites will use a persistent Next.js server.</p>
            </div>
            <div className="flex flex-wrap content-start gap-3">
              <Link href="/docs/deployment/github-pages" className="rounded-md border px-4 py-2.5 text-sm hover:bg-muted">GitHub Pages</Link>
              <Link href="/docs/getting-started/account-mode" className="rounded-md border px-4 py-2.5 text-sm hover:bg-muted">Account mode</Link>
              <Link href="/docs/getting-started/developer-mode" className="rounded-md border px-4 py-2.5 text-sm hover:bg-muted">Developer mode</Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted-foreground sm:px-6">
          <span>NextGuide · MIT-licensed · Built from Aria Docs</span>
          <div className="flex gap-5"><a href={site.github} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">GitHub</a><Link href="/docs" className="hover:text-foreground">Docs</Link></div>
        </div>
      </footer>
    </div>
  )
}
