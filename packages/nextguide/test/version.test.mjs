import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { checkVersion, compareVersions } from "../lib/version.mjs"

const mock = (tags, status = 200) => async (_url, options) => {
  assert.equal(options.method, "GET")
  assert.equal(options.headers.Accept, "application/json")
  return { ok: status === 200, status, json: async () => tags }
}

test("SemVer compares stable, prerelease and numeric prerelease identifiers", () => {
  assert.equal(compareVersions("1.0.0", "1.0.0-alpha.99"), 1)
  assert.equal(compareVersions("0.0.1-alpha.2", "0.0.1-alpha.10"), -1)
  assert.equal(compareVersions("1.0.0-beta", "1.0.0-alpha"), 1)
  assert.equal(compareVersions("1.0.0-alpha.1", "1.0.0-alpha"), 1)
  assert.equal(compareVersions("1.0.0+build.a", "1.0.0+build.b"), 0)
  assert.equal(compareVersions("2.0.0", "1.99.99"), 1)
  assert.throws(() => compareVersions("not-a-version", "1.0.0"), /Invalid/)
})

test("Update check reports a newer published version", async () => {
  const result = await checkVersion("0.0.1-alpha.2", { fetchImpl: mock({ latest: "1.0.0", alpha: "1.1.0-alpha.1" }) })
  assert.equal(result.installed, "0.0.1-alpha.2")
  assert.equal(result.published, "1.0.0")
  assert.equal(result.tag, "latest")
  assert.equal(result.status, "update-available")
  assert.equal(result.updateAvailable, true)
})

test("Pre-release channel is opt-in and does not mistake older tags for updates", async () => {
  const result = await checkVersion("0.0.1-alpha.2", {
    tag: "alpha", fetchImpl: mock({ latest: "0.0.1-alpha.0", alpha: "0.0.1-alpha.1" }),
  })
  assert.equal(result.status, "ahead")
  assert.equal(result.updateAvailable, false)
  assert.equal(result.published, "0.0.1-alpha.1")
})

test("Same version reports up to date", async () => {
  const result = await checkVersion("1.0.0", { fetchImpl: mock({ latest: "1.0.0" }) })
  assert.equal(result.status, "up-to-date")
  assert.equal(result.updateAvailable, false)
})

test("Unpublished tags and missing npm package are handled without made-up versions", async () => {
  const missingTag = await checkVersion("0.0.1-alpha.2", { fetchImpl: mock({ alpha: "0.0.1-alpha.1" }) })
  assert.equal(missingTag.status, "not-published")
  assert.equal(missingTag.published, null)
  const missingPackage = await checkVersion("0.0.1-alpha.2", { fetchImpl: mock({}, 404) })
  assert.equal(missingPackage.status, "not-published")
})

test("Registry errors fail clearly rather than claiming the package is up to date", async () => {
  await assert.rejects(checkVersion("1.0.0", { fetchImpl: mock({}, 503) }), /HTTP 503/)
  await assert.rejects(checkVersion("1.0.0", { fetchImpl: mock(null) }), /Invalid npm registry/)
  await assert.rejects(checkVersion("1.0.0", { tag: "beta", fetchImpl: mock({}) }), /Tag must/)
  await assert.rejects(checkVersion("1.0.0", { fetchImpl: async () => { throw Error("offline") } }), /offline/)
})

test("CLI version help is offline and advertises the read-only check", () => {
  const cli = fileURLToPath(new URL("../bin/nextguide.mjs", import.meta.url))
  const result = spawnSync(process.execPath, [cli, "version", "--help"], { encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /version check/)
  assert.match(result.stdout, /does not install/)
})

test("CLI rejects invalid version subcommands without contacting npm", () => {
  const cli = fileURLToPath(new URL("../bin/nextguide.mjs", import.meta.url))
  for (const args of [["version", "banana"], ["version", "check", "--tag", "beta"], ["version", "check", "--unknown"]]) {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" })
    assert.equal(result.status, 2, result.stderr)
  }
})
