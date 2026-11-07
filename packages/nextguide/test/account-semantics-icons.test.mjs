import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

const source = relative => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8")

test("Account Mode preserves native link semantics rather than rendering anchors as buttons", () => {
  const studio = source("../src/account/studio.tsx")
  assert.doesNotMatch(studio, /<Button[^>]*render=\{<a\b/)
  assert.match(studio, /className=\{buttonVariants\(\{ variant: "outline", size: "sm" \}\)\}/)
  assert.match(studio, /<a href=\{publicHref\(page\.slug\)\}/)
  assert.match(studio, /<form method="post" action="\/api\/nextguide\/account\/logout">/)
  assert.doesNotMatch(studio, /tooltip="View documentation"/)
})

test("Vega Account Mode uses scoped border tokens in light and dark themes", () => {
  const css = source("../src/account/account.css")
  assert.match(css, /@layer base \{/)
  assert.match(css, /\.ng-account-root \*::before/)
  assert.match(css, /border-color: var\(--border\)/)
  assert.match(css, /:root\.dark:has\(\.ng-account-root\)/)
})

test("Docs page navigation and starter search use Lucide directional icons", () => {
  const footer = source("../src/components/site/page-footer.tsx")
  assert.match(footer, /import \{ ArrowLeft, ArrowRight \} from "lucide-react"/)
  assert.doesNotMatch(footer, /←|→/)
  const shell = source("../src/components/docs/starter-shell.tsx")
  assert.match(shell, /<ArrowUp/)
  assert.match(shell, /<ArrowDown/)
  assert.doesNotMatch(shell, /↑ ↓ Navigate/)
})
