// NextGuide registry v1: trusted, read-only distribution of content-only add-ons.
// Built-ins only. Private signing keys must NEVER be deployed with the server.
import { createHash, generateKeyPairSync, createPrivateKey, createPublicKey, sign, verify, randomBytes } from "node:crypto"
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, realpathSync, statSync } from "node:fs"
import { join, resolve, relative, sep, extname, isAbsolute } from "node:path"

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const COMMIT = /^[a-f0-9]{40}$/i
const DIGEST = /^[a-f0-9]{64}$/
const REPOSITORY = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/
const CATEGORIES = new Set(["content", "theme", "icons", "language", "ai", "oauth", "integration", "accessibility", "other"])
const MAX_INDEX = 2 * 1024 * 1024
const MAX_ARTIFACT = 3 * 1024 * 1024

export function hash(bytes) { return createHash("sha256").update(bytes).digest("hex") }
function fail(message) { throw new Error(message) }
function object(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(label + " must be an object")
}
function keys(obj, permitted, label) {
  for (const key of Object.keys(obj)) if (!permitted.includes(key)) fail(label + " has unsupported field " + key)
}
function field(value, label, min = 1, max = 2000) {
  if (typeof value !== "string" || value.length < min || value.length > max || !value.trim()) fail("Invalid " + label)
  return value
}
function regularFile(path, maxBytes) {
  const st = lstatSync(path)
  if (!st.isFile() || st.isSymbolicLink() || st.size > maxBytes) fail("Invalid or oversized file " + path)
}
function safeContentPath(root, path) {
  if (typeof path !== "string" || path.length > 160 || !path || isAbsolute(path) || path.includes("\\") ||
      path.split("/").some(part => !part || part === "." || part === ".." || part.startsWith("."))) fail("Unsafe add-on content path")
  const target = resolve(root, path)
  if (!target.startsWith(root + sep)) fail("Add-on content escapes source directory")
  if (realpathSync(target) !== target) fail("Symlinks are not permitted in add-on content")
  return target
}
export function parseSemver(version) {
  if (typeof version !== "string" || !SEMVER.test(version)) fail("Only stable major.minor.patch versions are supported by registry v1")
  return version.split(".").map(Number)
}
export function compareSemver(a, b) {
  const x = parseSemver(a), y = parseSemver(b)
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return Math.sign(x[i] - y[i])
  return 0
}
export function satisfiesRange(version, range) {
  parseSemver(version)
  if (typeof range !== "string" || range.length > 90) return false
  const clauses = range.trim().split(/\s+/)
  if (!clauses.length || clauses.length > 6) return false
  return clauses.every(clause => {
    const m = /^(>=|<=|>|<|=)(\d+\.\d+\.\d+)$/.exec(clause)
    if (!m) return false
    const cmp = compareSemver(version, m[2])
    return m[1] === ">=" ? cmp >= 0 : m[1] === "<=" ? cmp <= 0 :
      m[1] === ">" ? cmp > 0 : m[1] === "<" ? cmp < 0 : cmp === 0
  })
}
export function validateManifest(m) {
  object(m, "Manifest")
  keys(m, ["$schema","schemaVersion","id","name","summary","description","version","author","repository","license","category","icon","keywords","compatibility","permissions","entrypoints"], "Manifest")
  if (m.schemaVersion !== 1) fail("Unsupported manifest schema")
  field(m.id, "id", 3, 100)
  if (!ID.test(m.id)) fail("Invalid add-on id")
  field(m.name, "name", 3, 80)
  field(m.summary, "summary", 8, 160)
  field(m.description, "description", 12, 2000)
  parseSemver(m.version)
  object(m.author, "Author")
  keys(m.author, ["name", "url"], "Author")
  field(m.author.name, "author.name", 2, 100)
  if (m.author.url !== undefined) {
    const url = new URL(field(m.author.url, "author.url"))
    if (url.protocol !== "https:") fail("Author URL must be HTTPS")
  }
  if (!REPOSITORY.test(field(m.repository, "repository", 20, 240))) fail("Repository must be a GitHub HTTPS URL")
  field(m.license, "license", 2, 80)
  field(m.icon, "icon", 5, 160)
  const iconParts = m.icon.split("/")
  if (!m.icon.endsWith(".png") || iconParts.some((part,i) => !/^[A-Za-z0-9_-]+$/.test(i === iconParts.length-1 ? part.slice(0,-4) : part))) {
    fail("Icon must be a safe relative PNG file")
  }
  if (!CATEGORIES.has(m.category) || m.category !== "content") fail("Registry v1 supports content add-ons only")
  if (!Array.isArray(m.keywords) || m.keywords.length < 1 || m.keywords.length > 12 ||
      new Set(m.keywords).size !== m.keywords.length ||
      !m.keywords.every(k => typeof k === "string" && /^[a-z0-9][a-z0-9-]{1,39}$/.test(k))) fail("Invalid keywords")
  object(m.compatibility, "Compatibility")
  keys(m.compatibility, ["mode", "nextguide"], "Compatibility")
  if (m.compatibility.mode !== "account") fail("Add-ons must target Account Mode")
  if (!satisfiesRange("1.0.0", m.compatibility.nextguide) &&
      !/^(?:(?:>=|<=|>|<|=)\d+\.\d+\.\d+)(?:\s+(?:>=|<=|>|<|=)\d+\.\d+\.\d+)*$/.test(m.compatibility.nextguide)) {
    fail("Invalid compatibility range")
  }
  if (!Array.isArray(m.permissions) || m.permissions.length) fail("Executable permissions are not supported")
  object(m.entrypoints, "Entrypoints")
  keys(m.entrypoints, ["content"], "Entrypoints")
  field(m.entrypoints.content, "entrypoints.content", 1, 160)
  return m
}

