import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Providers } from "@/components/providers"
import { SearchProvider } from "@/components/search"
import { getSearchIndex } from "@/lib/search-index"
import { site } from "@/lib/site"
import "@workspace/ui/globals.css"
import "@ariadocs/components/styles.css"
import "./site.css"

// Fonts live in the app. @ariadocs/components only uses `font-sans` and `font-mono`.
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" })
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
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
