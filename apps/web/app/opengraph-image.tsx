import { renderNextGuideOgImage } from "nextguide/og"
import { site } from "@/lib/site"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "NextGuide documentation"

export default function Image() {
  return renderNextGuideOgImage({
    siteName: site.name,
    title: "Documentation that belongs to your project",
    description: site.description,
    section: "Next.js documentation",
  })
}
