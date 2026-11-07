/** Node.js-only Account Mode API. Server modules must never be imported by client components. */
export declare const ACCOUNT_COOKIE: "ng_account_session"
export declare class AccountError extends Error {
  status: number
  retryAfter: number
  constructor(message: string, status?: number, retryAfter?: number)
}
export declare function accountFile(project?: string, dataDir?: string): string
export declare function createBootstrap(project?: string, options?: { dataDir?: string }): { token: string; file: string }
export declare function rotateBootstrap(project?: string): { token: string; file: string }
export declare function base32Encode(data: Uint8Array): string
export declare function totp(secret: string, time?: number): string
export declare function matchingTotpStep(secret: string, code: string, time?: number, minimum?: number): number | null
export declare function otpUri(secret: string, label?: string, issuer?: string): string
export declare function accountStatus(project?: string, sessionToken?: string): { initialized: boolean; authenticated: boolean }
export declare function verifySession(project?: string, token?: string): boolean
export declare function beginEnrollment(project: string, bootstrapToken: string, options?: { time?: number; qr?: (uri: string) => Promise<string> }): Promise<{ manualKey: string; qrDataUrl: string }>
export declare function finishEnrollment(project: string, bootstrapToken: string, code: string, time?: number): { session: string; recoveryCodes: string[] }
export declare function signIn(project: string, code: string, time?: number): { session: string; usedRecovery: boolean }
export declare function signOut(project: string, sessionToken?: string): void
export declare function sameOrigin(request: { url: string; headers: { get(name: string): string | null } }, configuredUrl?: string): boolean
export declare function beginAuthenticatorRotation(project: string, session: string, code: string, options?: { time?: number; qr?: (uri: string) => Promise<string> }): Promise<{ manualKey: string; qrDataUrl: string }>
export declare function finishAuthenticatorRotation(project: string, session: string, code: string, time?: number): { session: string; recoveryCodes: string[] }
export declare function renewRecoveryCodes(project: string, session: string, code: string, time?: number): { recoveryCodes: string[] }
export declare function revokeAllSessions(project: string, session: string): { ok: boolean }
