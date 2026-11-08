import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import { createLinuxExtensionRunner } from "../lib/extension-isolation.mjs"
import { createExtensionBroker } from "../dist/extensions/runtime.js"

const CODE = 'export async function activate({ request }) { await request("extension.info") }\n'
const DIGEST = createHash("sha256").update(CODE).digest("hex")
const MANIFEST = {
  schemaVersion: 2, id: "acme.isolated", name: "Isolated test", version: "1.0.0",
  category: "integration", compatibility: { mode: "account", nextguide: ">=1.0.0 <2.0.0" },
  permissions: ["storage.read"], entrypoints: { server: "dist/server.mjs" },
}

function fakeProcess({ autoReady = true } = {}) {
  const child = new EventEmitter()
  child.pid = 975311
  child.stdin = new PassThrough()
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  child.kill = () => { child.killed = true; return true }
  child.stdin.setEncoding("utf8")
  const written = []
  let incoming = ""
  child.stdin.on("data", chunk => {
    incoming += chunk
    let split
    while ((split = incoming.indexOf("\n")) >= 0) {
      written.push(JSON.parse(incoming.slice(0, split)))
      incoming = incoming.slice(split + 1)
    }
  })
  if (autoReady) queueMicrotask(() => child.stdout.write('{"type":"ready"}\n'))
  return { child, written }
}

function host(child, additions = {}) {
  const seen = []
  const broker = createExtensionBroker({
    authorize(manifest, digest) {
      seen.push({ manifest, digest })
      return digest === DIGEST ? { permissions: ["storage.read"] } : null
    },
    storage: {
      async get(id, key) { return { id, key } },
      async set() { throw Error("must not write") },
      async delete() { throw Error("must not delete") },
    },
  })
  const launches = []
  const runner = createLinuxExtensionRunner({
    broker,
    // The host test double never launches these binaries. They must be real
    // /usr executables to exercise fail-closed dependency prechecks.
    bubblewrap: "/usr/bin/prlimit",
    prlimit: "/usr/bin/prlimit",
    node: "/usr/bin/prlimit",
    startupMs: 300,
    lifetimeMs: 1000,
    spawn(bin, args, opts) { launches.push({ bin, args, opts }); return child },
    ...additions,
  })
  return { runner, launches, seen }
}

test("signed bytes, owner grants and explicit namespace arguments gate a runner", async () => {
  const { child, written } = fakeProcess()
  const { runner, launches, seen } = host(child)
  const handle = await runner.start({ manifest: MANIFEST, code: CODE, artifactSha256: DIGEST })
  assert.equal(handle.active, true)
  assert.equal(handle.extensionId, MANIFEST.id)
  assert.equal(seen[0].digest, DIGEST)
  assert.equal(launches.length, 1)
  const { bin, args, opts } = launches[0]
  assert.equal(bin, "/usr/bin/prlimit")
  for (const required of [
    "--unshare-user", "--unshare-pid", "--unshare-net",
    "--unshare-ipc", "--unshare-uts", "--clearenv",
    "--die-with-parent", "--no-addons",
  ]) assert.ok(args.includes(required), required)
  assert.equal(args.includes("--unshare-all"), false)
  assert.equal(args.includes("--share-net"), false)
  assert.equal(opts.shell, false)
  assert.equal(opts.detached, true)
  assert.deepEqual(Object.keys(opts.env), ["PATH"])

  child.stdout.write('{"type":"call","id":"req1","method":"storage.get","params":{"key":"preferences"}}\n')
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(written[0].result, { id: "acme.isolated", key: "preferences" })
  child.stdout.write('{"type":"call","id":"req2","method":"storage.set","params":{"key":"x","value":1}}\n')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(written[1].error.code, "PERMISSION_DENIED")
  handle.stop()
  assert.equal(handle.active, false)
  assert.deepEqual(handle.contributions(), [])
})

test("wrong SHA-256 never opens broker session or starts process", async () => {
  const { child } = fakeProcess()
  const { runner, launches, seen } = host(child)
  await assert.rejects(runner.start({ manifest: MANIFEST, code: CODE,
    artifactSha256: "f".repeat(64) }), /approved release digest/)
  assert.equal(seen.length, 0)
  assert.equal(launches.length, 0)
})

test("startup times out and child is terminated, never treated as ready", async () => {
  const { child } = fakeProcess({ autoReady: false })
  const { runner } = host(child, { startupMs: 100, lifetimeMs: 250 })
  await assert.rejects(runner.start({ manifest: MANIFEST, code: CODE,
    artifactSha256: DIGEST }), /did not become ready/)
  assert.equal(child.killed, true)
})

test("invalid IPC and output floods terminate the process", async () => {
  for (const bad of [
    "not json\n",
    JSON.stringify({ type: "call", id: "../escape", method: "extension.info" }) + "\n",
    "a".repeat(65_537),
  ]) {
    const { child } = fakeProcess()
    const { runner } = host(child)
    const handle = await runner.start({ manifest: MANIFEST, code: CODE, artifactSha256: DIGEST })
    child.stdout.write(bad)
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(handle.active, false)
    assert.equal(child.killed, true)
  }
})

test("sandbox exit and unavailable binaries fail closed", async () => {
  const { child } = fakeProcess({ autoReady: false })
  const { runner } = host(child, { spawn() {
    queueMicrotask(() => child.emit("exit", 1))
    return child
  } })
  const result = runner.start({ manifest: MANIFEST, code: CODE, artifactSha256: DIGEST })
  await assert.rejects(result, /Sandbox process exited/)
  assert.equal(child.killed, true)
  const broker = createExtensionBroker({ authorize: () => ({ permissions: [] }) })
  const unavailable = createLinuxExtensionRunner({ broker, bubblewrap: "/not-installed/bwrap" })
  await assert.rejects(unavailable.start({ manifest: MANIFEST, code: CODE,
    artifactSha256: DIGEST }), /Required trusted Linux sandbox binary/)
})
