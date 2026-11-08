import { createServer } from "node:http"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { readRegistry, compareSemver, parseSemver, satisfiesRange } from "./lib.mjs"
import { handleRegistryWrites } from "./submissions.mjs"
import { createCloudflareAccessVerifier } from "./access.mjs"

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer", "Cross-Origin-Resource-Policy": "cross-origin",
  "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Cache-Control": "public, max-age=30"
}
function respond(res, method, status, body, headers = {}) {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body) + "\n")
  res.writeHead(status, { ...HEADERS, "Content-Length": String(data.byteLength), ...headers })
  res.end(method === "HEAD" ? undefined : data)
}
function latestFor(id, releases, includeRevoked = false) {
  return releases.filter(r => r.manifest.id === id && (includeRevoked || r.status === "active"))
    .sort((a,b) => compareSemver(b.manifest.version, a.manifest.version))
}
function catalogItem(release) {
  const { manifest, digest, commit, approvedAt, status } = release
  return { id: manifest.id, name: manifest.name, summary: manifest.summary, description: manifest.description,
    category: manifest.category, author: manifest.author, repository: manifest.repository,
    license: manifest.license, keywords: manifest.keywords, version: manifest.version,
    icon: { path: manifest.icon, url: "https://raw.githubusercontent.com/" +
      new URL(manifest.repository).pathname.slice(1).replace(/\/$/,"") + "/" + commit + "/" + manifest.icon },
    compatibility: manifest.compatibility, permissions: manifest.permissions,
    artifact: { sha256: digest, url: release.assetUrl || null, size: release.size || null },
    commit, approvedAt, status }
}
function catalog(releases) {
  const latest = new Map()
  for (const r of releases) {
    if (r.status !== "active") continue
    const prev = latest.get(r.manifest.id)
    if (!prev || compareSemver(r.manifest.version, prev.manifest.version) > 0) latest.set(r.manifest.id, r)
  }
  return [...latest.values()].map(catalogItem).sort((a,b) => a.name.localeCompare(b.name, "en"))
}
function invalidQuery(url, allowed) {
  return [...url.searchParams.keys()].some(k => !allowed.includes(k) || url.searchParams.getAll(k).length !== 1)
}
export function createRegistryHandler(options) {
  const { dataDir, publicKey } = options
  const argumentsContext = options
  if (!dataDir || !publicKey) throw Error("Registry data directory and pinned public key required")
  return async (req, res) => {
    // Protect /admin at the origin, even when a request bypasses Cloudflare.
    // Without explicit Access verification the dashboard always fails closed.
    let requestedPath = ""
    try { requestedPath = new URL(req.url || "", "http://127.0.0.1").pathname } catch {}
    if (requestedPath === "/admin" || requestedPath.startsWith("/admin/")) {
      let authorized = false
      try { authorized = !!options.accessVerifier && await options.accessVerifier(req) }
      catch { authorized = false }
      if (!authorized) return respond(res, req.method || "GET", 403,
        { error: "Cloudflare Access authorization required" }, { "Cache-Control": "no-store" })
    }
    try { if (await handleRegistryWrites(req, res, argumentsContext)) return }
    catch (error) { console.error("[nextguide-registry] Route error:", error.message); return respond(res, req.method || "GET", 500, {error:"Internal server error"}) }
    const method = req.method || "GET"
    if (method === "OPTIONS") { res.writeHead(204, { ...HEADERS, "Content-Length": "0" }); return res.end() }
    if (method !== "GET" && method !== "HEAD") return respond(res, method, 405, { error: "Method not allowed" }, { Allow: "GET, HEAD, OPTIONS" })
    if (!req.url || req.url.length > 2048) return respond(res, method, 414, { error: "Request URL too long" })
    let url
    try { url = new URL(req.url, "http://127.0.0.1") }
    catch { return respond(res, method, 400, { error: "Invalid URL" }) }
    const path = url.pathname
    try {
      const { envelope, payload } = readRegistry(dataDir, publicKey)
      if ((path === "/healthz" || path === "/v1/health") && !url.search) {
        return respond(res, method, 200, { ok: true, service: "nextguide-registry", schemaVersion: 1 }, { "Cache-Control": "no-store" })
      }
      if (path === "/v1/registry" && !url.search) {
        return respond(res, method, 200, envelope, { "Cache-Control": "public, max-age=15" })
      }
      if (path === "/v1/addons") {
        if (invalidQuery(url, ["q", "category", "limit", "offset", "nextguide"])) return respond(res, method, 400, { error: "Invalid query" })
        const search = (url.searchParams.get("q") || "").toLowerCase().trim()
        const category = url.searchParams.get("category")
        const nextguide = url.searchParams.get("nextguide")
        const limit = url.searchParams.get("limit") || "20"
        const offset = url.searchParams.get("offset") || "0"
        if (search.length > 80 || (category && !/^[a-z]{2,30}$/.test(category)) ||
          !/^\d{1,3}$/.test(limit) || +limit < 1 || +limit > 50 ||
          !/^\d{1,6}$/.test(offset) || +offset > 100000) return respond(res, method, 400, { error: "Invalid filters" })
        if (nextguide) try { parseSemver(nextguide) } catch { return respond(res, method, 400, { error: "Invalid NextGuide version" }) }
        const list = catalog(payload.releases).filter(item => {
          if (category && item.category !== category) return false
          if (nextguide && !satisfiesRange(nextguide, item.compatibility.nextguide)) return false
          if (search && !(item.name + " " + item.summary + " " + item.id + " " + item.keywords.join(" ")).toLowerCase().includes(search)) return false
          return true
        })
        return respond(res, method, 200, { items: list.slice(+offset, +offset + +limit),
          total: list.length, limit: +limit, offset: +offset })
      }
      const detail = /^\/v1\/addons\/([a-z0-9.-]+)(?:\/(versions|updates))?$/.exec(path)
      if (detail) {
        const [, id, operation] = detail
        if (id.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return respond(res, method, 404, { error: "Not found" })
        const versions = latestFor(id, payload.releases, true)
        if (!versions.length) return respond(res, method, 404, { error: "Add-on not found" })
        if (operation === "versions") {
          if (url.search) return respond(res, method, 400, { error: "Unexpected query" })
          return respond(res, method, 200, { id, versions: versions.map(catalogItem) })
        }
        if (operation === "updates") {
          if (invalidQuery(url, ["from", "nextguide"])) return respond(res, method, 400, { error: "Invalid query" })
          const from = url.searchParams.get("from"), nextguide = url.searchParams.get("nextguide")
          try { parseSemver(from); parseSemver(nextguide) }
          catch { return respond(res, method, 400, { error: "Specify valid from and nextguide versions" }) }
          const upgrade = versions.find(r => r.status === "active" &&
            compareSemver(r.manifest.version, from) > 0 &&
            satisfiesRange(nextguide, r.manifest.compatibility.nextguide))
          return respond(res, method, 200, { id, from, nextguide, update: upgrade ? catalogItem(upgrade) : null })
        }
        if (url.search) return respond(res, method, 400, { error: "Unexpected query" })
        const current = versions.find(r => r.status === "active")
        return current ? respond(res, method, 200, { ...catalogItem(current), versions: versions.map(r => ({ version: r.manifest.version, status: r.status })) })
          : respond(res, method, 410, { error: "All add-on versions revoked" })
      }
      return respond(res, method, 404, { error: "Not found" }, { "Cache-Control": "no-store" })
    } catch (error) {
      console.error("[nextguide-registry] Registry unavailable:", error instanceof Error ? error.message : "unknown")
      return respond(res, method, 503, { error: "Registry metadata unavailable" }, { "Cache-Control": "no-store" })
    }
  }
}
export function createRegistryServer(options) { return createServer(createRegistryHandler(options)) }
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const dataDir = process.env.NG_REGISTRY_DATA_DIR
  const keyPath = process.env.NG_REGISTRY_PUBLIC_KEY_FILE
  const host = process.env.NG_REGISTRY_HOST || "127.0.0.1"
  const port = Number(process.env.NG_REGISTRY_PORT || "4389")
  if (!dataDir || !keyPath || !Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("Set NG_REGISTRY_DATA_DIR and NG_REGISTRY_PUBLIC_KEY_FILE; optional NG_REGISTRY_HOST and NG_REGISTRY_PORT")
    process.exit(1)
  }
  const publicKey = readFileSync(keyPath, "utf8")
  readRegistry(dataDir, publicKey) // Refuse traffic with invalid or missing signed index.
  const privateKeyPath = process.env.NG_REGISTRY_PRIVATE_KEY_FILE
  const privateKey = privateKeyPath ? readFileSync(privateKeyPath, "utf8") : null
  const adminSecret = process.env.NG_REGISTRY_ADMIN_SECRET || null
  const sessionSecret = process.env.NG_REGISTRY_SESSION_SECRET || null
  const origin = process.env.NG_REGISTRY_PUBLIC_ORIGIN || null
  const webhook = process.env.NG_REGISTRY_DISCORD_WEBHOOK_URL || null
  const teamDomain = process.env.NG_CF_ACCESS_TEAM_DOMAIN
  const audience = process.env.NG_CF_ACCESS_AUD
  const accessVerifier = teamDomain && audience
    ? createCloudflareAccessVerifier({ teamDomain, audience }) : null
  if (!accessVerifier) console.warn("[nextguide-registry] /admin disabled: Cloudflare Access not configured")
  const server = createRegistryServer({ dataDir, publicKey, privateKey, adminSecret,
    sessionSecret, origin, webhook, accessVerifier })
  server.listen(port, host, () => console.log("[nextguide-registry] Listening on " + host + ":" + port))
}
