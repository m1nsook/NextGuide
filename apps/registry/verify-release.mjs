// Read-only verification of public GitHub Release add-on archives.
// NEVER execute a package or extract an untrusted tarball to disk.
import { createHash } from "node:crypto"
import { gunzipSync } from "node:zlib"
import { validateManifest, validateIconBytes, hash } from "./lib.mjs"

const COMMIT = /^[a-f0-9]{40}$/i
const REPO = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/?$/
const SHA256 = /^[a-f0-9]{64}$/
const MAX_TGZ = 3 * 1024 * 1024
const MAX_RAW = 6 * 1024 * 1024
const decoder = new TextDecoder("utf-8", { fatal: true })
const field = (bytes) => decoder.decode(bytes.subarray(0, bytes.indexOf(0) === -1 ? bytes.length : bytes.indexOf(0)))
function requireSafePath(path) {
  if (!path || path.length > 240 || path.startsWith("/") || path.includes("\\") ||
    path.split("/").some(s => !s || s === "." || s === ".." || s.startsWith("."))) throw Error("Unsafe archive entry")
}
function octal(block) {
  const string = Buffer.from(block).toString("ascii").replace(/\0/g, "").trim()
  if (!/^[0-7]{1,12}$/.test(string)) throw Error("Invalid tar header size")
  return parseInt(string, 8)
}
export function unpackAddonTgz(bytes) {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes)
  if (bytes.length < 30 || bytes.length > MAX_TGZ) throw Error("Archive exceeds compressed size limit")
  let raw
  try { raw = gunzipSync(bytes, { maxOutputLength: MAX_RAW }) }
  catch { throw Error("Invalid or oversized gzipped tar archive") }
  const files = new Map()
  let offset = 0
  let ended = false
  while (offset + 512 <= raw.length) {
    const block = raw.subarray(offset, offset + 512)
    if (block.every(b => b === 0)) { ended = true; break }
    const type = block[156]
    if (type !== 0 && type !== 48) throw Error("Tar entry is not a regular file")
    if (block.subarray(345, 500).some(b => b !== 0)) throw Error("Tar prefixes are not supported")
    const name = field(block.subarray(0,100))
    requireSafePath(name)
    if (files.has(name)) throw Error("Duplicate tar entry")
    const size = octal(block.subarray(124,136))
    if (size > 262144) throw Error("Archive member too large")
    const start = offset + 512
    const end = start + size
    if (end > raw.length) throw Error("Truncated archive")
    const contents = raw.subarray(start,end)
    if (!name.endsWith(".png")) decoder.decode(contents)
    files.set(name, contents)
    if (files.size > 102) throw Error("Too many archive entries")
    offset = start + Math.ceil(size/512)*512
  }
  if (!ended || !files.has("nextguide-addon.json")) throw Error("Archive has no manifest or tar terminator")
  if (raw.subarray(offset).some(b => b !== 0)) throw Error("Unexpected trailing archive bytes")
  let manifest
  try { manifest = validateManifest(JSON.parse(files.get("nextguide-addon.json").toString("utf8"))) }
  catch (error) { throw Error("Invalid manifest: " + error.message) }
  const contentRoot = manifest.entrypoints.content + "/"
  if (manifest.entrypoints.content.startsWith("/") || manifest.entrypoints.content.includes("\\") ||
      manifest.entrypoints.content.split("/").some(s => !s || s === "." || s === "..")) throw Error("Unsafe content root")
  const icon=files.get(manifest.icon)
  if (!icon) throw Error("Manifest icon is missing from the archive")
  validateIconBytes(icon)
  let contentFiles = 0
  for (const [name] of files) {
    if (name === "nextguide-addon.json" || name === manifest.icon) continue
    if (!name.startsWith(contentRoot) || !name.endsWith(".md")) throw Error("Archive contains an unsupported file")
    contentFiles++
  }
  if (!contentFiles) throw Error("No Markdown pages in the archive")
  return { manifest, files }
}
const blobHash = bytes => createHash("sha1").update(Buffer.from("blob " + bytes.length + "\0")).update(bytes).digest("hex")
async function fetchBounded(url, { headers = {}, maxBytes = MAX_TGZ, hosts = ["api.github.com"] } = {}) {
  let current = new URL(url)
  for (let i = 0; i < 5; i++) {
    if (current.protocol !== "https:" || !hosts.some(host => current.hostname === host ||
      (host === "*.githubusercontent.com" && current.hostname.endsWith(".githubusercontent.com")))) throw Error("Untrusted GitHub download host")
    const r = await fetch(current, { headers: {
      "Accept":"application/vnd.github+json", "User-Agent":"nextguide-registry/1.0",
      "X-GitHub-Api-Version":"2022-11-28", ...headers
    }, redirect: "manual", signal: AbortSignal.timeout(12000) })
    if ([301,302,303,307,308].includes(r.status)) {
      const location = r.headers.get("location")
      if (!location) throw Error("Invalid asset redirect")
      current = new URL(location, current)
      continue
    }
    if (!r.ok) throw Error("GitHub request failed: HTTP " + r.status)
    if (Number(r.headers.get("content-length") || "0") > maxBytes) throw Error("GitHub response too large")
    const reader = r.body.getReader()
    let length = 0, chunks = []
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      length += next.value.byteLength
      if (length > maxBytes) { await reader.cancel(); throw Error("GitHub response exceeds size limit") }
      chunks.push(next.value)
    }
    return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), length)
  }
  throw Error("Too many GitHub redirects")
}
async function githubJSON(apiPath) {
  const raw = await fetchBounded("https://api.github.com/" + apiPath, { maxBytes: 512*1024 })
  return JSON.parse(raw.toString("utf8"))
}
export function validateSubmission(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("Invalid submission")
  const allowed = ["repository", "tag", "commit", "assetUrl", "sha256"]
  for (const k of Object.keys(input)) if (!allowed.includes(k)) throw Error("Unknown submission field " + k)
  if (typeof input.repository !== "string" || !REPO.test(input.repository)) throw Error("Invalid GitHub repository")
  if (typeof input.tag !== "string" || !/^v[0-9]+\.[0-9]+\.[0-9]+$/.test(input.tag)) throw Error("Release tag must use vX.Y.Z")
  if (!COMMIT.test(input.commit)) throw Error("Full Git commit SHA required")
  if (!SHA256.test(input.sha256)) throw Error("SHA-256 digest required")
  if (typeof input.assetUrl !== "string" || input.assetUrl.length > 500) throw Error("Invalid release asset URL")
  const path = new URL(input.assetUrl)
  if (path.protocol !== "https:" || path.hostname !== "github.com" ||
      !path.pathname.endsWith(".tgz") || path.search || path.hash) throw Error("Artifact must be a GitHub Release .tgz URL")
  const [, owner, repo] = REPO.exec(input.repository)
  const requiredPrefix = "/" + owner + "/" + repo + "/releases/download/" + input.tag + "/"
  if (!path.pathname.startsWith(requiredPrefix)) throw Error("Release asset must belong to the declared repository/tag")
  return { repository: "https://github.com/" + owner + "/" + repo,
    tag: input.tag, commit: input.commit.toLowerCase(), sha256: input.sha256,
    assetUrl: input.assetUrl, owner, repo }
}
export async function verifyReleaseSubmission(input) {
  const s = validateSubmission(input)
  const repoPath = "repos/" + encodeURIComponent(s.owner) + "/" + encodeURIComponent(s.repo)
  const release = await githubJSON(repoPath + "/releases/tags/" + encodeURIComponent(s.tag))
  if (release.draft || release.prerelease || release.tag_name !== s.tag) throw Error("Only published stable GitHub Releases are accepted")
  const commit = await githubJSON(repoPath + "/commits/" + encodeURIComponent(s.tag))
  if (commit.sha?.toLowerCase() !== s.commit || !/^[a-f0-9]{40}$/i.test(commit.commit?.tree?.sha || "")) throw Error("GitHub release tag does not resolve to submitted source commit")
  const asset = release.assets?.find(a => a.browser_download_url === s.assetUrl &&
    a.state === "uploaded" && a.name.endsWith(".tgz"))
  if (!asset || asset.size > MAX_TGZ || asset.size <= 30) throw Error("Release asset is missing or too large")
  const bytes = await fetchBounded(s.assetUrl, {
    hosts:["github.com", "*.githubusercontent.com"], maxBytes: MAX_TGZ,
    headers:{ Accept:"application/octet-stream" }
  })
  if (bytes.length !== asset.size || hash(bytes) !== s.sha256) throw Error("Asset size/digest mismatch")
  if (asset.digest?.startsWith("sha256:") && asset.digest.slice(7) !== s.sha256) throw Error("GitHub asset checksum mismatch")
  const { manifest, files } = unpackAddonTgz(bytes)
  if (manifest.version !== s.tag.slice(1) || manifest.repository.toLowerCase().replace(/\/$/, "") !== s.repository.toLowerCase()) {
    throw Error("Manifest version/repository differs from GitHub release")
  }
  const tree = await githubJSON(repoPath + "/git/trees/" + commit.commit.tree.sha + "?recursive=1")
  if (tree.truncated || !Array.isArray(tree.tree)) throw Error("GitHub source tree unavailable or truncated")
  const refs = new Map(tree.tree.filter(t => t.type === "blob").map(t => [t.path, t.sha]))
  for (const [path, content] of files) {
    if (refs.get(path) !== blobHash(content)) throw Error("Artifact differs from committed GitHub source: " + path)
  }
  return { manifest, repository: s.repository, commit: s.commit, tag: s.tag,
    assetUrl: s.assetUrl, digest: s.sha256, size: bytes.length, verifiedAt: new Date().toISOString() }
}
