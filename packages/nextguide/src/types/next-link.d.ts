/**
 * Type-only contract for the Next.js *peer* imported by site/next.
 *
 * The compiled JS continues importing the real "next/link" from the host
 * Next.js application. This declaration is used only by this package's
 * standalone TypeScript build, which must not depend on Bun hoisting Next.
 */
import type { AnchorHTMLAttributes, ComponentType } from "react"

type DocsLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean | null }
declare const Link: ComponentType<DocsLinkProps>
export default Link
