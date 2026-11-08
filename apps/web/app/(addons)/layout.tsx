import { DocsSidebar } from "@/components/docs-sidebar"
import { getAddonsNavigation } from "@/lib/navigation"
import nextguidePackage from "../../../../packages/nextguide/package.json"

/** Independent add-on documentation sidebar; shared NextGuide rendering system. */
export default async function AddonsLayout({ children }: { children: React.ReactNode }) {
  const items = await getAddonsNavigation()
  return (
    <div className="lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]">
      <DocsSidebar items={items} version={nextguidePackage.version}
        basePath="/addons" siteName="NextGuide Add-ons" homeHref="/addons" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
