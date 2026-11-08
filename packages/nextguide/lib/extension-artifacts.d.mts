/** Read-only, signature-bound verification of currently approved content v1 .tgz archives. */
export declare function verifyApprovedContentArchive(options: {
  /** Actual signed registry envelope, not an unsigned release row. */
  envelope: unknown
  /** Pinned by the installed site owner, never fetched from the index itself. */
  pinnedPublicKeyPem: string
  id: string
  version: string
  /** Untrusted downloaded bytes. No extraction or code execution occurs. */
  archive: Uint8Array
}): {
  id: string
  version: string
  manifest: Record<string, unknown>
  icon: { path: string; bytes: Buffer }
  /** Render with a Markdown engine that disables raw HTML. Never compile as MDX. */
  pages: Array<{ path: string; markdown: string }>
}
