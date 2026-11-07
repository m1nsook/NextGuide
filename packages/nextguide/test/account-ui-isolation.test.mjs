import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

const accountCSS = readFileSync(fileURLToPath(new URL("../src/account/account.css", import.meta.url)), "utf8")
const studio = readFileSync(fileURLToPath(new URL("../src/account/studio.tsx", import.meta.url)), "utf8")
const access = readFileSync(fileURLToPath(new URL("../src/account/client.tsx", import.meta.url)), "utf8")
const monaco = readFileSync(fileURLToPath(new URL("../src/account/mdx-editor.tsx", import.meta.url)), "utf8")

test("Account Mode always uses NextGuide design tokens, not bootstrapper theme", () => {
  assert.match(accountCSS, /@import "\.\.\/ui\/theme\.css"/)
  assert.doesNotMatch(accountCSS, /NEXTGUIDE_ACCOUNT_SHADCN_BOOTSTRAPPER|#ffc7d4|oklch\(0\.8228/)
  assert.doesNotMatch(accountCSS, /:root(?:\.dark)?:has\(\.ng-account-bootstrap\)/)
  assert.match(accountCSS, /max-width:1680px/)
})

test("Account studio does not turn every navigation control into a filled UI button", () => {
  assert.doesNotMatch(studio, /from "\.\/ui\/button\.js"/)
  assert.match(studio, /<button key=\{item\.id\} type="button" className=\{/)
  assert.doesNotMatch(studio, /ng-account-bootstrap/)
  assert.match(studio, /<StudioSelect label="Owner avatar"/)
  assert.match(studio, /<AccountMdxEditor/)
})

test("Account access retains setup flow and local Monaco assets", () => {
  assert.match(access, /phase === "token"/)
  assert.match(access, /phase === "recovery"/)
  assert.doesNotMatch(access, /ng-account-bootstrap/)
  assert.match(monaco, /@monaco-editor\/react/)
  assert.match(monaco, /\/_nextguide\/monaco\/vs/)
})
