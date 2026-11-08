import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  existsSync, mkdtempSync, mkdirSync, readFileSync,
  rmSync, symlinkSync, writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createExtensionFileStorage } from "../lib/extension-storage.mjs"

function fixture(run) {
  const temp = mkdtempSync(join(tmpdir(), "ng-ext-storage-"))
  const storage = createExtensionFileStorage(join(temp, "private"))
  return Promise.resolve().then(() => run(storage, temp))
    .finally(() => rmSync(temp, { force: true, recursive: true }))
}
const digest = input => createHash("sha256").update(input).digest("hex")

test("extension storage persists across adapter restarts and isolates namespaces", () => fixture(async (store, root) => {
  await store.set("acme.one", "settings", { title: "Hello" })
  assert.deepEqual(await store.get("acme.one", "settings"), { title: "Hello" })
  assert.equal(await store.get("acme.two", "settings"), null)
  const another = createExtensionFileStorage(join(root, "private"))
  assert.deepEqual(await another.get("acme.one", "settings"), { title: "Hello" })
  await another.delete("acme.one", "settings")
  assert.equal(await store.get("acme.one", "settings"), null)
}))

test("invalid add-on IDs and keys cannot escape their private namespace", () => fixture(async store => {
  await assert.rejects(store.set("../bad", "settings", "no"), /Invalid extension ID/)
  await assert.rejects(store.set("acme.one", "../private", "no"), /Invalid extension storage key/)
  await assert.rejects(store.get("acme.one", ".."), /Invalid extension storage key/)
}))

test("storage writes are atomic and serialized for the same extension", () => fixture(async store => {
  await Promise.all(Array.from({ length: 20 }, (_, i) => store.set("acme.one", "counter", { value: i })))
  assert.deepEqual(await store.get("acme.one", "counter"), { value: 19 })
}))

test("per-extension item quota prevents unlimited disk growth", () => fixture(async store => {
  for (let i = 0; i < 128; i++) {
    await store.set("acme.one", "key_" + i, "x")
  }
  await assert.rejects(store.set("acme.one", "key_129", "overflow"), /quota exceeded/)
  assert.equal(await store.get("acme.one", "key_0"), "x")
}))

test("private storage rejects symlinked files and roots", t => {
  if (process.platform === "win32") return t.skip("Windows symlink creation may require elevation")
  return fixture(async (store, root) => {
    const dir = join(root, "private", digest("acme.one"))
    await store.set("acme.one", "settings", "original")
    const file = join(dir, digest("settings") + ".json")
    rmSync(file)
    const outside = join(root, "outside.json")
    writeFileSync(outside, '{"value":"stolen"}')
    symlinkSync(outside, file)
    await assert.rejects(store.get("acme.one", "settings"), /Unsafe extension storage file/)
    assert.equal(readFileSync(outside, "utf8"), '{"value":"stolen"}')
    const link = join(root, "symlink-root")
    symlinkSync(join(root, "private"), link, "dir")
    assert.throws(() => createExtensionFileStorage(link), /Unsafe extension storage directory/)
  })
})

test("cancelled operations are rejected", () => fixture(async store => {
  const cancel = new AbortController()
  cancel.abort()
  await assert.rejects(store.set("acme.one", "settings", "x", cancel.signal), /session ended/)
}))
