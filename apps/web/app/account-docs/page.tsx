import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpen, LockKeyhole, PanelsTopLeft, Settings2 } from "lucide-react"

export const metadata: Metadata = {
  title: "Account Mode — NextGuide",
  description: "Account Mode authentication is in development with authenticator-based setup and recovery codes.",
}

const planned = [
  { icon: Settings2, title: "Guided setup", description: "Configure your documentation site from a browser instead of editing configuration files." },
  { icon: PanelsTopLeft, title: "Visual editing", description: "Manage documentation pages, navigation and media using an authenticated editor." },
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
        Authenticator QR setup and recovery are being implemented. The visual CMS is still planned, and Account Mode is not included in the published alpha.
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
        Account authentication is an in-development source preview. The full CMS will be available after the editor and deployment security tests.
      </p>
    </main>
  )
}
