/**
 * Type-only contract for hooks used by the optional Next.js App Router bridge.
 * The host project's Next.js implementation supplies the real hooks at runtime.
 */
export declare function usePathname(): string | null
export declare function useRouter(): {
  push(href: string): void
  prefetch(href: string): void
}
