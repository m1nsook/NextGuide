"use client"

import * as React from "react"
import {
  ArrowLeft, ExternalLink, PackageCheck, Power, Puzzle, RotateCcw,
  Search, ShieldCheck, Trash2,
} from "lucide-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "./ui/alert-dialog.js"
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
  compatible: boolean
}
type InstalledAddon = {
  id: string
  enabled: boolean
  version: string
  name: string
  availableVersions: string[]
}
type AddonActivity = {
  revision: number
  at: string
  id: string
  version: string
  operation: "install" | "update" | "rollback" | "enable" | "disable" | "uninstall" | "no-op"
}
type Catalog = {
  configured: boolean
  registryUnavailable?: boolean
  catalogFresh: boolean
  releases: Release[]
  installed: { revision: number; addons: InstalledAddon[]; history?: AddonActivity[] }
  nextguideVersion: string
}
type Action =
  | { kind: "install"; id: string; version: string }
  | { kind: "toggle"; id: string; enabled: boolean }
  | { kind: "rollback"; id: string; version: string }
  | { kind: "uninstall"; id: string }

function ReleaseDetails({ release, back, installed, onAction, busy, catalogFresh }: {
  release: Release
  back: () => void
  installed?: InstalledAddon
  onAction: (action: Action) => void
  busy: boolean
  catalogFresh: boolean
}) {
  const { manifest: addon } = release
  const canInstall = catalogFresh && release.compatible && addon.permissions.length === 0
  const newer = (a: string, b: string) => a.split(".").map(Number).some((n,i,all) =>
    all.slice(0,i).every((v,j)=>v===Number(b.split(".")[j])) && n>Number(b.split(".")[i]))
  const canUpdate = installed && canInstall && newer(addon.version, installed.version)
  return <div className="space-y-6">
    <Button variant="ghost" onClick={back} disabled={busy} className="gap-2">
      <ArrowLeft className="size-4" />Back to add-ons
    </Button>
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex size-16 shrink-0 items-center justify-center rounded-xl border bg-muted/30">
        <Puzzle className="size-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{addon.name}</h1>
          <Badge variant="secondary">v{addon.version}</Badge>
          <Badge variant="outline"><ShieldCheck className="mr-1 size-3" />Signed release</Badge>
          {installed && <Badge variant="secondary">Installed v{installed.version}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{addon.summary || addon.description || "Reviewed content add-on"}</p>
        <p className="break-all font-mono text-xs text-muted-foreground">{addon.id}</p>
      </div>
    </div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <Card><CardHeader><CardTitle>About this add-on</CardTitle>
        <CardDescription>{addon.category} · {addon.author?.name || "Independent publisher"}</CardDescription>
      </CardHeader><CardContent className="space-y-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{addon.description || addon.summary || "No description supplied."}</p>
        <a className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          href={addon.repository} target="_blank" rel="noopener noreferrer">
          Source repository<ExternalLink className="size-3.5" />
        </a>
        <p className="text-xs text-muted-foreground">This preview accepts reviewed plain Markdown content only.
          Enabled, verified Markdown pages are available in Account Mode documentation navigation and search.</p>
      </CardContent></Card>
      <div className="space-y-4">
        <Card><CardHeader><CardTitle>Release information</CardTitle></CardHeader>
          <CardContent><dl className="space-y-3 text-sm">
            <div><dt className="text-muted-foreground">Compatibility</dt>
              <dd>{addon.compatibility.nextguide || "Unspecified"} {release.compatible ? "· Compatible" : "· Not compatible"}</dd></div>
            <div><dt className="text-muted-foreground">License</dt><dd>{addon.license || "Not supplied"}</dd></div>
            <div><dt className="text-muted-foreground">Reviewed by</dt><dd>{release.reviewer}</dd></div>
            <div><dt className="text-muted-foreground">Permissions</dt>
              <dd>{addon.permissions.length ? addon.permissions.join(", ") : "No additional capabilities"}</dd></div>
          </dl></CardContent></Card>
        <Card><CardContent className="space-y-3 pt-5">
          {installed ? <>
            <Button variant="outline" className="w-full" disabled={busy}
              onClick={() => onAction({kind:"toggle",id:addon.id,enabled:!installed.enabled})}>
              <Power className="size-4" />{installed.enabled ? "Disable" : "Enable"} content
            </Button>
            {canUpdate && <Button className="w-full" disabled={busy}
              onClick={() => onAction({kind:"install",id:addon.id,version:addon.version})}>
              <PackageCheck className="size-4" />Update to v{addon.version}</Button>}
            {installed.availableVersions.filter(v=>v!==installed.version).map(version=>
              <Button key={version} variant="outline" className="w-full" disabled={busy}
                onClick={() => onAction({kind:"rollback",id:addon.id,version})}>
                <RotateCcw className="size-4" />Roll back to v{version}
              </Button>
            )}
            <Button variant="destructive" className="w-full" disabled={busy}
              onClick={() => onAction({kind:"uninstall",id:addon.id})}>
              <Trash2 className="size-4" />Uninstall
            </Button>
          </> : <Button className="w-full" disabled={busy || !canInstall}
            onClick={() => onAction({kind:"install",id:addon.id,version:addon.version})}>
            <PackageCheck className="size-4" />Install reviewed content
          </Button>}
          {!canInstall && <p className="text-xs text-muted-foreground">
            This release is incompatible with your installed NextGuide version or requests unsupported capabilities.
          </p>}
          <p className="text-xs text-muted-foreground">No JavaScript is executed. Enabling stores content state;
            signed Markdown content is rendered in dedicated, non-executable documentation routes.</p>
        </CardContent></Card>
      </div>
    </div>
  </div>
}

function actionDescription(action: Action | null) {
  if (!action) return ""
  if (action.kind === "install") return "Install the signed, reviewed content release " + action.id +
    " at version " + action.version + "? It requests no additional capabilities. Content will be stored privately."
  if (action.kind === "rollback") return "Restore the previously reviewed version " + action.version +
    " of " + action.id + "? It will remain disabled until you enable it again."
  if (action.kind === "uninstall") return "Remove " + action.id +
    " from the installed list? This preserves private settings and stored release history for recovery."
  return (action.enabled ? "Enable" : "Disable") + " the approved content state for " + action.id + "?"
}

type V2Release = {
  manifest: Manifest
  digest: string
  size: number
  status: "active" | "revoked"
  compatible: boolean
  review: {
    reviewer: string
    approvedAt: string
    policy: "independent-human"
  }
}
type V2Installed = {
  id: string
  name: string
  version: string
  digest: string
  requestedPermissions: string[]
  grantedPermissions: string[]
  availableVersions: string[]
  reviewer: string
  reviewedAt: string
  execution: "blocked"
}
type V2Catalog = {
  configured: boolean
  registryUnavailable: boolean
  executionAvailable: false
  nextguideVersion: string
  releases: V2Release[]
  installed: {
    revision: number
    addons: V2Installed[]
    history: Array<{revision:number;at:string;operation:string;id:string;version:string}>
  }
}
type V2Action =
  | { kind:"stage";id:string;version:string }
  | { kind:"grant";id:string;version:string;digest:string;permissions:string[] }
  | { kind:"revoke";id:string }
  | { kind:"rollback";id:string;version:string }
  | { kind:"uninstall";id:string }

function V2ActionDescription({action}: {action:V2Action | null}) {
  if (!action) return null
  if (action.kind==="stage") return <p>Download and privately stage independently reviewed
    executable add-on {action.id} v{action.version}? The exact archive and every source hash will be
    verified. It will stay <strong>blocked from execution</strong> and request no automatic grants.</p>
  if (action.kind==="grant") return <div className="space-y-2">
    <p>Record explicit owner consent for {action.id} v{action.version} and
      the exact reviewed SHA-256 {action.digest.slice(0,16)}…?</p>
    <p>Requested capabilities: <strong>{action.permissions.length ? action.permissions.join(", "):"None"}</strong></p>
    <p>Consent is saved for this immutable version only. This does NOT enable or run any code.</p>
  </div>
  if (action.kind==="rollback") return <p>Return to reviewed v{action.version}
    of {action.id}? Previous grants will be cleared. The add-on remains blocked.</p>
  if (action.kind==="revoke") return <p>Immediately revoke the saved owner
    permissions for {action.id}? This works even if the registry is offline.</p>
  return <p>Remove staged {action.id} from the Account Mode v2 list?
    Previously stored immutable bytes remain private for recovery.</p>
}

/** Signed v2 review and consent only. No executable runtime or untrusted React. */
function V2ReviewPanel() {
  const [data,setData]=React.useState<V2Catalog | null>(null)
  const [loading,setLoading]=React.useState(true)
  const [busy,setBusy]=React.useState(false)
  const [error,setError]=React.useState("")
  const [notice,setNotice]=React.useState("")
  const [pending,setPending]=React.useState<V2Action | null>(null)
  const [query,setQuery]=React.useState("")

  const refresh=React.useCallback(async()=>{
    const response=await fetch("/api/nextguide/studio/addons-v2",{
      method:"GET",credentials:"same-origin",cache:"no-store"
    })
    if(response.status===401){
      window.location.replace("/login")
      throw Error("Sign in again to review executable add-ons.")
    }
    if(!response.ok)throw Error("Could not read private v2 add-on staging state.")
    const value=await response.json() as V2Catalog
    if(!value || typeof value.configured!=="boolean" ||
       !Array.isArray(value.releases) || !value.installed ||
       !Number.isSafeInteger(value.installed.revision) ||
       !Array.isArray(value.installed.addons)) {
      throw Error("Invalid signed v2 staging catalog response.")
    }
    setData(value)
  },[])
  React.useEffect(()=>{
    let live=true
    void refresh().catch(cause=>{
      if(live)setError(cause instanceof Error?cause.message:"V2 staging unavailable.")
    }).finally(()=>{if(live)setLoading(false)})
    return ()=>{live=false}
  },[refresh])

  async function apply(){
    if(!data || !pending || busy)return
    setBusy(true);setError("");setNotice("")
    const action=pending
    try{
      const response=await fetch("/api/nextguide/studio/addon-v2-"+action.kind,{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...action,expectedRevision:data.installed.revision,consent:true}),
      })
      if(response.status===401){
        window.location.replace("/login")
        throw Error("Session expired.")
      }
      const result=await response.json() as {error?:string;executionAvailable?:boolean}
      if(!response.ok)throw Error(result.error || "Reviewed add-on operation denied.")
      if(result.executionAvailable!==false)throw Error("Unsafe v2 state response.")
      await refresh()
      setNotice("Saved reviewed "+action.kind+" operation. Executable add-ons remain blocked.")
    }catch(cause){setError(cause instanceof Error?cause.message:"V2 operation failed.")}
    finally{setBusy(false);setPending(null)}
  }
  const installed=data?.installed.addons??[]
  const releases=(data?.releases??[]).filter(release=>{
    const q=query.trim().toLowerCase()
    return !q || [release.manifest.name,release.manifest.id,
      release.manifest.author?.name,release.manifest.category]
      .some(x=>String(x??"").toLowerCase().includes(q))
  })
  const latest=(v:string,w:string)=>{
    const a=v.split(".").map(Number),b=w.split(".").map(Number)
    for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i]
    return false
  }
  return <section className="space-y-4 border-t border-border pt-8" aria-label="Executable v2 review">
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold">Executable extensions</h2>
        <Badge variant="secondary">V2 review preview</Badge>
        <Badge variant="outline">Execution blocked</Badge>
      </div>
      <p className="text-sm text-muted-foreground">Review independently signed JavaScript/TypeScript
        packages, their publisher, exact SHA-256 and requested capabilities. Stage releases
        privately and record explicit owner permission approval. <strong>Nothing can run here</strong>
        until the separately audited sandbox and v2 registry are production-ready.</p>
    </div>
    {loading && <p className="text-sm text-muted-foreground">Checking private v2 staging state…</p>}
    {error && <Card><CardContent className="p-4 text-sm text-destructive" role="alert">{error}</CardContent></Card>}
    {notice && <Card><CardContent className="p-4 text-sm" role="status">{notice}</CardContent></Card>}
    {data && <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>NextGuide {data.nextguideVersion} · {installed.length} privately staged</span>
      <Button size="sm" variant="outline" disabled={busy} onClick={()=>
        void refresh().catch(cause=>setError(cause instanceof Error?cause.message:"Refresh failed."))}>
        Refresh review status
      </Button>
    </div>}
    {data && !data.configured && <Card><CardContent className="p-4 text-sm text-muted-foreground">
      The private v2 signed registry is not connected. This preview becomes available
      only when the independently reviewed /v2/registry service and pinned public
      key are configured. Existing v1 Markdown add-ons are unaffected.</CardContent></Card>}
    {data?.configured && data.registryUnavailable && <Card><CardContent className="p-4 text-sm text-muted-foreground" role="status">
      The signed executable registry is unavailable or cannot be verified.
      No new staging, grants or rollback is allowed; offline permission revocation
      and uninstall remain available.</CardContent></Card>}
    {installed.length>0 && <div className="space-y-3">
      <h3 className="text-base font-semibold">Privately staged</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {installed.map(item=><Card key={item.id}>
          <CardHeader><CardTitle className="text-base">{item.name}</CardTitle>
            <CardDescription>{item.id} · v{item.version} · Not running</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="break-all font-mono text-xs text-muted-foreground">SHA-256: {item.digest}</p>
            <p className="text-sm">Requested: {item.requestedPermissions.join(", ")||"No capabilities"}</p>
            <p className="text-sm">Approved: {item.grantedPermissions.join(", ")||"None"}</p>
            <p className="text-xs text-muted-foreground">Independently reviewed by {item.reviewer}</p>
            <div className="flex flex-wrap gap-2">
              {item.grantedPermissions.length>0 ?
                <Button size="sm" variant="outline" disabled={busy}
                  onClick={()=>setPending({kind:"revoke",id:item.id})}>Revoke permissions</Button> :
                <Button size="sm" variant="outline" disabled={busy||data?.registryUnavailable}
                  onClick={()=>setPending({kind:"grant",id:item.id,version:item.version,
                    digest:item.digest,permissions:[...item.requestedPermissions]})}>
                  Review &amp; approve permissions</Button>}
              {item.availableVersions.filter(x=>x!==item.version).map(version=>
                <Button key={version} variant="outline" size="sm"
                  disabled={busy||data?.registryUnavailable}
                  onClick={()=>setPending({kind:"rollback",id:item.id,version})}>
                  Roll back to {version}</Button>)}
              <Button size="sm" variant="destructive" disabled={busy}
                onClick={()=>setPending({kind:"uninstall",id:item.id})}>Uninstall staged</Button>
            </div>
          </CardContent>
        </Card>)}
      </div>
    </div>}
    {data?.configured&&!data.registryUnavailable&&<>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true"/>
        <Input className="pl-9" aria-label="Search independently reviewed executable add-ons"
          value={query} onChange={e=>setQuery(e.target.value)}
          placeholder="Search reviewed executable extensions"/>
      </div>
      {releases.length?<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {releases.map(release=>{
          const addon=release.manifest
          const installedItem=installed.find(x=>x.id===addon.id)
          const canStage=release.compatible &&
            (!installedItem || latest(addon.version,installedItem.version))
          return <Card key={addon.id}><CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="outline">Independently reviewed</Badge>
              <Badge variant={release.compatible?"secondary":"outline"}>
                {release.compatible?"Compatible":"Incompatible"}</Badge>
            </div>
            <CardTitle className="text-base">{addon.name}</CardTitle>
            <CardDescription>{addon.summary||addon.id}</CardDescription>
          </CardHeader><CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">{addon.category} · v{addon.version}</p>
            <p className="text-sm">Capabilities: {addon.permissions.join(", ")||"None"}</p>
            <p className="text-xs text-muted-foreground">Reviewer: {release.review.reviewer}</p>
            <p className="break-all font-mono text-xs text-muted-foreground">SHA-256: {release.digest}</p>
            <a className="inline-flex gap-1 text-sm text-primary hover:underline"
              href={addon.repository} target="_blank" rel="noopener noreferrer">
              Publisher source<ExternalLink className="size-3.5"/></a>
            <Button size="sm" className="w-full" disabled={busy||!canStage}
              onClick={()=>setPending({kind:"stage",id:addon.id,version:addon.version})}>
              {installedItem?"Stage reviewed update":"Stage reviewed release"}
            </Button>
          </CardContent></Card>
        })}
      </div>:<p className="text-sm text-muted-foreground">No active reviewed v2 releases match your search.</p>}
    </>}
    {(data?.installed.history?.length??0)>0 && <Card><CardHeader>
      <CardTitle className="text-base">Executable review activity</CardTitle>
      <CardDescription>Last 100 successful private staging and consent changes</CardDescription>
    </CardHeader><CardContent className="divide-y divide-border">
      {[...(data?.installed.history??[])].reverse().slice(0,10).map(event=>
        <div key={event.revision} className="flex flex-wrap justify-between gap-2 py-2 text-xs">
          <span><strong className="capitalize">{event.operation}</strong> {event.id} · {event.version}</span>
          <span className="text-muted-foreground">{event.at.replace("T"," ").slice(0,16)} UTC</span>
        </div>)}
    </CardContent></Card>}
    <AlertDialog open={pending!==null} onOpenChange={open=>{if(!open&&!busy)setPending(null)}}>
      <AlertDialogContent><AlertDialogHeader>
        <AlertDialogTitle>Review executable add-on change</AlertDialogTitle>
        <AlertDialogDescription>
          Explicit review and consent are required. No executable code will run.
        </AlertDialogDescription>
        <div className="space-y-2 text-sm text-muted-foreground"><V2ActionDescription action={pending}/></div>
      </AlertDialogHeader><AlertDialogFooter>
        <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
        <AlertDialogAction disabled={busy} onClick={()=>void apply()}>
          {busy?"Verifying signed release…":"Confirm owner decision"}
        </AlertDialogAction>
      </AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </section>
}

