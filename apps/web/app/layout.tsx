import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Providers } from "@/components/providers"
import { SearchProvider } from "@/components/search"
import { getSearchIndex } from "@/lib/search-index"
import { site } from "@/lib/site"
import "./globals.css"
import "nextguide/styles.css"
import "./site.css"

// Fonts are owned by the site. NextGuide components inherit these variables.
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" })
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.name}: Next.js documentation`,
    description: site.description,
  },
  twitter: { card: "summary_large_image" },
  title: { default: `${site.name}: Next.js documentation`, template: `%s · ${site.name}` },
  description: site.description,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const searchIndex = await getSearchIndex()

  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <body className="bg-background text-foreground min-h-dvh font-sans antialiased">
        <Providers>
          <SearchProvider entries={searchIndex}>{children}</SearchProvider>
        </Providers>
      </body>
    </html>
  )
}
