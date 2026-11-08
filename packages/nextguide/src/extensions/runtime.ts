/**
 * Capability mediation for an OUT-OF-PROCESS extension runner.
 *
 * This is not a JS interpreter, process sandbox, or installer. The caller must
 * verify the signed registry release, apply owner grants, and provide an OS
 * isolation boundary before forwarding messages from third-party code.
 *
 * Never pass untrusted extension source to registerTrusted() or import().
 */
import {
  EXTENSION_CONTRIBUTIONS, validateExtensionManifest,
  type ExtensionCapability, type ExtensionContributionKind,
  type ExtensionManifest,
} from "./index.js"
import { validateExtensionView } from "./views.js"

export type ExtensionJson = null | boolean | string | number | ExtensionJson[] | {
  [key: string]: ExtensionJson
}

export interface ExtensionStorageAdapter {
  get(extensionId: string, key: string, signal?: AbortSignal): Promise<ExtensionJson | null>
  set(extensionId: string, key: string, value: ExtensionJson, signal?: AbortSignal): Promise<void>
  delete(extensionId: string, key: string, signal?: AbortSignal): Promise<void>
}

export type ExtensionNetworkRequest = {
  url: string
  method: "GET" | "POST"
  body?: ExtensionJson
}

export interface ExtensionNetworkAdapter {
  /**
   * Implementations MUST additionally pin resolved public IP addresses,
   * reject private/link-local ranges, disable redirects and cap response size.
   * URL checking in the broker is not an SSRF boundary against DNS rebinding.
   */
  request(extensionId: string, request: ExtensionNetworkRequest, signal: AbortSignal): Promise<ExtensionJson>
}

export type ExtensionApproval = {
  permissions: readonly ExtensionCapability[]
  /** Exact DNS names only; no wildcards, ports, IP literals, or local domains. */
  networkHosts?: readonly string[]
}

export interface ExtensionBrokerConfig {
  /** Trusted host callback: must verify signed release identity and owner grant. */
  authorize(manifest: ExtensionManifest, artifactSha256: string): Promise<ExtensionApproval | null> | ExtensionApproval | null
  storage?: ExtensionStorageAdapter
  network?: ExtensionNetworkAdapter
}

export type ExtensionRuntimeMessage = {
  id: string
  method: string
  params?: unknown
}

export type ExtensionRuntimeResponse =
  | { id: string; ok: true; result: ExtensionJson }
  | { id: string; ok: false; error: { code: string; message: string } }

export type ExtensionRuntimeContribution = {
  extensionId: string
  kind: ExtensionContributionKind
  descriptor: Record<string, ExtensionJson>
}

export interface ExtensionRuntimeSession {
  readonly extensionId: string
  handle(message: unknown): Promise<ExtensionRuntimeResponse>
  contributions(): ExtensionRuntimeContribution[]
  close(): void
}

export class ExtensionBrokerError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = "ExtensionBrokerError"
  }
}

const idPattern = /^[a-zA-Z0-9_-]{1,64}$/
const keyPattern = /^[a-z0-9][a-z0-9_-]{0,79}$/
const domainPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/
const shaPattern = /^[a-f0-9]{64}$/
const MAX_REQUEST_BYTES = 65536
const MAX_RESULT_BYTES = 65536

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function fail(code: string, message: string): never {
  throw new ExtensionBrokerError(code, message)
}

/**
 * Safe JSON copying avoids getters, prototype-poisoning properties, cycles,
 * non-finite numbers and unexpected executable JS values.
 */
export function sanitizeExtensionJson(input: unknown, maxBytes = MAX_REQUEST_BYTES): ExtensionJson {
  let nodes = 0
  function walk(value: unknown, depth: number): ExtensionJson {
    if (++nodes > 2000 || depth > 16) fail("INVALID_JSON", "JSON exceeds depth or item limits.")
    if (value === null || typeof value === "boolean") return value
    if (typeof value === "string") {
      if (value.length > maxBytes) fail("INVALID_JSON", "String exceeds limit.")
      return value
    }
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (Array.isArray(value)) {
      if (value.length > 256) fail("INVALID_JSON", "Array exceeds limit.")
      return value.map(item => walk(item, depth + 1))
    }
    if (!object(value)) fail("INVALID_JSON", "Only ordinary JSON data is accepted.")
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) fail("INVALID_JSON", "Non-JSON object.")
    const entries = Object.entries(Object.getOwnPropertyDescriptors(value))
    if (entries.length > 256) fail("INVALID_JSON", "Object exceeds key limit.")
    const output: Record<string, ExtensionJson> = Object.create(null)
    for (const [key, descriptor] of entries) {
      if (!key || key.length > 128 || ["__proto__", "prototype", "constructor"].includes(key)) {
        fail("INVALID_JSON", "Unsafe object property.")
      }
      if (!Object.hasOwn(descriptor, "value")) fail("INVALID_JSON", "Getters are not allowed.")
      output[key] = walk(descriptor.value, depth + 1)
    }
    return output
  }
  const safe = walk(input, 0)
  const size = new TextEncoder().encode(JSON.stringify(safe)).byteLength
  if (size > maxBytes) fail("INVALID_JSON", "JSON payload is too large.")
  return safe
}

