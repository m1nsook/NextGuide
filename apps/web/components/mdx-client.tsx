"use client"

import type { SerializeResult } from "nextguide/mdx"
import { MdxClient } from "nextguide/mdx/client"
import { Pre } from "nextguide/components"
import { Callout, Card, Cards } from "./callout"
import { Install, Tab, Tabs } from "./install"

/** Client-side MDX rendering, used by pages with `render: client` frontmatter. */
export function ClientMdx({ serialized }: { serialized: SerializeResult }) {
  return <MdxClient serialized={serialized} components={{ pre: Pre, Callout, Cards, Card, Install, Tabs, Tab }} />
}
