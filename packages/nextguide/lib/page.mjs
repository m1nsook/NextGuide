import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"

const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const WINDOWS_DEVICES = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

function displayPath(root, file) {
  return relative(root, file).split(sep).join("/")
}

function safeDirectory(root, destination) {
  const rel = relative(root, destination)
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error("contentDir must be a directory inside the Next.js project")
  }
  let current = root
  for (const part of rel.split(sep)) {
    current = join(current, part)
    if (!existsSync(current)) continue
    const stat = lstatSync(current)
    if (stat.isSymbolicLink()) throw new Error(`Refusing a symbolic link in the content directory: ${displayPath(root, current)}`)
    if (!stat.isDirectory()) throw new Error(`Not a directory: ${displayPath(root, current)}`)
  }
}

function titleFor(slug) {
  return slug.split("-").filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(" ")
}

function readDeveloperConfig(root) {
  const file = join(root, "nextguide.config.json")
  if (!existsSync(file)) throw new Error("Missing nextguide.config.json. Run nextguide init first.")
  let config
  try { config = JSON.parse(readFileSync(file, "utf8")) }
  catch { throw new Error("nextguide.config.json is not valid JSON") }
  if (config?.mode !== "developer" || typeof config.contentDir !== "string" || !config.contentDir.trim()) {
    throw new Error("Developer Mode requires mode=developer and a non-empty contentDir in nextguide.config.json")
  }
  return config
}

function readMeta(file) {
  if (!existsSync(file)) return []
  const stat = lstatSync(file)
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`Refusing unsafe navigation metadata: ${file}`)
  }
  let meta
  try { meta = JSON.parse(readFileSync(file, "utf8")) }
  catch { throw new Error(`Invalid JSON in ${file}`) }
  if (!Array.isArray(meta) || meta.some(item => item === null || typeof item !== "object" || Array.isArray(item) || typeof item.slug !== "string" || !item.slug)) {
    throw new Error(`Expected an array of { slug, title } entries in ${file}`)
  }
  return meta
}

function frontmatter(title, description) {
  // JSON-quoted strings are valid YAML scalars, preventing accidental new keys.
  return `---\ntitle: ${JSON.stringify(title)}\n${description ? `description: ${JSON.stringify(description)}\n` : ""}---\n\nWrite your documentation here.\n`
}

export function planPage(projectDirectory, slug, options = {}) {
  const root = resolve(projectDirectory)
  const config = readDeveloperConfig(root)
  const content = resolve(root, config.contentDir)
  safeDirectory(root, content)
  if (typeof slug !== "string") throw new Error("Provide a page slug, for example: guides/installation")
  const segments = slug.split("/")
  if (!segments.length || segments.length > 16 || slug.length > 240 ||
      segments.some(segment => !SEGMENT.test(segment) || segment.length > 64 || WINDOWS_DEVICES.test(segment)) ||
      slug.includes("\\")) {
    throw new Error("Page slug must use lowercase kebab-case segments separated by / (example: guides/installation)")
  }
  if (segments.slice(0, -1).includes("index")) {
    throw new Error("Page slug cannot use index as an intermediate folder")
  }
  const last = segments.at(-1)
  const title = options.title ?? titleFor(last)
  const description = options.description ?? ""
  for (const [name, value] of Object.entries({ title, description })) {
    if (typeof value !== "string" || value.length > 500 || (name === "title" && !value.trim())) {
      throw new Error(`${name} must be ${name === "title" ? "a non-empty" : "a"} string of at most 500 characters`)
    }
  }
  const created = []
  const modified = []
  let folder = content
  for (let index = 0; index < segments.length; index++) {
    const name = segments[index]
    const isLast = index === segments.length - 1
    const page = join(folder, `${name}.mdx`)
    const directory = join(folder, name)
    if (existsSync(page)) {
      if (isLast) throw new Error(`Refusing to overwrite existing page: ${displayPath(root, page)}`)
      throw new Error(`Cannot create a section with an existing page: ${displayPath(root, page)}`)
    }
    if (isLast && name !== "index" && existsSync(directory)) {
      throw new Error(`Page slug conflicts with an existing section: ${displayPath(root, directory)}`)
    }
    if (!isLast) safeDirectory(root, directory)
    const metaPath = join(folder, "_meta.json")
    const meta = readMeta(metaPath)
    if (!meta.some(entry => entry.slug === name)) {
      meta.push({ slug: name, title: isLast ? title : titleFor(name) })
      const entry = { path: displayPath(root, metaPath), content: JSON.stringify(meta, null, 2) + "\n" }
      ;(existsSync(metaPath) ? modified : created).push(entry)
    }
    folder = directory
  }
  const pagePath = join(dirname(folder), `${last}.mdx`)
  created.push({ path: displayPath(root, pagePath), content: frontmatter(title, description) })
  const route = segments.filter((name, index) => !(index === segments.length - 1 && name === "index")).join("/")
  return { projectDirectory: root, created, modified, href: route ? "/docs/" + route : "/docs" }
}

export function addPage(projectDirectory, slug, options = {}) {
  const plan = planPage(projectDirectory, slug, options)
  if (options.dryRun) return { ...plan, dryRun: true }
  // Validate all files before making changes. wx refuses overwriting existing pages.
  for (const file of plan.created) {
    const path = join(plan.projectDirectory, file.path)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, file.content, { encoding: "utf8", flag: "wx" })
  }
  for (const file of plan.modified) {
    writeFileSync(join(plan.projectDirectory, file.path), file.content, "utf8")
  }
  return { ...plan, dryRun: false }
}
