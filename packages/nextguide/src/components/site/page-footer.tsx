import { ArrowLeft, ArrowRight } from "lucide-react"

export interface PageLink { title: string; href: string }

/** Previous / Next cards at the end of a page. */
export function PageNav({ previous, next }: { previous?: PageLink; next?: PageLink }) {
  if (previous === undefined && next === undefined) return null

  return (
    <nav aria-label="Pagination" className="not-prose mt-16 grid gap-3 sm:grid-cols-2">
      {previous !== undefined ? (
        <a href={previous.href} className="hover:bg-muted/50 flex flex-col gap-1 rounded-xl border px-4 py-3.5 transition-colors">
          <span className="text-muted-foreground text-[13px]">Previous</span>
          <span className="inline-flex items-center gap-2 font-medium"><ArrowLeft className="size-4 shrink-0" aria-hidden="true" />{previous.title}</span>
        </a>
      ) : (
        <span className="hidden sm:block" />
      )}
      {next !== undefined ? (
        <a
          href={next.href}
          className="hover:bg-muted/50 flex flex-col items-end gap-1 rounded-xl border px-4 py-3.5 text-right transition-colors"
        >
          <span className="text-muted-foreground text-[13px]">Next</span>
          <span className="inline-flex items-center gap-2 font-medium">{next.title}<ArrowRight className="size-4 shrink-0" aria-hidden="true" /></span>
        </a>
      ) : null}
    </nav>
  )
}
