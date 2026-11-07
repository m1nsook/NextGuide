import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpen, Code2, FileCode2, GitBranch } from "lucide-react"

export const metadata: Metadata = {
  title: "Developer Mode — NextGuide",
  description: "Build and publish file-based Next.js documentation using MDX, React, Git and static generation.",
}

const features = [
  { icon: FileCode2, title: "Own your MDX files", description: "Edit documentation and components in your existing code editor." },
  { icon: GitBranch, title: "Designed for Git", description: "Review documentation changes alongside your application's code." },
  { icon: BookOpen, title: "Static-first publishing", description: "Use Next.js App Router or Pages Router and deploy wherever you already host." },
]

export default function DeveloperDocsHome() {
  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-5 py-16 sm:px-10 sm:py-24">
      <Link href="/" className="text-muted-foreground hover:text-foreground inline-flex text-sm">← NextGuide</Link>
      <div className="mt-14 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-[var(--ng-accent)]">
        <Code2 size={14} aria-hidden /> Available in alpha
      </div>
      <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">Developer Mode</h1>
      <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8">
        Full control for teams who write documentation in code. Use MDX, custom React components, Git,
        and Next.js to build a docs site that belongs to your project.
      </p>
      <div className="mt-9 flex flex-wrap gap-3">
        <Link href="/docs/getting-started/installation" className="bg-foreground text-background inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-medium">
          Install NextGuide <ArrowRight size={16} aria-hidden />
        </Link>
        <Link href="/docs" className="inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium hover:bg-muted">
          Read Developer documentation <BookOpen size={16} aria-hidden />
        </Link>
      </div>
      <section className="mt-20 grid gap-4 sm:grid-cols-3" aria-label="Developer Mode features">
        {features.map(({ icon: Icon, title, description }) => (
          <div key={title} className="rounded-xl border bg-card p-6">
            <Icon className="mb-5 size-5 text-[var(--ng-accent)]" aria-hidden />
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-6">{description}</p>
          </div>
        ))}
      </section>
      <p className="text-muted-foreground mt-10 text-sm">
        Looking for a visual editor? <Link href="/account-docs" className="text-foreground underline underline-offset-4">Explore Account Mode preview</Link>.
      </p>
    </main>
  )
}