function permissionOf(kind: unknown): ExtensionCapability {
  if (typeof kind !== "string" || !Object.hasOwn(EXTENSION_CONTRIBUTIONS, kind)) {
    fail("INVALID_CONTRIBUTION", "Unsupported contribution kind.")
  }
  return EXTENSION_CONTRIBUTIONS[kind as ExtensionContributionKind]
}

function permittedNetworkUrl(value: unknown, hosts: ReadonlySet<string>): string {
  if (typeof value !== "string" || value.length > 2048) fail("NETWORK_DENIED", "Invalid URL.")
  let url: URL
  try { url = new URL(value) } catch { return fail("NETWORK_DENIED", "Invalid URL.") }
  const host = url.hostname.toLowerCase()
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
    url.hash || !domainPattern.test(host) ||
    /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host) ||
    /^\d+(?:\.\d+){3}$/.test(host) || !hosts.has(host)) {
    fail("NETWORK_DENIED", "Network host is not authorized.")
  }
  return url.toString()
}

function normalKey(value: unknown): string {
  if (typeof value !== "string" || !keyPattern.test(value)) {
    fail("INVALID_KEY", "Use a lowercase storage key without path separators.")
  }
  return value
}

/**
 * The broker accepts messages from a separately isolated runner over an
 * external transport. Each session is bound to one verified extension and
 * never accepts a caller-supplied extension identity or capability grant.
 */
