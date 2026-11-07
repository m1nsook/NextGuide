"use client"

import * as React from "react"
import { BookOpen, Brush, Check, ChevronDown, ChevronUp, Copy, ExternalLink, FilePlus, FileText, FolderTree, HardDriveUpload, LayoutDashboard, LockKeyhole, LogOut, Plus, Save, Search, ShieldCheck, Trash2 } from "lucide-react"
import { LogoMark } from "../components/site/logo.js"
import { AccountProviders } from "./providers.js"
import { AccountThemeMenu } from "./theme-menu.js"
import { AccountMdxEditor } from "./mdx-editor.js"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.js"
import { Badge } from "./ui/badge.js"
import { Button } from "./ui/button.js"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "./ui/card.js"
import { Checkbox } from "./ui/checkbox.js"
import { Input } from "./ui/input.js"
import { Label } from "./ui/label.js"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select.js"
import { Separator } from "./ui/separator.js"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger } from "./ui/sidebar.js"
import { Switch } from "./ui/switch.js"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs.js"
import { Textarea } from "./ui/textarea.js"

type Font = "inter" | "geist" | "ibm-plex-sans" | "segoe-ui" | "system" | "jetbrains-mono" | "geist-mono" | "ibm-plex-mono" | "system-mono"
type Site = { name: string; description: string; url: string; logo: string; ogImage: string; copyrightEnabled: boolean; copyrightText: string; copyrightHref: string; ownerName: string; ownerEmail: string; ownerAvatar: string; accent: string; theme: string; bodyFont: Font; headingFont: Font; codeFont: Font; setupComplete: boolean }
type PageRow = { slug: string; title: string; description: string; version: string; bytes: number }
type Page = { slug: string; title: string; description: string; body: string; version: string | null }
type NavEntry = { slug: string; title: string; hidden: boolean }
type Navigation = { folder: string; items: NavEntry[] }
type Media = { name: string; url: string }
type Overview = { site: Site; pages: PageRow[]; navigation: Navigation; media: Media[] }
type View = "overview" | "pages" | "navigation" | "design" | "media" | "security"
type Option = { value: string; label: string }

const emptyPage: Page = { slug: "", title: "", description: "", body: "", version: null }
const accents = ["blue", "red", "green", "purple", "yellow", "orange", "teal", "pink"]
const accentColors: Record<string, string> = { blue: "#3b82f6", red: "#ef4444", green: "#22c55e", purple: "#a855f7", yellow: "#eab308", orange: "#f97316", teal: "#14b8a6", pink: "#ec4899" }
const bodyFonts: { id: Font; label: string; css: string }[] = [
  { id: "inter", label: "Inter", css: 'var(--ng-preview-inter), Inter, sans-serif' },
  { id: "geist", label: "Geist", css: 'var(--ng-preview-geist), Geist, sans-serif' },
  { id: "ibm-plex-sans", label: "IBM Plex Sans", css: 'var(--ng-preview-ibm-plex-sans), "IBM Plex Sans", sans-serif' },
  { id: "segoe-ui", label: "Segoe UI", css: '"Segoe UI", sans-serif' },
  { id: "system", label: "System UI", css: 'system-ui, sans-serif' },
]
const monoFonts: { id: Font; label: string; css: string }[] = [
  { id: "jetbrains-mono", label: "JetBrains Mono", css: 'var(--ng-preview-jetbrains-mono), "JetBrains Mono", monospace' },
  { id: "geist-mono", label: "Geist Mono", css: 'var(--ng-preview-geist-mono), "Geist Mono", monospace' },
  { id: "ibm-plex-mono", label: "IBM Plex Mono", css: 'var(--ng-preview-ibm-plex-mono), "IBM Plex Mono", monospace' },
  { id: "system-mono", label: "System Mono", css: 'ui-monospace, monospace' },
]
const sections: { id: View; label: string; icon: typeof FileText }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "pages", label: "Pages", icon: FileText },
  { id: "navigation", label: "Navigation", icon: FolderTree },
  { id: "design", label: "Appearance", icon: Brush },
  { id: "media", label: "Media", icon: HardDriveUpload },
  { id: "security", label: "Security", icon: LockKeyhole },
]

