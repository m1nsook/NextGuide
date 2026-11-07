import { DocsSitePageNav } from "nextguide/site"
import type { DocsSitePageLink } from "nextguide/site"
import { staticHref } from "@/lib/static-href"

/** NextGuide's actual shared prev/next control, with static-host-aware anchor URLs. */
export function PageNav({ previous, next }: { previous?: DocsSitePageLink; next?: DocsSitePageLink }) {
  return (
    <DocsSitePageNav
      previous={previous ? { ...previous, href: staticHref(previous.href) } : undefined}
      next={next ? { ...next, href: staticHref(next.href) } : undefined}
    />
  )
}
