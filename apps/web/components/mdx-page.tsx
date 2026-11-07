import type { ComponentProps } from "react"
import { DocsSitePage } from "nextguide/site"
import { staticHref } from "@/lib/static-href"

type Props = ComponentProps<typeof DocsSitePage>

/** Keep the package's exact reading layout; only fix URLs of its plain anchors on Pages. */
export function MdxPage(props: Props) {
  const breadcrumbs = props.breadcrumbs.map((item) => ({
    ...item, ...(item.href ? { href: staticHref(item.href) } : {}),
  }))
  const previous = props.previous ? { ...props.previous, href: staticHref(props.previous.href) } : undefined
  const next = props.next ? { ...props.next, href: staticHref(props.next.href) } : undefined
  return <DocsSitePage {...props} breadcrumbs={breadcrumbs} previous={previous} next={next} />
}
