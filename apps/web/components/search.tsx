"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { DocsSiteSearchProvider } from "nextguide/site"
import type { SearchEntry } from "@/lib/search-index"
export { DocsSiteSearchButton as SearchButton } from "nextguide/site"

export function SearchProvider({ entries, children }: { entries: SearchEntry[]; children: ReactNode }) {
  const router = useRouter()
  return (
    <DocsSiteSearchProvider entries={entries} onNavigate={(href) => router.push(href)}>
      {children}
    </DocsSiteSearchProvider>
  )
}
