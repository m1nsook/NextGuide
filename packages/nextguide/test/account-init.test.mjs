import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtempSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { initAccount } from "../lib/account-starter.mjs"
import { accountFile } from "../lib/account-auth.mjs"
import ts from "typescript"

function fixture(router = "src/app", typed = true) {
  const project = mkdtempSync(join(tmpdir(), "nextguide-account-init-"))
  mkdirSync(join(project, router), { recursive: true })
  writeFileSync(join(project, "package.json"), JSON.stringify({ dependencies: { next: "16.4.5" } }))
  if (typed) writeFileSync(join(project, "tsconfig.json"), "{}")
  const inspection = { ok: true, issues: [], routers: [{ name: router.includes("pages") ? "Pages Router" : "App Router", folder: router }] }
  return { project, inspection }
}
function isolated(f) {
  const old = process.env.NEXTGUIDE_DATA_DIR
  const base = mkdtempSync(join(tmpdir(), "nextguide-private-"))
  process.env.NEXTGUIDE_DATA_DIR = join(base, "storage")
  try { f() }
  finally {
    if (old === undefined) delete process.env.NEXTGUIDE_DATA_DIR
    else process.env.NEXTGUIDE_DATA_DIR = old
    rmSync(base, { recursive: true, force: true })
  }
}

test("App Router Account Mode scaffolds protected routes and owner token without harming docs", () => isolated(() => {
  const { project, inspection } = fixture()
  try {
    const result = initAccount(project, inspection)
    assert.equal(result.mode, "account")
    assert.ok(result.bootstrapToken.length >= 30)
    assert.equal(result.created.length, 23)
    for (const name of result.created.filter(path => /\\.[jt]sx?$/.test(path))) {
      const content = readFileSync(join(project, name), "utf8")
      const parsed = ts.createSourceFile(name, content, ts.ScriptTarget.Latest, true)
      assert.equal(parsed.parseDiagnostics.length, 0, name + ": " +
        parsed.parseDiagnostics.map(item => ts.flattenDiagnosticMessageText(item.messageText, " ")).join("; "))
    }
    assert.ok(existsSync(join(project, "src/app/setup/page.tsx")))
    assert.ok(existsSync(join(project, "src/app/login/page.tsx")))
    for (const route of ["setup", "login"]) {
      const source = readFileSync(join(project, `src/app/${route}/page.tsx`), "utf8")
      assert.match(source, /next\/font\/google/, route + " should self-host Inter")
      assert.match(source, /--ng-preview-inter/, route + " should supply the Account Mode font variable")
    }
    assert.ok(existsSync(join(project, "src/app/admin/page.tsx")))
    assert.ok(existsSync(join(project, "public/_nextguide/monaco/vs/loader.js")), "local Monaco bundle missing")
    assert.ok(existsSync(join(project, "public/_nextguide/monaco/vs/LICENSE.txt")), "Microsoft MIT notice missing")
    assert.match(readFileSync(join(project, "src/app/admin/page.tsx"), "utf8"), /await connection\(\)/)
    assert.ok(existsSync(join(project, "src/app/api/nextguide/account/[action]/route.ts")))
    assert.ok(existsSync(join(project, "src/app/api/nextguide/studio/[action]/route.ts")))
    assert.ok(existsSync(join(project, "src/app/nextguide/media/[name]/route.ts")))
    assert.match(readFileSync(join(project, "src/app/nextguide/media/[name]/route.ts"), "utf8"), /readStudioMedia/)
    assert.match(readFileSync(join(project, "src/app/admin/page.tsx"), "utf8"), /AccountStudio/)
    assert.match(readFileSync(join(project, "src/app/docs/layout.tsx"), "utf8"), /getStudioSettings/)
    assert.match(readFileSync(join(project, "src/app/docs/layout.tsx"), "utf8"), /await connection/)
    assert.match(readFileSync(join(project, "src/app/docs/layout.tsx"), "utf8"), /settings.theme/)
    assert.ok(readFileSync(join(project, "src/app/docs/layout.tsx"), "utf8").includes("prewarm={false}"))
    assert.match(readFileSync(join(project, "src/app/docs/layout.tsx"), "utf8"), /siteLogo=\{settings.logo\}/)
    assert.match(readFileSync(join(project, "src/app/docs/layout.tsx"), "utf8"), /footerEnabled=\{settings.copyrightEnabled\}/)
    assert.match(readFileSync(join(project, "src/app/docs/[[...slug]]/page.tsx"), "utf8"), /runtimeSite.ogImage/)
    assert.ok(readFileSync(join(project, "src/app/docs/[[...slug]]/page.tsx"), "utf8").includes('slug.startsWith(".well-known/")'))
    assert.match(readFileSync(join(project, "src/app/og/[...slug]/route.ts"), "utf8"), /settings.name/)
    assert.match(readFileSync(join(project, "src/app/docs/[[...slug]]/page.tsx"), "utf8"), /runtimeSite.description/)
    assert.match(readFileSync(join(project, "src/app/api/nextguide/studio/[action]/route.ts"), "utf8"), /verifySession/)
    assert.match(readFileSync(join(project, "src/app/api/nextguide/studio/[action]/route.ts"), "utf8"), /sameOrigin/)
    assert.match(readFileSync(join(project, "src/app/admin/page.tsx"), "utf8"), /verifySession/)
    assert.match(readFileSync(join(project, "src/app/api/nextguide/account/[action]/route.ts"), "utf8"), /sameOrigin/)
    assert.equal(JSON.parse(readFileSync(join(project, "nextguide.config.json"), "utf8")).mode, "account")
    assert.ok(existsSync(join(project, "content/docs/index.mdx")))
    assert.doesNotMatch(readFileSync(result.privateDirectory, "utf8"), new RegExp(result.bootstrapToken))
    assert.throws(() => initAccount(project, inspection), /Refusing to overwrite/)
  } finally { rmSync(project, { recursive: true, force: true }) }
}))

