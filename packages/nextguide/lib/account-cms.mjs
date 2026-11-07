// NextGuide Account Mode studio: filesystem-backed documentation content and private site settings.
// This module is Node-only. Every caller MUST verify the session before invoking editor mutations.
import { createHash, randomBytes } from "node:crypto"
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { accountFile, AccountError } from "./account-auth.mjs"

export const ACCOUNT_ACCENTS = Object.freeze(["blue", "red", "green", "purple", "yellow", "orange", "teal", "pink"])
export const ACCOUNT_MODES = Object.freeze(["light", "dark", "system"])
export const ACCOUNT_BODY_FONTS = Object.freeze(["inter", "geist", "ibm-plex-sans", "segoe-ui", "system"])
export const ACCOUNT_CODE_FONTS = Object.freeze(["jetbrains-mono", "geist-mono", "ibm-plex-mono", "system-mono"])
const MAX_DOCS = 750
const MAX_PAGE_BYTES = 384 * 1024
const MAX_MEDIA_BYTES = 2 * 1024 * 1024
const MEDIA = Object.freeze({ "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif", "image/svg+xml": null })
export const DEFAULT_SITE = Object.freeze({
  name: "My Documentation",
  description: "Documentation built with NextGuide",
  url: "",
  ownerName: "",
  ownerEmail: "",
  ownerAvatar: "",
  accent: "blue",
  theme: "light",
  bodyFont: "inter",
  headingFont: "inter",
  codeFont: "jetbrains-mono",
  setupComplete: false,
})

