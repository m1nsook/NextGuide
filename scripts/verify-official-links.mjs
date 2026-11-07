/**
 * Validate the *exported HTML* rather than guessing from MDX source.
 * GitHub Pages hosts NextGuide under /NextGuide, so plain anchors to /
 * or /components result in real 404s even when Next.js Link works.
 */
import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export function validateExportLinks(outputDirectory, deploymentBasePath = "/NextGuide") {
  const root = resolve(outputDirectory)
  if (!existsSync(root)) throw new Error("Missing generated static site at " + root)
  const prefix = deploymentBasePath.replace(/\/$/, "")
  const htmlFiles = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith(".html")) htmlFiles.push(path)
    }
  }
  walk(root)
  assert.ok(htmlFiles.length > 0, "No exported HTML files to verify")
  const errors = []
  let checked = 0
  for (const file of htmlFiles) {
    const html = readFileSync(file, "utf8")
    for (const match of html.matchAll(/<a\b[^>]*?\bhref=(["'])(.*?)\1/gis)) {
      const raw = match[2].replace(/&amp;/g, "&")
      if (!raw.startsWith("/") || raw.startsWith("//")) continue
      const path = new URL(raw, "https://example.invalid").pathname
      // The only valid absolute internal paths on this deployment live under
      // the GitHub Pages project prefix; Next Link normally adds it for us.
      if (path !== prefix && !path.startsWith(prefix + "/")) {
        errors.push({ file: relative(root, file), href: raw, reason: "Missing " + prefix + " deployment prefix" })
        continue
      }
      const rest = decodeURIComponent(path.slice(prefix.length) || "/")
      if (rest.includes("\0") || rest.split("/").includes("..")) {
        errors.push({ file: relative(root, file), href: raw, reason: "Unsafe destination path" })
        continue
      }
      const clean = rest.replace(/^\/+/, "").replace(/\/+$/, "")
      const target = clean ? join(root, clean, "index.html") : join(root, "index.html")
      const fileTarget = clean ? join(root, clean) : target
      if (!existsSync(target) && !existsSync(fileTarget)) {
        errors.push({ file: relative(root, file), href: raw, reason: "No exported page or asset at destination" })
      }
      checked++
    }
  }
  if (errors.length) {
    throw new Error("Found " + errors.length + " broken internal links in exported NextGuide HTML:\n" +
      errors.slice(0, 75).map(e => "  " + e.file + ": " + e.href + " (" + e.reason + ")").join("\n"))
  }
  return { pages: htmlFiles.length, checked }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const out = process.argv[2] ?? "apps/web/out"
  const stats = validateExportLinks(out)
  console.log("NextGuide Pages links checked: " + stats.checked + " anchors across " + stats.pages + " HTML pages.")
}
