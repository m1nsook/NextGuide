/**
 * Persistent, extension-scoped JSON storage. Node-only.
 * The site's PRIVATE storage root must be owner-controlled (0700) and outside
 * source repositories and publicly served directories.
 *
 * Filesystem isolation is NOT a sandbox against arbitrary Node add-on code.
 * Only the trusted host may import this adapter and pass its operations through
 * the capability broker.
 */
import { createHash, randomBytes } from "node:crypto"
import {
  existsSync, lstatSync, mkdirSync, readdirSync, readFileSync,
  renameSync, unlinkSync, writeFileSync,
} from "node:fs"
import { basename, isAbsolute, join, resolve } from "node:path"

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/
const KEY = /^[a-z0-9][a-z0-9_-]{0,79}$/
const MAX_VALUE = 32768
const MAX_NAMESPACE = 1024 * 1024
const MAX_KEYS = 128

function assertPrivateDirectory(directory) {
  if (!isAbsolute(directory)) throw Error("Extension storage root must be an absolute path")
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const entry = lstatSync(directory)
  if (!entry.isDirectory() || entry.isSymbolicLink()) throw Error("Unsafe extension storage directory")
}

function hash(input) { return createHash("sha256").update(input).digest("hex") }

export function createExtensionFileStorage(storageRoot) {
  if (typeof storageRoot !== "string" || !isAbsolute(storageRoot)) {
    throw Error("Storage root must be an absolute private directory")
  }
  const root = resolve(storageRoot)
  assertPrivateDirectory(root)
  const operations = new Map()

  function scope(extensionId) {
    if (typeof extensionId !== "string" || !ID.test(extensionId)) throw Error("Invalid extension ID")
    assertPrivateDirectory(root)
    const dir = join(root, hash(extensionId))
    assertPrivateDirectory(dir)
    return dir
  }

  function filename(extensionId, key) {
    if (typeof key !== "string" || !KEY.test(key)) throw Error("Invalid extension storage key")
    return join(scope(extensionId), hash(key) + ".json")
  }

  function checkedBytes(file) {
    const info = lstatSync(file)
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_VALUE + 64) {
      throw Error("Unsafe extension storage file")
    }
    return readFileSync(file)
  }

  function queue(extensionId, operation) {
    const previous = operations.get(extensionId) ?? Promise.resolve()
    const current = previous.catch(() => {}).then(operation)
    operations.set(extensionId, current)
    void current.finally(() => {
      if (operations.get(extensionId) === current) operations.delete(extensionId)
    }).catch(() => {})
    return current
  }

  function scan(directory, replacedFile) {
    let total = 0, count = 0
    for (const entry of readdirSync(directory)) {
      const file = join(directory, entry)
      if (entry === replacedFile || !entry.endsWith(".json")) continue
      const stats = lstatSync(file)
      if (!stats.isFile() || stats.isSymbolicLink()) throw Error("Unsafe extension storage entry")
      count++
      total += stats.size
      if (count > MAX_KEYS || total > MAX_NAMESPACE) throw Error("Extension storage quota exceeded")
    }
    return { total, count }
  }

  return {
    async get(extensionId, key, signal) {
      if (signal?.aborted) throw Error("Extension session ended")
      const file = filename(extensionId, key)
      if (!existsSync(file)) return null
      const stored = JSON.parse(checkedBytes(file).toString("utf8"))
      if (!stored || typeof stored !== "object" ||
          !Object.hasOwn(stored, "value")) throw Error("Damaged extension storage")
      return stored.value
    },
    async set(extensionId, key, value, signal) {
      if (signal?.aborted) throw Error("Extension session ended")
      return queue(extensionId, async () => {
        if (signal?.aborted) throw Error("Extension session ended")
        const file = filename(extensionId, key)
        const dir = scope(extensionId)
        if (existsSync(file)) checkedBytes(file)
        const bytes = Buffer.from(JSON.stringify({ value }) + "\n", "utf8")
        if (bytes.length > MAX_VALUE + 64) throw Error("Extension storage value exceeds 32 KiB")
        const { total, count } = scan(dir, basename(file))
        if (total + bytes.length > MAX_NAMESPACE || count + 1 > MAX_KEYS) {
          throw Error("Extension storage quota exceeded")
        }
        const temp = join(dir, "." + randomBytes(16).toString("hex") + ".tmp")
        try {
          writeFileSync(temp, bytes, { mode: 0o600, flag: "wx" })
          if (signal?.aborted) throw Error("Extension session ended")
          renameSync(temp, file)
        } finally { if (existsSync(temp)) unlinkSync(temp) }
      })
    },
    async delete(extensionId, key, signal) {
      if (signal?.aborted) throw Error("Extension session ended")
      return queue(extensionId, async () => {
        if (signal?.aborted) throw Error("Extension session ended")
        const file = filename(extensionId, key)
        if (existsSync(file)) {
          checkedBytes(file)
          unlinkSync(file)
        }
      })
    }
  }
}
