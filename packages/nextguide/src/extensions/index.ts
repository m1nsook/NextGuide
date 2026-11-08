/**
 * NextGuide's versioned extension contract.
 *
 * This module DOES NOT load or sandbox third-party JavaScript. It validates
 * metadata and coordinates explicitly trusted, host-supplied extensions.
 * Arbitrary code from registry packages must not be passed to this host.
 */
export const EXTENSION_API_VERSION = 1 as const

export const EXTENSION_CAPABILITIES = [
  "docs.pages",
  "mdx.blocks",
  "ui.components",
  "admin.pages",
  "theme.tokens",
  "icons.packs",
  "i18n.locales",
  "ai.providers",
  "auth.providers",
  "server.routes",
  "server.jobs",
  "storage.read",
  "storage.write",
  "network.fetch",
  "secrets.read",
] as const

export type ExtensionCapability = typeof EXTENSION_CAPABILITIES[number]

export const EXTENSION_CONTRIBUTIONS = {
  "docs.page": "docs.pages",
  "mdx.block": "mdx.blocks",
  "ui.component": "ui.components",
  "admin.page": "admin.pages",
  "theme.tokens": "theme.tokens",
  "icons.pack": "icons.packs",
  "i18n.locale": "i18n.locales",
  "ai.provider": "ai.providers",
  "auth.provider": "auth.providers",
  "server.route": "server.routes",
  "server.job": "server.jobs",
} as const satisfies Record<string, ExtensionCapability>

export type ExtensionContributionKind = keyof typeof EXTENSION_CONTRIBUTIONS
export type ExtensionState = "disabled" | "activating" | "active" | "deactivating"

export interface ExtensionManifest {
  schemaVersion: 1 | 2
  id: string
  name: string
  version: string
  category: string
  compatibility: { mode: "account"; nextguide: string }
  permissions: ExtensionCapability[]
  entrypoints: {
    content?: string
    client?: string
    server?: string
    admin?: string
    theme?: string
    locales?: string
  }
}

export type ExtensionIssue = {
  path: string
  code: string
  message: string
}

export type ExtensionValidation = {
  valid: boolean
  issues: ExtensionIssue[]
  manifest: ExtensionManifest | null
}

const capabilitySet = new Set<string>(EXTENSION_CAPABILITIES)
const allowedEntrypoints = new Set(["content", "client", "server", "admin", "theme", "locales"])
const identifier = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/
const semver = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/
const range = /^(?:(?:>=|<=|>|<|=)\d+\.\d+\.\d+)(?:\s+(?:>=|<=|>|<|=)\d+\.\d+\.\d+)*$/
const pathPattern = /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*$/

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function safeEntryPath(value: unknown): value is string {
  return typeof value === "string" && value.length <= 240 && pathPattern.test(value) &&
    value.split("/").every(part => part !== "." && part !== ".." && !part.startsWith(".") && !part.endsWith("."))
}

/**
 * Returns every issue instead of throwing on the first one.
 *
 * v1 content manifests remain recognized; v2 can declare future entrypoints
 * and capability requests, but validation does not grant permission to execute.
 */
