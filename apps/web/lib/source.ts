import { createDocs, type DocsConfig } from "nextguide/mdx"
import { rehypeAutolinkHeadings, rehypeCodeRaw, rehypeCodeTitles, rehypePrism, rehypeSlug, remarkGfm } from "nextguide/mdx/plugins"
import { createOpenAPI } from "nextguide/openapi"
import { mdxComponents } from "@/components/mdx"

const shared: Omit<DocsConfig, "contentDir"> = {
  remarkPlugins: [remarkGfm],
  rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }], rehypeCodeTitles, rehypePrism, rehypeCodeRaw],
  components: mdxComponents,
}

export const docs = createDocs({ contentDir: "contents/docs", ...shared })
export const componentDocs = createDocs({ contentDir: "contents/components", ...shared })

// This reference is a fictional example, not an actual NextGuide web service.
export const openapi = createOpenAPI({ source: "contents/openapi/example.yaml", allowRemote: false })

export const REFERENCE_BASE = "/reference"

// Internal fixture for source code tests, not a public NextGuide API.
export const edgeCases = createOpenAPI({ source: "contents/openapi/edge-cases.yaml", allowRemote: false })
