import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createBootstrap, totp } from "../lib/account-auth.mjs"
import { listStudioPages, readStudioPage, saveStudioPage, deleteStudioPage, getStudioNavigation, setStudioNavigation, getStudioSettings, saveStudioSettings, listStudioMedia, uploadStudioMedia, readStudioMedia, deleteStudioMedia } from "../lib/account-cms.mjs"

function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), "nextguide-studio-"))
  const previous = process.env.NEXTGUIDE_DATA_DIR
  const privateRoot = mkdtempSync(join(tmpdir(), "nextguide-studio-private-"))
  process.env.NEXTGUIDE_DATA_DIR = privateRoot
  mkdirSync(join(root, "content/docs/guides"), { recursive: true })
  mkdirSync(join(root, "public"), { recursive: true })
  writeFileSync(join(root, "nextguide.config.json"), JSON.stringify({
    schemaVersion: 1, mode: "account", basePath: "/docs",
    contentDir: "content/docs", appearance: { mode: "light", accent: "blue" },
    site: { name: "Test Docs", description: "Before" }
  }))
  writeFileSync(join(root, "content/docs/_meta.json"), JSON.stringify([{ slug: "index", title: "Home" }, { slug: "guides", title: "Guides" }]))
  writeFileSync(join(root, "content/docs/index.mdx"), '---\ntitle: Home\ndescription: Test page\n---\n\n# Welcome\n')
  writeFileSync(join(root, "content/docs/guides/_meta.json"), JSON.stringify([{ slug: "install", title: "Install" }]))
  writeFileSync(join(root, "content/docs/guides/install.mdx"), '---\ntitle: Installation\ndescription: Start here\n---\n\nOld content\n')
  createBootstrap(root)
  try { return fn(root) }
  finally {
    if (previous === undefined) delete process.env.NEXTGUIDE_DATA_DIR
    else process.env.NEXTGUIDE_DATA_DIR = previous
    rmSync(root, { recursive: true, force: true })
    rmSync(privateRoot, { recursive: true, force: true })
  }
}

test("studio can list, edit and create MDX pages without discarding sidebar order", () => fixture(root => {
  assert.deepEqual(listStudioPages(root).map(page => page.slug), ["", "guides/install"])
  const page = readStudioPage(root, "guides/install")
  assert.equal(page.title, "Installation")
  const saved = saveStudioPage(root, { ...page, title: "Install NextGuide", body: "# Updated" })
  assert.equal(saved.created, false)
  assert.equal(readStudioPage(root, "guides/install").body.trim(), "# Updated")
  assert.throws(() => saveStudioPage(root, page), /changed elsewhere/)
  const created = saveStudioPage(root, { slug: "guides/new-article", title: "New article", description: "", body: "Hello", version: null })
  assert.equal(created.created, true)
  const meta = JSON.parse(readFileSync(join(root, "content/docs/guides/_meta.json"), "utf8"))
  assert.deepEqual(meta.map(item => item.slug), ["install", "new-article"])
  assert.equal(meta[1].title, "New article")
  assert.throws(() => saveStudioPage(root, { slug: "../private", title: "Bad", body: "", version: null }), /Invalid page slug/)
  assert.throws(() => saveStudioPage(root, { slug: "guides/new-article", title: "Overwrite", body: "", version: null }), /changed elsewhere/)
  assert.deepEqual(deleteStudioPage(root, "guides/new-article", created.version), { deleted: "guides/new-article" })
  assert.equal(existsSync(join(root, "content/docs/guides/new-article.mdx")), false)
  assert.throws(() => deleteStudioPage(root, "", readStudioPage(root, "").version), /cannot be deleted/)
}))