export function validateExtensionManifest(value: unknown): ExtensionValidation {
  const issues: ExtensionIssue[] = []
  const issue = (path: string, code: string, message: string) => { issues.push({ path, code, message }) }
  if (!record(value)) {
    issue("$", "type", "Add-on manifest must be a JSON object.")
    return { valid: false, issues, manifest: null }
  }
  const schema = value.schemaVersion
  if (schema !== 1 && schema !== 2) issue("schemaVersion", "version", "Use manifest schemaVersion 1 or 2.")
  if (typeof value.id !== "string" || !identifier.test(value.id)) {
    issue("id", "identifier", "Use a publisher-qualified identifier such as acme.hello-world.")
  }
  if (typeof value.name !== "string" || value.name.trim().length < 3 || value.name.length > 80) {
    issue("name", "name", "A readable name must contain 3–80 characters.")
  }
  if (typeof value.version !== "string" || !semver.test(value.version)) {
    issue("version", "semver", "Use a stable major.minor.patch version.")
  }
  if (typeof value.category !== "string" || !value.category.trim() || value.category.length > 80) {
    issue("category", "category", "Add a descriptive add-on category.")
  }
  if (!record(value.compatibility)) {
    issue("compatibility", "type", "Declare Account Mode and an explicit NextGuide version range.")
  } else {
    if (value.compatibility.mode !== "account") issue("compatibility.mode", "mode", "Extensions currently target Account Mode only.")
    if (typeof value.compatibility.nextguide !== "string" || !range.test(value.compatibility.nextguide)) {
      issue("compatibility.nextguide", "range", "Declare an explicit range such as >=1.0.0 <2.0.0.")
    }
  }
  if (!Array.isArray(value.permissions)) {
    issue("permissions", "type", "Permissions must be an array.")
  } else {
    const seen = new Set<string>()
    for (const [index, item] of value.permissions.entries()) {
      if (typeof item !== "string" || !capabilitySet.has(item)) {
        issue(`permissions[${index}]`, "capability", "Unknown extension capability.")
      } else if (seen.has(item)) {
        issue(`permissions[${index}]`, "duplicate", "Capability is declared more than once.")
      } else seen.add(item)
    }
    if (schema === 1 && value.permissions.length > 0) {
      issue("permissions", "legacy", "Schema v1 supports content-only packages without permissions.")
    }
  }
  if (!record(value.entrypoints) || Object.keys(value.entrypoints).length === 0) {
    issue("entrypoints", "type", "Specify at least one add-on entrypoint.")
  } else {
    for (const [key, entry] of Object.entries(value.entrypoints)) {
      if (!allowedEntrypoints.has(key)) {
        issue("entrypoints." + key, "unsupported", "Unsupported extension entrypoint.")
      } else if (!safeEntryPath(entry)) {
        issue("entrypoints." + key, "path", "Use a safe, relative file or directory path without dot segments.")
      } else if (key === "server" || key === "client" || key === "admin") {
        if (!/\.(?:js|mjs)$/.test(entry)) {
          issue("entrypoints." + key, "build", "Use a compiled .js or .mjs entrypoint; no raw TypeScript execution.")
        }
      }
    }
    if (schema === 1 && (Object.keys(value.entrypoints).length !== 1 || !safeEntryPath(value.entrypoints.content))) {
      issue("entrypoints", "legacy", "Schema v1 supports only a Markdown content directory.")
    }
  }
  if (schema === 1 && value.category !== "content") {
    issue("category", "legacy", "Schema v1 supports the content category only.")
  }
  return { valid: issues.length === 0, issues,
    manifest: issues.length === 0 ? value as unknown as ExtensionManifest : null }
}

export class ExtensionHostError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = "ExtensionHostError"
  }
}

export interface ExtensionContext {
  readonly id: string
  hasPermission(permission: ExtensionCapability): boolean
  contribute(kind: ExtensionContributionKind, value: Record<string, unknown>): void
  onDeactivate(cleanup: () => void | Promise<void>): void
}

export interface TrustedExtension {
  readonly manifest: ExtensionManifest
  activate(context: ExtensionContext): void | Promise<void>
  deactivate?(): void | Promise<void>
}

export interface ExtensionContribution {
  readonly extensionId: string
  readonly kind: ExtensionContributionKind
  readonly value: Record<string, unknown>
}

interface ExtensionRecord {
  extension: TrustedExtension
  state: ExtensionState
  approved: Set<ExtensionCapability>
  contributions: ExtensionContribution[]
  cleanup: Array<() => void | Promise<void>>
}

function cloneContribution(value: Record<string, unknown>): Record<string, unknown> {
  if (!record(value)) throw new ExtensionHostError("Contribution must be an object.", "INVALID_CONTRIBUTION")
  // Contributions are data descriptors, not handlers or executable callbacks.
  // Reject cycles and functions rather than silently stripping them.
  let serialized: string
  try { serialized = JSON.stringify(value) } catch { throw new ExtensionHostError("Contribution is not JSON serializable.", "INVALID_CONTRIBUTION") }
  if (!serialized || serialized.length > 16384) throw new ExtensionHostError("Contribution exceeds the data limit.", "INVALID_CONTRIBUTION")
  const clone: unknown = JSON.parse(serialized)
  if (!record(clone) || Object.keys(value).some(key => !(key in clone))) {
    throw new ExtensionHostError("Contribution has unsupported data.", "INVALID_CONTRIBUTION")
  }
  return clone
}

/**
 * Registration is for HOST-TRUSTED modules supplied directly by the site owner.
 * This is deliberately NOT an untrusted JS loader or a sandbox. The future
 * isolated extension runner will validate packages before invoking any adapter.
 */
