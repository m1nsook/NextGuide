"use client"

import * as React from "react"
import { BookOpen, Brush, ChevronDown, ChevronUp, Copy, ExternalLink, FilePlus, FileText, FolderTree, HardDriveUpload, LayoutDashboard, LockKeyhole, LogOut, Menu, Save, Search, Settings, ShieldCheck, Trash2 } from "lucide-react"
import { LogoMark } from "../components/site/logo.js"
import { Providers as DocsSiteProviders } from "../components/site/providers.js"
import { ThemeToggle } from "../components/site/theme-toggle.js"
import { Card, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/index.js"

type Font = "inter" | "geist" | "ibm-plex-sans" | "segoe-ui" | "system" | "jetbrains-mono" | "geist-mono" | "ibm-plex-mono" | "system-mono"
type Site = { name: string; description: string; url: string; logo: string; ogImage: string; copyrightEnabled: boolean; copyrightText: string; copyrightHref: string; ownerName: string; ownerEmail: string; ownerAvatar: string; accent: string; theme: string; bodyFont: Font; headingFont: Font; codeFont: Font; setupComplete: boolean }
type PageRow = { slug: string; title: string; description: string; version: string; bytes: number }
type Page = { slug: string; title: string; description: string; body: string; version: string | null }
type NavEntry = { slug: string; title: string; hidden: boolean }
type Navigation = { folder: string; items: NavEntry[] }
type Media = { name: string; url: string }
type Overview = { site: Site; pages: PageRow[]; navigation: Navigation; media: Media[] }
type View = "overview" | "pages" | "navigation" | "design" | "media" | "security"
const accents = ["blue", "red", "green", "purple", "yellow", "orange", "teal", "pink"]
const accentColor: Record<string,string> = { blue:"#60a5fa", red:"#fb7185", green:"#4ade80", purple:"#c084fc", yellow:"#facc15", orange:"#fb923c", teal:"#2dd4bf", pink:"#f472b6" }
const bodyFonts: { id: Font; name: string; family: string }[] = [
  {id:"inter",name:"Inter",family:"Inter, sans-serif"}, {id:"geist",name:"Geist",family:"Geist, sans-serif"},
  {id:"ibm-plex-sans",name:"IBM Plex Sans",family:"IBM Plex Sans, sans-serif"},
  {id:"segoe-ui",name:"Segoe UI",family:"Segoe UI, sans-serif"}, {id:"system",name:"System UI",family:"system-ui, sans-serif"},
]
const codeFonts: { id: Font; name: string; family: string }[] = [
  {id:"jetbrains-mono",name:"JetBrains Mono",family:"JetBrains Mono, monospace"},
  {id:"geist-mono",name:"Geist Mono",family:"Geist Mono, monospace"},
  {id:"ibm-plex-mono",name:"IBM Plex Mono",family:"IBM Plex Mono, monospace"},
  {id:"system-mono",name:"System",family:"ui-monospace, monospace"},
]
const navigationItems: { id: View; label: string; icon: typeof BookOpen }[] = [
  { id:"overview",label:"Overview",icon:LayoutDashboard },
  { id:"pages",label:"Pages & editor",icon:FileText },
  { id:"navigation",label:"Navigation",icon:FolderTree },
  { id:"design",label:"Appearance & site",icon:Brush },
  { id:"media",label:"Media library",icon:HardDriveUpload },
  { id:"security",label:"Security",icon:LockKeyhole },
]
const emptyPage: Page = {slug:"",title:"",description:"",body:"",version:null}

async function request<T>(action: string, data?: object, method: "GET"|"POST" = "GET"): Promise<T> {
  const response = await fetch("/api/nextguide/studio/" + action, {
    method, credentials:"same-origin", cache:"no-store",
    ...(method === "POST" ? { headers:{"Content-Type":"application/json"}, body:JSON.stringify(data) } : {}),
  })
  let result: Record<string,unknown> = {}
  try { result = await response.json() } catch { /* surface the HTTP status below */ }
  if (response.status === 401) { window.location.replace("/login"); throw Error("Your session expired. Please sign in.") }
  if (!response.ok) throw Error(String(result.error || "Operation failed (HTTP " + response.status + ")."))
  return result as T
}

/** Reuse the same Radix-backed selector as the documentation UI. */
function StudioSelect({ value, onChange, options, label }: {
  value: string
  onChange: (value: string) => void
  label: string
  options: { value: string; label: string }[]
}) {
  const none = "__nextguide_empty__"
  return (
    <Select value={value || none} onValueChange={selected => onChange(selected === none ? "" : selected)}>
      <SelectTrigger aria-label={label} className="ng-studio-radix-trigger">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value || none}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function slugHref(slug: string, basePath: string) {
  const base = basePath
  return (base === "/" ? "" : base) + (slug ? "/" + slug : "/")
}
function slugLabel(slug: string) { return slug || "Homepage" }
function headingPreview(source: string) {
  const lines = source.split("\n").slice(0, 260)
  return lines.map((line, i) => {
    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      const className = "ng-studio-preview-h" + heading[1].length
      return <div key={i} className={className}>{heading[2]}</div>
    }
    if (!line.trim()) return <div key={i} className="ng-studio-preview-gap" />
    if (/^([-*]\s+|\d+\.\s+)/.test(line)) return <p key={i} className="ng-studio-preview-bullet">{line.replace(/^([-*]\s+|\d+\.\s+)/,"• ")}</p>
    if (line.startsWith("`")) return <code key={i}>{line}</code>
    return <p key={i}>{line.replace(/\*\*|(?<!\*)\*/g,"")}</p>
  })
}

export function AccountStudio({ basePath = "/docs" }: { basePath?: string }) {
  const [view,setView] = React.useState<View>("overview")
  const [state,setState] = React.useState<Overview|null>(null)
  const [site,setSite] = React.useState<Site|null>(null)
  const [page,setPage] = React.useState<Page|null>(null)
  const [nav,setNav] = React.useState<Navigation|null>(null)
  const [query,setQuery] = React.useState("")
  const [preview,setPreview] = React.useState(true)
  const [busy,setBusy] = React.useState(false)
  const [error,setError] = React.useState("")
  const [notice,setNotice] = React.useState("")
  const [mobileMenu,setMobileMenu] = React.useState(false)
  const [wizardStep,setWizardStep] = React.useState(0)
  const [selectedUpload,setSelectedUpload] = React.useState<File|null>(null)
  const [securityCode,setSecurityCode] = React.useState("")
  const validRecoveryChallenge = /^NG-(?:[0-9a-fA-F]{4}-){4}[0-9a-fA-F]{4}$/.test(securityCode.trim())
  const [qr,setQr] = React.useState("")
  const [manualKey,setManualKey] = React.useState("")
  const [newCode,setNewCode] = React.useState("")
  const [recovery,setRecovery] = React.useState<string[]|null>(null)
  const [ackRecovery,setAckRecovery] = React.useState(false)
  const [unsaved,setUnsaved] = React.useState(false)
  const appReady = Boolean(state && site)

  const refresh = React.useCallback(async () => {
    const value = await request<Overview>("overview")
    setState(value)
    setSite(value.site)
    setNav(value.navigation)
    return value
  },[])
  React.useEffect(() => { refresh().catch(e=>setError(e.message)) },[refresh])
  function showMessage(message: string) { setError("");setNotice(message) }
  function showError(e: unknown) { setNotice("");setError(e instanceof Error ? e.message : String(e)) }
  async function run(callback: () => Promise<unknown>, message: string) {
    if(busy) return
    setBusy(true);setError("");setNotice("")
    try { await callback(); if(message) showMessage(message) }
    catch(e) { showError(e) }
    finally { setBusy(false) }
  }
  function editSite<K extends keyof Site>(key:K,value:Site[K]) {
    setSite(prev=> prev?{...prev,[key]:value}:prev)
    setUnsaved(true)
  }
  async function saveSite(complete?: boolean) {
    if (!site) return
    const updated = await request<Site>("save-settings",{...site,setupComplete:complete ?? site.setupComplete},"POST")
    setSite(updated);setUnsaved(false);await refresh()
    return updated
  }
  function switchView(next:View) {
    if(unsaved && !window.confirm("You have unsaved site settings. Leave without saving?")) return
    setUnsaved(false);setView(next);setMobileMenu(false);setError("");setNotice("")
  }
  async function loadPage(slug:string) {
    if(page && page.version !== null && unsaved && !window.confirm("Discard unsaved changes?")) return
    await run(async()=>{
      const next=await request<Page>("page?slug="+encodeURIComponent(slug))
      setPage(next);setUnsaved(false);setView("pages")
    },"")
  }
  function changePage<K extends keyof Page>(key:K,value:Page[K]) {
    setPage(prev=>prev?{...prev,[key]:value}:prev);setUnsaved(true)
  }
  async function savePage() {
    if(!page)return
    await run(async()=>{
      const result=await request<Page>("save-page",page,"POST")
      setPage(result);setUnsaved(false);await refresh()
    },"Page saved. Your live documentation will reflect this change on the running server.")
  }
  async function removePage() {
    if(!page||!page.slug)return
    if(!window.confirm("Delete "+page.title+"? This removes the MDX source file and its navigation entry."))return
    await run(async()=>{
      await request("delete-page",{slug:page.slug,version:page.version},"POST")
      setPage(null);setUnsaved(false);await refresh()
    },"Page deleted.")
  }
  async function openNavigation(folder:string) {
    await run(async()=>{setNav(await request<Navigation>("navigation?folder="+encodeURIComponent(folder)))},"")
  }
  async function saveNav() {
    if(!nav)return
    await run(async()=>{setNav(await request<Navigation>("save-navigation",nav,"POST"));await refresh()},"Navigation order saved.")
  }
  function moveNav(index:number,offset:number) {
    setNav(prev=>{
      if(!prev)return prev
      const next=[...prev.items], to=index+offset
      if(to<0||to>=next.length)return prev
      ;[next[index],next[to]]=[next[to],next[index]]
      return {...prev,items:next}
    })
  }
  async function uploadFile() {
    if(!selectedUpload)return
    await run(async()=>{
      if(selectedUpload.size>2*1024*1024)throw Error("Images must be 2 MB or smaller.")
      const file=selectedUpload
      const result=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader()
        reader.onload=()=>resolve(String(reader.result).split(",")[1] || "")
        reader.onerror=()=>reject(Error("Cannot read the selected image."))
        reader.readAsDataURL(file)
      })
      await request("upload-media",{mime:file.type,base64:result},"POST")
      setSelectedUpload(null);await refresh()
    },"Image uploaded. Copy its URL to use in your MDX pages.")
  }
  async function deleteFile(name:string) {
    if(!window.confirm("Permanently delete this media file?"))return
    await run(async()=>{await request("delete-media",{name},"POST");await refresh()},"Media deleted.")
  }
  const filtered=(state?.pages||[]).filter(p=>(p.title+" "+p.slug).toLowerCase().includes(query.toLowerCase()))
  const showWizard=appReady&&!site?.setupComplete
  const to = (title:string,description:string,content:React.ReactNode) => <Card className="ng-studio-section"><header><h2>{title}</h2><p>{description}</p></header>{content}</Card>

  return <DocsSiteProviders defaultTheme="system" enableSystem><div className="ng-studio-shell">
    <aside className={"ng-studio-side "+(mobileMenu?"ng-studio-side-open":"")}>
      <div className="ng-studio-brand"><span className="ng-studio-brand-icon"><LogoMark className="ng-account-icon"/></span><span>NextGuide<small>Account Mode</small></span></div>
      <span className="ng-studio-nav-label">WORKSPACE</span>
      <nav aria-label="Dashboard">
        {navigationItems.map(item=><button key={item.id} type="button" className={"ng-studio-nav-item "+(view===item.id?"ng-studio-active":"")} onClick={()=>switchView(item.id)}><item.icon size={18} aria-hidden="true"/>{item.label}</button>)}
      </nav>
      <div className="ng-studio-side-bottom"><a href={slugHref("", basePath)} target="_blank" rel="noreferrer"><ExternalLink size={16}/>View website</a><form method="post" action="/api/nextguide/account/logout"><button type="submit"><LogOut size={16}/>Sign out</button></form></div>
    </aside>
    <div className="ng-studio-main">
      <header className="ng-studio-topbar">
        <button className="ng-studio-menu" aria-label="Toggle navigation" onClick={()=>setMobileMenu(!mobileMenu)}><Menu size={22}/></button>
        <span>{state?.site.name||"Account Mode"} <span className="ng-studio-chevron">/</span> {navigationItems.find(x=>x.id===view)?.label}</span>
        <div className="ng-studio-header-tools"><a href={slugHref("", basePath)} target="_blank" rel="noreferrer">View docs <ExternalLink size={14}/></a><ThemeToggle /></div>
      </header>
      <main className="ng-studio-workspace" aria-live="polite">
        {error&&<div className="ng-studio-alert ng-studio-error" role="alert">{error}<button type="button" onClick={()=>setError("")}>Dismiss</button></div>}
        {notice&&<div className="ng-studio-alert ng-studio-success" role="status">{notice}<button type="button" onClick={()=>setNotice("")}>Dismiss</button></div>}
        {!appReady&&!error?<p className="ng-studio-muted">Loading your workspace…</p>:null}
        {showWizard&&site?<div className="ng-studio-onboarding">
          <span className="ng-studio-eyebrow">STEP {wizardStep+1} OF 3 · PERSONALIZE YOUR SITE</span>
          <h1>{wizardStep===0?"Welcome to your documentation.":wizardStep===1?"Make it feel like yours.":"You're ready to publish."}</h1>
          <p>{wizardStep===0?"Your authenticator is already connected. Give your site a name and short description.":wizardStep===1?"Choose a readable color scheme and typography. Everything can be changed later.":"Your pages, navigation, search, and components are already installed."}</p>
          <div className="ng-studio-steps" aria-label="Wizard progress"><span data-current={wizardStep===0}>1. Identity</span><span data-current={wizardStep===1}>2. Design</span><span data-current={wizardStep===2}>3. Finish</span></div>
          {wizardStep===0?<div className="ng-studio-fields">
            <label>Website title<input value={site.name} maxLength={100} onChange={e=>editSite("name",e.target.value)} placeholder="Your documentation"/></label>
            <label>Description<textarea value={site.description} maxLength={400} onChange={e=>editSite("description",e.target.value)} rows={3}/></label>
            <label>Public site origin (optional)<input value={site.url} onChange={e=>editSite("url",e.target.value)} placeholder="https://docs.example.com"/></label>
            <label>Your display name (optional)<input value={site.ownerName} onChange={e=>editSite("ownerName",e.target.value)} placeholder="Documentation owner"/></label>
            <label>Contact email (optional, private)<input type="email" value={site.ownerEmail} onChange={e=>editSite("ownerEmail",e.target.value)} placeholder="you@example.com"/></label>
          </div>:null}
          {wizardStep===1?<DesignFields site={site} update={editSite}/>:null}
          {wizardStep===2?<div className="ng-studio-summary"><ShieldCheck size={26}/><h3>{site.name}</h3><p>{site.description}</p><p>Appearance: {site.theme} · {site.accent} · {site.bodyFont}</p><p>Your admin area requires an authenticator code. Keep your recovery codes offline.</p></div>:null}
          <div className="ng-studio-actions">
            {wizardStep>0?<button className="ng-studio-button-secondary" onClick={()=>setWizardStep(x=>x-1)}>Back</button>:null}
            {wizardStep<2?<button className="ng-studio-button" onClick={()=>setWizardStep(x=>x+1)}>Continue</button>:<button className="ng-studio-button" disabled={busy} onClick={()=>run(async()=>{await saveSite(true);setView("overview");setWizardStep(0)},"Site configured. Welcome to your dashboard!")}>Finish setup</button>}
          </div>
        </div>:null}
        {appReady&&!showWizard&&<div className="ng-studio-content">
          {view==="overview"&&<>
            <span className="ng-studio-eyebrow">YOUR WORKSPACE</span><h1>{site?.ownerName ? "Welcome back, "+site.ownerName+"." : "Good to see you again."}</h1><p className="ng-studio-muted">Manage your documentation site without touching source files.</p>
            <div className="ng-studio-stats"><div><FileText size={21}/><strong>{state!.pages.length}</strong><span>Documentation pages</span></div><div><FolderTree size={21}/><strong>{state!.navigation.items.length}</strong><span>Top-level items</span></div><div><HardDriveUpload size={21}/><strong>{state!.media.length}</strong><span>Uploaded images</span></div></div>
            {to("Quick actions","Everything here is stored in your own Next.js project.",<div className="ng-studio-quick"><button onClick={()=>{setPage({...emptyPage});setView("pages")}}><FilePlus size={18}/>Create a page</button><button onClick={()=>switchView("design")}><Brush size={18}/>Customize site</button><button onClick={()=>switchView("navigation")}><FolderTree size={18}/>Edit navigation</button></div>)}
            {to("Recent pages","Continue working on an existing document.",<div className="ng-studio-page-list">{state!.pages.slice(0,8).map(item=><button key={item.slug} onClick={()=>loadPage(item.slug)}><FileText size={17}/><span>{item.title}<small>{slugLabel(item.slug)}</small></span><span>Open</span></button>)}</div>)}
          </>}
          {view==="pages"&&<>
            <div className="ng-studio-title-row"><div><h1>Pages</h1><p className="ng-studio-muted">Edit your MDX, organize guides, and publish updates.</p></div><button className="ng-studio-button" onClick={()=>{setPage({...emptyPage});setUnsaved(false)}}><FilePlus size={17}/>New page</button></div>
            <div className="ng-studio-page-grid"><div className="ng-studio-page-panel"><label className="ng-studio-search"><Search size={16}/><input placeholder="Search pages" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="ng-studio-page-picker">{filtered.map(row=><button type="button" key={row.slug} data-selected={page?.slug===row.slug} onClick={()=>loadPage(row.slug)}><FileText size={16}/><span>{row.title}<small>{slugLabel(row.slug)}</small></span></button>)}</div></div>
              {page?<div className="ng-studio-editor">
                <div className="ng-studio-editor-head"><span>{page.version===null?"New page":"Editing "+slugLabel(page.slug)}</span><div><button className="ng-studio-button-secondary" onClick={()=>setPreview(!preview)}>{preview?"Hide preview":"Show preview"}</button><button className="ng-studio-button" disabled={busy} onClick={savePage}><Save size={17}/>Save</button></div></div>
                <div className="ng-studio-fields"><label>Page path (slug)<input disabled={page.version!==null} value={page.slug} onChange={e=>changePage("slug",e.target.value.toLowerCase())} placeholder="guides/installation"/><small>Lowercase letters, hyphens, and slash. Homepage slug is empty.</small></label>
                  <label>Title<input value={page.title} onChange={e=>changePage("title",e.target.value)} maxLength={160} placeholder="Installation"/></label>
                  <label>Description<input value={page.description} onChange={e=>changePage("description",e.target.value)} maxLength={500} placeholder="What this page teaches"/></label>
                  <div className="ng-studio-editbar"><button title="Insert heading" onClick={()=>changePage("body",page.body+"\n## New heading\n")}>H2</button><button title="Insert bold" onClick={()=>changePage("body",page.body+"**Bold text**")}>B</button><button title="Insert link" onClick={()=>changePage("body",page.body+"[Link](https://example.com)")}>Link</button><button title="Insert code" onClick={()=>changePage("body",page.body+"\n```ts\nconst hello = 'NextGuide'\n```\n")}>Code</button><button title="Insert callout" onClick={()=>changePage("body",page.body+"\n<Callout kind=\"info\" title=\"Note\">Your message</Callout>\n")}>Callout</button></div>
                  <label>Page content <textarea className="ng-studio-mdx" value={page.body} onChange={e=>changePage("body",e.target.value)} spellCheck={false} placeholder="# Welcome to your docs..." rows={17}/></label>
                </div>
                {preview?<div className="ng-studio-preview"><div className="ng-studio-preview-head"><BookOpen size={16}/>Draft reading preview <span>(Markdown approximation; MDX components render on the live page)</span></div><div className="ng-studio-preview-copy"><h2>{page.title||"Untitled page"}</h2>{headingPreview(page.body)}</div></div>:null}
                <div className="ng-studio-editor-actions">{page.version!==null&&page.slug?<button className="ng-studio-button-danger" onClick={removePage}><Trash2 size={16}/>Delete</button>:null}
                  {page.version!==null?<a href={slugHref(page.slug, basePath)} target="_blank" rel="noreferrer"><ExternalLink size={16}/>View published page</a>:null}</div>
              </div>:<div className="ng-studio-placeholder"><FileText size={32}/><h3>Select a page</h3><p>Or create a new one to start writing.</p></div>}
            </div>
          </>}
          {view==="navigation"&&<>
            <h1>Navigation</h1><p className="ng-studio-muted">Choose a folder, reorder its items, or hide entries from the sidebar.</p>
            <div className="ng-studio-fields ng-studio-nav-folder"><label>Folder<input value={nav?.folder||""} onChange={e=>setNav(prev=>prev?{...prev,folder:e.target.value}:prev)} placeholder="Root navigation"/></label><button className="ng-studio-button-secondary" onClick={()=>openNavigation(nav?.folder||"")}>Open folder</button></div>
            {to("Navigation entries","Drag-free keyboard-friendly ordering. Use the arrow buttons to move each entry.",<div className="ng-studio-nav-editor">{nav?.items.map((item,index)=><div className="ng-studio-nav-row" key={item.slug}><span className="ng-studio-nav-position">{index+1}</span><span className="ng-studio-nav-slug">{item.slug}</span><input aria-label={"Navigation title for "+item.slug} value={item.title} onChange={e=>setNav(prev=>prev?{...prev,items:prev.items.map((x,j)=>j===index?{...x,title:e.target.value}:x)}:prev)}/><label className="ng-studio-checkbox"><input type="checkbox" checked={!item.hidden} onChange={e=>setNav(prev=>prev?{...prev,items:prev.items.map((x,j)=>j===index?{...x,hidden:!e.target.checked}:x)}:prev)}/>Visible</label><div className="ng-studio-reorder"><button aria-label={"Move "+item.slug+" up"} disabled={index===0} onClick={()=>moveNav(index,-1)}><ChevronUp size={17}/></button><button aria-label={"Move "+item.slug+" down"} disabled={index===nav!.items.length-1} onClick={()=>moveNav(index,1)}><ChevronDown size={17}/></button></div></div>)}</div>)}
            <button className="ng-studio-button" disabled={busy} onClick={saveNav}><Save size={17}/>Save navigation</button>
          </>}
          {view==="design"&&site&&<>
            <h1>Website & appearance</h1><p className="ng-studio-muted">Your changes are saved on the server and used by your documentation layout.</p>
            {to("Site identity","Make your documentation recognizable.",<div className="ng-studio-fields">
              <label>Title<input value={site.name} onChange={e=>editSite("name",e.target.value)}/></label>
              <label>Description<textarea rows={3} value={site.description} onChange={e=>editSite("description",e.target.value)}/></label>
              <label>Public site origin (no path)<input value={site.url} onChange={e=>editSite("url",e.target.value)} placeholder="https://docs.example.com"/></label>
              <label>Sidebar logo from media library<StudioSelect label="Sidebar logo" value={site.logo} onChange={value=>editSite("logo",value)}
                options={[{value:"",label:"Use site initial (default)"},...state!.media.map(item=>({value:item.url,label:item.name}))]}/></label>
              <label>Sidebar logo public path<input value={site.logo} onChange={e=>editSite("logo",e.target.value)} placeholder="/logo.svg"/></label>
              <label>Custom OG image public path<input value={site.ogImage} onChange={e=>editSite("ogImage",e.target.value)} placeholder="/og-cover.png"/></label>
            </div>)}
            {to("Sidebar footer","Choose your attribution. The default is optional and completely customizable.",<div className="ng-studio-fields">
              <label className="ng-studio-check"><input type="checkbox" checked={site.copyrightEnabled} onChange={e=>editSite("copyrightEnabled",e.target.checked)}/>Show a sidebar footer</label>
              <label>Footer text<input disabled={!site.copyrightEnabled} value={site.copyrightText} onChange={e=>editSite("copyrightText",e.target.value)} placeholder="Built with NextGuide"/></label>
              <label>Footer link<input disabled={!site.copyrightEnabled} value={site.copyrightHref} onChange={e=>editSite("copyrightHref",e.target.value)} placeholder="https://example.com"/></label>
            </div>)}
            {to("Design tokens","Accessible accent presets and typography.",<DesignFields site={site} update={editSite}/>)}
            {to("Owner profile","Optional owner information stays in private account storage and is not displayed publicly.",<div className="ng-studio-fields">
              <label>Display name<input value={site.ownerName} onChange={e=>editSite("ownerName",e.target.value)} maxLength={80}/></label>
              <label>Contact email (not required for login)<input type="email" value={site.ownerEmail} onChange={e=>editSite("ownerEmail",e.target.value)} maxLength={254}/></label>
              <label>Avatar from your media library<select value={site.ownerAvatar} onChange={e=>editSite("ownerAvatar",e.target.value)}><option value="">Default NextGuide avatar</option>{state!.media.map(item=><option key={item.name} value={item.url}>{item.name}</option>)}</select></label>
            </div>)}
            <button className="ng-studio-button" disabled={busy} onClick={()=>run(()=>saveSite(),"Site settings saved.")}><Save size={17}/>Save settings</button>
          </>}
          {view==="media"&&<>
            <h1>Media library</h1><p className="ng-studio-muted">Upload images for docs. Files remain on your server; no external image host is needed.</p>
            {to("Upload an image","PNG, JPEG, WebP or GIF, up to 2 MB.",<div className="ng-studio-upload"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>setSelectedUpload(e.target.files?.[0]||null)}/><button className="ng-studio-button" disabled={!selectedUpload||busy} onClick={uploadFile}><HardDriveUpload size={17}/>Upload</button></div>)}
            {to("Your assets","Click Copy URL to paste into an MDX page.",<div className="ng-studio-media-list">{!state!.media.length?<p className="ng-studio-muted">No images uploaded yet.</p>:state!.media.map(item=><div key={item.name}><FileText size={19}/><span>{item.name}<small>{item.url}</small></span><button onClick={()=>navigator.clipboard.writeText(item.url)} aria-label={"Copy URL for "+item.name}><Copy size={16}/>Copy URL</button><button onClick={()=>deleteFile(item.name)} aria-label={"Delete "+item.name}><Trash2 size={16}/></button></div>)}</div>)}
          </>}
          {view==="security"&&<>
            <h1>Account security</h1><p className="ng-studio-muted">Your documentation is protected by your authenticator, not a password.</p>
            {to("Authenticator & recovery","Keep a saved copy of your recovery codes. They work once each.",<div className="ng-studio-fields"><p>To change your authenticator, confirm with a current authenticator code or an additional unused recovery code. Renewing recovery codes requires your authenticator. A signed-in session alone cannot reset either factor.</p><label>Current authenticator code or unused recovery code<input value={securityCode} onChange={e=>setSecurityCode(e.target.value)} inputMode="text" maxLength={27} autoComplete="off" placeholder="000000 or NG-XXXX-XXXX-XXXX-XXXX-XXXX"/></label>
              <div className="ng-studio-actions"><button className="ng-studio-button-secondary" disabled={busy||!(securityCode.length===6||validRecoveryChallenge)} onClick={()=>run(async()=>{const result=await accountPost<{qrDataUrl:string;manualKey:string}>("rotate-begin",{code:securityCode.trim()});setQr(result.qrDataUrl);setManualKey(result.manualKey);setSecurityCode("")},"")}>Change authenticator</button>
              <button className="ng-studio-button-secondary" disabled={busy||securityCode.length!==6} onClick={()=>run(async()=>{const result=await accountPost<{recoveryCodes:string[]}>("recovery-renew",{code:securityCode.trim()});setRecovery(result.recoveryCodes);setAckRecovery(false);setSecurityCode("")},"Recovery codes replaced. Save the new ones now.")}>Replace recovery codes</button></div>
              {qr?<div className="ng-studio-rotate"><p>Scan this new QR code, then enter a code from your *new* authenticator. Your existing codes stay active until you confirm.</p><img src={qr} width={230} height={230} alt="New authenticator QR code"/><code>{manualKey}</code><input value={newCode} onChange={e=>setNewCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="New authenticator code"/><button className="ng-studio-button" disabled={busy||newCode.length!==6} onClick={()=>run(async()=>{const result=await accountPost<{recoveryCodes:string[]}>("rotate-finish",{code:newCode});setQr("");setManualKey("");setNewCode("");setRecovery(result.recoveryCodes);setAckRecovery(false)},"Authenticator changed. Save these replacement recovery codes.")}>Verify new authenticator</button></div>:null}
              {recovery?<div className="ng-studio-rotate"><strong>Save these replacement recovery codes now.</strong><p>Old recovery codes are now invalid.</p><pre>{recovery.join("\n")}</pre><button onClick={()=>navigator.clipboard.writeText(recovery.join("\n"))} className="ng-studio-button-secondary"><Copy size={16}/>Copy recovery codes</button><label className="ng-studio-checkbox"><input type="checkbox" checked={ackRecovery} onChange={e=>setAckRecovery(e.target.checked)}/>I saved these codes</label><button disabled={!ackRecovery} className="ng-studio-button" onClick={()=>setRecovery(null)}>Done</button></div>:null}
            </div>)}
            {to("Sessions","Sign out from all devices if you think a session is compromised.",<button className="ng-studio-button-danger" onClick={()=>run(async()=>{await accountPost("logout-all",{});window.location.replace("/login")},"")}><LockKeyhole size={17}/>Sign out everywhere</button>)}
          </>}
        </div>}
      </main>
    </div>
  </div></DocsSiteProviders>
}
async function accountPost<T>(action:string,data:object):Promise<T> {
  const response = await fetch("/api/nextguide/account/"+action, {method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)})
  const value = await response.json()
  if(!response.ok)throw Error(value.error||"Account security operation failed.")
  return value
}
function DesignFields({site,update}:{site:Site;update:<K extends keyof Site>(key:K,value:Site[K])=>void}) {
  return <div className="ng-studio-fields">
    <fieldset className="ng-studio-colors"><legend>Accent color</legend><div>{accents.map(accent=><button type="button" key={accent} data-selected={site.accent===accent} aria-label={accent+" accent"} aria-pressed={site.accent===accent} onClick={()=>update("accent",accent)}><span style={{backgroundColor:accentColor[accent]}}/>{accent}</button>)}</div></fieldset>
    <label>Default appearance <StudioSelect label="Default appearance" value={site.theme} onChange={value=>update("theme",value)}
      options={[{value:"light",label:"Light"},{value:"dark",label:"Dark"},{value:"system",label:"Follow system"}]}/></label>
    <div className="ng-studio-font-grid">{(["bodyFont","headingFont","codeFont"] as const).map(field=><label key={field}>{field==="bodyFont"?"Body font":field==="headingFont"?"Heading font":"Code font"}
      <StudioSelect value={site[field]} label={field+" font"} onChange={value=>update(field,value as Font)}
        options={(field==="codeFont"?codeFonts:bodyFonts).map(font=>({value:font.id,label:font.name}))}/>
      <span className="ng-studio-font-sample" style={{fontFamily:[...bodyFonts,...codeFonts].find(f=>f.id===site[field])?.family}}>{field==="codeFont"?'const docs = "NextGuide";':"Build documentation that feels like yours."}</span></label>)}</div>
  </div>
}
