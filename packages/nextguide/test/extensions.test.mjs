import test from "node:test"
import assert from "node:assert/strict"
import {
  EXTENSION_API_VERSION, EXTENSION_CAPABILITIES, validateExtensionManifest,
  createExtensionHost, ExtensionHostError,
} from "../dist/extensions/index.js"

function manifest(overrides = {}) {
  return {
    schemaVersion: 2,
    id: "acme.search", name: "Search Tools", version: "1.0.0",
    category: "integration",
    compatibility: { mode: "account", nextguide: ">=1.0.0 <2.0.0" },
    permissions: ["admin.pages", "docs.pages"],
    entrypoints: { client: "dist/client.js", server: "dist/server.mjs" },
    ...overrides,
  }
}

test("extension API is versioned and declares typed capabilities", () => {
  assert.equal(EXTENSION_API_VERSION, 1)
  assert.ok(EXTENSION_CAPABILITIES.includes("ai.providers"))
  assert.ok(EXTENSION_CAPABILITIES.includes("server.routes"))
  assert.ok(EXTENSION_CAPABILITIES.includes("mdx.blocks"))
})

test("validator reports all invalid fields together instead of failing on first issue", () => {
  const report = validateExtensionManifest(manifest({
    id: "not-qualified", version: "preview", permissions: ["network.root", "network.root"],
    entrypoints: { server: "../outside.ts", unknown: "thing" }
  }))
  assert.equal(report.valid, false)
  for (const field of ["id", "version", "permissions[0]", "permissions[1]", "entrypoints.server", "entrypoints.unknown"]) {
    assert.ok(report.issues.some(issue => issue.path === field), field)
  }
  assert.equal(report.manifest, null)
})

test("old content-only manifest remains compatible without executable permissions", () => {
  const old = manifest({ schemaVersion: 1, category: "content", permissions: [], entrypoints: { content: "content" } })
  assert.equal(validateExtensionManifest(old).valid, true)
  assert.ok(validateExtensionManifest({ ...old, permissions: ["server.routes"] }).issues.some(i => i.code === "legacy"))
})

test("host activates trusted code only after explicit capability approval", async () => {
  const host = createExtensionHost()
  let cleaned = 0
  host.registerTrusted({
    manifest: manifest(),
    async activate(ctx) {
      assert.equal(ctx.hasPermission("admin.pages"), true)
      assert.equal(ctx.hasPermission("server.routes"), false)
      ctx.contribute("admin.page", { title: "Search admin", path: "/admin/search" })
      ctx.contribute("docs.page", { title: "Search help" })
      ctx.onDeactivate(() => { cleaned++ })
    },
  })
  await assert.rejects(host.enable("acme.search"), err => err instanceof ExtensionHostError && err.code === "PERMISSION_REQUIRED")
  assert.throws(() => host.approve("acme.search", ["server.routes"]), /undeclared/)
  host.approve("acme.search", ["admin.pages", "docs.pages"])
  await host.enable("acme.search")
  assert.equal(host.list()[0].state, "active")
  assert.equal(host.contributions("admin.page").length, 1)
  assert.throws(() => host.unregister("acme.search"), /Disable/)
  await host.disable("acme.search")
  assert.equal(cleaned, 1)
  assert.deepEqual(host.contributions(), [])
  host.unregister("acme.search")
  assert.deepEqual(host.list(), [])
})

test("unapproved contributions are rejected and activation rolls back", async () => {
  const host = createExtensionHost()
  host.registerTrusted({ manifest: manifest({ permissions: [], entrypoints: { content: "content" } }),
    activate(ctx) { ctx.contribute("server.route", { method: "GET", path: "/anything" }) }
  })
  await assert.rejects(host.enable("acme.search"), /not approved/)
  assert.equal(host.list()[0].state, "disabled")
  assert.deepEqual(host.contributions(), [])
})

test("host does not expose mutable contribution references", async () => {
  const host = createExtensionHost()
  const entry = { title: "Docs block" }
  host.registerTrusted({
    manifest: manifest({ permissions: ["mdx.blocks"] }),
    activate(ctx) { ctx.contribute("mdx.block", entry) }
  })
  host.approve("acme.search", ["mdx.blocks"])
  await host.enable("acme.search")
  entry.title = "Changed outside"
  assert.equal(host.contributions()[0].value.title, "Docs block")
  host.contributions()[0].value.title = "Changed response"
  assert.equal(host.contributions()[0].value.title, "Docs block")
  await host.disable("acme.search")
})

test("failed activation cleans up registered side effects", async () => {
  const host = createExtensionHost()
  let cleaned = false
  host.registerTrusted({
    manifest: manifest({ permissions: [] }),
    activate(ctx) {
      ctx.onDeactivate(() => { cleaned = true })
      throw Error("activation failed")
    }
  })
  await assert.rejects(host.enable("acme.search"), /activation failed/)
  assert.equal(cleaned, true)
  assert.equal(host.list()[0].state, "disabled")
})


test("stale extension contexts cannot contribute after disable and re-enable", async () => {
  const host = createExtensionHost()
  const contexts = []
  host.registerTrusted({
    manifest: manifest({ permissions: ["admin.pages"] }),
    activate(ctx) {
      contexts.push(ctx)
      ctx.contribute("admin.page", { path: "/admin/current" })
    }
  })
  host.approve("acme.search", ["admin.pages"])
  await host.enable("acme.search")
  const old = contexts[0]
  await host.disable("acme.search")
  assert.throws(() => old.contribute("admin.page", { path: "/admin/obsolete" }), /no longer active/)
  assert.throws(() => old.onDeactivate(() => {}), /no longer active/)
  await host.enable("acme.search")
  assert.throws(() => old.contribute("admin.page", { path: "/admin/stale" }), /no longer active/)
  assert.equal(host.contributions("admin.page").length, 1)
  await host.disable("acme.search")
})