/** Owner-only Account Mode UI. All mutations go through session and origin-checked routes. */
export function AccountAddonMarketplace({basePath="/docs"}: {basePath?: string}) {
  const [catalog, setCatalog] = React.useState<Catalog | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const [notice, setNotice] = React.useState("")
  const [term, setTerm] = React.useState("")
  const [category, setCategory] = React.useState("all")
  const [chosen, setChosen] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState<Action | null>(null)

  const refresh = React.useCallback(async () => {
    const response = await fetch("/api/nextguide/studio/addons", {
      method:"GET",credentials:"same-origin",cache:"no-store",
    })
    if (response.status===401) {
      window.location.replace("/login")
      throw Error("Sign in again to manage add-ons.")
    }
    if (!response.ok) throw Error("Could not fetch the verified add-on catalog.")
    const value = await response.json() as Catalog
    if (!value || typeof value.configured!=="boolean" || !Array.isArray(value.releases) ||
        !value.installed || !Array.isArray(value.installed.addons) ||
        !Number.isInteger(value.installed.revision)) {
      throw Error("The add-on catalog response is invalid.")
    }
    setCatalog(value)
    return value
  }, [])
  React.useEffect(() => {
    let active = true
    void refresh().catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : "Catalog unavailable.")
    }).finally(()=>{if(active)setLoading(false)})
    return () => {active=false}
  }, [refresh])

  async function performAction() {
    if (!pending || !catalog || busy) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const method = pending.kind === "install" ? "addon-install" :
        pending.kind === "toggle" ? "addon-toggle" :
          pending.kind === "rollback" ? "addon-rollback" : "addon-uninstall"
      const payload = {
        ...pending,
        expectedRevision:catalog.installed.revision,
        consent:true,
      }
      const response=await fetch("/api/nextguide/studio/"+method,{
        method:"POST",cache:"no-store",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),
      })
      if(response.status===401){
        window.location.replace("/login")
        throw Error("Session expired. Sign in again.")
      }
      const result=await response.json() as {error?:string}
      if(!response.ok)throw Error(result.error||"Add-on operation failed.")
      await refresh()
      if(pending.kind==="uninstall")setChosen(null)
      setNotice("Add-on "+pending.kind+" completed. No executable extension code was run.")
    }catch(cause){
      setError(cause instanceof Error ? cause.message : "Add-on operation failed.")
    }finally{
      setPending(null)
      setBusy(false)
    }
  }

  const installed=catalog?.installed.addons??[]
  const releases=catalog?.releases??[]
  const categories=[...new Set(releases.map(r=>r.manifest.category))].sort()
  const selected=chosen?releases.find(r=>r.manifest.id===chosen):undefined
  const matching=releases.filter(release=>{
    const m=release.manifest, q=term.trim().toLowerCase()
    return (category==="all"||m.category===category) &&
      (!q||[m.id,m.name,m.summary,m.description,m.category,m.author?.name]
        .some(value=>String(value??"").toLowerCase().includes(q)))
  }).sort((a,b)=>a.manifest.name.localeCompare(b.manifest.name))

  return <div className="space-y-6">
    {error && <Card><CardContent className="p-5 text-sm text-destructive" role="alert">{error}</CardContent></Card>}
    {notice && <Card><CardContent className="p-5 text-sm text-foreground" role="status">{notice}</CardContent></Card>}
    {loading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading approved add-ons…</CardContent></Card>}
    {selected ? <ReleaseDetails release={selected} back={()=>setChosen(null)}
      installed={installed.find(a=>a.id===selected.manifest.id)} onAction={setPending} busy={busy}
      catalogFresh={catalog?.catalogFresh??false}/> : <>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">Add-ons</h1>
          <Badge variant="secondary">Reviewed content</Badge></div>
        <p className="text-sm text-muted-foreground">Install and manage signed Markdown add-ons in Account Mode.
          Executable v2 extensions remain non-runnable while their review and sandbox gates are unfinished.</p>
        {catalog && <p className="text-xs text-muted-foreground">
          Installed NextGuide {catalog.nextguideVersion} · {installed.length} stored add-ons
        </p>}
      </div>
      {catalog && installed.length>0 && <section className="space-y-3">
        <h2 className="text-lg font-semibold">Installed on this site</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {installed.map(addon=><Card key={addon.id}><CardHeader>
            <CardTitle className="text-base">{addon.name}</CardTitle>
            <CardDescription>{addon.id} · v{addon.version} · {addon.enabled?"Enabled":"Disabled"}</CardDescription>
          </CardHeader><CardContent className="flex flex-wrap gap-2">
            {addon.enabled && <a className="inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted" href={(basePath==="/"?"":basePath)+"/addons/"+encodeURIComponent(addon.id)+"/"} target="_blank" rel="noopener noreferrer">Open content</a>}
            {releases.some(x=>x.manifest.id===addon.id) && <Button variant="outline" size="sm"
              disabled={busy} onClick={()=>setChosen(addon.id)}>Details</Button>}
            <Button variant="outline" size="sm" disabled={busy || (!addon.enabled && !catalog.catalogFresh)} onClick={()=>
              setPending({kind:"toggle",id:addon.id,enabled:!addon.enabled})}>
              {addon.enabled?"Disable":"Enable"}
            </Button>
            <Button variant="destructive" size="sm" disabled={busy}
              onClick={()=>setPending({kind:"uninstall",id:addon.id})}>Uninstall</Button>
          </CardContent></Card>)}
        </div>
      </section>}
      {catalog?.installed.history && catalog.installed.history.length > 0 && <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent add-on activity</h2>
        <Card><CardContent className="divide-y divide-border">
          {[...catalog.installed.history].reverse().slice(0,12).map(event=>
            <div key={event.revision} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div className="min-w-0"><span className="font-medium capitalize">{event.operation}</span>
                <span className="ml-2 break-all text-muted-foreground">{event.id} · v{event.version}</span></div>
              <span className="text-xs text-muted-foreground">{event.at.replace("T"," ").slice(0,16)} UTC · #{event.revision}</span>
            </div>
          )}
        </CardContent></Card>
        <p className="text-xs text-muted-foreground">The latest 100 successful installation changes are recorded privately with each atomic state update. No credentials or downloaded code are included.</p>
      </section>}
      {catalog?.registryUnavailable && <Card><CardContent className="p-5 text-sm text-muted-foreground" role="status">
        The signed registry cannot be verified right now. Installed history remains available, but new installs, updates and enabling are unavailable. You can still disable or uninstall existing add-ons.
      </CardContent></Card>}
      {catalog?.configured && !catalog.catalogFresh && <Card><CardContent className="p-5 text-sm text-muted-foreground" role="status">The verified catalog is older than one hour. Discovery is available, but new installs, updates and enabling are suspended until the registry issues a fresh signed index. Disable and uninstall remain available.</CardContent></Card>}
      {catalog && !catalog.configured && <Card><CardHeader>
        <CardTitle>Signed registry not configured</CardTitle>
        <CardDescription>Set a trusted registry URL and pinned Ed25519 public key on the Account Mode server.
          Previously installed data remains stored privately.</CardDescription>
      </CardHeader></Card>}
      {catalog?.configured && <>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-lg">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"/>
            <Input aria-label="Search approved add-ons" className="pl-9"
              placeholder="Search by name, publisher or category" value={term}
              onChange={e=>setTerm(e.target.value)}/>
          </div>
          <span className="text-sm text-muted-foreground">{matching.length} reviewed releases</span>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filter add-on categories">
          {["all",...categories].map(item=><Button key={item} size="sm"
            variant={category===item?"secondary":"outline"} aria-pressed={category===item}
            onClick={()=>setCategory(item)} className="capitalize">
              {item==="all"?"All add-ons":item}
          </Button>)}
        </div>
        {matching.length?<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {matching.map(release=><Card key={release.manifest.id} className="flex flex-col">
            <CardHeader className="flex-1">
              <div className="mb-3 flex justify-between gap-2"><Puzzle className="size-5" aria-hidden="true"/>
                <Badge variant="outline">{release.compatible?"Verified":"Incompatible"}</Badge></div>
              <CardTitle className="text-lg">{release.manifest.name}</CardTitle>
              <CardDescription>{release.manifest.summary||release.manifest.description||"Reviewed content add-on"}</CardDescription>
              <p className="pt-2 text-xs text-muted-foreground">
                {release.manifest.author?.name||"Independent publisher"} · {release.manifest.category} · v{release.manifest.version}
              </p>
            </CardHeader><CardContent><Button variant="outline" className="w-full"
              onClick={()=>setChosen(release.manifest.id)}>View details</Button></CardContent>
          </Card>)}
        </div>:<Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          No approved add-ons match your search.</CardContent></Card>}
        <p className="text-xs text-muted-foreground">
          Every install verifies the signed registry, exact archive bytes and compatibility again.
          Revoked releases cannot be reactivated.
        </p>
      </>}
    </>}
    <V2ReviewPanel />
    <AlertDialog open={pending!==null} onOpenChange={open=>{if(!open&&!busy)setPending(null)}}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Confirm add-on change</AlertDialogTitle>
          <AlertDialogDescription>{actionDescription(pending)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={()=>void performAction()}>
            {busy?"Verifying…":"Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
}
