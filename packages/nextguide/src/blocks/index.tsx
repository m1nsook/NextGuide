"use client"

import * as React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/interactive.js"
import {
  AlertCircle, Check, CheckCircle2, ChevronRight, Code2, Copy, FileArchive,
  FileCode2, FileJson2, FileText, Folder, Info, Lightbulb, ListTree, Terminal,
  TriangleAlert,
} from "lucide-react"

export type FileTreeItem = {
  name: string
  kind?: "folder" | "file" | "code" | "json" | "executable" | "archive" | "segment"
  detail?: string
  children?: FileTreeItem[]
}

function treeText(nodes: FileTreeItem[], prefix = "", singleRoot = false): string[] {
  const lines: string[] = []
  nodes.forEach((node, index) => {
    const last = index === nodes.length - 1
    const name = node.name + (node.kind === "folder" ? "/" : "")
    const suffix = node.detail ? " — " + node.detail : ""
    lines.push(singleRoot ? name + suffix : prefix + (last ? "└── " : "├── ") + name + suffix)
    if (node.children?.length) {
      lines.push(...treeText(node.children, singleRoot ? "" : prefix + (last ? "    " : "│   ")))
    }
  })
  return lines
}

function useCopy() {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return {
    copied,
    copy: async (value: string) => {
      try {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), 1800)
      } catch {
        setCopied(false)
      }
    },
  }
}

