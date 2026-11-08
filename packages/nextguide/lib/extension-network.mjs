/**
 * Host-only HTTPS egress for NextGuide extension capability mediation.
 *
 * Never expose this adapter or the Node HTTPS module to add-on code.
 * The broker must separately authorize exact networkHosts per extension.
 *
 * IPv4-only by design: resolve every A record, reject unsafe answers, and
 * pin one approved address for the outbound TLS socket. Never enable
 * automatic redirects or proxy-based address re-resolution here.
 */
import { lookup as dnsLookup } from "node:dns/promises"
import { request as httpsRequest } from "node:https"
import { isIP } from "node:net"
import { sanitizeExtensionJson } from "../dist/extensions/runtime.js"

const MAX_RESPONSE = 65_536
const MAX_REQUEST = 32_768
const DOMAIN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/
const RESERVED_DOMAIN = /(?:^|\.)(?:localhost|local|internal|test|invalid|onion|lan|home|arpa)$/
const blocks = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
]
function ipNumber(ip) {
  return ip.split(".").reduce((acc, octet) => (((acc << 8) | Number(octet)) >>> 0), 0)
}

/** Publicly routable IPv4 only. Fail closed for unknown or reserved ranges. */
export function isPublicExtensionIPv4(ip) {
  if (typeof ip !== "string" || isIP(ip) !== 4) return false
  const value = ipNumber(ip)
  return !blocks.some(([prefix, length]) => {
    const mask = (0xffffffff << (32 - length)) >>> 0
    return (value & mask) === (ipNumber(prefix) & mask)
  })
}
function validHost(value) {
  return typeof value === "string" && value.length <= 253 &&
    value === value.toLowerCase() && DOMAIN.test(value) &&
    !RESERVED_DOMAIN.test(value) && !isIP(value)
}
function aborted() { return Error("Extension request aborted or timed out") }
function raceAbort(promise, signal) {
  if (signal.aborted) return Promise.reject(aborted())
  return new Promise((resolve, reject) => {
    const onAbort = () => { reject(aborted()) }
    signal.addEventListener("abort", onAbort, { once: true })
    Promise.resolve(promise).then(
      value => { signal.removeEventListener("abort", onAbort); resolve(value) },
      error => { signal.removeEventListener("abort", onAbort); reject(error) },
    )
  })
}
function ensureUrl(raw, allowed) {
  if (typeof raw !== "string" || raw.length > 2048) throw Error("Invalid extension URL")
  let url
  try { url = new URL(raw) } catch { throw Error("Invalid extension URL") }
  const host = url.hostname.toLowerCase()
  if (url.protocol !== "https:" || !validHost(host) || !allowed.has(host) ||
      url.port || url.username || url.password || url.hash) {
    throw Error("Extension URL is not on an approved HTTPS host")
  }
  return url
}

/**
 * Trusted network adapter. allowedHosts is a host-level security ceiling;
 * the extension broker separately enforces per-extension owner grants.
 *
 * resolver and transport overrides are only for trusted host tests and must
 * never come from a marketplace package.
 */
export function createRestrictedExtensionHttpsAdapter({
  allowedHosts = [],
  timeoutMs = 8_000,
  maxResponseBytes = MAX_RESPONSE,
  resolver = dnsLookup,
  transport = httpsRequest,
} = {}) {
  if (!Array.isArray(allowedHosts) || allowedHosts.some(name => !validHost(name))) {
    throw Error("Invalid host-level HTTPS allowlist")
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    throw Error("Invalid extension HTTPS timeout")
  }
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > MAX_RESPONSE) {
    throw Error("Invalid extension response size limit")
  }
  if (typeof resolver !== "function" || typeof transport !== "function") {
    throw Error("Trusted network resolver and transport are required")
  }
  const allowed = new Set(allowedHosts)

  return {
    async request(_extensionId, query, signal) {
      if (!query || typeof query !== "object") throw Error("Invalid extension request")
      const url = ensureUrl(query.url, allowed)
      if (query.method !== "GET" && query.method !== "POST") {
        throw Error("Only GET and POST are supported")
      }
      if (query.method === "GET" && query.body !== undefined) throw Error("GET requests cannot include bodies")
      const body = query.method === "POST" && query.body !== undefined
        ? Buffer.from(JSON.stringify(sanitizeExtensionJson(query.body, MAX_REQUEST)), "utf8")
        : undefined
      if (body && body.byteLength > MAX_REQUEST) throw Error("Extension request body too large")
      const timer = AbortSignal.timeout(timeoutMs)
      const activeSignal = signal ? AbortSignal.any([signal, timer]) : timer
      if (activeSignal.aborted) throw aborted()

      // Resolve A records once. A mixed public/private result fails closed.
      const answers = await raceAbort(resolver(url.hostname, {
        family: 4, all: true, verbatim: true,
      }), activeSignal)
      if (!Array.isArray(answers) || answers.length < 1 || answers.length > 32 ||
          answers.some(answer => !answer || answer.family !== 4 ||
            !isPublicExtensionIPv4(answer.address))) {
        throw Error("Extension DNS returned an unsafe or invalid address")
      }
      const address = answers[0].address
      if (activeSignal.aborted) throw aborted()

      return await new Promise((resolve, reject) => {
        let settled = false
        function finish(error, result) {
          if (settled) return
          settled = true
          if (error) reject(error)
          else resolve(result)
        }
        // Keep the hostname for SNI and certificate verification. The only
        // IP used by the socket is the vetted public IP from DNS resolution.
        const options = {
          protocol: "https:",
          hostname: url.hostname,
          servername: url.hostname,
          path: url.pathname + url.search,
          port: 443,
          method: query.method,
          agent: false,
          family: 4,
          autoSelectFamily: false,
          rejectUnauthorized: true,
          signal: activeSignal,
          lookup(_name, _options, callback) { callback(null, address, 4) },
          headers: {
            accept: "application/json",
            ...(body ? { "content-type": "application/json", "content-length": String(body.length) } : {}),
          },
        }
        let req
        try {
          req = transport(options, response => {
            const status = response.statusCode ?? 0
            const contentType = response.headers?.["content-type"] ?? ""
            const declaredSize = Number(response.headers?.["content-length"] ?? 0)
            if (status < 200 || status >= 300 ||
                !/^application\/(?:json|[a-z0-9.+-]+\+json)(?:;|$)/i.test(contentType) ||
                !Number.isFinite(declaredSize) || declaredSize > maxResponseBytes) {
              response.resume()
              finish(Error("Extension HTTPS response denied"))
              return
            }
            const chunks = []
            let bytes = 0
            response.on("error", error => finish(error))
            response.on("data", part => {
              bytes += part.length
              if (bytes > maxResponseBytes) {
                response.destroy()
                finish(Error("Extension HTTPS response exceeds limit"))
              } else chunks.push(Buffer.from(part))
            })
            response.on("end", () => {
              if (settled) return
              try {
                const decoded = new TextDecoder("utf-8", { fatal: true })
                  .decode(Buffer.concat(chunks))
                finish(null, sanitizeExtensionJson(JSON.parse(decoded), maxResponseBytes))
              } catch {
                finish(Error("Extension HTTPS response is not valid JSON"))
              }
            })
          })
          req.on("error", error => finish(error))
          req.end(body)
        } catch (error) { finish(error) }
      })
    },
  }
}
