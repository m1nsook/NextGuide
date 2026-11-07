import { ImageResponse } from "next/og"
import { NEXTGUIDE_LOGO_PATH } from "../components/site/logo.js"

/** Same 1200 × 630 format as the built-in Next.js generated OG image convention. */
export const NEXTGUIDE_OG_SIZE = { width: 1200, height: 630 } as const
export const NEXTGUIDE_OG_CONTENT_TYPE = "image/png" as const

export type NextGuideOgAccent = "blue" | "red" | "green" | "purple" | "yellow" | "orange" | "teal" | "pink"

export interface NextGuideOgOptions {
  /** Project name appears next to the official NextGuide mark. */
  siteName: string
  /** MDX frontmatter title or a specific route title. */
  title: string
  description?: string
  section?: string
  appearance?: "light" | "dark" | "system"
  accent?: NextGuideOgAccent
}

const LIGHT = {
  blue: "#176ac2", red: "#b91c1c", green: "#166534", purple: "#6d28d9",
  yellow: "#854d0e", orange: "#9a3412", teal: "#115e59", pink: "#9d174d",
}
const DARK = {
  blue: "#64b5f6", red: "#fca5a5", green: "#86efac", purple: "#d8b4fe",
  yellow: "#fde047", orange: "#fdba74", teal: "#5eead4", pink: "#f9a8d4",
}

function limit(value: string, max: number): string {
  const source = Array.from(value.trim())
  return source.length > max ? source.slice(0, max - 1).join("") + "…" : value.trim()
}

/**
 * NextGuide's standard social-preview image, rendered by Next.js at build time
 * for static documentation routes or per request on a Next.js server.
 *
 * Reuses the author's original logo path and the official site palette.
 * This is a server-only helper: no runtime screenshot or external API needed.
 */
export function renderNextGuideOgImage({
  siteName,
  title,
  description = "",
  section = "Documentation",
  appearance = "dark",
  accent = "blue",
}: NextGuideOgOptions): ImageResponse {
  const dark = appearance !== "light" // system falls back to dark for stable social cards
  const palette = dark ? DARK : LIGHT
  const highlight = palette[accent] ?? palette.blue
  const background = dark ? "#0e1014" : "#ffffff"
  const surface = dark ? "#181b20" : "#fafafa"
  const foreground = dark ? "#ededed" : "#0b0b0c"
  const muted = dark ? "#9a9aa2" : "#5f5f67"
  const border = dark ? "#2a2d34" : "#e6e6e9"
  const heading = limit(title || "Documentation", 112)
  const detail = limit(description, 168)
  const headingSize = heading.length > 85 ? 54 : heading.length > 55 ? 62 : 72

  return new ImageResponse(
    <div
      style={{
        display: "flex", flexDirection: "column",
        width: "100%", height: "100%", backgroundColor: background,
        color: foreground, padding: "66px 76px",
        fontFamily: "sans-serif", position: "relative",
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", width: "100%",
          paddingBottom: 30, borderBottom: `1px solid ${border}`,
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 64, height: 64, background: surface,
          borderRadius: 14, border: `1px solid ${border}`,
        }}>
          <svg width="39" height="39" viewBox="0 0 1072 1072" fill={foreground} xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d={NEXTGUIDE_LOGO_PATH} />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 18 }}>
          <span style={{ fontSize: 27, fontWeight: 700, letterSpacing: -1 }}>{limit(siteName || "NextGuide", 44)}</span>
          <span style={{ color: muted, fontSize: 17, marginTop: 4 }}>Documentation powered by NextGuide</span>
        </div>
        <div style={{
          display: "flex", marginLeft: "auto", padding: "12px 18px",
          backgroundColor: surface, border: `1px solid ${border}`,
          color: highlight, borderRadius: 12, fontSize: 17, fontWeight: 600,
        }}>{limit(section, 32)}</div>
      </div>

      <div style={{
        display: "flex", flex: 1, flexDirection: "column", justifyContent: "center",
        paddingTop: 26, paddingBottom: 20,
      }}>
        <div style={{ display: "flex", width: 66, height: 6, backgroundColor: highlight, borderRadius: 3, marginBottom: 24 }} />
        <div style={{ display: "flex", fontSize: headingSize, fontWeight: 750, letterSpacing: -2.2, lineHeight: 1.13, maxWidth: 1040 }}>
          {heading}
        </div>
        {detail ? <div style={{ display: "flex", fontSize: 24, lineHeight: 1.45, color: muted, maxWidth: 1010, marginTop: 20 }}>{detail}</div> : null}
      </div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: `1px solid ${border}`, paddingTop: 22,
        color: muted, fontSize: 17,
      }}>
        <span>NextGuide</span>
        <span style={{ color: highlight }}>MDX · Next.js · Documentation</span>
      </div>
    </div>,
    NEXTGUIDE_OG_SIZE,
  )
}