export function createExtensionHost() {
  const extensions = new Map<string, ExtensionRecord>()
  function get(id: string): ExtensionRecord {
    const value = extensions.get(id)
    if (!value) throw new ExtensionHostError("Extension not registered: " + id, "NOT_FOUND")
    return value
  }
  return {
    registerTrusted(extension: TrustedExtension): void {
      const result = validateExtensionManifest(extension?.manifest)
      if (!result.valid) {
        throw new ExtensionHostError("Invalid extension manifest: " + result.issues.map(x => x.path).join(", "), "INVALID_MANIFEST")
      }
      if (typeof extension.activate !== "function") throw new ExtensionHostError("Missing activation callback.", "INVALID_MODULE")
      if (extensions.has(extension.manifest.id)) throw new ExtensionHostError("Extension already registered.", "DUPLICATE_EXTENSION")
      extensions.set(extension.manifest.id, { extension, state: "disabled", approved: new Set(), contributions: [], cleanup: [] })
    },
    approve(id: string, permissions: readonly ExtensionCapability[]): void {
      const item = get(id)
      if (item.state !== "disabled") throw new ExtensionHostError("Disable the extension before changing permissions.", "ACTIVE_EXTENSION")
      const requested = new Set(item.extension.manifest.permissions)
      if (permissions.some(permission => !requested.has(permission))) throw new ExtensionHostError("Cannot grant undeclared permission.", "UNDECLARED_PERMISSION")
      item.approved = new Set(permissions)
    },
    async enable(id: string): Promise<void> {
      const item = get(id)
      if (item.state !== "disabled") throw new ExtensionHostError("Extension must be disabled first.", "INVALID_STATE")
      const missing = item.extension.manifest.permissions.filter(permission => !item.approved.has(permission))
      if (missing.length) throw new ExtensionHostError("Permission approval required: " + missing.join(", "), "PERMISSION_REQUIRED")
      item.state = "activating"
      const context: ExtensionContext = {
        id,
        hasPermission: permission => item.approved.has(permission) && item.extension.manifest.permissions.includes(permission),
        contribute(kind, value) {
          if (!(kind in EXTENSION_CONTRIBUTIONS)) throw new ExtensionHostError("Unsupported contribution kind.", "INVALID_CONTRIBUTION")
          const permission = EXTENSION_CONTRIBUTIONS[kind]
          if (!context.hasPermission(permission)) throw new ExtensionHostError("Contribution permission not approved.", "PERMISSION_REQUIRED")
          item.contributions.push({ extensionId: id, kind, value: cloneContribution(value) })
        },
        onDeactivate(callback) {
          if (typeof callback !== "function") throw new ExtensionHostError("Cleanup must be a function.", "INVALID_CLEANUP")
          item.cleanup.push(callback)
        }
      }
      try {
        await item.extension.activate(context)
        item.state = "active"
      } catch (error) {
        for (const callback of item.cleanup.reverse()) {
          try { await callback() } catch { /* preserve activation failure */ }
        }
        item.cleanup = []
        item.contributions = []
        item.state = "disabled"
        throw error
      }
    },
    async disable(id: string): Promise<void> {
      const item = get(id)
      if (item.state !== "active") throw new ExtensionHostError("Extension is not active.", "INVALID_STATE")
      item.state = "deactivating"
      let failure: unknown
      try { await item.extension.deactivate?.() } catch (error) { failure = error }
      for (const callback of item.cleanup.reverse()) {
        try { await callback() } catch (error) { failure ??= error }
      }
      item.cleanup = []
      item.contributions = []
      item.state = "disabled"
      if (failure) throw failure
    },
    unregister(id: string): void {
      const item = get(id)
      if (item.state !== "disabled") throw new ExtensionHostError("Disable before unregistering.", "ACTIVE_EXTENSION")
      extensions.delete(id)
    },
    list(): ReadonlyArray<{ id: string; version: string; state: ExtensionState; requested: readonly ExtensionCapability[]; approved: readonly ExtensionCapability[] }> {
      return [...extensions.entries()].map(([id, entry]) => ({
        id, version: entry.extension.manifest.version, state: entry.state,
        requested: [...entry.extension.manifest.permissions], approved: [...entry.approved]
      }))
    },
    contributions(kind?: ExtensionContributionKind): ExtensionContribution[] {
      return [...extensions.values()]
        .filter(entry => entry.state === "active")
        .flatMap(entry => entry.contributions)
        .filter(contribution => !kind || contribution.kind === kind)
        .map(contribution => ({ ...contribution, value: cloneContribution(contribution.value) }))
    }
  }
}
