import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { addPage, planPage } from "../lib/page.mjs"

function fixture(contentDir = "content/docs") {
  const root = mkdtempSync(join(tmpdir(), "nextguide-page-"))
  mkdirSync(join(root, "content", "docs"), { recursive: true })
  writeFileSync(join(root, "nextguide.config.json"), JSON.stringify({ schemaVersion: 1, mode: "developer", contentDir }))
  writeFileSync(join(root, "content/docs/_meta.json"), JSON.stringify([{ slug: "index", title: "Introduction", nav: false }], null, 2) + "\n")
  return root
}
const cleanup = root => rmSync(root, { recursive: true, force: true })
const read = (root, p) => readFileSync(join(root, p), "utf8")

test("creates root page and appends sidebar entry without changing existing entries", () => {
  const root = fixture()
  try {
    const result = addPage(root, "release-notes", { title: "Release Notes", description: "Changes" })
    assert.equal(result.href, "/docs/release-notes")
    assert.match(read(root, "content/docs/release-notes.mdx"), /title: "Release Notes"/)
    assert.match(read(root, "content/docs/release-notes.mdx"), /description: "Changes"/)
    assert.deepEqual(JSON.parse(read(root, "content/docs/_meta.json")), [
      { slug: "index", title: "Introduction", nav: false },
      { slug: "release-notes", title: "Release Notes" },
    ])
    assert.deepEqual(result.modified.map(file => file.path), ["content/docs/_meta.json"])
  } finally { cleanup(root) }
})

test("creates nested pages and parent navigation files in the correct paths", () => {
  const root = fixture()
  try {
    const result = addPage(root, "guides/windows/install")
    assert.equal(result.href, "/docs/guides/windows/install")
    assert.match(read(root, "content/docs/guides/windows/install.mdx"), /title: "Install"/)
    assert.ok(JSON.parse(read(root, "content/docs/_meta.json")).some(item => item.slug === "guides"))
    assert.deepEqual(JSON.parse(read(root, "content/docs/guides/_meta.json")), [{ slug: "windows", title: "Windows" }])
    assert.deepEqual(JSON.parse(read(root, "content/docs/guides/windows/_meta.json")), [{ slug: "install", title: "Install" }])
  } finally { cleanup(root) }
})

test("preserves custom folder metadata and avoids duplicate section entries", () => {
  const root = fixture()
  try {
    const original = [{ slug: "guides", title: "My tutorials", nav: false, props: { label: "Docs" } }]
    writeFileSync(join(root, "content/docs/_meta.json"), JSON.stringify(original, null, 2))
    mkdirSync(join(root, "content/docs/guides"))
    const result = addPage(root, "guides/setup")
    assert.deepEqual(result.modified, [])
    assert.deepEqual(JSON.parse(read(root, "content/docs/_meta.json")), original)
    assert.deepEqual(JSON.parse(read(root, "content/docs/guides/_meta.json")), [{ slug: "setup", title: "Setup" }])
  } finally { cleanup(root) }
})

test("dry-run reports all changes but writes nothing", () => {
  const root = fixture()
  try {
    const before = read(root, "content/docs/_meta.json")
    const result = addPage(root, "guides/api", { dryRun: true })
    assert.equal(result.dryRun, true)
    assert.deepEqual(result.created.map(x => x.path), ["content/docs/guides/_meta.json", "content/docs/guides/api.mdx"])
    assert.deepEqual(planPage(root, "guides/api").created, result.created)
    assert.equal(existsSync(join(root, "content/docs/guides")), false)
    assert.equal(read(root, "content/docs/_meta.json"), before)
  } finally { cleanup(root) }
})

test("refuses to overwrite files or conflict with section directories", () => {
  const root = fixture()
  try {
    writeFileSync(join(root, "content/docs/existing.mdx"), "personal")
    assert.throws(() => addPage(root, "existing"), /Refusing to overwrite/)
    assert.equal(read(root, "content/docs/existing.mdx"), "personal")
    mkdirSync(join(root, "content/docs/reference"))
    assert.throws(() => addPage(root, "reference"), /conflicts with an existing section/)
  } finally { cleanup(root) }
})