export function validateIconBytes(input) {
  const bytes=Buffer.from(input)
  if (bytes.length < 45 || bytes.length > 256 * 1024 ||
      !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ||
      bytes.readUInt32BE(8) !== 13 || bytes.toString("ascii",12,16) !== "IHDR") fail("Invalid PNG icon")
  const width=bytes.readUInt32BE(16), height=bytes.readUInt32BE(20)
  if (width < 32 || height < 32 || width > 1024 || height > 1024) fail("PNG icon dimensions must be 32–1024 px")
  let pos=8, chunks=0, ended=false
  while (pos+12<=bytes.length && chunks++ < 300) {
    const size=bytes.readUInt32BE(pos), type=bytes.toString("ascii",pos+4,pos+8)
    if (size>bytes.length-pos-12 || !/^[A-Za-z]{4}$/.test(type)) fail("Broken PNG icon chunks")
    const next=pos+size+12
    if (type==="IEND") {
      if (size!==0 || next!==bytes.length) fail("Unexpected bytes after PNG icon")
      ended=true
      break
    }
    pos=next
  }
  if (!ended) fail("PNG icon has no terminator")
  return { width, height }
}

export function packReviewedSource(directory) {
  const root = realpathSync(resolve(directory))
  const manifestFile = join(root, "nextguide-addon.json")
  regularFile(manifestFile, 64 * 1024)
  const manifest = validateManifest(JSON.parse(readFileSync(manifestFile, "utf8")))
  const iconPath=safeContentPath(root,manifest.icon)
  regularFile(iconPath,256*1024)
  const iconBytes=readFileSync(iconPath)
  validateIconBytes(iconBytes)
  const contentRoot = safeContentPath(root, manifest.entrypoints.content)
  if (!lstatSync(contentRoot).isDirectory()) fail("Content entrypoint is not a directory")
  const files = []
  let total = 0
  function walk(dir) {
    if (!lstatSync(dir).isDirectory()) fail("Unexpected content entry")
    for (const dirent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, dirent.name)
      if (dirent.isSymbolicLink()) fail("Content symlinks are forbidden")
      if (dirent.isDirectory()) { walk(full); continue }
      if (!dirent.isFile() || extname(dirent.name) !== ".md") fail("Content-only registry accepts .md files only")
      const path = relative(contentRoot, full).split(sep).join("/")
      safeContentPath(contentRoot, path)
      regularFile(full, 256 * 1024)
      const bytes = readFileSync(full)
      total += bytes.byteLength
      if (total > 2 * 1024 * 1024 || files.length >= 100) fail("Content package exceeds limits")
      const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
      files.push({ path, content })
    }
  }
  walk(contentRoot)
  if (!files.length) fail("An add-on must have at least one Markdown page")
  files.sort((a,b) => a.path.localeCompare(b.path, "en"))
  return { manifest, archive: { schemaVersion: 1, id: manifest.id, version: manifest.version, icon: { path: manifest.icon, base64: iconBytes.toString("base64") }, files } }
}
export function keyId(publicPem) {
  return hash(createPublicKey(publicPem).export({ type: "spki", format: "der" })).slice(0, 24)
}
export function generateSigningKeys(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const privateFile = join(directory, "registry.private.pem")
  const publicFile = join(directory, "registry.public.pem")
  if (existsSync(privateFile) || existsSync(publicFile)) fail("Refusing to overwrite existing signing keys")
  const keys = generateKeyPairSync("ed25519")
  const privatePem = keys.privateKey.export({ type: "pkcs8", format: "pem" })
  const publicPem = keys.publicKey.export({ type: "spki", format: "pem" })
  writeFileSync(privateFile, privatePem, { mode: 0o600, flag: "wx" })
  writeFileSync(publicFile, publicPem, { mode: 0o644, flag: "wx" })
  return { privateFile, publicFile, keyId: keyId(publicPem) }
}
function signedEnvelope(payload, privatePem) {
  const privateKey = createPrivateKey(privatePem)
  if (privateKey.asymmetricKeyType !== "ed25519") fail("Signing key must be Ed25519")
  const publicPem = createPublicKey(privateKey).export({ type: "spki", format: "pem" })
  const body = Buffer.from(JSON.stringify(payload), "utf8")
  return { schemaVersion: 1, algorithm: "Ed25519", keyId: keyId(publicPem),
    body: body.toString("base64url"), signature: sign(null, body, privateKey).toString("base64url") }
}
export function verifyEnvelope(envelope, publicPem) {
  object(envelope, "Signed registry")
  keys(envelope, ["schemaVersion","algorithm","keyId","body","signature"], "Signed registry")
  if (envelope.schemaVersion !== 1 || envelope.algorithm !== "Ed25519" || envelope.keyId !== keyId(publicPem)) fail("Wrong registry signing key or format")
  if (typeof envelope.body !== "string" || typeof envelope.signature !== "string" ||
      envelope.body.length > MAX_INDEX * 2) fail("Invalid signed registry envelope")
  const body = Buffer.from(envelope.body, "base64url")
  if (body.length > MAX_INDEX) fail("Registry index too large")
  const signature = Buffer.from(envelope.signature, "base64url")
  if (signature.length !== 64 || !verify(null, body, createPublicKey(publicPem), signature)) fail("Registry signature verification failed")
  const payload = JSON.parse(body.toString("utf8"))
  object(payload, "Registry payload")
  keys(payload, ["schemaVersion","updatedAt","releases"], "Registry payload")
  if (payload.schemaVersion !== 1 || !Array.isArray(payload.releases) || payload.releases.length > 20000) fail("Invalid signed registry payload")
  const seen = new Set()
  for (const release of payload.releases) {
    object(release, "Release")
    keys(release, ["manifest","commit","digest","approvedAt","reviewer","status","assetUrl","size","tag"], "Release")
    const m = validateManifest(release.manifest)
    if (!COMMIT.test(release.commit) || !DIGEST.test(release.digest) ||
        !["active", "revoked"].includes(release.status)) fail("Invalid signed release")
    if (release.assetUrl !== undefined) {
      if (typeof release.assetUrl !== "string" || !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/releases\/download\/v[0-9]+\.[0-9]+\.[0-9]+\/[A-Za-z0-9_.-]+\.tgz$/.test(release.assetUrl)) fail("Invalid release asset URL")
      if (!Number.isInteger(release.size) || release.size < 32 || release.size > 3 * 1024 * 1024) fail("Invalid release asset size")
      if (release.tag !== "v" + m.version) fail("Invalid release tag")
    }
    field(release.reviewer, "reviewer", 2, 100)
    if (!Number.isFinite(Date.parse(release.approvedAt))) fail("Invalid release approval date")
    const key = m.id + "@" + m.version
    if (seen.has(key)) fail("Duplicate registry release")
    seen.add(key)
  }
  return payload
}
export function readRegistry(dataDir, publicPem) {
  const path = join(resolve(dataDir), "index.json")
  regularFile(path, MAX_INDEX * 2)
  const envelope = JSON.parse(readFileSync(path, "utf8"))
  return { envelope, payload: verifyEnvelope(envelope, publicPem) }
}
function saveAtomic(file, contents) {
  mkdirSync(resolve(file, ".."), { recursive: true, mode: 0o750 })
  if (existsSync(file) && (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink())) fail("Refusing to replace non-regular file")
  const tmp = file + "." + randomBytes(8).toString("hex") + ".tmp"
  writeFileSync(tmp, contents, { flag: "wx", mode: 0o640 })
  renameSync(tmp, file)
}
export function initializeRegistry(dataDir, privatePem) {
  const path = join(resolve(dataDir), "index.json")
  if (existsSync(path)) fail("Registry already exists")
  const payload = { schemaVersion: 1, updatedAt: new Date().toISOString(), releases: [] }
  saveAtomic(path, JSON.stringify(signedEnvelope(payload, privatePem)) + "\n")
  return payload
}
function mutation(dataDir, privatePem, change) {
  const publicPem = createPublicKey(createPrivateKey(privatePem)).export({ type: "spki", format: "pem" })
  const existing = readRegistry(dataDir, publicPem).payload
  const releases = structuredClone(existing.releases)
  const outcome = change(releases)
  const payload = { schemaVersion: 1, updatedAt: new Date().toISOString(), releases }
  saveAtomic(join(resolve(dataDir), "index.json"), JSON.stringify(signedEnvelope(payload, privatePem)) + "\n")
  return outcome
}
export function publishReviewedAddon(dataDir, privatePem, directory, commit, reviewer) {
  if (!COMMIT.test(commit)) fail("A full 40-character reviewed Git commit SHA is required")
  field(reviewer, "reviewer", 2, 100)
  const { manifest, archive } = packReviewedSource(directory)
  const encoded = Buffer.from(JSON.stringify(archive) + "\n")
  if (encoded.length > MAX_ARTIFACT) fail("Artifact exceeds limit")
  const digest = hash(encoded)
  return mutation(dataDir, privatePem, releases => {
    if (releases.some(r => r.manifest.id === manifest.id && r.manifest.version === manifest.version)) fail("Version already registered; releases are immutable")
    const prev = releases.filter(r => r.manifest.id === manifest.id)
    if (prev.some(r => r.manifest.repository !== manifest.repository)) fail("Add-on id cannot change source repository")
    if (prev.some(r => compareSemver(manifest.version, r.manifest.version) <= 0)) fail("Version must be greater than previous releases")
    const artifactPath = join(resolve(dataDir), "artifacts", digest + ".json")
    mkdirSync(join(resolve(dataDir), "artifacts"), { recursive: true, mode: 0o750 })
    if (existsSync(artifactPath)) {
      regularFile(artifactPath, MAX_ARTIFACT)
      if (hash(readFileSync(artifactPath)) !== digest) fail("Existing artifact has wrong digest")
    } else writeFileSync(artifactPath, encoded, { flag: "wx", mode: 0o640 })
    const release = { manifest, commit: commit.toLowerCase(), digest,
      approvedAt: new Date().toISOString(), reviewer, status: "active" }
    releases.push(release)
    return release
  })
}
export function revokeRelease(dataDir, privatePem, id, version) {
  return mutation(dataDir, privatePem, releases => {
    const release = releases.find(r => r.manifest.id === id && r.manifest.version === version)
    if (!release) fail("Release not found")
    if (release.status !== "active") fail("Release already revoked")
    release.status = "revoked"
    return release
  })
}
export function readArtifact(dataDir, digest, registry) {
  if (!DIGEST.test(digest)) fail("Invalid artifact digest")
  if (!registry.releases.some(r => r.status === "active" && r.digest === digest)) fail("Artifact not approved or revoked")
  const path = join(resolve(dataDir), "artifacts", digest + ".json")
  regularFile(path, MAX_ARTIFACT)
  const data = readFileSync(path)
  if (hash(data) !== digest) fail("Artifact checksum mismatch")
  return data
}

