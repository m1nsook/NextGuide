import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpen, LockKeyhole, PanelsTopLeft, Settings2 } from "lucide-react"

export const metadata: Metadata = {
  title: "Account Mode — NextGuide",
  description: "Account Mode is in development: passwordless setup and a browser-based documentation editor.",
}

const planned = [
  { icon: Settings2, title: "Guided setup", description: "Site identity, accessible color presets, fonts, and optional owner profile, all through a browser." },
  { icon: PanelsTopLeft, title: "Content studio", description: "Create and edit MDX pages, arrange sidebar navigation, and upload images in a protected workspace." },
  { icon: LockKeyhole, title: "Passwordless ownership", description: "A terminal token gates authenticator enrollment, with recovery codes and protected sessions." },
]

export default function AccountDocsHome() {
  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-5 py-16 sm:px-10 sm:py-24">
      <Link href="/" className="text-muted-foreground hover:text-foreground inline-flex text-sm">← NextGuide</Link>
      <div className="text-muted-foreground mt-14 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
        <LockKeyhole size={14} aria-hidden /> Authentication preview in development
      </div>
      <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">Account Mode</h1>
      <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8">
        A guided, browser-first experience for creators who want documentation without editing MDX by hand.
        The source version includes authenticator enrollment, a site wizard, and a protected MDX editor. Account Mode has not been released to npm yet.
      </p>
      <div className="mt-9 flex flex-wrap gap-3">
        <Link href="/docs/getting-started/account-mode" className="inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium hover:bg-muted">
          Read the roadmap <ArrowRight size={16} aria-hidden />
        </Link>
        <Link href="/developer-docs" className="bg-foreground text-background inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-medium">
          Use Developer Mode now <BookOpen size={16} aria-hidden />
        </Link>
      </div>
      <section className="mt-20 grid gap-4 sm:grid-cols-3" aria-label="Planned Account Mode capabilities">
        {planned.map(({ icon: Icon, title, description }) => (
          <div key={title} className="rounded-xl border bg-card p-6">
            <Icon className="mb-5 size-5 text-[var(--ng-accent)]" aria-hidden />
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-6">{description}</p>
          </div>
        ))}
      </section>
      <p className="text-muted-foreground mt-10 text-sm">
        The CMS source implementation is under integration review. This page will publish installation commands once packaging and deployment have been verified.
      </p>
    </main>
  )
}