function hash(input) { return createHash("sha256").update(input).digest("hex") }
function assertText(input, label, limit, required = false) {
  if (typeof input !== "string" || input.length > limit || (required && !input.trim()) || /[\0\u0001-\u0008\u000b\u000c\u000e-\u001f]/.test(input)) {
    throw new AccountError("Invalid " + label + ".", 400)
  }
  return input.trim()
}
function assertObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AccountError("Invalid request.", 400)
}
function safeDirectory(path) {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new AccountError("Refusing symbolic-link directory.", 400)
}
function filePath(project, subpath) {
  const root = resolve(project)
  const file = resolve(root, subpath)
  if (file !== root && !file.startsWith(root + sep)) throw new AccountError("Path outside project.", 400)
  let ancestor = dirname(file)
  while (ancestor !== root && ancestor.startsWith(root + sep)) {
    if (existsSync(ancestor)) safeDirectory(ancestor)
    ancestor = dirname(ancestor)
  }
  if (existsSync(file) && lstatSync(file).isSymbolicLink()) throw new AccountError("Refusing symbolic-link file.", 400)
  return file
}
function ensureFolder(path) {
  const stack = []
  let current = path
  while (!existsSync(current)) { stack.push(current); current = dirname(current) }
  safeDirectory(current)
  while (stack.length) { const next = stack.pop(); mkdirSync(next, { mode: 0o755 }); safeDirectory(next) }
}
function atomicWrite(path, content) {
  ensureFolder(dirname(path))
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new AccountError("Refusing symbolic-link write.", 400)
  const temp = path + "." + randomBytes(8).toString("hex") + ".tmp"
  try {
    writeFileSync(temp, content, { encoding: "utf8", flag: "wx" })
    renameSync(temp, path)
  } finally { if (existsSync(temp)) unlinkSync(temp) }
}
function projectConfig(project) {
  const path = filePath(project, "nextguide.config.json")
  try {
    const value = JSON.parse(readFileSync(path, "utf8"))
    if (value.mode !== "account") throw new AccountError("This project isn't an Account Mode installation.", 409)
    const root = String(value.contentDir ?? "")
    if (root !== "content/docs") throw new AccountError("Account Mode supports its generated content/docs folder only.", 409)
    return value
  } catch (error) {
    if (error instanceof AccountError) throw error
    throw new AccountError("NextGuide account project configuration is missing.", 503)
  }
}
function docsDir(project) { projectConfig(project); return filePath(project, "content/docs") }
function mediaDir(project) { projectConfig(project); return join(dirname(accountFile(project)), "media") }
function settingsFile(project) {
  projectConfig(project)
  return join(dirname(accountFile(project)), "site.json")
}
function guardedSlug(input, allowHome = true) {
  if (input === "" && allowHome) return "index"
  if (typeof input !== "string" || input.length > 150 || !/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(input) ||
      input.split("/").some(segment => segment.startsWith("-") || segment.endsWith("-") || segment === "index")) {
    // Only the actual homepage can use the reserved index slug.
    throw new AccountError("Invalid page slug: use lowercase letters, numbers, and hyphens.", 400)
  }
  return input
}
function documentPath(project, slug) {
  const root = docsDir(project)
  const logical = guardedSlug(slug)
  let target = filePath(project, "content/docs/" + logical + ".mdx")
  if (slug && !existsSync(target)) {
    const folderIndex = filePath(project, "content/docs/" + logical + "/index.mdx")
    const folder = filePath(project, "content/docs/" + logical)
    if (existsSync(folder) && lstatSync(folder).isDirectory()) target = folderIndex
  }
  if (!target.startsWith(root + sep)) throw new AccountError("Page outside docs directory.", 400)
  return target
}
function readMeta(project, folder = "") {
  const relativePath = folder ? "content/docs/" + folder + "/_meta.json" : "content/docs/_meta.json"
  const file = filePath(project, relativePath)
  if (!existsSync(file)) return []
  try {
    const value = JSON.parse(readFileSync(file, "utf8"))
    if (!Array.isArray(value) || value.some(entry => !entry || typeof entry !== "object" ||
      typeof entry.slug !== "string" || !/^[a-z0-9-]+$/.test(entry.slug))) {
      throw Error("Invalid NextGuide metadata format")
    }
    return value
  } catch { throw new AccountError("Invalid navigation metadata. Fix _meta.json first.", 409) }
}
function writeMeta(project, folder, value) {
  const relativePath = folder ? "content/docs/" + folder + "/_meta.json" : "content/docs/_meta.json"
  atomicWrite(filePath(project, relativePath), JSON.stringify(value, null, 2) + "\n")
}
function yaml(text) { return JSON.stringify(text) }
function formatPage(title, description, body, original = null) {
  const existing = original?.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/)
  if (!existing) return "---\ntitle: " + yaml(title) + "\ndescription: " + yaml(description) + "\n---\n\n" + body.trim() + "\n"
  // Keep every unknown MDX frontmatter field. The editor only owns title
  // and description, not arbitrary author-defined metadata.
  let titleSeen = false, descriptionSeen = false
  const lines = existing[1].split(/\r?\n/).map(line => {
    if (/^title\s*:/.test(line)) { titleSeen = true; return "title: " + yaml(title) }
    if (/^description\s*:/.test(line)) { descriptionSeen = true; return "description: " + yaml(description) }
    return line
  })
  if (!titleSeen) lines.unshift("title: " + yaml(title))
  if (!descriptionSeen) lines.push("description: " + yaml(description))
  return "---\n" + lines.join("\n") + "\n---\n\n" + body.trim() + "\n"
}
function frontmatter(source) {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/)
  if (!match) return { title: "", description: "", body: source }
  const part = match[1]
  function field(key) {
    const row = part.match(new RegExp("^" + key + ":\\s*(.*)$", "m"))
    if (!row) return ""
    try { return JSON.parse(row[1]) } catch { return row[1].replace(/^['"]|['"]$/g, "") }
  }
  return { title: String(field("title")), description: String(field("description")), body: source.slice(match[0].length) }
}
function navigateTree(root, folder = "", pages = []) {
  if (!existsSync(root)) return pages
  safeDirectory(root)
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (pages.length >= MAX_DOCS) throw new AccountError("Too many documentation pages.", 413)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory() && /^[a-z0-9-]+$/.test(entry.name)) {
      navigateTree(join(root, entry.name), folder ? folder + "/" + entry.name : entry.name, pages)
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      const name = entry.name.slice(0, -4)
      const slug = [folder, name === "index" ? "" : name].filter(Boolean).join("/")
      if (slug && !/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(slug)) continue
      const absolute = join(root, entry.name)
      const raw = readFileSync(absolute, "utf8")
      const data = frontmatter(raw)
      pages.push({ slug, title: data.title || (slug.split("/").pop() || "Home"), description: data.description,
        version: hash(raw), bytes: Buffer.byteLength(raw) })
    }
  }
  return pages
}

