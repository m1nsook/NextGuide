import test from "node:test"
import assert from "node:assert/strict"
import {
  createExtensionBroker, sanitizeExtensionJson,
} from "../dist/extensions/runtime.js"
import { validateExtensionView, safeExtensionLink } from "../dist/extensions/views.js"

const DIGEST = "a".repeat(64)
function manifest(id = "acme.one", permissions = []) {
  return {
    schemaVersion: 2, id, name: "Example extension", version: "1.0.0",
    category: "integration", compatibility: { mode: "account", nextguide: ">=1.0.0 <2.0.0" },
    permissions, entrypoints: { server: "dist/server.mjs" }
  }
}
const msg = (id, method, params = {}) => ({ id, method, params })
const granted = (permissions, additional = {}) => ({ permissions, ...additional })

test("authorization callback binds session to approved manifest and release digest", async () => {
  const seen = []
  const broker = createExtensionBroker({
    authorize(manifest, digest) {
      seen.push({ id: manifest.id, digest })
      return manifest.id === "acme.one" && digest === DIGEST ? granted([]) : null
    }
  })
  const session = await broker.openSession(manifest(), DIGEST)
  const response = await session.handle(msg("id1", "extension.info"))
  assert.deepEqual(JSON.parse(JSON.stringify(response.result)), { id: "acme.one", version: "1.0.0", apiVersion: 1 })
  assert.equal(seen.length, 1)
  assert.equal(seen[0].digest, DIGEST)
  await assert.rejects(broker.openSession(manifest("acme.other"), DIGEST), /no verified owner approval/)
  await assert.rejects(broker.openSession(manifest(), "invalid"), /manifest or artifact digest/)
  await assert.rejects(createExtensionBroker({authorize: () => granted(["network.fetch"])}).openSession(manifest(), DIGEST),
    /undeclared/)
  session.close()
  const closed = await session.handle(msg("id2", "extension.info"))
  assert.equal(closed.error.code, "SESSION_CLOSED")
})

test("storage access is bound to session ID rather than caller-supplied ID", async () => {
  const storage = new Map()
  const broker = createExtensionBroker({
    authorize: async (m) => granted(m.permissions),
    storage: {
      async get(id, key) { return storage.get(id + ":" + key) ?? null },
      async set(id, key, value) { storage.set(id + ":" + key, value) },
      async delete(id, key) { storage.delete(id + ":" + key) },
    }
  })
  const a = await broker.openSession(manifest("acme.one", ["storage.read", "storage.write"]), DIGEST)
  const b = await broker.openSession(manifest("acme.two", ["storage.read"]), DIGEST)
  assert.equal((await a.handle(msg("01", "storage.set", { key: "settings", value: { name: "A" }, extensionId: "acme.two" }))).ok, true)
  assert.equal((await b.handle(msg("02", "storage.get", { key: "settings" }))).result, null)
  assert.equal((await a.handle(msg("03", "storage.get", { key: "settings" }))).result.name, "A")
  const denied = await b.handle(msg("04", "storage.set", { key: "settings", value: "hijack" }))
  assert.equal(denied.error.code, "PERMISSION_DENIED")
  const traversal = await a.handle(msg("05", "storage.get", { key: "../config" }))
  assert.equal(traversal.error.code, "INVALID_KEY")
  const ignored = await a.handle(msg("06", "secrets.read", { key: "NEXTGUIDE_SECRET" }))
  assert.equal(ignored.error.code, "UNKNOWN_METHOD")
  a.close(); b.close()
})

test("unapproved network access is blocked, even for a syntactically valid domain", async () => {
  let calls = 0
  const broker = createExtensionBroker({
    authorize: m => granted(m.permissions, { networkHosts: ["api.example.com"] }),
    network: { async request(id, query) { calls++; return { id, url: query.url } } }
  })
  const session = await broker.openSession(manifest("acme.one", ["network.fetch"]), DIGEST)
  const ok = await session.handle(msg("1", "network.request", { url: "https://api.example.com/v1", method: "GET" }))
  assert.equal(ok.ok, true)
  assert.equal(calls, 1)
  for (const url of [
    "http://api.example.com/v1", "https://api.example.com.evil.org/",
    "https://127.0.0.1/", "https://localhost/", "https://api.example.com:8443/",
    "https://alice:pw@api.example.com/", "https://evil.org/",
    "https://[::1]/", "file:///etc/passwd"
  ]) {
    const reply = await session.handle(msg("deny", "network.request", { url }))
    assert.equal(reply.error.code, "NETWORK_DENIED", url)
  }
  assert.equal(calls, 1)
  session.close()
})

