/**
 * Account Mode-only, private installation journal for reviewed v1 Markdown add-ons.
 *
 * The registry envelope AND archive must be verified before a write. This
 * module never evaluates add-on JavaScript, compiles Markdown as MDX, writes
 * into content/docs, or makes an executable extension active.
 *
 * Each state change is guarded by a cross-process lock and a compare-and-swap
 * revision. Release blobs are content-addressed, immutable and private.
 * Unreferenced blobs left by a failed transaction are safe to collect later.
 */
import { createHash, randomBytes } from "node:crypto"
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync,
  realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { accountFile } from "./account-auth.mjs"
import { verifySignedRegistryEnvelope } from "./extension-catalog.mjs"
import { verifyApprovedContentArchive } from "./extension-artifacts.mjs"

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const PACKAGE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/
const HASH = /^[a-f0-9]{64}$/
const MAX_INSTALLED = 64
const MAX_VERSIONS = 4
const MAX_CATALOG_AGE_MS = 60 * 60 * 1000
const FUTURE_SKEW_MS = 5 * 60 * 1000

function fail(code, message) {
  const error = new Error("NextGuide add-on install: " + message)
  error.code = code
  throw error
}
function object(v) { return v !== null && typeof v === "object" && !Array.isArray(v) }
function cleanDirectory(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true, mode: 0o700 })
  if (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink()) {
    fail("UNSAFE_STORAGE", "Private add-on directory is not a real directory")
  }
}
function assertRegular(path) {
  const info = lstatSync(path)
  if (!info.isFile() || info.isSymbolicLink()) fail("UNSAFE_STORAGE", "Refusing unsafe add-on file")
}
function compare(a, b) {
  const lhs = a.split(".").map(BigInt), rhs = b.split(".").map(BigInt)
  for (let i = 0; i < 3; i++) if (lhs[i] !== rhs[i]) return lhs[i] > rhs[i] ? 1 : -1
  return 0
}
export function compatibleAddonRange(range, installedVersion) {
  if (typeof range !== "string" || !VERSION.test(installedVersion)) return false
  const constraints = range.trim().split(/\s+/)
  if (!constraints.length || constraints.length > 8) return false
  return constraints.every(part => {
    const match = /^(>=|<=|>|<|=)(\d+\.\d+\.\d+)$/.exec(part)
    if (!match || !VERSION.test(match[2])) return false
    const comparison = compare(installedVersion, match[2])
    return match[1] === ">=" ? comparison >= 0 :
      match[1] === "<=" ? comparison <= 0 :
        match[1] === ">" ? comparison > 0 :
          match[1] === "<" ? comparison < 0 : comparison === 0
  })
}
function safeRecord(record) {
  if (!object(record) || !ID.test(record.id) || typeof record.enabled !== "boolean" ||
      !VERSION.test(record.pinnedVersion) ||
      !Array.isArray(record.versions) || record.versions.length < 1 ||
      record.versions.length > MAX_VERSIONS) return false
  const versions = new Set()
  for (const version of record.versions) {
    if (!object(version) || !VERSION.test(version.version) || !HASH.test(version.digest) ||
        !Number.isSafeInteger(version.size) || version.size < 32 || version.size > 3 * 1024 * 1024 ||
        typeof version.name !== "string" || version.name.length > 80 ||
        !Number.isFinite(Date.parse(version.reviewedAt)) || versions.has(version.version)) return false
    versions.add(version.version)
  }
  return versions.has(record.pinnedVersion)
}
function assertState(state) {
  if (!object(state) || state.schemaVersion !== 1 ||
      !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !object(state.addons) || Object.keys(state.addons).length > MAX_INSTALLED) {
    fail("DAMAGED_STATE", "Installed add-on index is invalid")
  }
  for (const [key, value] of Object.entries(state.addons)) {
    if (!safeRecord(value) || key !== value.id) fail("DAMAGED_STATE", "Invalid installed add-on record")
  }
  return state
}
function copy(value) { return JSON.parse(JSON.stringify(value)) }
function newState() { return { schemaVersion: 1, revision: 0, addons: Object.create(null) } }

/**
 * Only called by trusted, authenticated Account Mode handlers.
 * nextguideVersion must be the installed framework's stable SemVer; alpha
 * builds cannot install packages declaring >=1.0.0 compatibility.
 */
