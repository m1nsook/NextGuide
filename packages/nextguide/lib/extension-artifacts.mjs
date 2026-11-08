/**
 * Read-only archive verification for CURRENT content-only v1 registry releases.
 *
 * No extraction, filesystem writes, script/MDX execution, or URL fetching.
 * This intentionally does NOT accept unreviewed executable v2 artifacts.
 * Consumers must render Markdown with raw HTML disabled.
 */
import { createHash } from "node:crypto"
import { gunzipSync } from "node:zlib"
import { verifySignedRegistryEnvelope } from "./extension-catalog.mjs"

const MAX_ARCHIVE = 3 * 1024 * 1024
const MAX_UNPACKED = 28 * 1024 * 1024
const MAX_FILE = 256 * 1024
const MAX_MEMBERS = 102
const PATH = /^[A-Za-z0-9_][A-Za-z0-9_. /-]*$/
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function fail(message) { throw Error("NextGuide add-on artifact: " + message) }
function object(x) { return x !== null && typeof x === "object" && !Array.isArray(x) }
function octal(bytes) {
  const text = bytes.toString("ascii").replace(/\0.*$/, "").trim()
  if (!/^[0-7]+$/.test(text)) fail("Invalid tar octal field")
  const value = Number.parseInt(text, 8)
  if (!Number.isSafeInteger(value)) fail("Tar number exceeds supported range")
  return value
}
function text(bytes) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes) }
  catch { return fail("Invalid UTF-8 in archive") }
}
function safeRelative(path) {
  return typeof path === "string" && path.length <= 160 && PATH.test(path) &&
    !path.startsWith("/") && !path.includes("\\") && !path.includes(":") &&
    path.split("/").every(part => part && part !== "." && part !== ".." && !part.endsWith("."))
}
function pathFromHeader(header) {
  if (header[0] === 0) fail("Empty tar member path")
  const nameEnd = header.subarray(0, 100).indexOf(0)
  const name = text(header.subarray(0, nameEnd < 0 ? 100 : nameEnd))
  if (Buffer.from(name, "utf8").length > 100 || !safeRelative(name)) {
    fail("Unsafe add-on archive path")
  }
  // PAX extensions, GNU long names and ustar prefixes are unsupported.
  if (header.subarray(345, 500).some(value => value !== 0)) {
    fail("Tar extended filename is not supported")
  }
  return name
}
function parseFiles(unpacked) {
  const files = new Map()
  const names = new Set()
  let offset = 0
  let terminator = false
  while (offset + 512 <= unpacked.length) {
    const header = unpacked.subarray(offset, offset + 512)
    if (header.every(value => value === 0)) {
      if (offset + 1024 > unpacked.length ||
          unpacked.subarray(offset).some(value => value !== 0)) {
        fail("Tar archive must end with zero blocks")
      }
      terminator = true
      break
    }
    if (header.subarray(257, 263).toString("binary") !== "ustar\0" ||
        header.subarray(263, 265).toString("ascii") !== "00" ||
        (header[156] !== 0 && header[156] !== 48)) {
      fail("Unsupported tar member type or format")
    }
    const expected = octal(header.subarray(148, 156))
    const checksum = Buffer.from(header)
    checksum.fill(32, 148, 156)
    if (checksum.reduce((a, b) => a + b, 0) !== expected) {
      fail("Invalid tar header checksum")
    }
    const path = pathFromHeader(header)
    const key = path.toLowerCase()
    if (names.has(key)) fail("Duplicate or case-colliding archive path")
    names.add(key)
    const size = octal(header.subarray(124, 136))
    if (size > MAX_FILE || files.size >= MAX_MEMBERS) fail("Archive member quota exceeded")
    const start = offset + 512
    const end = start + size
    const next = start + Math.ceil(size / 512) * 512
    if (end > unpacked.length || next > unpacked.length) fail("Truncated tar member")
    if (unpacked.subarray(end, next).some(value => value !== 0)) {
      fail("Non-zero tar padding")
    }
    files.set(path, Buffer.from(unpacked.subarray(start, end)))
    offset = next
  }
  if (!terminator || files.size < 3) fail("Missing tar terminator or required members")
  return files
}