// Remote-approved releases use GitHub Releases for durable artifact hosting.
// Only reviewed metadata is stored on the VPS, inside the signed index.
export function publishRemoteApprovedRelease(dataDir, privatePem, verified, reviewer) {
  field(reviewer, "reviewer", 2, 100)
  const manifest = validateManifest(verified.manifest)
  if (!COMMIT.test(verified.commit) || !DIGEST.test(verified.digest) ||
      !Number.isInteger(verified.size) || verified.size < 32 || verified.size > 3 * 1024 * 1024 ||
      verified.tag !== "v" + manifest.version) fail("Invalid approved release metadata")
  const release = { manifest, commit: verified.commit.toLowerCase(), digest: verified.digest,
    tag: verified.tag, assetUrl: verified.assetUrl, size: verified.size,
    approvedAt: new Date().toISOString(), reviewer, status: "active" }
  return mutation(dataDir, privatePem, releases => {
    if (releases.some(r => r.manifest.id === manifest.id && r.manifest.version === manifest.version)) fail("Version already published; releases are immutable")
    const others = releases.filter(r => r.manifest.id === manifest.id)
    if (others.some(r => r.manifest.repository.toLowerCase() !== manifest.repository.toLowerCase())) fail("Publisher repository mismatch")
    if (others.some(r => compareSemver(manifest.version, r.manifest.version) <= 0)) fail("Release version must increase")
    releases.push(release)
    return release
  })
}
