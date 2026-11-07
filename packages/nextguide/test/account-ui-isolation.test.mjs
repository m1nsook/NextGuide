import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

function file(path) { return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8") }
const css = file("../src/account/account.css")
const studio = file("../src/account/studio.tsx")
const login = file("../src/account/client.tsx")
const theme = file("../src/account/theme-menu.tsx")
const button = file("../src/account/ui/button.tsx")

// The ZIP is `shadcn init` Base UI + Vega. Do not transplant old Neko/Radix styling.
test("Account Mode uses the fresh Vega/neutral preset, scoped to account routes", () => {
  assert.match(css, /@import "shadcn\/tailwind\.css"/)
  assert.match(css, /:root:has\(\.ng-account-root\)/)
  assert.match(css, /:root\.dark:has\(\.ng-account-root\)/)
  assert.doesNotMatch(css, /#ffc7d4|NEXTGUIDE_ACCOUNT_SHADCN_BOOTSTRAPPER|ng-studio-shell/)
})
test("Account Mode uses shadcn Base UI controls, not the old dashboard primitives", () => {
  assert.match(button, /@base-ui\/react\/button/)
  assert.match(studio, /from "\.\/ui\/sidebar\.js"/)
  assert.match(studio, /<SidebarProvider/)
  assert.match(studio, /<AccountMdxEditor/)
  assert.doesNotMatch(studio, /DocsSiteProviders|ng-studio-shell|from "\.\.\/ui\/index\.js"/)
  assert.match(login, /from "\.\/ui\/card\.js"/)
  assert.match(login, /phase === "recovery"/)
  assert.doesNotMatch(login, /DocsSiteProviders|ng-account-card/)
  assert.match(theme, /from "\.\/ui\/dropdown-menu\.js"/)
})
test("UI and API remain separate and recoverable", () => {
  const api = file("../lib/account-starter.mjs")
  const mdx = file("../src/account/mdx-editor.tsx")
  assert.match(api, /verifySession/)
  assert.match(api, /sameOrigin/)
  assert.match(api, /AccountStudio/)
  assert.match(mdx, /@monaco-editor\/react/)
  assert.match(mdx, /\/_nextguide\/monaco\/vs/)
})