test("network fetch is disabled by default and response errors are redacted", async () => {
  const broker = createExtensionBroker({ authorize: () => granted(["network.fetch"]) })
  const s = await broker.openSession(manifest("acme.one", ["network.fetch"]), DIGEST)
  assert.equal((await s.handle(msg("n", "network.request", { url: "https://example.com/" }))).error.code, "UNAVAILABLE")
  s.close()
  const erroring = createExtensionBroker({
    authorize: () => granted(["storage.read"]),
    storage: { async get() { throw Error("private filesystem path /var/secrets"); },
      async set() {}, async delete() {} }
  })
  const session = await erroring.openSession(manifest("acme.one", ["storage.read"]), DIGEST)
  const response = await session.handle(msg("e", "storage.get", { key: "my_key" }))
  assert.equal(response.error.code, "INTERNAL_ERROR")
  assert.doesNotMatch(response.error.message, /secrets|filesystem/)
  session.close()
})

test("declarative UI contributions reject HTML and unsafe links", async () => {
  const view = { type: "card", children: [
    { type: "heading", level: 2, text: "Hello" },
    { type: "button", text: "Open panel", action: "open_panel" }
  ]}
  assert.equal(validateExtensionView(view).valid, true)
  assert.equal(safeExtensionLink("javascript:alert(1)"), false)
  assert.equal(safeExtensionLink("https://example.com"), true)
  assert.equal(safeExtensionLink("/docs"), true)
  assert.equal(safeExtensionLink("//evil.com"), false)
  for (const bad of [
    {type:"html", value:"<script>alert(1)</script>"},
    {type:"link", text:"Danger", href:"javascript:alert(1)"},
    {type:"button", text:"Click", action:"../evil"},
    {type:"text", text:"hi", dangerouslySetInnerHTML:{"__html":"hello"}}
  ]) assert.equal(validateExtensionView(bad).valid, false)
  const broker = createExtensionBroker({ authorize: m => granted(m.permissions) })
  const session = await broker.openSession(manifest("acme.one", ["ui.components"]), DIGEST)
  const accepted = await session.handle(msg("v1", "contribution.publish", { kind: "ui.component", descriptor: { view }}))
  assert.equal(accepted.ok, true)
  assert.equal(session.contributions().length, 1)
  const unsafe = await session.handle(msg("v2", "contribution.publish", {
    kind: "ui.component", descriptor: { view: { type: "link", text: "oops", href: "javascript:alert(1)" }}
  }))
  assert.equal(unsafe.error.code, "INVALID_CONTRIBUTION")
  assert.equal(session.contributions().length, 1)
  session.close()
  assert.deepEqual(session.contributions(), [])
})

test("unknown permission, malicious JSON, and invalid message IDs fail closed", async () => {
  assert.throws(() => sanitizeExtensionJson({__proto__: null, foo: undefined}), /Only ordinary JSON data/)
  assert.throws(() => sanitizeExtensionJson(JSON.parse('{"__proto__":"x"}')), /Unsafe object property/)
  assert.throws(() => sanitizeExtensionJson({ get surprise() { return "run" }}), /Getters are not allowed/)
  const a = {}
  a.self = a
  assert.throws(() => sanitizeExtensionJson(a), /JSON exceeds depth or item limits/)
  const broker = createExtensionBroker({ authorize: () => granted([]) })
  const session = await broker.openSession(manifest(), DIGEST)
  assert.equal((await session.handle(msg("", "extension.info"))).error.code, "INVALID_REQUEST")
  assert.equal((await session.handle(msg("1", "storage.get", { key: "x" }))).error.code, "PERMISSION_DENIED")
  assert.equal((await session.handle(msg("2", "network.request", { url: "https://example.com" }))).error.code, "PERMISSION_DENIED")
  session.close()
})

test("closing a session invalidates in-flight responses and aborts operations", async () => {
  let release
  let aborted = false
  const broker = createExtensionBroker({
    authorize: () => granted(["storage.read"]),
    storage: {
      async get(id, key, signal) {
        signal.addEventListener("abort", () => { aborted = true })
        return await new Promise(resolve => { release = resolve })
      },
      async set() {}, async delete() {}
    }
  })
  const session = await broker.openSession(manifest("acme.one", ["storage.read"]), DIGEST)
  const waiting = session.handle(msg("wait", "storage.get", { key: "foo" }))
  await new Promise(resolve => setImmediate(resolve))
  session.close()
  release("late data")
  const response = await waiting
  assert.equal(aborted, true)
  assert.equal(response.error.code, "SESSION_CLOSED")
})