async function studioRequest<T>(action: string, payload?: object, method: "GET" | "POST" = "GET"): Promise<T> {
  const response = await fetch("/api/nextguide/studio/" + action, {
    method, cache: "no-store", credentials: "same-origin",
    ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : {}),
  })
  let result: Record<string, unknown> = {}
  try { result = await response.json() as Record<string, unknown> }
  catch { throw Error("The server did not return a valid JSON response.") }
  if (response.status === 401) { window.location.replace("/login"); throw Error("Session expired. Sign in again.") }
  if (!response.ok) throw Error(String(result.error || `Request failed (${response.status}).`))
  return result as T
}
async function secureAction<T>(action: string, payload: object): Promise<T> {
  const response = await fetch("/api/nextguide/account/" + action, {
    method: "POST", cache: "no-store", credentials: "same-origin",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  })
  const data: Record<string, unknown> = await response.json()
  if (!response.ok) throw Error(String(data.error || `Account request failed (${response.status}).`))
  return data as T
}

function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Option[] }) {
  const none = "__ng_empty__"
  return (
    <Select value={value || none} onValueChange={next => onChange(next === none ? "" : String(next ?? ""))}>
      <SelectTrigger aria-label={label} className="w-full"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent align="start">
        {options.map(option => <SelectItem key={option.value || none} value={option.value || none}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <div className="space-y-2"><Label className="block text-sm font-medium">{label}</Label>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
}
function SiteDesign({ site, change }: { site: Site; change: <K extends keyof Site>(key: K, value: Site[K]) => void }) {
  return <div className="space-y-6">
    <Field label="Default appearance"><Choice label="Appearance" value={site.theme} onChange={v => change("theme", v)} options={[{value:"light",label:"Light"},{value:"dark",label:"Dark"},{value:"system",label:"System"}]} /></Field>
    <Field label="Documentation accent color">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {accents.map(color => <Button key={color} type="button" variant={site.accent === color ? "secondary" : "outline"} className="justify-start capitalize" aria-pressed={site.accent === color} onClick={() => change("accent", color)}>
          <span className="size-4 rounded-full border" style={{ backgroundColor: accentColors[color] }} />{color}{site.accent === color && <Check className="ml-auto size-3" />}
        </Button>)}
      </div>
    </Field>
    <div className="grid gap-4 md:grid-cols-3">
      {(["bodyFont", "headingFont", "codeFont"] as const).map(key => {
        const options = key === "codeFont" ? monoFonts : bodyFonts
        return <Field key={key} label={key === "bodyFont" ? "Body font" : key === "headingFont" ? "Heading font" : "Code font"}>
          <Choice label={key} value={site[key]} onChange={v => change(key, v as Font)} options={options.map(o => ({value:o.id,label:o.label}))} />
          <div className="ng-studio-font-sample min-h-16 rounded-md border bg-muted/20 p-3 text-sm" style={{fontFamily:options.find(o=>o.id===site[key])?.css}}>{key === "codeFont" ? 'const docs = "NextGuide";' : "Build documentation that feels like yours."}</div>
        </Field>
      })}
    </div>
  </div>
}
function PagePreview({ page }: { page: Page }) {
  return <div className="space-y-3 rounded-md border bg-muted/20 p-5">
    <h2 className="text-xl font-semibold">{page.title || "Untitled page"}</h2>
    {page.body.split("\n").slice(0,100).map((line, index) => line.startsWith("# ") ? <h3 key={index} className="text-lg font-semibold">{line.slice(2)}</h3> : line.startsWith("## ") ? <h4 key={index} className="font-semibold">{line.slice(3)}</h4> : line.trim() ? <p key={index} className="break-words text-sm text-muted-foreground">{line.replace(/\*\*/g, "")}</p> : null)}
    <p className="text-xs text-muted-foreground">Markdown approximation. Custom MDX components render on the published page.</p>
  </div>
}

/** Fresh Base UI dashboard; no legacy account-shell styles or Radix UI controls. */
export function AccountStudio({ basePath = "/docs" }: { basePath?: string }) {
  const [view, setView] = React.useState<View>("overview")
  const [overview, setOverview] = React.useState<Overview | null>(null)
  const [site, setSite] = React.useState<Site | null>(null)
  const [page, setPage] = React.useState<Page | null>(null)
  const [navigation, setNavigation] = React.useState<Navigation | null>(null)
  const [query, setQuery] = React.useState("")
  const [draftChanged, setDraftChanged] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const [notice, setNotice] = React.useState("")
  const [setupStep, setSetupStep] = React.useState(0)
  const [upload, setUpload] = React.useState<File | null>(null)
  const [securityCode, setSecurityCode] = React.useState("")
  const [newCode, setNewCode] = React.useState("")
  const [newQr, setNewQr] = React.useState("")
  const [newSecret, setNewSecret] = React.useState("")
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[] | null>(null)
  const [recoverySaved, setRecoverySaved] = React.useState(false)
  const [navigationFolder, setNavigationFolder] = React.useState("")
  const publicHref = (slug: string) => (basePath === "/" ? "" : basePath) + (slug ? "/" + slug : "/")
  const ready = overview !== null && site !== null

  const refresh = React.useCallback(async () => {
    const data = await studioRequest<Overview>("overview")
    setOverview(data); setSite(data.site); setNavigation(data.navigation)
    return data
  }, [])
  React.useEffect(() => { refresh().catch(e => setError(e instanceof Error ? e.message : "Could not load workspace.")) }, [refresh])
  function switchView(next: View) {
    if (draftChanged && !window.confirm("You have unsaved changes. Leave this screen?")) return
    setView(next); setDraftChanged(false); setError(""); setNotice("")
  }
  async function act(action: () => Promise<unknown>, success = "") {
    if (busy) return
    setBusy(true); setError(""); setNotice("")
    try { await action(); if (success) setNotice(success) }
    catch (e) { setError(e instanceof Error ? e.message : "Request failed.") }
    finally { setBusy(false) }
  }
  function editSite<K extends keyof Site>(key: K, value: Site[K]) { setSite(prev => prev ? { ...prev, [key]: value } : prev); setDraftChanged(true) }
  function editPage<K extends keyof Page>(key: K, value: Page[K]) { setPage(prev => prev ? { ...prev, [key]: value } : prev); setDraftChanged(true) }
  async function saveSite(complete = false) {
    if (!site) return
    const saved = await studioRequest<Site>("save-settings", { ...site, setupComplete: complete || site.setupComplete }, "POST")
    setSite(saved); setDraftChanged(false); await refresh()
  }
  async function loadPage(slug: string) {
    if (draftChanged && !window.confirm("Discard unsaved changes?")) return
    await act(async () => { const data = await studioRequest<Page>("page?slug=" + encodeURIComponent(slug)); setPage(data); setDraftChanged(false); setView("pages") })
  }
  async function savePage() {
    if (!page) return
    await act(async () => { const saved = await studioRequest<Page>("save-page", page, "POST"); setPage(saved); setDraftChanged(false); await refresh() }, "Page saved successfully.")
  }
  async function deletePage() {
    if (!page?.slug || !window.confirm("Delete this page and its navigation entry?")) return
    await act(async () => { await studioRequest("delete-page", { slug: page.slug, version: page.version }, "POST"); setPage(null); setDraftChanged(false); await refresh() }, "Page deleted.")
  }
  async function openFolder() { await act(async () => { setNavigation(await studioRequest<Navigation>("navigation?folder=" + encodeURIComponent(navigationFolder))) }) }
  function moveNav(index: number, delta: number) { setNavigation(prev => {
    if (!prev) return prev
    const dest = index + delta
    if (dest < 0 || dest >= prev.items.length) return prev
    const items = [...prev.items]; [items[index], items[dest]] = [items[dest], items[index]]
    return { ...prev, items }
  }) }
  async function saveNavigation() {
    if (!navigation) return
    await act(async () => { setNavigation(await studioRequest<Navigation>("save-navigation", navigation, "POST")); await refresh() }, "Navigation saved.")
  }
  async function uploadMedia() {
    if (!upload) return
    await act(async () => {
      if (upload.size > 2 * 1024 * 1024) throw Error("Image must be 2 MB or smaller.")
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "")
        reader.onerror = () => reject(Error("Could not read image."))
        reader.readAsDataURL(upload)
      })
      await studioRequest("upload-media", { mime: upload.type, base64: data }, "POST"); setUpload(null); await refresh()
    }, "Image uploaded.")
  }
  async function deleteMedia(name: string) {
    if (!window.confirm("Permanently delete this image?")) return
    await act(async () => { await studioRequest("delete-media", { name }, "POST"); await refresh() }, "Image deleted.")
  }
  const visiblePages = (overview?.pages || []).filter(item => (item.title + " " + item.slug).toLowerCase().includes(query.toLowerCase()))
  const createPage = () => { if (draftChanged && !window.confirm("Discard unsaved changes?")) return; setPage({ ...emptyPage }); setDraftChanged(false); setView("pages") }
  const stat = (label: string, number: number, Icon: typeof FileText) => <Card><CardHeader className="flex flex-row items-center justify-between"><CardDescription>{label}</CardDescription><Icon className="size-4 text-muted-foreground" /></CardHeader><CardContent><p className="text-3xl font-semibold tabular-nums">{number}</p></CardContent></Card>

  return <AccountProviders><div className="ng-account-root min-h-svh bg-background text-foreground">
    <SidebarProvider className="min-h-svh">
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-3"><div className="flex items-center gap-3 px-2 py-2"><LogoMark className="size-7 shrink-0" /><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="text-sm font-semibold tracking-tight">NextGuide</p><p className="text-xs text-muted-foreground">Account Mode</p></div></div></SidebarHeader>
        <Separator />
        <SidebarContent>
          <SidebarGroup><SidebarGroupLabel>Workspace</SidebarGroupLabel><SidebarMenu>
            {sections.map(section => <SidebarMenuItem key={section.id}><SidebarMenuButton tooltip={section.label} isActive={view === section.id} onClick={() => switchView(section.id)}><section.icon/><span>{section.label}</span></SidebarMenuButton></SidebarMenuItem>)}
          </SidebarMenu></SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-3"><SidebarMenu>
          <SidebarMenuItem><SidebarMenuButton render={<a href={publicHref("")} target="_blank" rel="noreferrer" />} tooltip="View documentation"><ExternalLink/><span>View documentation</span></SidebarMenuButton></SidebarMenuItem>
          <SidebarMenuItem><SidebarMenuButton render={<a href="/api/nextguide/account/logout" />} tooltip="Sign out" onClick={e => {e.preventDefault(); const form = document.createElement("form"); form.method="POST"; form.action="/api/nextguide/account/logout"; document.body.append(form); form.submit()}}><LogOut/><span>Sign out</span></SidebarMenuButton></SidebarMenuItem>
        </SidebarMenu></SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3"><SidebarTrigger/><Separator orientation="vertical" className="h-5"/><p className="truncate text-sm text-muted-foreground">{site?.name || "My documentation"}<span className="mx-2 text-border">/</span><span className="font-medium text-foreground">{sections.find(x => x.id === view)?.label}</span></p></div>
          <div className="flex items-center gap-2"><Button variant="outline" size="sm" render={<a href={publicHref("")} target="_blank" rel="noreferrer" />}>View docs<ExternalLink className="size-3.5" /></Button><AccountThemeMenu /></div>
        </header>
        <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 pb-16 md:p-8" aria-live="polite">
          {error && <Alert variant="destructive" role="alert"><AlertTitle>Action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {notice && <Alert role="status"><Check className="size-4"/><AlertTitle>Saved</AlertTitle><AlertDescription>{notice}</AlertDescription></Alert>}
          {!ready && !error && <div className="space-y-3"><div className="h-7 w-64 animate-pulse rounded bg-muted"/><div className="h-32 w-full animate-pulse rounded bg-muted"/><span className="sr-only">Loading dashboard</span></div>}
          {ready && site && !site.setupComplete && <div className="mx-auto w-full max-w-2xl space-y-6 py-6">
            <div className="space-y-2"><Badge variant="secondary">Step {setupStep + 1} of 3</Badge><h1 className="text-2xl font-semibold tracking-tight">{setupStep === 0 ? "Set up your documentation" : setupStep === 1 ? "Choose your docs appearance" : "Ready to publish"}</h1><p className="text-sm text-muted-foreground">{setupStep === 0 ? "Start with your documentation details." : setupStep === 1 ? "These settings change the public documentation, not the admin dashboard." : "Your site is ready. Settings can be changed later."}</p></div>
            <Card><CardContent className="space-y-5">
              {setupStep === 0 && <>
                <Field label="Website title"><Input value={site.name} maxLength={100} onChange={e => editSite("name", e.target.value)} placeholder="Documentation title" /></Field>
                <Field label="Description"><Textarea value={site.description} maxLength={400} onChange={e => editSite("description", e.target.value)} rows={3}/></Field>
                <Field label="Public origin (optional)"><Input value={site.url} onChange={e => editSite("url", e.target.value)} placeholder="https://docs.example.com"/></Field>
                <Field label="Display name (optional)"><Input value={site.ownerName} onChange={e => editSite("ownerName", e.target.value)} /></Field>
                <Field label="Private contact email (optional)"><Input type="email" value={site.ownerEmail} onChange={e => editSite("ownerEmail", e.target.value)} /></Field>
              </>}
              {setupStep === 1 && <SiteDesign site={site} change={editSite}/ >}
              {setupStep === 2 && <div className="space-y-3"><ShieldCheck className="size-8 text-muted-foreground" /><h2 className="text-xl font-medium">{site.name}</h2><p className="text-muted-foreground">{site.description}</p><p className="text-sm text-muted-foreground">Appearance: {site.theme} · {site.accent}</p><p className="text-sm text-muted-foreground">Remember to store your authenticator recovery codes offline.</p></div>}
            </CardContent><CardFooter className="flex justify-between gap-3"><Button variant="outline" disabled={setupStep === 0} onClick={() => setSetupStep(step => step - 1)}>Back</Button>{setupStep < 2 ? <Button onClick={() => setSetupStep(step => step + 1)}>Continue</Button> : <Button disabled={busy} onClick={() => act(async () => { await saveSite(true); setSetupStep(0); setView("overview") }, "Site setup complete.")}>Finish setup</Button>}</CardFooter></Card>
          </div>}
          {ready && site?.setupComplete && <>
            {view === "overview" && <>
              <div className="flex flex-wrap items-end justify-between gap-4"><div className="space-y-1"><h1 className="text-2xl font-semibold tracking-tight">Overview</h1><p className="text-sm text-muted-foreground">Manage pages, navigation, and your documentation website.</p></div><Button onClick={createPage}><Plus className="size-4"/>New page</Button></div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{stat("Documentation pages", overview!.pages.length, FileText)}{stat("Top-level navigation", overview!.navigation.items.length, FolderTree)}{stat("Uploaded media", overview!.media.length, HardDriveUpload)}</div>
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2"><CardHeader><CardTitle>Recent pages</CardTitle><CardDescription>Open a page to edit its MDX source.</CardDescription></CardHeader><CardContent><div className="divide-y rounded-md border">
                  {overview!.pages.length ? overview!.pages.slice(0,8).map(item => <button key={item.slug} type="button" className="flex w-full items-center gap-3 p-3 text-left text-sm hover:bg-muted/50" onClick={() => loadPage(item.slug)}><FileText className="size-4 text-muted-foreground"/><span className="min-w-0 flex-1 truncate font-medium">{item.title}</span><span className="truncate text-xs text-muted-foreground">{item.slug || "Homepage"}</span></button>) : <p className="p-5 text-sm text-muted-foreground">No pages yet.</p>}
                </div></CardContent></Card>
                <Card><CardHeader><CardTitle>Quick actions</CardTitle><CardDescription>Manage your docs from one place.</CardDescription></CardHeader><CardContent className="flex flex-col gap-2"><Button variant="outline" className="justify-start" onClick={createPage}><FilePlus className="size-4"/>Create page</Button><Button variant="outline" className="justify-start" onClick={() => switchView("design")}><Brush className="size-4"/>Appearance</Button><Button variant="outline" className="justify-start" onClick={() => switchView("navigation")}><FolderTree className="size-4"/>Navigation</Button></CardContent></Card>
              </div>
            </>}
            {view === "pages" && <>
              <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">Pages</h1><p className="mt-1 text-sm text-muted-foreground">Write and manage your documentation with Monaco MDX.</p></div><Button onClick={createPage}><FilePlus className="size-4"/>New page</Button></div>
              <div className="grid min-w-0 gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
                <Card size="sm" className="min-w-0 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-110px)]"><CardHeader><CardTitle className="text-sm">Documentation</CardTitle><CardDescription>{visiblePages.length} pages</CardDescription></CardHeader><CardContent className="min-h-0 gap-2">
                  <div className="relative"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"/><Input aria-label="Search pages" className="pl-9" placeholder="Find a page…" value={query} onChange={e => setQuery(e.target.value)} /></div>
                  <div className="max-h-[55dvh] space-y-1 overflow-y-auto pr-1">
                    {visiblePages.map(item => <Button key={item.slug} type="button" variant={page?.slug === item.slug ? "secondary" : "ghost"} className="h-auto w-full justify-start gap-2 py-2 text-left" onClick={() => loadPage(item.slug)}><FileText className="size-4 shrink-0"/><span className="min-w-0 flex-1 truncate"><span className="block truncate text-sm">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.slug || "Homepage"}</span></span></Button>)}
                  </div>
                </CardContent></Card>
                {page ? <div className="min-w-0 space-y-4">
                  <Card className="min-w-0"><CardHeader className="flex flex-wrap flex-row items-center justify-between gap-3"><div className="min-w-0"><CardTitle>{page.version === null ? "Create page" : page.title || "Untitled"}</CardTitle><CardDescription className="truncate">{page.slug || "Homepage"}{draftChanged && " · Unsaved changes"}</CardDescription></div><div className="flex gap-2"><Button variant="outline" render={<a href={publicHref(page.slug)} target="_blank" rel="noreferrer" />} disabled={page.version === null}><ExternalLink className="size-4"/>View</Button><Button disabled={busy} onClick={savePage}><Save className="size-4"/>Save</Button></div></CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid gap-4 lg:grid-cols-2"><Field label="Page path (slug)" hint="Lowercase, hyphens and slashes. Homepage is empty."><Input disabled={page.version !== null} value={page.slug} onChange={e => editPage("slug", e.target.value.toLowerCase())} placeholder="guides/installation"/></Field><Field label="Title"><Input value={page.title} maxLength={160} onChange={e => editPage("title", e.target.value)} placeholder="Installation"/></Field></div>
                      <Field label="Description"><Input value={page.description} maxLength={500} onChange={e => editPage("description", e.target.value)} placeholder="What this page covers" /></Field>
                      <Separator />
                      <Tabs defaultValue="editor" className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-2"><TabsList><TabsTrigger value="editor">MDX editor</TabsTrigger><TabsTrigger value="preview">Preview</TabsTrigger></TabsList><div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={() => editPage("body", page.body + "\n## Heading\n")}>H2</Button><Button size="sm" variant="outline" onClick={() => editPage("body", page.body + "**Bold text**")}>Bold</Button><Button size="sm" variant="outline" onClick={() => editPage("body", page.body + "[Link](https://example.com)")}>Link</Button><Button size="sm" variant="outline" onClick={() => editPage("body", page.body + "\n```ts\nconst x = 1\n```\n")}>Code</Button></div></div>
                        <TabsContent value="editor" className="ng-account-editor mt-4"><AccountMdxEditor key={page.slug || "new-page"} value={page.body} slug={page.slug} onChange={value => editPage("body", value)}/></TabsContent>
                        <TabsContent value="preview" className="mt-4"><PagePreview page={page}/></TabsContent>
                      </Tabs>
                    </CardContent>
                    {page.version !== null && page.slug && <CardFooter className="justify-end"><Button variant="destructive" onClick={deletePage} disabled={busy}><Trash2 className="size-4"/>Delete page</Button></CardFooter>}
                  </Card>
                </div> : <Card className="min-h-80 items-center justify-center"><FileText className="size-8 text-muted-foreground"/><CardTitle>Select a page</CardTitle><CardDescription>Choose an existing page or create a new one.</CardDescription><Button variant="outline" onClick={createPage}><Plus className="size-4"/>New page</Button></Card>}
              </div>
            </>}
            {view === "navigation" && <>
              <div><h1 className="text-2xl font-semibold tracking-tight">Navigation</h1><p className="mt-1 text-sm text-muted-foreground">Edit labels, visibility, and ordering for each docs folder.</p></div>
              <Card><CardHeader><CardTitle>Navigation entries</CardTitle><CardDescription>Use the up/down buttons to arrange sidebar items.</CardDescription></CardHeader><CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-3"><div className="min-w-48 flex-1"><Field label="Folder"><Input value={navigationFolder} placeholder="Root folder" onChange={e => setNavigationFolder(e.target.value)} /></Field></div><Button variant="outline" onClick={openFolder} disabled={busy}>Open folder</Button></div>
                <Table><TableHeader><TableRow><TableHead>Path</TableHead><TableHead>Label</TableHead><TableHead>Visible</TableHead><TableHead className="text-right">Order</TableHead></TableRow></TableHeader><TableBody>
                  {navigation?.items.map((item, index) => <TableRow key={item.slug}><TableCell className="max-w-56 truncate text-xs text-muted-foreground">{item.slug}</TableCell><TableCell><Input aria-label={"Navigation title for " + item.slug} value={item.title} onChange={e => setNavigation(prev => prev ? { ...prev, items: prev.items.map((row, i) => i === index ? { ...row, title: e.target.value } : row) } : prev)}/></TableCell><TableCell><Checkbox aria-label={"Show " + item.slug} checked={!item.hidden} onCheckedChange={checked => setNavigation(prev => prev ? { ...prev, items: prev.items.map((row, i) => i === index ? { ...row, hidden: checked !== true } : row) } : prev)} /></TableCell><TableCell><div className="flex justify-end gap-1"><Button size="icon-sm" variant="outline" aria-label={"Move " + item.slug + " up"} disabled={index === 0} onClick={() => moveNav(index, -1)}><ChevronUp className="size-4"/></Button><Button size="icon-sm" variant="outline" aria-label={"Move " + item.slug + " down"} disabled={index === navigation.items.length - 1} onClick={() => moveNav(index, 1)}><ChevronDown className="size-4"/></Button></div></TableCell></TableRow>)}
                </TableBody></Table>
              </CardContent><CardFooter className="justify-end"><Button onClick={saveNavigation} disabled={busy}><Save className="size-4"/>Save navigation</Button></CardFooter></Card>
            </>}
            {view === "design" && <>
              <div><h1 className="text-2xl font-semibold tracking-tight">Appearance & site</h1><p className="mt-1 text-sm text-muted-foreground">These settings apply to your published documentation. The admin UI remains Vega.</p></div>
              <div className="grid items-start gap-4 xl:grid-cols-2">
                <Card><CardHeader><CardTitle>Site identity</CardTitle><CardDescription>Page titles, URLs, and brand images.</CardDescription></CardHeader><CardContent className="space-y-4">
                  <Field label="Site title"><Input value={site.name} onChange={e => editSite("name", e.target.value)}/></Field>
                  <Field label="Description"><Textarea rows={3} value={site.description} onChange={e => editSite("description", e.target.value)}/></Field>
                  <Field label="Public origin"><Input value={site.url} placeholder="https://docs.example.com" onChange={e => editSite("url", e.target.value)}/></Field>
                  <Field label="Sidebar logo"><Choice label="Sidebar logo" value={site.logo} onChange={value => editSite("logo", value)} options={[{ value: "", label: "Default icon" }, ...(overview?.media || []).map(item => ({value:item.url,label:item.name}))]}/></Field>
                  <Field label="Custom logo path"><Input value={site.logo} placeholder="/logo.svg" onChange={e => editSite("logo", e.target.value)}/></Field>
                  <Field label="Open Graph image path"><Input value={site.ogImage} placeholder="/cover.png" onChange={e => editSite("ogImage", e.target.value)}/></Field>
                </CardContent></Card>
                <Card><CardHeader><CardTitle>Documentation design</CardTitle><CardDescription>Theme, accent, and font families.</CardDescription></CardHeader><CardContent><SiteDesign site={site} change={editSite}/></CardContent></Card>
                <Card><CardHeader><CardTitle>Sidebar footer</CardTitle><CardDescription>Optional attribution at the bottom of your docs sidebar.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex items-center gap-3"><Switch id="ng-footer-enabled" checked={site.copyrightEnabled} onCheckedChange={checked => editSite("copyrightEnabled", checked)}/><Label htmlFor="ng-footer-enabled">Show footer</Label></div><Field label="Footer text"><Input disabled={!site.copyrightEnabled} value={site.copyrightText} onChange={e => editSite("copyrightText", e.target.value)}/></Field><Field label="Footer link"><Input disabled={!site.copyrightEnabled} value={site.copyrightHref} onChange={e => editSite("copyrightHref", e.target.value)}/></Field></CardContent></Card>
                <Card><CardHeader><CardTitle>Owner profile</CardTitle><CardDescription>Private details, not displayed on public pages.</CardDescription></CardHeader><CardContent className="space-y-4"><Field label="Display name"><Input value={site.ownerName} onChange={e => editSite("ownerName", e.target.value)}/></Field><Field label="Contact email"><Input type="email" value={site.ownerEmail} onChange={e => editSite("ownerEmail", e.target.value)}/></Field><Field label="Avatar"><Choice label="Owner avatar" value={site.ownerAvatar} onChange={value => editSite("ownerAvatar", value)} options={[{ value: "", label: "Default avatar" }, ...(overview?.media || []).map(item => ({value:item.url,label:item.name}))]}/></Field></CardContent></Card>
              </div>
              <div className="flex justify-end"><Button disabled={busy} onClick={() => act(() => saveSite(), "Settings saved.")}><Save className="size-4"/>Save settings</Button></div>
            </>}
            {view === "media" && <>
              <div><h1 className="text-2xl font-semibold tracking-tight">Media library</h1><p className="mt-1 text-sm text-muted-foreground">Upload images for your documentation. Files stay on your server.</p></div>
              <Card><CardHeader><CardTitle>Upload image</CardTitle><CardDescription>PNG, JPEG, WebP or GIF, maximum 2 MB.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center gap-3"><Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="w-full max-w-md" onChange={e => setUpload(e.target.files?.[0] || null)}/><Button onClick={uploadMedia} disabled={!upload || busy}><HardDriveUpload className="size-4"/>Upload</Button></CardContent></Card>
              <Card><CardHeader><CardTitle>Images</CardTitle><CardDescription>{overview!.media.length} files</CardDescription></CardHeader><CardContent><div className="divide-y rounded-md border">{overview!.media.length ? overview!.media.map(item => <div key={item.name} className="flex flex-wrap items-center gap-3 p-3"><FileText className="size-4 text-muted-foreground"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.name}</p><p className="truncate text-xs text-muted-foreground">{item.url}</p></div><Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(item.url)}><Copy className="size-4"/>Copy URL</Button><Button variant="destructive" size="sm" onClick={() => deleteMedia(item.name)} disabled={busy}><Trash2 className="size-4"/>Delete</Button></div>) : <p className="p-5 text-sm text-muted-foreground">No images uploaded yet.</p>}</div></CardContent></Card>
            </>}
            {view === "security" && <>
              <div><h1 className="text-2xl font-semibold tracking-tight">Security</h1><p className="mt-1 text-sm text-muted-foreground">Manage authenticator access, recovery codes, and active sessions.</p></div>
              <Card><CardHeader><CardTitle>Authenticator & recovery</CardTitle><CardDescription>Changing your authenticator requires a valid current code or unused recovery code. Recovery renewal requires your authenticator.</CardDescription></CardHeader><CardContent className="space-y-4"><Field label="Current code or recovery code"><Input value={securityCode} onChange={e => setSecurityCode(e.target.value)} autoComplete="off" placeholder="000000 or NG-XXXX-..." maxLength={27}/></Field><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || !(securityCode.length === 6 || /^NG-(?:[a-fA-F0-9]{4}-){4}[a-fA-F0-9]{4}$/.test(securityCode.trim()))} onClick={() => act(async () => { const result = await secureAction<{qrDataUrl:string;manualKey:string}>("rotate-begin", {code:securityCode.trim()});setNewQr(result.qrDataUrl);setNewSecret(result.manualKey);setSecurityCode("") })}>Change authenticator</Button><Button variant="outline" disabled={busy || securityCode.length !== 6} onClick={() => act(async () => { const result = await secureAction<{recoveryCodes:string[]}>("recovery-renew",{code:securityCode.trim()});setRecoveryCodes(result.recoveryCodes);setRecoverySaved(false);setSecurityCode("") }, "Recovery codes replaced. Save the new codes.")}>Replace recovery codes</Button></div>
                {newQr && <div className="space-y-3 rounded-md border p-4"><p className="text-sm">Scan this QR code with your new authenticator.</p><img src={newQr} width={220} height={220} alt="New authenticator QR code" className="rounded bg-white p-2"/><code className="block break-all text-xs">{newSecret}</code><Input value={newCode} onChange={e => setNewCode(e.target.value)} inputMode="numeric" placeholder="New authenticator code" maxLength={6}/><Button disabled={busy || newCode.length !== 6} onClick={() => act(async () => { const result = await secureAction<{recoveryCodes:string[]}>("rotate-finish",{code:newCode});setRecoveryCodes(result.recoveryCodes);setRecoverySaved(false);setNewQr("");setNewSecret("");setNewCode("") }, "Authenticator changed. Save replacement recovery codes.")}>Verify new authenticator</Button></div>}
                {recoveryCodes && <div className="space-y-3 rounded-md border p-4"><p className="text-sm font-medium">Save these replacement recovery codes now. Old codes are invalid.</p><pre className="break-all whitespace-pre-wrap rounded bg-muted p-3 font-mono text-xs leading-7">{recoveryCodes.join("\n")}</pre><Button variant="outline" onClick={() => navigator.clipboard.writeText(recoveryCodes.join("\n"))}><Copy className="size-4"/>Copy codes</Button><div className="flex items-center gap-3"><Checkbox id="ng-recovery-ack" checked={recoverySaved} onCheckedChange={checked => setRecoverySaved(checked === true)}/><Label htmlFor="ng-recovery-ack">I saved these codes</Label></div><Button disabled={!recoverySaved} onClick={() => setRecoveryCodes(null)}>Done</Button></div>}
              </CardContent></Card>
              <Card><CardHeader><CardTitle>Sessions</CardTitle><CardDescription>Sign out everywhere if you think another device is using your session.</CardDescription></CardHeader><CardFooter><Button variant="destructive" disabled={busy} onClick={() => act(async () => { await secureAction("logout-all", {}); window.location.replace("/login") })}><LogOut className="size-4"/>Sign out all devices</Button></CardFooter></Card>
            </>}
          </>}
        </main>
      </SidebarInset>
    </SidebarProvider>
  </div></AccountProviders>
}