/**
 * Verifies the Ed25519-signed registry release and exact downloaded bytes.
 * Returns data-only Markdown/icon contents; no files are installed or run.
 *
 * @param {{ envelope: unknown, pinnedPublicKeyPem: string,
 *   id: string, version: string, archive: Uint8Array }} options
 */
export function verifyApprovedContentArchive({ envelope, pinnedPublicKeyPem,
  id, version, archive } = {}) {
  // Signed catalog authentication comes first; never trust release metadata
  // from a package, a query parameter, or an unsigned server response.
  const payload = verifySignedRegistryEnvelope(envelope, pinnedPublicKeyPem)
  const release = payload.releases.find(r => r.manifest.id === id &&
    r.manifest.version === version)
  if (!release || release.status !== "active") fail("No active signed release for this version")
  if (!(archive instanceof Uint8Array) || archive.byteLength !== release.size ||
      archive.byteLength < 32 || archive.byteLength > MAX_ARCHIVE) {
    fail("Archive size does not match the reviewed release")
  }
  const bytes = Buffer.from(archive)
  if (createHash("sha256").update(bytes).digest("hex") !== release.digest) {
    fail("SHA-256 mismatch against signed release metadata")
  }
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) fail("Expected gzip archive")
  let tar
  try { tar = gunzipSync(bytes, { maxOutputLength: MAX_UNPACKED }) }
  catch { return fail("Gzip archive failed validation or exceeds limits") }
  const files = parseFiles(tar)
  const manifestBytes = files.get("nextguide-addon.json")
  if (!manifestBytes || manifestBytes.length > 65_536) fail("Missing or oversized v1 manifest")
  let manifest
  try { manifest = JSON.parse(text(manifestBytes)) }
  catch { return fail("Invalid manifest JSON") }
  if (!object(manifest) || manifest.schemaVersion !== 1 ||
      manifest.id !== release.manifest.id || manifest.version !== release.manifest.version ||
      manifest.repository !== release.manifest.repository ||
      manifest.category !== "content" || !Array.isArray(manifest.permissions) ||
      manifest.permissions.length !== 0 || !object(manifest.entrypoints) ||
      manifest.entrypoints.content !== release.manifest.entrypoints?.content ||
      manifest.icon !== release.manifest.icon) {
    fail("Manifest does not match signed content-only release")
  }
  const icon = files.get(manifest.icon)
  if (!icon || icon.length < 45 || icon.length > MAX_FILE ||
      !icon.subarray(0, 8).equals(PNG) ||
      icon.subarray(12, 16).toString("ascii") !== "IHDR" ||
      icon.readUInt32BE(8) !== 13 ||
      icon.readUInt32BE(16) < 32 || icon.readUInt32BE(16) > 1024 ||
      icon.readUInt32BE(20) < 32 || icon.readUInt32BE(20) > 1024) {
    fail("Invalid add-on PNG icon")
  }
  const prefix = manifest.entrypoints.content + "/"
  if (!safeRelative(manifest.entrypoints.content) ||
      !safeRelative(manifest.icon)) fail("Unsafe manifest asset path")
  const pages = []
  for (const [path, data] of files) {
    if (path === "nextguide-addon.json" || path === manifest.icon) continue
    if (!path.startsWith(prefix) || !path.endsWith(".md") ||
        data.length > MAX_FILE || data.length === 0) {
      fail("Archive includes an unsupported file; v1 is Markdown-only")
    }
    const markdown = text(data)
    if (markdown.includes("\0")) fail("Binary content inside Markdown file")
    pages.push({ path, markdown })
  }
  if (pages.length < 1 || pages.length > 100) fail("Invalid content file count")
  // Arrays and buffers are fresh values owned by the caller. No host filesystem
  // path or executable entrypoint crosses this boundary.
  return {
    id: manifest.id, version: manifest.version,
    manifest, icon: { path: manifest.icon, bytes: Buffer.from(icon) }, pages,
  }
}
