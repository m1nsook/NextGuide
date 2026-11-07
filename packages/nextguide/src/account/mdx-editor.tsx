"use client"

import * as React from "react"
import { useTheme } from "next-themes"

// Monaco's editor and workers are browser-only. Load them only after mount.
// Use the locally installed /public/_nextguide/monaco/vs files, NOT a CDN.
// The CLI installs those files during Account Mode setup/upgrade.
const MonacoEditor = React.lazy(async () => {
  const mod = await import("@monaco-editor/react")
  mod.loader.config({ paths: { vs: "/_nextguide/monaco/vs" } })
  return { default: mod.Editor }
})

export interface AccountMdxEditorProps {
  value: string
  onChange: (value: string) => void
  slug: string
}

/** Native text editing remains available on mobile and before Monaco loads. */
export function AccountMdxEditor({ value, onChange, slug }: AccountMdxEditorProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [touchDevice, setTouchDevice] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
    setTouchDevice(window.matchMedia("(pointer: coarse)").matches)
  }, [])
  const fallback = (
    <textarea
      aria-label="MDX page source"
      className="ng-studio-mdx ng-studio-editor-fallback"
      value={value}
      onChange={event => onChange(event.target.value)}
      spellCheck={false}
      rows={20}
      placeholder="# Write your documentation in MDX..."
    />
  )
  if (!mounted || touchDevice) return fallback

  return (
    <div className="ng-studio-monaco" aria-label="MDX source editor">
      <React.Suspense fallback={fallback}>
        <MonacoEditor
          path={"inmemory://nextguide/" + (slug || "index") + ".mdx"}
          language="markdown"
          theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
          height="480px"
          value={value}
          onChange={(next: string | undefined) => onChange(next ?? "")}
          loading={<div className="ng-studio-monaco-loading" role="status">Loading MDX editor…</div>}
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
            wordWrap: "on",
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            tabSize: 2,
            fontFamily: "var(--ng-preview-jetbrains-mono), 'JetBrains Mono', ui-monospace, monospace",
            fontSize: 13,
            lineHeight: 21,
            smoothScrolling: true,
            padding: { top: 14, bottom: 14 },
            renderLineHighlight: "line",
            accessibilitySupport: "auto",
            bracketPairColorization: { enabled: true }
          }}
        />
      </React.Suspense>
    </div>
  )
}
