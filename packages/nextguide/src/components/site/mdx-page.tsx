import type { ReactNode } from "react"
import { Docs } from "../docs/index.js"
import { DocsBreadcrumbs, DocsPageActions, type DocsBreadcrumbItem } from "../docs/page-tools.js"
import type { TocItem } from "../../core/index.js"
import type { PageLink } from "./page-footer.js"
import { PageNav } from "./page-footer.js"

/** An MDX page: title row, content, previous/next, and the table of contents. */
export function MdxPage({
  title,
  description,
  toc,
  markdown,
  breadcrumbs,
  editUrl,
  previous,
  next,
  children,
}: {
  title?: string
  description?: string
  toc: TocItem[]
  markdown: string
  breadcrumbs: DocsBreadcrumbItem[]
  editUrl?: string
  previous?: PageLink
  next?: PageLink
  children: ReactNode
}) {
  return (
    <div className="mx-auto flex max-w-[76rem] justify-center gap-14 px-5 pt-10 pb-24 sm:px-10 lg:pt-14">
      <article className="w-full max-w-3xl min-w-0">
        <DocsBreadcrumbs items={breadcrumbs} />
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          {title !== undefined ? <Docs.Page.Title>{title}</Docs.Page.Title> : null}
          <DocsPageActions markdown={markdown} title={title ?? "Documentation"} editUrl={editUrl} />
        </div>
        {description !== undefined ? <Docs.Page.Description>{description}</Docs.Page.Description> : null}
        <Docs.Page.Content>{children}</Docs.Page.Content>
        <PageNav previous={previous} next={next} />
      </article>
      <aside className="sticky top-14 hidden h-fit w-52 shrink-0 xl:block">
        <Docs.Toc items={toc} />
      </aside>
    </div>
  )
}
