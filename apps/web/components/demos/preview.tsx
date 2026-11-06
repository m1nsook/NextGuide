import type { ReactNode } from "react"
import { OpenAPI } from "nextguide/components"
import { edgeCases, openapi, REFERENCE_BASE } from "@/lib/source"

/** A framed live preview inside MDX. */
export function Preview({ children }: { children?: ReactNode }) {
  return (
    <div className="ng-live-preview not-prose my-6">
      <div className="ng-live-preview-heading">Preview</div>
      <div className="ng-live-preview-body">{children}</div>
    </div>
  )
}

/**
 * Wraps live OpenAPI.* demos in an `OpenAPI.Root` with the demo API.
 * An async Server Component: the spec is parsed on the server and only the
 * model is sent to the client components below.
 */
export async function ApiPreview({ children }: { children?: ReactNode }) {
  const api = await openapi.parse()
  return (
    <Preview>
      <OpenAPI.Root api={api} operationBaseHref={REFERENCE_BASE}>
        {children}
      </OpenAPI.Root>
    </Preview>
  )
}

/** Renders children inside `OpenAPI.Root` with the edge-case fixture spec. */
export async function EdgeCasePreview({ children }: { children?: ReactNode }) {
  const api = await edgeCases.parse()
  return (
    <Preview>
      <OpenAPI.Root api={api}>{children}</OpenAPI.Root>
    </Preview>
  )
}