export function createExtensionBroker(config: ExtensionBrokerConfig) {
  if (!config || typeof config.authorize !== "function") {
    fail("CONFIGURATION", "The broker requires a trusted authorization callback.")
  }

  return {
    async openSession(manifestValue: unknown, artifactSha256: string): Promise<ExtensionRuntimeSession> {
      const checked = validateExtensionManifest(manifestValue)
      if (!checked.valid || !checked.manifest || !shaPattern.test(artifactSha256)) {
        fail("INVALID_MANIFEST", "Invalid extension manifest or artifact digest.")
      }
      const manifest = checked.manifest
      const approval = await config.authorize(manifest, artifactSha256)
      if (!approval || !Array.isArray(approval.permissions)) {
        fail("NOT_AUTHORIZED", "This extension has no verified owner approval.")
      }
      const declared = new Set(manifest.permissions)
      const granted = new Set<ExtensionCapability>()
      for (const permission of approval.permissions) {
        if (!declared.has(permission)) fail("NOT_AUTHORIZED", "Approval includes undeclared permissions.")
        granted.add(permission)
      }
      const hosts = new Set<string>()
      for (const name of approval.networkHosts ?? []) {
        if (typeof name !== "string" || !domainPattern.test(name) || name !== name.toLowerCase() ||
            /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(name) ||
            /^\d+(?:\.\d+){3}$/.test(name)) {
          fail("NOT_AUTHORIZED", "Invalid approved network domain.")
        }
        hosts.add(name)
      }
      if (hosts.size && !granted.has("network.fetch")) fail("NOT_AUTHORIZED", "Network destinations require network.fetch approval.")
      const extensionId = manifest.id
      const stored: ExtensionRuntimeContribution[] = []
      const controller = new AbortController()
      let closed = false
      let pending = 0

      function requirePermission(permission: ExtensionCapability) {
        if (!granted.has(permission) || !declared.has(permission)) {
          fail("PERMISSION_DENIED", "This capability is not approved.")
        }
      }

      async function dispatch(method: string, params: ExtensionJson): Promise<ExtensionJson> {
        if (method === "extension.info") {
          return { id: extensionId, version: manifest.version, apiVersion: 1 }
        }
        if (!object(params)) fail("INVALID_REQUEST", "Parameters must be an object.")
        if (method === "storage.get") {
          requirePermission("storage.read")
          if (!config.storage) fail("UNAVAILABLE", "Extension storage is not configured.")
          return sanitizeExtensionJson(await config.storage.get(extensionId, normalKey(params.key), controller.signal))
        }
        if (method === "storage.set") {
          requirePermission("storage.write")
          if (!config.storage) fail("UNAVAILABLE", "Extension storage is not configured.")
          const key = normalKey(params.key)
          const value = sanitizeExtensionJson(params.value, 32768)
          await config.storage.set(extensionId, key, value, controller.signal)
          return { written: true }
        }
        if (method === "storage.delete") {
          requirePermission("storage.write")
          if (!config.storage) fail("UNAVAILABLE", "Extension storage is not configured.")
          await config.storage.delete(extensionId, normalKey(params.key), controller.signal)
          return { deleted: true }
        }
        if (method === "network.request") {
          requirePermission("network.fetch")
          if (!config.network || !hosts.size) fail("UNAVAILABLE", "Extension network access is disabled.")
          const url = permittedNetworkUrl(params.url, hosts)
          const methodValue = params.method === undefined ? "GET" : params.method
          if (methodValue !== "GET" && methodValue !== "POST") {
            fail("NETWORK_DENIED", "Only GET and POST requests are supported.")
          }
          if (methodValue === "GET" && params.body !== undefined) {
            fail("NETWORK_DENIED", "GET requests cannot include a body.")
          }
          const body = methodValue === "POST" && params.body !== undefined
            ? sanitizeExtensionJson(params.body, 32768) : undefined
          const result = await config.network.request(extensionId, {
            url, method: methodValue, ...(body === undefined ? {} : { body })
          }, controller.signal)
          return sanitizeExtensionJson(result, MAX_RESULT_BYTES)
        }
        if (method === "contribution.publish") {
          const permission = permissionOf(params.kind)
          requirePermission(permission)
          const kind = params.kind as ExtensionContributionKind
          const raw = sanitizeExtensionJson(params.descriptor, 32768)
          if (!object(raw)) fail("INVALID_CONTRIBUTION", "Contribution must be a JSON object.")
          if (["ui.component", "mdx.block", "admin.page"].includes(kind)) {
            const checkedView = validateExtensionView(raw.view)
            if (!checkedView.valid) {
              fail("INVALID_CONTRIBUTION", "The view descriptor is invalid.")
            }
          }
          if (stored.length >= 64) fail("LIMIT_EXCEEDED", "Too many contributions.")
          stored.push({ extensionId, kind, descriptor: raw as Record<string, ExtensionJson> })
          return { published: true }
        }
        fail("UNKNOWN_METHOD", "Unsupported extension method.")
      }

      return {
        extensionId,
        async handle(input: unknown): Promise<ExtensionRuntimeResponse> {
          const message = object(input) ? input : {}
          const id = typeof message.id === "string" && idPattern.test(message.id) ? message.id : ""
          if (!id) return { id: "", ok: false, error: { code: "INVALID_REQUEST", message: "Invalid request identifier." } }
          if (closed) return { id, ok: false, error: { code: "SESSION_CLOSED", message: "Session has ended." } }
          if (pending >= 16) return { id, ok: false, error: { code: "LIMIT_EXCEEDED", message: "Too many pending messages." } }
          pending++
          try {
            const safe = sanitizeExtensionJson(input, MAX_REQUEST_BYTES)
            if (!object(safe) || typeof safe.method !== "string" || safe.method.length > 64) {
              fail("INVALID_REQUEST", "Invalid runtime method.")
            }
            const params = safe.params ?? {}
            const result = await dispatch(safe.method, params)
            if (closed) fail("SESSION_CLOSED", "Session has ended.")
            return { id, ok: true, result: sanitizeExtensionJson(result, MAX_RESULT_BYTES) }
          } catch (error) {
            const known = error instanceof ExtensionBrokerError ? error : null
            return { id, ok: false, error: {
              code: known?.code ?? "INTERNAL_ERROR",
              message: known?.message ?? "Extension service failed."
            } }
          } finally { pending-- }
        },
        contributions() {
          return closed ? [] : stored.map(item => ({
            extensionId: item.extensionId, kind: item.kind,
            descriptor: sanitizeExtensionJson(item.descriptor) as Record<string, ExtensionJson>
          }))
        },
        close() {
          if (closed) return
          closed = true
          controller.abort()
          stored.length = 0
        }
      }
    }
  }
}
