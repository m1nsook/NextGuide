import type { ExtensionStorageAdapter } from "../dist/extensions/runtime.js"

/**
 * Node-only private storage for the host's capability broker.
 * Use an absolute private directory outside the Next.js public/source tree.
 */
export declare function createExtensionFileStorage(storageRoot: string): ExtensionStorageAdapter
