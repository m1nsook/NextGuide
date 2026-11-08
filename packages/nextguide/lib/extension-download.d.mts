/** Host-only verified v1 content artifact downloader; never exposed to add-ons. */
export declare function downloadVerifiedContentRelease(options: {
  envelope: unknown
  pinnedPublicKeyPem: string
  id: string
  version: string
  /** Trusted test/host overrides, never add-on supplied. */
  resolver?: (host: string, opts: { family: number; all: boolean; verbatim: boolean }) =>
    Promise<Array<{ address: string; family: number }>>
  transport?: (...args: any[]) => any
  signal?: AbortSignal
  timeoutMs?: number
}): Promise<Buffer>
