import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const cli = fileURLToPath(new URL("../bin/nextguide.mjs", import.meta.url))
const withColor = { ...process.env, FORCE_COLOR: "1", TERM: "xterm-256color" }
delete withColor.NO_COLOR
const withoutColor = { ...withColor, NO_COLOR: "1" }

function project() {
  const dir = mkdtempSync(join(tmpdir(), "nextguide-cli-style-"))
  mkdirSync(join(dir, "src/app"), { recursive: true })
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "test-site", dependencies: { next: "16.4.5" } }))
  writeFileSync(join(dir, "tsconfig.json"), "{}")
  return dir
}

function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8", env: options.env ?? withoutColor, cwd: options.cwd ?? process.cwd(),
  })
}

test("CLI colors and symbols are enabled when requested, disabled by NO_COLOR", () => {
  const root = project()
  try {
    const colored = run(["doctor", root], { env: withColor })
    assert.equal(colored.status, 0, colored.stderr)
    assert.match(colored.stdout, /\u001b\[[\d;]+m/)
    assert.match(colored.stdout, /✓ OK:/)

    const plain = run(["doctor", root], { env: withoutColor })
    assert.equal(plain.status, 0, plain.stderr)
    assert.doesNotMatch(plain.stdout, /\u001b\[/)
    assert.match(plain.stdout, /✓ OK:/)

    const json = run(["doctor", root, "--json"], { env: withColor })
    assert.equal(json.status, 0, json.stderr)
    assert.doesNotMatch(json.stdout, /\u001b\[/)
    assert.equal(JSON.parse(json.stdout).ok, true)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("init and page creation share readable console entries without disrupting JSON", () => {
  const root = project()
  try {
    const init = run(["init", root, "--developer", "--yes"], { env: withColor })
    assert.equal(init.status, 0, init.stderr)
    assert.match(init.stdout, /◆.*NextGuide Developer Mode/)
    assert.match(init.stdout, /CREATE content\/docs\/index.mdx/)
    assert.match(init.stdout, /Templates:/)
    const page = run(["page", "add", "guides/hello", "--project", root], { env: withColor })
    assert.equal(page.status, 0, page.stderr)
    assert.match(page.stdout, /page created/)
    assert.match(page.stdout, /CREATE content\/docs\/guides\/hello.mdx/)
    const preview = run(["page", "add", "guides/more", "--project", root, "--dry-run", "--json"], { env: withColor })
    assert.equal(preview.status, 0, preview.stderr)
    assert.equal(JSON.parse(preview.stdout).href, "/docs/guides/more")
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("upgrade shows installed-template version and unchanged/generated status", () => {
  const root = project()
  try {
    const setup = run(["init", root, "--developer", "--yes"])
    assert.equal(setup.status, 0, setup.stderr)
    const upgrade = run(["upgrade", root, "--refresh-generated", "--dry-run"], { env: withColor })
    assert.equal(upgrade.status, 0, upgrade.stderr)
    assert.match(upgrade.stdout, /Templates: installed NextGuide package v/)
    assert.match(upgrade.stdout, /✓ All files match/)
    assert.match(upgrade.stdout, /does not download or rebuild/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