export function CopyButton({ value, className, label = "Copy" }: {
  value: string
  className?: string
  label?: string
}) {
  const { copied, copy } = useCopy()
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={"ng-copy-button " + (className ?? "")}
            aria-label={copied ? "Copied" : label}
            onClick={() => void copy(value)}>
            {copied ? <Check aria-hidden="true" size={15} /> : <Copy aria-hidden="true" size={15} />}
            <span className="ng-sr-only" aria-live="polite">{copied ? "Copied" : ""}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{copied ? "Copied" : label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const languageLabels: Record<string, string> = {
  ps1: "PowerShell", powershell: "PowerShell", pwsh: "PowerShell",
  shell: "Shell", sh: "Shell", bash: "Shell", cmd: "Command Prompt",
  ts: "TypeScript", tsx: "TSX", js: "JavaScript", jsx: "JSX",
  json: "JSON", yaml: "YAML", yml: "YAML", rust: "Rust", rs: "Rust",
  css: "CSS", html: "HTML", mdx: "MDX", text: "Plain text",
}
export type CodeWindowProps = {
  code: string
  title?: string
  language?: string
  description?: string
  lineNumbers?: boolean
  wrap?: boolean
  className?: string
}
export function CodeWindow({ code, title, language = "text", description, lineNumbers = false, wrap = false, className = "" }: CodeWindowProps) {
  const label = languageLabels[language.toLowerCase()] ?? language
  return (
    <figure className={"ng-code-window " + className}>
      <figcaption className="ng-code-header">
        {["ps1", "powershell", "pwsh", "bash", "shell", "sh"].includes(language.toLowerCase())
          ? <Terminal aria-hidden="true" size={16} />
          : <Code2 aria-hidden="true" size={16} />}
        <span className="ng-code-title">{title ?? label}</span>
        {title ? <span className="ng-code-language">{label}</span> : null}
        <CopyButton value={code} />
      </figcaption>
      <pre className={"ng-code-pre" + (wrap ? " ng-code-wrap" : "")}><code>
        {lineNumbers
          ? code.replace(/\n$/, "").split("\n").map((line, i) => <span key={i} className="ng-code-line" data-line={i + 1}>{line || " "}</span>)
          : code}
      </code></pre>
      {description ? <p className="ng-code-description">{description}</p> : null}
    </figure>
  )
}

export type CodeTab = { label: string; code: string; language?: string; title?: string }
export function CodeTabs({ items, defaultIndex = 0, className = "" }: {
  items: CodeTab[]
  defaultIndex?: number
  className?: string
}) {
  const [index, setIndex] = React.useState(defaultIndex)
  const active = items[index] ?? items[0]
  if (!active) return null
  return (
    <div className={"ng-code-tabs " + className}>
      <div className="ng-code-tabs-bar" role="tablist" aria-label="Code examples">
        {items.map((item, i) => (
          <button key={item.label + i} type="button" role="tab"
            aria-selected={i === index} aria-controls={"ng-code-tab-" + i}
            className="ng-code-tab" onClick={() => setIndex(i)}>{item.label}</button>
        ))}
      </div>
      <div role="tabpanel" id={"ng-code-tab-" + index} className="ng-code-tabs-panel">
        <CodeWindow code={active.code} language={active.language ?? "text"} title={active.title ?? active.label} />
      </div>
    </div>
  )
}

const fileIcons = {
  folder: Folder, file: FileText, code: FileCode2, json: FileJson2,
  executable: FileArchive, archive: FileArchive, segment: FileText,
}
function FileNodes({ items }: { items: FileTreeItem[] }) {
  return <ul className="ng-file-list">{items.map((node, i) => {
    const Icon = fileIcons[node.kind ?? "file"]
    const label = <><Icon size={16} className={"ng-file-icon ng-file-" + (node.kind ?? "file")} aria-hidden="true" />
      <span className="ng-file-name">{node.name}</span>
      {node.detail ? <span className="ng-file-detail">{node.detail}</span> : null}</>
    return <li key={node.name + i}>
      {node.children?.length
        ? <details open><summary><ChevronRight className="ng-file-chevron" size={14} aria-hidden="true" />{label}</summary><div className="ng-file-children"><FileNodes items={node.children} /></div></details>
        : <div className="ng-file-leaf">{label}</div>}
    </li>
  })}</ul>
}
export function FileTree({ title = "File structure", description, items }: {
  title?: string
  description?: string
  items: FileTreeItem[]
}) {
  return (
    <figure className="ng-file-tree">
      <figcaption className="ng-code-header">
        <ListTree aria-hidden="true" size={16} />
        <span className="ng-code-title">{title}</span>
        <CopyButton value={treeText(items, "", items.length === 1).join("\n")} label="Copy file tree" />
      </figcaption>
      <div className="ng-file-tree-body"><FileNodes items={items} /></div>
      {description ? <p className="ng-code-description">{description}</p> : null}
    </figure>
  )
}

export type CalloutKind = "info" | "tip" | "warning" | "danger" | "success"
const calloutIcons = { info: Info, tip: Lightbulb, warning: TriangleAlert, danger: AlertCircle, success: CheckCircle2 }
export function Callout({ kind = "info", title, children }: {
  kind?: CalloutKind
  title?: string
  children?: React.ReactNode
}) {
  const Icon = calloutIcons[kind]
  return <aside className={"ng-callout ng-callout-" + kind} role={kind === "danger" || kind === "warning" ? "note" : undefined}>
    <Icon size={18} aria-hidden="true" />
    <div className="ng-callout-content">{title ? <strong>{title}</strong> : null}<div>{children}</div></div>
  </aside>
}
export function Steps({ children }: { children?: React.ReactNode }) {
  return <ol className="ng-steps">{children}</ol>
}
export function Step({ title, children }: { title: string; children?: React.ReactNode }) {
  return <li><h3>{title}</h3><div>{children}</div></li>
}
export function LinkCards({ children }: { children?: React.ReactNode }) {
  return <div className="ng-link-cards">{children}</div>
}
export function LinkCard({ title, description, href, icon: Icon }: {
  title: string
  description?: string
  href: string
  icon?: React.ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" | "false" }>
}) {
  return <a className="ng-link-card" href={href}>
    {Icon ? <Icon size={18} aria-hidden="true" /> : null}
    <span><strong>{title}</strong>{description ? <span>{description}</span> : null}</span>
    <ChevronRight size={16} aria-hidden="true" />
  </a>
}
