import { createMdxRoute } from "@/lib/mdx-route"
import { getAddonsNavigation } from "@/lib/navigation"
import { addonDocs } from "@/lib/source"

const route = createMdxRoute(addonDocs, "/addons", getAddonsNavigation)

export default route.Page
export const generateMetadata = route.generateMetadata
export const generateStaticParams = route.generateStaticParams
export const dynamicParams = false
