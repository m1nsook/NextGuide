import assert from "node:assert/strict"
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const output = join(root, "dist")

test("all-in-one exports are present", () => {
  for (const key of [".", "./core", "./mdx", "./mdx/server", "./mdx/client", "./openapi", "./components", "./ui", "./icons", "./fonts", "./fonts/catalog", "./styles.css"]) {
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