export function listStudioPages(project = process.cwd()) {
  return navigateTree(docsDir(project)).sort((a, b) => a.slug.localeCompare(b.slug))
}
export function readStudioPage(project, slug) {
  const file = documentPath(project, slug)
  if (!existsSync(file)) throw new AccountError("Page not found.", 404)
  const raw = readFileSync(file, "utf8")
  if (Buffer.byteLength(raw) > MAX_PAGE_BYTES) throw new AccountError("Page exceeds editor size limit.", 413)
  return { slug, ...frontmatter(raw), version: hash(raw) }
}
export function saveStudioPage(project, input) {
  assertObject(input)
  const slug = input.slug
  const title = assertText(input.title, "page title", 160, true)
  const description = assertText(input.description ?? "", "page description", 500)
  const body = assertText(input.body, "page content", MAX_PAGE_BYTES)
  const file = documentPath(project, slug)
  const exists = existsSync(file)
  if (exists && lstatSync(file).isSymbolicLink()) throw new AccountError("Refusing symbolic-link document.", 400)
  const before = exists ? readFileSync(file, "utf8") : null
  if (exists && hash(before) !== input.version) throw new AccountError("This page was changed elsewhere. Reload before saving.", 409)
  if (!exists && input.version !== null) throw new AccountError("Page already exists or was removed. Reload before saving.", 409)
  if (!exists && listStudioPages(project).length >= MAX_DOCS) throw new AccountError("Page limit reached.", 413)
  const content = formatPage(title, description, body, before)
  if (Buffer.byteLength(content) > MAX_PAGE_BYTES) throw new AccountError("Page exceeds editor size limit.", 413)
  atomicWrite(file, content)
  const parts = slug ? slug.split("/") : []
  const name = parts.pop() || "index"
  const folder = parts.join("/")
  const nav = readMeta(project, folder)
  const existingEntry = nav.find(entry => entry.slug === name)
  if (!existingEntry) {
    nav.push({ slug: name, title })
    writeMeta(project, folder, nav)
  } else if (before && existingEntry.title === frontmatter(before).title && existingEntry.title !== title) {
    // Keep navigation labels in sync with titles unless the owner supplied a
    // deliberate custom label in the navigation editor.
    existingEntry.title = title
    writeMeta(project, folder, nav)
  }
  return { slug, title, description, body, version: hash(content), created: !exists }
}
export function deleteStudioPage(project, slug, version) {
  if (!slug) throw new AccountError("Homepage cannot be deleted.", 400)
  const file = documentPath(project, slug)
  if (!existsSync(file)) throw new AccountError("Page not found.", 404)
  const content = readFileSync(file, "utf8")
  if (hash(content) !== version) throw new AccountError("This page has changed. Reload before deleting.", 409)
  unlinkSync(file)
  const parts = slug.split("/")
  const name = parts.pop()
  const folder = parts.join("/")
  const nav = readMeta(project, folder)
  const folderStillExists = existsSync(filePath(project, "content/docs/" + slug)) && lstatSync(filePath(project, "content/docs/" + slug)).isDirectory()
  if (!folderStillExists) writeMeta(project, folder, nav.filter(entry => entry.slug !== name))
  return { deleted: slug }
}
export function getStudioNavigation(project, folder = "") {
  if (folder) guardedSlug(folder, false)
  const meta = readMeta(project, folder)
  const location = folder ? filePath(project, "content/docs/" + folder) : docsDir(project)
  if (!existsSync(location)) throw new AccountError("Navigation folder not found.", 404)
  const present = readdirSync(location, { withFileTypes: true })
    .filter(entry => !entry.isSymbolicLink() && (entry.isDirectory() || entry.isFile() && entry.name.endsWith(".mdx")))
    .map(entry => entry.isDirectory() ? entry.name : entry.name.slice(0, -4))
    .filter(name => /^[a-z0-9-]+$/.test(name))
  const recognized = new Set(present)
  const explicitlyOrdered = meta.filter(entry => recognized.has(entry.slug))
  const seen = new Set(explicitlyOrdered.map(entry => entry.slug))
  const remainder = present.filter(slug => !seen.has(slug)).sort().map(slug => ({ slug, title: slug }))
  return { folder, items: [...explicitlyOrdered, ...remainder].map(entry => ({
    slug: entry.slug, title: entry.title ?? entry.slug, hidden: entry.nav === false,
  })) }
}
export function setStudioNavigation(project, input) {
  assertObject(input)
  const folder = input.folder ?? ""
  if (folder) guardedSlug(folder, false)
  const location = folder ? filePath(project, "content/docs/" + folder) : docsDir(project)
  if (!existsSync(location)) throw new AccountError("Navigation folder not found.", 404)
  if (!Array.isArray(input.items) || input.items.length > 200) throw new AccountError("Invalid navigation items.", 400)
  const seen = new Set()
  // Sidebar metadata can contain custom props (icons, grouping flags, etc).
  // Rearranging entries must not silently erase these author-owned fields.
  const existing = new Map(readMeta(project, folder).map(entry => [entry.slug, entry]))
  const nav = []
  for (const item of input.items) {
    assertObject(item)
    const slug = assertText(item.slug, "navigation slug", 80, true)
    if (!/^[a-z0-9-]+$/.test(slug) || seen.has(slug) || slug.startsWith("-")) throw new AccountError("Invalid or duplicate navigation slug.", 400)
    seen.add(slug)
    if (!existsSync(join(location, slug + ".mdx")) && !existsSync(join(location, slug))) throw new AccountError("Navigation entry has no matching page or folder.", 409)
    nav.push({ ...(existing.get(slug) ?? {}), slug, title: assertText(item.title, "navigation label", 120, true), nav: !item.hidden })
  }
  writeMeta(project, folder, nav)
  return getStudioNavigation(project, folder)
}
export function getStudioSettings(project = process.cwd()) {
  const config = projectConfig(project)
  const path = settingsFile(project)
  const defaults = { ...DEFAULT_SITE, name: config.site?.name ?? DEFAULT_SITE.name,
    description: config.site?.description ?? DEFAULT_SITE.description,
    accent: config.appearance?.accent ?? "blue", theme: config.appearance?.mode ?? "light" }
  if (!existsSync(path)) return defaults
  if (lstatSync(path).isSymbolicLink()) throw new AccountError("Refusing symbolic-link settings.", 503)
  try {
    const stored = JSON.parse(readFileSync(path, "utf8"))
    return { ...defaults, ...stored }
  } catch { throw new AccountError("Site settings are corrupt.", 503) }
}
export function saveStudioSettings(project, input) {
  assertObject(input)
  const site = {
    name: assertText(input.name, "site name", 100, true),
    description: assertText(input.description, "site description", 400),
    url: assertText(input.url ?? "", "site URL", 200),
    ownerName: assertText(input.ownerName ?? "", "owner display name", 80),
    ownerEmail: assertText(input.ownerEmail ?? "", "owner email", 254),
    ownerAvatar: assertText(input.ownerAvatar ?? "", "owner avatar", 170),
    accent: input.accent,
    theme: input.theme,
    bodyFont: input.bodyFont,
    headingFont: input.headingFont,
    codeFont: input.codeFont,
    setupComplete: Boolean(input.setupComplete),
  }
  if (site.ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.ownerEmail)) throw new AccountError("Invalid optional contact email.", 400)
  if (site.ownerAvatar && !/^\/nextguide\/media\/[a-f0-9]{24}\.(png|jpg|webp|gif)$/.test(site.ownerAvatar)) throw new AccountError("Choose an avatar from your uploaded media.", 400)
  if (site.url) {
    let parsed
    try { parsed = new URL(site.url) }
    catch { throw new AccountError("Invalid site URL.", 400) }
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash)
      throw new AccountError("Invalid site URL. Use your site origin only.", 400)
    if (parsed.pathname !== "/" && parsed.pathname !== "") throw new AccountError("Site URL should not include a path.", 400)
    site.url = parsed.origin
  }
  for (const [key, allowed] of [["accent",ACCOUNT_ACCENTS], ["theme",ACCOUNT_MODES],
    ["bodyFont",ACCOUNT_BODY_FONTS], ["headingFont",ACCOUNT_BODY_FONTS], ["codeFont",ACCOUNT_CODE_FONTS]]) {
    if (!allowed.includes(site[key])) throw new AccountError("Unsupported " + key + " option.", 400)
  }
  atomicWrite(settingsFile(project), JSON.stringify(site, null, 2) + "\n")
  return site
}
export function listStudioMedia(project) {
  const dir = mediaDir(project)
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter(file => file.isFile() && /^[a-f0-9]{24}\.(png|jpg|webp|gif)$/.test(file.name))
    .map(file => ({ name: file.name, url: "/nextguide/media/" + file.name }))
}
function validSignature(type, data) {
  if (type === "image/png") return data.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
  if (type === "image/jpeg") return data.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))
  if (type === "image/webp") return data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP"
  if (type === "image/gif") return ["GIF87a", "GIF89a"].includes(data.subarray(0, 6).toString("ascii"))
  return false
}
export function uploadStudioMedia(project, mime, base64) {
  if (!Object.hasOwn(MEDIA, mime) || !MEDIA[mime]) throw new AccountError("Only PNG, JPEG, WebP and GIF images are supported.", 415)
  if (typeof base64 !== "string" || base64.length > Math.ceil(MAX_MEDIA_BYTES * 4 / 3) + 10 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw new AccountError("Invalid image data.", 400)
  }
  const data = Buffer.from(base64, "base64")
  if (!data.length || data.length > MAX_MEDIA_BYTES || !validSignature(mime, data)) throw new AccountError("Invalid image file.", 400)
  const folder = mediaDir(project)
  ensureFolder(folder)
  const name = randomBytes(12).toString("hex") + MEDIA[mime]
  const path = join(folder, name)
  writeFileSync(path, data, { flag: "wx", mode: 0o600 })
  return { name, url: "/nextguide/media/" + name }
}
export function deleteStudioMedia(project, name) {
  if (typeof name !== "string" || !/^[a-f0-9]{24}\.(png|jpg|webp|gif)$/.test(name)) throw new AccountError("Invalid media filename.", 400)
  const path = join(mediaDir(project), name)
  if (!existsSync(path) || lstatSync(path).isSymbolicLink()) throw new AccountError("Image not found.", 404)
  unlinkSync(path)
  return { deleted: name }
}

export function readStudioMedia(project, name) {
  if (typeof name !== "string" || !/^[a-f0-9]{24}\\.(png|jpg|webp|gif)$/.test(name)) {
    throw new AccountError("Invalid media filename.", 400)
  }
  const file = join(mediaDir(project), name)
  if (!existsSync(file) || lstatSync(file).isSymbolicLink() || !lstatSync(file).isFile()) {
    throw new AccountError("Image not found.", 404)
  }
  const bytes = readFileSync(file)
  if (bytes.length > MAX_MEDIA_BYTES || !bytes.length) throw new AccountError("Invalid image.", 400)
  const ext = name.split(".").pop()
  const mime = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif" }[ext]
  if (!validSignature(mime, bytes)) throw new AccountError("Invalid image.", 400)
  return { bytes, mime }
}
