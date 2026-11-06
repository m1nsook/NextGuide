import assert from "node:assert/strict"
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const output = join(root, "dist")

test("all-in-one exports are present", () => {
  for (const key of [".", "./core", "./mdx", "./mdx/server", "./mdx/client", "./openapi", "./components", "./ui", "./icons", "./blocks", "./ui/primitives", "./ui/interactive", "./fonts", "./fonts/catalog", "./styles.css"]) {
    assert.ok(manifest.exports[key], key)
  }
})
test("no published workspace packages are needed", () => {
  assert.ok(manifest.peerDependencies.next)
  assert.ok(manifest.peerDependencies.react)
  assert.equal(Object.keys(manifest.dependencies).some(dep => dep.startsWith("@ariadocs/")), false)
  assert.equal(JSON.stringify(manifest.dependencies).includes("workspace:"), false)
})
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => {
    const absolute = join(path, entry.name)
    return entry.isDirectory() ? walk(absolute) : [absolute]
  })
}
test("every published export resolves to a compiled file", () => {
  for (const [name, target] of Object.entries(manifest.exports)) {
    const filenames = typeof target === "string" ? [target] : [target.default, target.types]
    for (const filename of filenames) assert.ok(existsSync(join(root, filename)), name + ": " + filename)
  }
  for (const filename of Object.values(manifest.imports["#read-file"])) {
    assert.ok(existsSync(join(root, filename)), filename)
  }
})
test("compiled code contains no internal workspace imports", () => {
  for (const filename of walk(output).filter(x => /\.(?:js|d\.ts|css)$/.test(x))) {
    const source = readFileSync(filename, "utf8")
    assert.doesNotMatch(source, /@(?:ariadocs|nextguide-internal)\/(?:core|mdx|openapi|components)/, filename)
    assert.doesNotMatch(source, /@workspace\//, filename)
  }
})

test("public JS modules import from the self-contained package", async () => {
  const [core, mdx, api, components, ui, icons, fonts] = await Promise.all([
    import("nextguide/core"),
    import("nextguide/mdx"),
    import("nextguide/openapi"),
    import("nextguide/components"),
    import("nextguide/ui"),
    import("nextguide/icons"),
    import("nextguide/fonts"),
  ])
  assert.equal(typeof core.slugify, "function")
  assert.equal(typeof mdx.createDocs, "function")
  assert.equal(typeof api.parseOpenAPI, "function")
  assert.ok(components.Docs)
  assert.equal(typeof ui.Button, "function")
  assert.equal(typeof icons.BrandIcon, "function")
  assert.equal(typeof fonts.FontPicker, "function")
  assert.equal(typeof fonts.validateFontSelection, "function")
  const blocks = await import("nextguide/blocks")
  assert.equal(typeof blocks.CodeWindow, "function")
  assert.equal(typeof blocks.CodeTabs, "function")
  assert.equal(typeof blocks.FileTree, "function")
  assert.equal(typeof ui.DialogContent, "function")
  assert.equal(typeof ui.TabsTrigger, "function")
  assert.equal(typeof ui.Table, "function")
})

test("all engine modules live in the single NextGuide source package", () => {
  const projectRoot = dirname(dirname(root))
  for (const legacy of ["lib-core", "lib-mdx", "lib-openapi", "lib-components", "ui"]) {
    assert.equal(existsSync(join(projectRoot, "packages", legacy, "package.json")), false,
      "Unexpected extra workspace package: " + legacy)
  }
  for (const module of ["core", "mdx", "openapi", "components", "ui", "blocks", "fonts", "icons"]) {
    assert.ok(existsSync(join(root, "src", module)),
      "Missing NextGuide source module: " + module)
  }
})

test("Developer Mode page creation ships in the CLI package", () => {
  for (const filename of ["bin/nextguide.mjs", "lib/init.mjs", "lib/page.mjs", "lib/page-cli.mjs"]) {
    assert.ok(existsSync(join(root, filename)), filename + " is required in the npm package")
  }
})

test("documentation site does not depend on the removed UI workspace", () => {
  const website = join(dirname(dirname(root)), "apps", "web")
  for (const file of [
    "package.json",
    "next.config.mjs",
    "postcss.config.mjs",
    "app/layout.tsx",
    "components/docs-sidebar.tsx",
  ]) {
    const source = readFileSync(join(website, file), "utf8")
    assert.doesNotMatch(source, /@workspace\/ui|packages\/ui\//, file)
  }
  assert.equal(existsSync(join(website, "components.json")), false,
    "Removed shadcn workspace registry config should not be restored")
})

test("official site version selector cannot appear in generated docs projects", () => {
  const projectRoot = dirname(dirname(root))
  const siteLayout = readFileSync(join(projectRoot, "apps/web/app/(docs)/layout.tsx"), "utf8")
  const side = readFileSync(join(projectRoot, "apps/web/components/docs-sidebar.tsx"), "utf8")
  const selector = readFileSync(join(projectRoot, "apps/web/components/version-selector.tsx"), "utf8")
  const generated = readFileSync(join(root, "lib/init.mjs"), "utf8")
  assert.match(siteLayout, /nextguidePackage\.version/)
  assert.match(side, /DocsVersionSelector/)
  assert.match(selector, /Development/)
  assert.doesNotMatch(generated, /DocsVersionSelector|Documentation versions/)
})
test("official documentation keyboard shortcut uses Lucide Command, not literal glyph", () => {
  const projectRoot = dirname(dirname(root))
  const search = readFileSync(join(projectRoot, "apps/web/components/search.tsx"), "utf8")
  assert.match(search, /<Command/)
  assert.doesNotMatch(search, /⌘K/)
})
