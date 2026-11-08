import type { ExtensionBrokerConfig, ExtensionRuntimeSession } from "../dist/extensions/runtime.js"
import type { ExtensionManifest } from "../dist/extensions/index.js"
import type { ChildProcess } from "node:child_process"

export interface IsolatedExtensionHandle {
  readonly extensionId: string
  readonly active: boolean
  contributions(): ReturnType<ExtensionRuntimeSession["contributions"]>
  stop(): void
}

/**
 * Linux-only prototype; requires bubblewrap, prlimit, dedicated non-root
 * deployment and explicitly supported namespace confinement. Windows and
 * unsupported configurations always fail closed.
 */
export declare function createLinuxExtensionRunner(options: {
  broker: { openSession(
    manifest: unknown, artifactSha256: string
  ): Promise<ExtensionRuntimeSession> }
  bubblewrap?: string
  prlimit?: string
  node?: string
  startupMs?: number
  lifetimeMs?: number
  cpuSeconds?: number
  addressSpaceBytes?: number
  /** Trusted host testing hook only; never populated by an add-on. */
  spawn?: (...args: any[]) => ChildProcess
}): {
  start(options: {
    manifest: ExtensionManifest
    /** Single compiled ES module; no unsigned archives or installer hooks. */
    code: string
    /** Exact SHA-256 of UTF-8 code. Must be approved by trusted broker. */
    artifactSha256: string
  }): Promise<IsolatedExtensionHandle>
}
