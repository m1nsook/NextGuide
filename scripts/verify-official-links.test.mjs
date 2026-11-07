import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { validateExportLinks } from "./verify-official-links.mjs"

function exportedSite(html, extraFiles = []) {
  const root = mkdtempSync(join(tmpdir(), "nextguide-links-"))
  mkdirSync(join(root, "docs"), { recursive: true })
  writeFileSync(join(root, "index.html"), html)
  writeFileSync(join(root, "docs", "index.html"), "<p>docs</p>")
  for (const [file, contents] of extraFiles) {
    mkdirSync(join(root, file.substring(0, file.lastIndexOf("/"))), { recursive: true })
    writeFileSync(join(root, file), contents)
  }
  return root
}

test("accepts Pages-prefixed links for working static routes", () => {
  const dir = exportedSite('<a href="/NextGuide/">home</a><a href="/NextGuide/docs/">docs</a><a href="/NextGuide/docs/#intro">section</a>')
  try {
    assert.deepEqual(validateExportLinks(dir), { pages: 2, checked: 3 })
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test("rejects the original bug: root-relative anchors escape GitHub Pages", () => {
  const dir = exportedSite('<a href="/">broken logo</a><a href="/components/">broken components</a>')
  try {
    assert.throws(() => validateExportLinks(dir), /Missing \/NextGuide deployment prefix/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test("rejects docs links that have a prefix but no real exported page", () => {
  const dir = exportedSite('<a href="/NextGuide/docs/missing/">missing</a>')
  try {
    assert.throws(() => validateExportLinks(dir), /No exported page or asset at destination/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
