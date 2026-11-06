import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import test from "node:test"

const cli = fileURLToPath(new URL("../bin/nextguide.mjs", import.meta.url))
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "nextguide cli spaces "))
  mkdirSync(join(root, "content/docs"), { recursive: true })
  writeFileSync(join(root, "nextguide.config.json"), JSON.stringify({ mode: "developer", contentDir: "content/docs" }))
  writeFileSync(join(root, "content/docs/_meta.json"), "[]\n")
  return root
}
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" })

test("CLI creates a named nested MDX page and reports its navigation changes", () => {
  const root = fixture()
  try {
    const result = run("page", "add", "guides/windows-installation", "--project", root, "--title", "Windows installation", "--description", "Setup on Windows")
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /CREATE content\/docs\/guides\/windows-installation\.mdx/)
    assert.match(result.stdout, /UPDATE content\/docs\/_meta\.json/)
    assert.match(result.stdout, /URL: \/docs\/guides\/windows-installation/)
    assert.match(readFileSync(join(root, "content/docs/guides/windows-installation.mdx"), "utf8"), /Windows installation/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("CLI dry-run JSON has stable file paths and never modifies files", () => {
  const root = fixture()
  try {
    const result = run("page", "add", "changelog", "--project", root, "--dry-run", "--json")
    assert.equal(result.status, 0, result.stderr)
    const json = JSON.parse(result.stdout)
    assert.equal(json.mode, "developer")
    assert.equal(json.href, "/docs/changelog")
    assert.equal(json.dryRun, true)
    assert.deepEqual(json.created, ["content/docs/changelog.mdx"])
    assert.deepEqual(json.modified, ["content/docs/_meta.json"])
    assert.equal(existsSync(join(root, "content/docs/changelog.mdx")), false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("CLI rejects missing, unknown and unsupported arguments cleanly", () => {
  const root = fixture()
  try {
    for (const args of [
      ["page", "add"], ["page", "add", "abc", "--project"], ["page", "add", "abc", "--unknown"], ["page", "delete", "abc"],
    ]) {
      const result = run(...args)
      assert.equal(result.status, 2, JSON.stringify(args) + ": " + result.stderr)
    }
    const result = run("page", "add", "con", "--project", root)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Page slug/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("CLI page help lists its actual supported commands", () => {
  const result = run("page", "--help")
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /page add <slug>/)
  assert.match(result.stdout, /--dry-run/)
  assert.match(result.stdout, /--project/)
})