test("navigation uses NextGuide's array schema and supports ordering and hidden items", () => fixture(root => {
  const nav = getStudioNavigation(root)
  assert.deepEqual(nav.items.map(item => item.slug), ["index", "guides"])
  const modified = setStudioNavigation(root, { folder: "", items: [
    { slug: "guides", title: "Guides", hidden: true },
    { slug: "index", title: "Home", hidden: false }
  ] })
  assert.deepEqual(modified.items.map(item => item.slug), ["guides", "index"])
  assert.equal(modified.items[0].hidden, true)
  const raw = JSON.parse(readFileSync(join(root, "content/docs/_meta.json"), "utf8"))
  assert.deepEqual(raw, [{ slug: "guides", title: "Guides", nav: false }, { slug: "index", title: "Home", nav: true }])
  assert.throws(() => setStudioNavigation(root, { folder:"", items:[{slug:"does-not-exist",title:"oops",hidden:false}] }), /no matching page/)
}))

test("settings accept supported themes and fonts and persist outside public web files", () => fixture(root => {
  const original = getStudioSettings(root)
  assert.equal(original.name, "Test Docs")
  const newSite = { ...original, name:"Hello & goodbye", url:"https://docs.example.com", logo:"/my-logo.svg", ogImage:"/social.png", copyrightEnabled:false, copyrightText:"Custom credit", copyrightHref:"https://example.org", accent:"purple", theme:"system", bodyFont:"ibm-plex-sans", headingFont:"geist", codeFont:"geist-mono", setupComplete:true }
  assert.deepEqual(saveStudioSettings(root, newSite), newSite)
  assert.deepEqual(getStudioSettings(root), newSite)
  assert.equal(existsSync(join(process.env.NEXTGUIDE_DATA_DIR, "site.json")), true)
  assert.equal(JSON.parse(readFileSync(join(root, "nextguide.config.json"), "utf8")).site.name, "Test Docs")
  assert.throws(() => saveStudioSettings(root, { ...newSite, accent: "unknown" }), /Unsupported accent/)
  assert.throws(() => saveStudioSettings(root, { ...newSite, url: "https://docs.example.com/secret" }), /should not include a path/)
  assert.throws(() => saveStudioSettings(root, { ...newSite, name: "" }), /Invalid site name/)
  assert.throws(() => saveStudioSettings(root, { ...newSite, logo: "javascript:alert(1)" }), /Invalid logo path/)
  assert.throws(() => saveStudioSettings(root, { ...newSite, ogImage: "//other-site.example/photo.png" }), /Invalid ogImage path/)
  assert.throws(() => saveStudioSettings(root, { ...newSite, copyrightHref: "javascript:alert(1)" }), /Invalid footer URL/)
}))

test("media accepts only verified raster signatures and randomized names", () => fixture(root => {
  // Valid signature check, without taking a dependency on an image decoder.
  const data = Buffer.from("89504e470d0a1a0a", "hex").toString("base64")
  const result = uploadStudioMedia(root, "image/png", data)
  assert.match(result.url, /^\/nextguide\/media\/[a-f0-9]{24}\.png$/)
  assert.deepEqual(listStudioMedia(root), [result])
  assert.equal(readStudioMedia(root, result.name).mime, "image/png")
  assert.ok(existsSync(join(process.env.NEXTGUIDE_DATA_DIR, "media", result.name)))
  assert.equal(existsSync(join(root, "public/nextguide/media", result.name)), false)
  assert.throws(() => uploadStudioMedia(root, "image/svg+xml", data), /Only PNG/)
  assert.throws(() => uploadStudioMedia(root, "image/png", Buffer.from("javascript").toString("base64")), /Invalid image file/)
  assert.deepEqual(deleteStudioMedia(root, result.name), { deleted: result.name })
  assert.equal(listStudioMedia(root).length, 0)
}))

test("schema refuses Developer Mode and output paths cannot escape project root", () => fixture(root => {
  const config = join(root, "nextguide.config.json")
  const before = JSON.parse(readFileSync(config, "utf8"))
  writeFileSync(config, JSON.stringify({ ...before, mode: "developer" }))
  assert.throws(() => listStudioPages(root), /isn't an Account Mode installation/)
}))