export function createAccountAddonStore({
  project = process.cwd(),
  dataDir,
  nextguideVersion,
  now = () => Date.now(),
} = {}) {
  if (typeof nextguideVersion !== "string" || !PACKAGE_VERSION.test(nextguideVersion)) {
    fail("INCOMPATIBLE", "A valid installed NextGuide package version is required")
  }
  const site = resolve(project)
  const configFile = join(site, "nextguide.config.json")
  assertRegular(configFile)
  let config
  try { config = JSON.parse(readFileSync(configFile, "utf8")) }
  catch { fail("INVALID_CONFIG", "Account Mode configuration is invalid") }
  if (config?.mode !== "account" || config?.contentDir !== "content/docs") {
    fail("MODE_DENIED", "Add-on installations are only supported in Account Mode")
  }
  const privateFile = accountFile(site, dataDir)
  assertRegular(privateFile)
  const privateRoot = dirname(privateFile)
  // Refuse unexpected symlink redirects, including an existing storage
  // directory symlink that might resolve inside a publicly served project.
  const actualPrivate = realpathSync(privateRoot)
  const actualSite = realpathSync(site)
  const inside = relative(actualSite, actualPrivate)
  if (inside === "" || (inside !== ".." && !inside.startsWith(".." + sep) && !isAbsolute(inside))) {
    fail("UNSAFE_STORAGE", "Add-on storage must remain outside the site")
  }
  if (lstatSync(privateRoot).isSymbolicLink()) fail("UNSAFE_STORAGE", "Private root is a symlink")
  const root = join(privateRoot, "addons")
  const blobs = join(root, "blobs")
  cleanDirectory(root)
  cleanDirectory(blobs)
  const index = join(root, "installed.json")
  const lock = join(root, ".lock")
  if (existsSync(index)) assertRegular(index)

  function state() {
    if (!existsSync(index)) return newState()
    assertRegular(index)
    const info = lstatSync(index)
    if (info.size > 128 * 1024) fail("DAMAGED_STATE", "Installed index is oversized")
    try { return assertState(JSON.parse(readFileSync(index, "utf8"))) }
    catch { return fail("DAMAGED_STATE", "Installed index could not be read safely") }
  }
  function blobPath(digest) {
    if (!HASH.test(digest)) fail("INVALID_DIGEST", "Invalid release digest")
    return join(blobs, digest + ".tgz")
  }
  function checkedBlob(version) {
    const path = blobPath(version.digest)
    if (!existsSync(path)) fail("MISSING_ARTIFACT", "Installed release artifact is missing")
    assertRegular(path)
    const stat = lstatSync(path)
    if (stat.size !== version.size) fail("CORRUPT_ARTIFACT", "Installed release size changed")
    const bytes = readFileSync(path)
    if (createHash("sha256").update(bytes).digest("hex") !== version.digest) {
      fail("CORRUPT_ARTIFACT", "Installed release digest changed")
    }
    return bytes
  }
  function fresh(envelope, key) {
    const payload = verifySignedRegistryEnvelope(envelope, key)
    const timestamp = Date.parse(payload.updatedAt)
    const age = now() - timestamp
    if (!Number.isFinite(age) || age < -FUTURE_SKEW_MS || age > MAX_CATALOG_AGE_MS) {
      fail("STALE_CATALOG", "Registry signature is too old for an installation change")
    }
    return payload
  }
  function findActive(payload, id, version, digest) {
    if (!ID.test(id) || !VERSION.test(version)) fail("INVALID_RELEASE", "Invalid release identity")
    const release = payload.releases.find(r => r.manifest.id === id && r.manifest.version === version)
    if (!release || release.status !== "active" ||
        (digest !== undefined && release.digest !== digest) ||
        !compatibleAddonRange(release.manifest.compatibility.nextguide, nextguideVersion)) {
      fail("NOT_APPROVED", "Release is revoked, changed or incompatible with NextGuide")
    }
    return release
  }
  function journal(expectedRevision, action) {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      fail("CONFLICT", "Expected index revision is required")
    }
    let fd
    try { fd = openSync(lock, "wx", 0o600) }
    catch { fail("BUSY", "Another add-on operation is active; retry after it completes") }
    try {
      const previous = state()
      if (previous.revision !== expectedRevision) fail("CONFLICT", "Add-on index changed; refresh and retry")
      const proposed = copy(previous)
      const result = action(proposed)
      proposed.revision = previous.revision + 1
      assertState(proposed)
      const tmp = join(root, "." + randomBytes(16).toString("hex") + ".tmp")
      try {
        writeFileSync(tmp, JSON.stringify(proposed) + "\n", { flag: "wx", mode: 0o600 })
        renameSync(tmp, index)
      } finally { if (existsSync(tmp)) unlinkSync(tmp) }
      return { revision: proposed.revision, ...result }
    } finally {
      closeSync(fd)
      unlinkSync(lock)
    }
  }
  function saveBlob(release, bytes) {
    const path = blobPath(release.digest)
    if (existsSync(path)) {
      checkedBlob(release)
      return
    }
    const tmp = join(blobs, "." + randomBytes(16).toString("hex") + ".tmp")
    try {
      writeFileSync(tmp, bytes, { flag: "wx", mode: 0o600 })
      // Atomic publish into the immutable content-addressed blob namespace.
      if (!existsSync(path)) renameSync(tmp, path)
    } finally { if (existsSync(tmp)) unlinkSync(tmp) }
    checkedBlob(release)
  }
  function publicEntry(record) {
    return { id: record.id, enabled: record.enabled, version: record.pinnedVersion,
      availableVersions: record.versions.map(r => r.version),
      name: record.versions.find(r => r.version === record.pinnedVersion).name }
  }
  return {
    list() {
      const current = state()
      return { revision: current.revision, addons: Object.values(current.addons).map(publicEntry) }
    },
    /** A reviewed archive can be installed or upgraded; writes are atomic. */
    install({ envelope, pinnedPublicKeyPem, id, version, archive, expectedRevision }) {
      const payload = fresh(envelope, pinnedPublicKeyPem)
      const release = findActive(payload, id, version)
      const verified = verifyApprovedContentArchive({
        envelope, pinnedPublicKeyPem, id, version, archive,
      })
      // No v1 executable capabilities. Future v2 permissions require an
      // independent explicit owner-grant flow before they can be activated.
      if (verified.manifest.permissions.length !== 0) fail("PERMISSION_DENIED", "v1 cannot request capabilities")
      const bytes = Buffer.from(archive)
      return journal(expectedRevision, next => {
        const prior = next.addons[id]
        if (!prior && Object.keys(next.addons).length >= MAX_INSTALLED) {
          fail("CAPACITY", "Maximum installed add-on count reached")
        }
        if (prior && compare(version, prior.pinnedVersion) <= 0) {
          fail("DOWNGRADE", "Use explicit rollback for a previous reviewed version")
        }
        const record = {
          version: release.manifest.version, digest: release.digest,
          size: release.size, name: release.manifest.name,
          reviewedAt: release.approvedAt,
        }
        const versions = prior ? [...prior.versions.filter(r => r.version !== version), record].slice(-MAX_VERSIONS) : [record]
        saveBlob(release, bytes)
        next.addons[id] = {
          id, pinnedVersion: version, enabled: prior?.enabled ?? false, versions,
        }
        return { addon: publicEntry(next.addons[id]) }
      })
    },
    setEnabled({ id, enabled, expectedRevision, envelope, pinnedPublicKeyPem }) {
      if (typeof enabled !== "boolean") fail("INVALID_REQUEST", "Expected enabled true or false")
      return journal(expectedRevision, next => {
        const record = next.addons[id]
        if (!record) fail("NOT_INSTALLED", "Add-on is not installed")
        if (enabled) {
          const payload = fresh(envelope, pinnedPublicKeyPem)
          const snapshot = record.versions.find(x => x.version === record.pinnedVersion)
          findActive(payload, id, snapshot.version, snapshot.digest)
          verifyApprovedContentArchive({ envelope, pinnedPublicKeyPem, id,
            version: snapshot.version, archive: checkedBlob(snapshot) })
        }
        record.enabled = enabled
        return { addon: publicEntry(record) }
      })
    },
    rollback({ id, version, expectedRevision, envelope, pinnedPublicKeyPem }) {
      const payload = fresh(envelope, pinnedPublicKeyPem)
      return journal(expectedRevision, next => {
        const record = next.addons[id]
        if (!record) fail("NOT_INSTALLED", "Add-on is not installed")
        const snapshot = record.versions.find(x => x.version === version)
        if (!snapshot || version === record.pinnedVersion) {
          fail("NOT_INSTALLED", "Requested rollback release is not available")
        }
        findActive(payload, id, version, snapshot.digest)
        verifyApprovedContentArchive({ envelope, pinnedPublicKeyPem, id,
          version, archive: checkedBlob(snapshot) })
        record.pinnedVersion = version
        // Explicitly disabled after rollback; owner must re-enable, with
        // fresh signed release status and integrity verification.
        record.enabled = false
        return { addon: publicEntry(record) }
      })
    },
    uninstall({ id, expectedRevision }) {
      return journal(expectedRevision, next => {
        if (!next.addons[id]) fail("NOT_INSTALLED", "Add-on is not installed")
        delete next.addons[id]
        // Keep private per-add-on settings and old immutable blobs until a
        // separate owner-approved cleanup flow is implemented.
        return { removed: id, privateDataPreserved: true }
      })
    },
    /** Privileged read: verify active signature and stored bytes on every use. */
    readEnabled({ id, envelope, pinnedPublicKeyPem }) {
      const record = state().addons[id]
      if (!record?.enabled) return null
      const payload = fresh(envelope, pinnedPublicKeyPem)
      const snapshot = record.versions.find(x => x.version === record.pinnedVersion)
      findActive(payload, id, snapshot.version, snapshot.digest)
      return verifyApprovedContentArchive({ envelope, pinnedPublicKeyPem, id,
        version: snapshot.version, archive: checkedBlob(snapshot) })
    },
  }
}