test("rejects traversal, invalid segments, reserved Windows devices and overlong slugs", () => {
  const root = fixture()
  try {
    const before = read(root, "content/docs/_meta.json")
    for (const slug of ["../escape", "/root", "foo//bar", "foo/../bar", "foo\\bar", "Bad_Case", "trailing/", "con", "com1", "guides/aux", "index/intro", "a".repeat(65)]) {
      assert.throws(() => addPage(root, slug), /Page slug|intermediate folder/, slug)
    }
    assert.equal(read(root, "content/docs/_meta.json"), before)
    writeFileSync(join(root, "nextguide.config.json"), JSON.stringify({ mode: "developer", contentDir: "../escape" }))
    assert.throws(() => addPage(root, "safe"), /inside the Next.js project/)
  } finally { cleanup(root) }
})

test("invalid metadata aborts before creating files", () => {
  const root = fixture()
  try {
    writeFileSync(join(root, "content/docs/_meta.json"), "{invalid")
    assert.throws(() => addPage(root, "new-page"), /Invalid JSON/)
    assert.equal(read(root, "content/docs/_meta.json"), "{invalid")
    assert.equal(existsSync(join(root, "content/docs/new-page.mdx")), false)
  } finally { cleanup(root) }
})

test("rejects symlinked content directories and navigation metadata", { skip: process.platform === "win32" }, () => {
  const root = fixture()
  const outside = mkdtempSync(join(tmpdir(), "nextguide-page-outside-"))
  try {
    symlinkSync(outside, join(root, "content/docs/linked"), "dir")
    assert.throws(() => addPage(root, "linked/readme"), /symbolic link/)
    assert.equal(existsSync(join(outside, "readme.mdx")), false)
    const outerMeta = join(outside, "private.json")
    writeFileSync(outerMeta, "[]\n")
    rmSync(join(root, "content/docs/_meta.json"))
    symlinkSync(outerMeta, join(root, "content/docs/_meta.json"), "file")
    assert.throws(() => addPage(root, "safe"), /unsafe navigation metadata/)
    assert.equal(readFileSync(outerMeta, "utf8"), "[]\n")
  } finally { cleanup(root); cleanup(outside) }
})

test("nested and root index pages resolve to folder URLs", () => {
  const root = fixture()
  try {
    assert.equal(addPage(root, "guides/index", { title: "Guides" }).href, "/docs/guides")
    assert.ok(existsSync(join(root, "content/docs/guides/index.mdx")))
    assert.equal(addPage(root, "index", { title: "Welcome" }).href, "/docs")
  } finally { cleanup(root) }
})

test("blocks Account Mode and escapes untrusted title/description as YAML strings", () => {
  const root = fixture()
  try {
    addPage(root, "safe", { title: 'Title: "hello"\nprivate: true', description: 'text"\nfoo: bar' })
    const mdx = read(root, "content/docs/safe.mdx")
    assert.equal(mdx.split("\n").filter(line => line.startsWith("title:")).length, 1)
    assert.equal(mdx.split("\n").filter(line => line.startsWith("description:")).length, 1)
    assert.doesNotMatch(mdx, /\nprivate: true|\nfoo: bar/)
    writeFileSync(join(root, "nextguide.config.json"), JSON.stringify({ mode: "account", contentDir: "content/docs" }))
    assert.throws(() => addPage(root, "another"), /Developer Mode/)
  } finally { cleanup(root) }
})


test("page creation follows root-mounted site URLs", () => {
  const root = fixture()
  try {
    writeFileSync(join(root, "nextguide.config.json"), JSON.stringify({
      schemaVersion: 1, mode: "developer", contentDir: "content/docs", basePath: "/",
    }))
    const result = addPage(root, "guides/windows")
    assert.equal(result.href, "/guides/windows")
    assert.equal(addPage(root, "index").href, "/")
  } finally { cleanup(root) }
})
