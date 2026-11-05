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
  for (const filename of walk(output).filter(x => /\.(?:js|d\.ts)$/.test(x))) {
    const source = readFileSync(filename, "utf8")
    assert.doesNotMatch(source, /@ariadocs\/(?:core|mdx|openapi|components)/, filename)
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
