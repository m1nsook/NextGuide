import { BookOpenText } from "lucide-react"
import { cn } from "@ariadocs/components"

/** Shared NextGuide mark for the public site and future admin. */
export function LogoMark({ className }: { className?: string }) {
  return <BookOpenText aria-hidden className={cn("size-5 shrink-0 text-[var(--aria-accent)]", className)} />
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span>NextGuide</span>
    </span>
  )
}
