"use client"

import * as React from "react"
import { Badge } from "../account/ui/badge.js"
import { Button } from "../account/ui/button.js"
import { Card, CardContent } from "../account/ui/card.js"
import { type ExtensionViewNode, validateExtensionView } from "./views.js"

export type ExtensionViewProps = {
  view: unknown
  onAction?: (action: string) => void
  className?: string
}

function RenderNode({ node, onAction }: {
  node: ExtensionViewNode
  onAction?: (action: string) => void
}): React.ReactNode {
  switch (node.type) {
    case "text": return <span>{node.text}</span>
    case "paragraph": return <p className="text-sm leading-6 text-foreground">{node.text}</p>
    case "heading": {
      const Heading = node.level === 2 ? "h2" : node.level === 3 ? "h3" : "h4"
      return <Heading className="text-lg font-semibold leading-tight">{node.text}</Heading>
    }
    case "badge": return <Badge>{node.text}</Badge>
    case "link":
      return <a href={node.href} rel="noopener noreferrer" target={node.href.startsWith("/") ? undefined : "_blank"}
        className="text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">
        {node.text}
      </a>
    case "button": return <Button type="button" disabled={!onAction} onClick={() => onAction?.(node.action)}>
      {node.text}
    </Button>
    case "divider": return <hr className="border-border" />
    case "stack": return <div className="flex flex-col gap-3">
      {node.children.map((child, index) => <RenderNode key={index} node={child} onAction={onAction} />)}
    </div>
    case "card": return <Card><CardContent className="space-y-3 p-4">
      {node.children.map((child, index) => <RenderNode key={index} node={child} onAction={onAction} />)}
    </CardContent></Card>
  }
}

/**
 * Host-owned React renderer for reviewed JSON contributions.
 * Never evaluates JSX, imports extension scripts, or accepts arbitrary HTML.
 * Callers own authorization of action identifiers.
 */
export function ExtensionView({ view, onAction, className }: ExtensionViewProps) {
  const report = React.useMemo(() => validateExtensionView(view), [view])
  if (!report.valid || !report.view) {
    return <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
      This add-on provided an invalid view.
    </div>
  }
  return <section className={className} data-nextguide-extension-view="">
    <RenderNode node={report.view} onAction={onAction} />
  </section>
}
