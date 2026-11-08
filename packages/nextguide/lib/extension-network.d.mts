import type { ExtensionNetworkAdapter } from "../dist/extensions/runtime.js"
export declare function isPublicExtensionIPv4(ip: unknown): boolean
/** Restricted, Node-only HTTPS adapter for use by the trusted host. */
export declare function createRestrictedExtensionHttpsAdapter(options?: {
  /** Host-level ceiling; broker authorizes each extension independently. */
  allowedHosts?: string[]
  timeoutMs?: number
  maxResponseBytes?: number
  /** Trusted host/test injection only, never supplied by an extension. */
  resolver?: (host: string, options: {family: number; all: boolean; verbatim: boolean}) =>
    Promise<Array<{ address: string; family: number }>>
  /** Trusted host/test injection only, never supplied by an extension. */
  transport?: (...args: any[]) => any
}): ExtensionNetworkAdapter