test("dry-run never writes secrets, pages or configuration", () => isolated(() => {
  const { project, inspection } = fixture("app", false)
  try {
    const result = initAccount(project, inspection, { dryRun: true })
    assert.equal(result.bootstrapToken, null)
    assert.ok(result.created.includes("app/api/nextguide/account/[action]/route.js"))
    assert.equal(existsSync(result.privateDirectory), false)
    assert.equal(existsSync(join(project, "nextguide.config.json")), false)
  } finally { rmSync(project, { recursive: true, force: true }) }
}))

test("Pages Router and static export are explicitly refused", () => isolated(() => {
  const { project, inspection } = fixture("pages")
  try {
    assert.throws(() => initAccount(project, inspection), /App Router/)
    assert.equal(existsSync(join(project, "nextguide.config.json")), false)
  } finally { rmSync(project, { recursive: true, force: true }) }
  const other = fixture()
  try {
    writeFileSync(join(other.project, "next.config.mjs"), 'export default { output: "export" }')
    assert.throws(() => initAccount(other.project, other.inspection), /running Next.js server/)
    assert.equal(existsSync(join(other.project, "nextguide.config.json")), false)
  } finally { rmSync(other.project, { recursive: true, force: true }) }
}))

test("conflicting user project file rolls back bootstrap and preserves the file", () => isolated(() => {
  const { project, inspection } = fixture()
  try {
    const filename = join(project, "nextguide.config.json")
    writeFileSync(filename, '{"custom":true}')
    const privateFile = accountFile(project)
    assert.throws(() => initAccount(project, inspection, { dryRun: true }), /Refusing to overwrite/)
    assert.throws(() => initAccount(project, inspection), /Refusing to overwrite/)
    assert.equal(readFileSync(filename, "utf8"), '{"custom":true}')
    assert.equal(existsSync(privateFile), false)
  } finally { rmSync(project, { recursive: true, force: true }) }
}))

test("Account Mode API and admin routes work with Cache Components and load true font previews", () => isolated(() => {
  const { project, inspection } = fixture()
  try {
    initAccount(project, inspection)
    for (const filename of [
      "src/app/admin/page.tsx",
      "src/app/api/nextguide/account/[action]/route.ts",
      "src/app/api/nextguide/studio/[action]/route.ts",
      "src/app/nextguide/media/[name]/route.ts",
    ]) {
      assert.doesNotMatch(readFileSync(join(project, filename), "utf8"), /export const runtime\\s*=/, filename)
    }
    const admin = readFileSync(join(project, "src/app/admin/page.tsx"), "utf8")
    for (const key of ["--ng-preview-inter", "--ng-preview-geist", "--ng-preview-ibm-plex-sans",
      "--ng-preview-jetbrains-mono", "--ng-preview-geist-mono", "--ng-preview-ibm-plex-mono"]) {
      assert.ok(admin.includes(key), key + " must be loaded using next/font/google")
    }
    assert.match(admin, /ng-studio-font-assets/)
  } finally { rmSync(project, { recursive: true, force: true }) }
}))


test("Account Mode add-on lifecycle routes stay owner-authenticated and read-only on Developer Mode", () => isolated(() => {
  const { project, inspection } = fixture()
  try {
    initAccount(project, inspection)
    const route=readFileSync(join(project,"src/app/api/nextguide/studio/[action]/route.ts"),"utf8")
    const view=readFileSync(new URL("../src/account/studio.tsx",import.meta.url),"utf8")
    const market=readFileSync(new URL("../src/account/addon-marketplace.tsx",import.meta.url),"utf8")
    const manager=readFileSync(new URL("../lib/extension-site-manager.mjs",import.meta.url),"utf8")
    assert.match(route,/createAccountAddonManager/)
    assert.match(route,/addons\.install\(input\)/)
    assert.match(route,/addons\.toggle\(input\)/)
    assert.match(route,/addons\.rollback\(input\)/)
    assert.match(route,/addons\.uninstall\(input\)/)
    assert.ok(route.indexOf("if (!authorized(request))") < route.indexOf('if (action === "addons")'),
      "GET must authenticate before inspecting the registry")
    const post=route.slice(route.indexOf("export async function POST"))
    assert.ok(post.indexOf("if (!authorized(request))") < post.indexOf('action.startsWith("addon-")'),
      "POST must authenticate before mutating add-ons")
    assert.ok(post.indexOf("if (!sameOrigin(request))") < post.indexOf('action.startsWith("addon-")'),
      "POST must enforce same-origin before any add-on mutation")
    assert.match(view,/<AccountAddonMarketplace \/>/)
    assert.match(view,/id: "addons", label: "Add-ons"/)
    assert.match(market,/credentials:"same-origin"/)
    assert.match(market,/<AlertDialog /)
    assert.match(market,/expectedRevision:catalog\.installed\.revision/)
    assert.match(market,/consent:true/)
    assert.match(manager,/NEXTGUIDE_ADDON_REGISTRY_PUBLIC_KEY_B64/)
    assert.match(manager,/NEXTGUIDE_ADDON_REGISTRY_URL/)
    assert.match(manager,/downloadVerifiedContentRelease/)
    assert.match(manager,/compatibleAddonRange/)
    assert.doesNotMatch(market,/eval\(|import\([^)]*addon/)
  } finally {rmSync(project,{recursive:true,force:true})}
}))
