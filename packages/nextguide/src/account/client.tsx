"use client"

import * as React from "react"
import { ArrowRight, CheckCircle2, Copy, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react"
import { LogoMark } from "../components/site/logo.js"
import { AccountProviders } from "./providers.js"
import { AccountThemeMenu } from "./theme-menu.js"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.js"
import { Button } from "./ui/button.js"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "./ui/card.js"
import { Checkbox } from "./ui/checkbox.js"
import { Input } from "./ui/input.js"
import { Label } from "./ui/label.js"
import { Separator } from "./ui/separator.js"

interface AccountStatus { initialized: boolean; authenticated: boolean }
type Phase = "token" | "verify" | "recovery" | "login"

async function accountAction(action: string, payload: Record<string, string>): Promise<{ qrDataUrl?: string; manualKey?: string; recoveryCodes?: string[] }> {
  const response = await fetch("/api/nextguide/account/" + action, {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  })
  const result: { error?: string; qrDataUrl?: string; manualKey?: string; recoveryCodes?: string[] } = await response.json()
  if (!response.ok) throw new Error(result.error || `Account request failed (${response.status}).`)
  return result
}

/** Rebuilt shadcn/Base UI access screens, retaining the existing secure API. */
export function AccountAccess({ mode }: { mode: "setup" | "login" }) {
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const [phase, setPhase] = React.useState<Phase>(mode === "setup" ? "token" : "login")
  const [token, setToken] = React.useState("")
  const [code, setCode] = React.useState("")
  const [useRecovery, setUseRecovery] = React.useState(false)
  const [qr, setQr] = React.useState("")
  const [manualKey, setManualKey] = React.useState("")
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[]>([])
  const [acknowledged, setAcknowledged] = React.useState(false)

  React.useEffect(() => {
    let active = true
    fetch("/api/nextguide/account/status", { cache: "no-store", credentials: "same-origin" })
      .then(async response => {
        if (!response.ok) throw new Error("Account storage is unavailable. Check server logs.")
        return response.json() as Promise<AccountStatus>
      })
      .then(status => {
        if (!active) return
        if (status.authenticated) window.location.replace("/admin")
        else if (mode === "setup" && status.initialized) window.location.replace("/login")
        else if (mode === "login" && !status.initialized) window.location.replace("/setup")
        else setLoading(false)
      })
      .catch((e: unknown) => { if (active) { setError(e instanceof Error ? e.message : "Could not load account status."); setLoading(false) } })
    return () => { active = false }
  }, [mode])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError("")
    try {
      if (phase === "token") {
        const result = await accountAction("begin", { token })
        setQr(result.qrDataUrl || ""); setManualKey(result.manualKey || ""); setCode(""); setPhase("verify")
      } else if (phase === "verify") {
        const result = await accountAction("finish", { token, code: code.trim() })
        setToken(""); setCode(""); setRecoveryCodes(result.recoveryCodes || []); setPhase("recovery")
      } else if (phase === "login") {
        await accountAction("login", { code: code.trim() })
        window.location.replace("/admin")
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Account request failed.") }
    finally { setBusy(false) }
  }

  return <AccountProviders>
    <main className="ng-account-root flex min-h-svh flex-col bg-background px-4 py-8 text-foreground">
      <header className="mx-auto flex w-full max-w-sm items-center justify-between pb-10">
        <a href="/docs" className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight"><LogoMark className="size-7"/>NextGuide</a>
        <AccountThemeMenu />
      </header>
      <div className="mx-auto my-auto w-full max-w-sm pb-12">
        <Card>
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
              {phase === "recovery" ? <ShieldCheck className="size-5" /> : phase === "verify" ? <KeyRound className="size-5" /> : <LockKeyhole className="size-5" />}
            </div>
            <CardTitle className="text-2xl tracking-tight">{phase === "token" ? "Set up your account" : phase === "verify" ? "Connect an authenticator" : phase === "recovery" ? "Save recovery codes" : "Sign in to NextGuide"}</CardTitle>
            <CardDescription>{phase === "token" ? "Enter the one-time token printed in your terminal." : phase === "verify" ? "Scan the QR code, then enter your current 6-digit code." : phase === "recovery" ? "Store these single-use recovery codes somewhere safe before continuing." : useRecovery ? "Enter an unused recovery code." : "Enter the 6-digit code from your authenticator."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground" role="status">Checking account status…</p>}
            {error && <Alert variant="destructive" role="alert"><AlertTitle>Something went wrong</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
            {!loading && phase === "recovery" && <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-4"><pre className="whitespace-pre-wrap break-all font-mono text-xs leading-7" aria-label="Single-use recovery codes">{recoveryCodes.join("\n")}</pre></div>
              <Button variant="outline" className="w-full" onClick={() => navigator.clipboard?.writeText(recoveryCodes.join("\n"))}><Copy className="size-4"/>Copy recovery codes</Button>
              <div className="flex items-center gap-3"><Checkbox id="ng-account-saved" checked={acknowledged} onCheckedChange={checked => setAcknowledged(checked === true)}/><Label htmlFor="ng-account-saved" className="text-sm">I saved these recovery codes</Label></div>
              <Button className="w-full" disabled={!acknowledged} onClick={() => window.location.assign("/admin")}><CheckCircle2 className="size-4"/>Open dashboard</Button>
            </div>}
            {!loading && phase !== "recovery" && <form onSubmit={submit} className="space-y-4">
              {phase === "verify" && <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/20 p-4">
                <img src={qr} width={220} height={220} alt="Authenticator enrollment QR code" className="rounded-md bg-white p-2" />
                <p className="text-xs text-muted-foreground">Can't scan? Use the setup key below.</p>
                <code className="max-w-full break-all text-center font-mono text-xs">{manualKey}</code>
              </div>}
              {phase === "token" ? <div className="space-y-2"><Label htmlFor="ng-account-token">One-time setup token</Label><Input id="ng-account-token" type="password" autoComplete="off" autoFocus value={token} onChange={e => setToken(e.target.value)} placeholder="Paste token from terminal" required /></div>
                : <div className="space-y-2"><Label htmlFor="ng-account-code">{useRecovery && phase === "login" ? "Recovery code" : "Authenticator code"}</Label><Input id="ng-account-code" autoFocus value={code} onChange={e => setCode(e.target.value)} placeholder={useRecovery && phase === "login" ? "NG-XXXX-XXXX-XXXX-XXXX-XXXX" : "000000"} inputMode={useRecovery && phase === "login" ? "text" : "numeric"} autoComplete={useRecovery ? "off" : "one-time-code"} pattern={useRecovery && phase === "login" ? "NG-[A-Fa-f0-9]{4}(-[A-Fa-f0-9]{4}){4}" : "[0-9]{6}"} required /></div>}
              <Button type="submit" className="w-full" disabled={busy || (phase === "verify" && code.length !== 6)}>{busy ? "Verifying…" : phase === "token" ? "Continue" : phase === "verify" ? "Verify authenticator" : "Sign in"}<ArrowRight className="size-4" /></Button>
              {phase === "login" && <Button type="button" variant="link" className="w-full" onClick={() => { setUseRecovery(!useRecovery);setCode("");setError("") }}>{useRecovery ? "Use authenticator instead" : "Use a recovery code"}</Button>}
              {phase === "verify" && <Button type="button" variant="link" className="w-full" onClick={() => { setPhase("token");setQr("");setManualKey("");setCode("") }}>Start setup again</Button>}
            </form>}
          </CardContent>
          <CardFooter className="flex flex-col gap-3"><Separator /><p className="text-center text-xs text-muted-foreground">Protected by your authenticator. No email or password required.</p></CardFooter>
        </Card>
      </div>
    </main>
  </AccountProviders>
}
