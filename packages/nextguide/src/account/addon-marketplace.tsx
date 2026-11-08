"use client"

import * as React from "react"
import { ArrowLeft, ExternalLink, PackageCheck, Puzzle, Search, ShieldCheck } from "lucide-react"
import { Badge } from "./ui/badge.js"
import { Button } from "./ui/button.js"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js"
import { Input } from "./ui/input.js"

type Manifest = {
  id: string
  name: string
  summary?: string
  description?: string
  category: string
  version: string
  repository: string
  license?: string
  author?: { name?: string }
  permissions: string[]
  compatibility: { mode: "account"; nextguide?: string }
}
type Release = {
  manifest: Manifest
  status: "active"
  reviewer: string
  approvedAt: string
  tag: string
  digest: string
  size: number
  assetUrl: string
}
type Catalog = { configured: boolean; releases: Release[] }

function ReleaseDetails({ release, back }: { release: Release; back: () => void }) {
  const { manifest: addon } = release
  return <div className="space-y-6">
    <Button variant="ghost" onClick={back} className="gap-2"><ArrowLeft className="size-4" />Back to add-ons</Button>
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex size-16 shrink-0 items-center justify-center rounded-xl border bg-muted/30"><Puzzle className="size-8 text-muted-foreground" aria-hidden="true" /></div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">{addon.name}</h1><Badge variant="secondary">v{addon.version}</Badge><Badge variant="outline"><ShieldCheck className="mr-1 size-3" />Signed release</Badge></div>
        <p className="text-sm text-muted-foreground">{addon.summary || addon.description || "Verified content add-on"}</p>
        <p className="break-all font-mono text-xs text-muted-foreground">{addon.id}</p>
      </div>
    </div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <Card><CardHeader><CardTitle>About this add-on</CardTitle><CardDescription>{addon.category} · {addon.author?.name || "Independent publisher"}</CardDescription></CardHeader><CardContent className="space-y-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{addon.description || addon.summary || "No description supplied."}</p>
        <a className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline" href={addon.repository} target="_blank" rel="noopener noreferrer">Source repository<ExternalLink className="size-3.5" /></a>
      </CardContent></Card>
      <div className="space-y-4">
        <Card><CardHeader><CardTitle>Release information</CardTitle></CardHeader><CardContent><dl className="space-y-3 text-sm">
          <div><dt className="text-muted-foreground">Compatibility</dt><dd>{addon.compatibility.nextguide || "Unspecified"}</dd></div>
          <div><dt className="text-muted-foreground">License</dt><dd>{addon.license || "Not supplied"}</dd></div>
          <div><dt className="text-muted-foreground">Reviewed by</dt><dd>{release.reviewer}</dd></div>
          <div><dt className="text-muted-foreground">Permissions</dt><dd>{addon.permissions.length ? addon.permissions.join(", ") : "No additional capabilities"}</dd></div>
        </dl></CardContent></Card>
        <Card><CardContent className="space-y-2 pt-5"><Button className="w-full" disabled><PackageCheck className="size-4" />Install (coming later)</Button><p className="text-xs text-muted-foreground">Catalog browsing is available. Site installation, updates and rollback have not been enabled.</p></CardContent></Card>
      </div>
    </div>
  </div>
}

/** Account Mode-only, owner-authenticated discovery of signed v1 releases. */
export function AccountAddonMarketplace() {
  const [catalog, setCatalog] = React.useState<Catalog | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [term, setTerm] = React.useState("")
  const [category, setCategory] = React.useState("all")
  const [chosen, setChosen] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const response = await fetch("/api/nextguide/studio/addons", {
          method: "GET", credentials: "same-origin", cache: "no-store",
        })
        if (response.status === 401) {
          window.location.replace("/login")
          return
        }
        if (!response.ok) throw Error("The verified add-on catalog could not be loaded.")
        const data = await response.json() as Catalog
        if (!data || !Array.isArray(data.releases) || typeof data.configured !== "boolean") {
          throw Error("The add-on catalog returned an invalid response.")
        }
        if (mounted) setCatalog(data)
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : "The catalog is unavailable.")
      } finally { if (mounted) setLoading(false) }
    })()
    return () => { mounted = false }
  }, [])

  const releases = catalog?.releases ?? []
  const categories = [...new Set(releases.map(r => r.manifest.category))].sort()
  const selected = chosen ? releases.find(r => r.manifest.id === chosen) : undefined
  const matching = releases.filter(r => {
    const m = r.manifest
    const query = term.trim().toLowerCase()
    return (category === "all" || m.category === category) &&
      (!query || [m.id, m.name, m.summary, m.description, m.category, m.author?.name]
        .some(s => String(s ?? "").toLowerCase().includes(query)))
  }).sort((a,b) => a.manifest.name.localeCompare(b.manifest.name))

  if (selected) return <ReleaseDetails release={selected} back={() => setChosen(null)} />
  return <div className="space-y-6">
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">Add-ons</h1><Badge variant="secondary">Catalog preview</Badge></div>
      <p className="text-sm text-muted-foreground">Discover independently reviewed NextGuide add-ons. Available in Account Mode only.</p>
    </div>
    {loading && <Card><CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground"><span className="size-4 animate-pulse rounded-full bg-muted" />Loading verified catalog…</CardContent></Card>}
    {error && <Card><CardContent className="p-5 text-sm text-destructive" role="alert">{error}</CardContent></Card>}
    {catalog && !catalog.configured && <Card><CardHeader><CardTitle>Catalog connection not configured</CardTitle><CardDescription>Your site owner must configure a trusted registry endpoint and pin its Ed25519 public key on the server. The catalog is never loaded from an unsigned or untrusted source.</CardDescription></CardHeader></Card>}
    {catalog?.configured && <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-lg"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search verified add-ons" className="pl-9" placeholder="Search by name, publisher, or category" value={term} onChange={e => setTerm(e.target.value)} /></div>
        <span className="text-sm text-muted-foreground">{matching.length} approved {matching.length === 1 ? "release" : "releases"}</span>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Filter add-on categories">
        {["all", ...categories].map(item => <Button key={item} size="sm" variant={category === item ? "secondary" : "outline"} aria-pressed={category === item} onClick={() => setCategory(item)} className="capitalize">{item === "all" ? "All add-ons" : item}</Button>)}
      </div>
      {matching.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {matching.map(release => <Card key={release.manifest.id} className="flex flex-col"><CardHeader className="flex-1">
          <div className="mb-3 flex items-center justify-between gap-2"><div className="rounded-lg border bg-muted/20 p-2"><Puzzle className="size-5" aria-hidden="true" /></div><Badge variant="outline">Verified</Badge></div>
          <CardTitle className="text-lg">{release.manifest.name}</CardTitle><CardDescription>{release.manifest.summary || release.manifest.description || "Approved add-on"} </CardDescription>
          <p className="pt-2 text-xs text-muted-foreground">{release.manifest.author?.name || "Independent publisher"} · {release.manifest.category} · v{release.manifest.version}</p>
        </CardHeader><CardContent><Button variant="outline" className="w-full" onClick={() => setChosen(release.manifest.id)}>View details</Button></CardContent></Card>)}
      </div> : <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No approved add-ons match your search.</CardContent></Card>}
      <p className="text-xs text-muted-foreground">Listings have a verified registry signature, but installed-site actions are not yet available. Revocations may change between catalog refreshes.</p>
    </>}
  </div>
}
