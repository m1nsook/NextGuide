"use client"

import { useEffect, useState, type FormEvent } from "react"
import { LogoMark } from "../components/site/logo.js"

type AccountStatus = { initialized: boolean; authenticated: boolean }
type Phase = "token" | "verify" | "recovery" | "login"

async function send(action: string, payload: Record<string, string>) {
  const response = await fetch("/api/nextguide/account/" + action, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || "Account request failed.")
  return result
}

export function AccountAccess({ mode }: { mode: "setup" | "login" }) {
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState("")
  const [phase, setPhase] = useState<Phase>(mode === "setup" ? "token" : "login")
  const [token, setToken] = useState("")
  const [code, setCode] = useState("")
  const [useRecovery, setUseRecovery] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [manualKey, setManualKey] = useState("")
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let active = true
    fetch("/api/nextguide/account/status", { cache: "no-store", credentials: "same-origin" })
      .then(async response => {
        if (!response.ok) throw new Error("Account storage is unavailable. Check the server logs.")
        return response.json() as Promise<AccountStatus>
      })
      .then(status => {
        if (!active) return
        if (status.authenticated) window.location.replace("/admin")
        else if (mode === "setup" && status.initialized) window.location.replace("/login")
        else if (mode === "login" && !status.initialized) window.location.replace("/setup")
        else setLoading(false)
      })
      .catch(e => { if (active) { setError(e.message); setLoading(false) } })
    return () => { active = false }
  }, [mode])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (working) return
    setWorking(true)
    setError("")
    try {
      if (phase === "token") {
        const result = await send("begin", { token })
        setQrDataUrl(result.qrDataUrl)
        setManualKey(result.manualKey)
        setCode("")
        setPhase("verify")
      } else if (phase === "verify") {
        const result = await send("finish", { token, code: code.trim() })
        setToken("")
        setCode("")
        setRecoveryCodes(result.recoveryCodes)
        setPhase("recovery")
      } else if (phase === "login") {
        await send("login", { code: code.trim() })
        window.location.replace("/admin")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally { setWorking(false) }
  }

  const setup = mode === "setup"
  return (
    <main className="ng-account-page">
      <div className="ng-account-background" aria-hidden="true" />
      <section className="ng-account-card" aria-label={setup ? "NextGuide setup" : "NextGuide sign in"}>
        <div className="ng-account-logo" aria-hidden="true"><LogoMark className="ng-account-icon" /></div>
        <span className="ng-account-kicker">NEXTGUIDE / ACCOUNT MODE</span>
        <h1>{setup ? "Make your docs yours." : "Welcome back."}</h1>
        <p className="ng-account-lead">
          {phase === "token" && "Enter the one-time setup token shown in your terminal. Only the server owner can register."}
          {phase === "verify" && "Scan this QR code with your authenticator, then enter the current six-digit code."}
          {phase === "recovery" && "Your authenticator is connected. Save these recovery codes before continuing."}
          {phase === "login" && (useRecovery ? "Enter one unused recovery code to access your documentation editor." : "Open your authenticator and enter the six-digit NextGuide code.")}
        </p>

        {loading ? <p className="ng-account-note" role="status">Checking account status…</p> : null}
        {!loading && phase === "recovery" ? (
          <div className="ng-account-recovery">
            <p className="ng-account-warning">Each recovery code works only once. Store them offline, separately from your phone. You will not see this list again.</p>
            <pre className="ng-account-codes" aria-label="Single-use account recovery codes">{recoveryCodes.join("\n")}</pre>
            <button className="ng-account-secondary" type="button" onClick={() => navigator.clipboard?.writeText(recoveryCodes.join("\n"))}>Copy recovery codes</button>
            <label className="ng-account-check">
              <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} />
              I saved these recovery codes in a safe place.
            </label>
            <a className={saved ? "ng-account-submit" : "ng-account-submit ng-account-disabled"} href={saved ? "/admin" : undefined} aria-disabled={!saved}>Open dashboard</a>
          </div>
        ) : null}
        {!loading && phase !== "recovery" ? (
          <form onSubmit={submit} className="ng-account-form">
            {phase === "verify" ? (
              <div className="ng-account-qr">
                {/* This QR image is generated on the server; it never contacts a third-party QR service. */}
                <img src={qrDataUrl} width={248} height={248} alt="Authenticator setup QR code" />
                <p>Cannot scan? Add this key manually:</p>
                <code className="ng-account-secret">{manualKey}</code>
              </div>
            ) : null}
            {phase === "token" ? (
              <label>One-time terminal token
                <input value={token} onChange={e => setToken(e.target.value)} placeholder="Paste the setup token" type="password" autoComplete="off" autoFocus required />
              </label>
            ) : (
              <label>{useRecovery && phase === "login" ? "Recovery code" : "Authenticator code"}
                <input value={code} onChange={e => setCode(e.target.value)} placeholder={useRecovery && phase === "login" ? "NG-XXXX-XXXX-XXXX-XXXX-XXXX" : "000000"} inputMode={useRecovery && phase === "login" ? "text" : "numeric"} autoComplete={useRecovery ? "off" : "one-time-code"} pattern={useRecovery && phase === "login" ? "NG-[A-Fa-f0-9]{4}(-[A-Fa-f0-9]{4}){4}" : "[0-9]{6}"} required autoFocus />
              </label>
            )}
            <button className="ng-account-submit" disabled={working || (phase === "verify" && code.length !== 6)}>
              {working ? "Verifying…" : phase === "token" ? "Continue to QR setup" : phase === "verify" ? "Verify authenticator" : "Sign in"}
            </button>
            {phase === "login" ? <button className="ng-account-link" type="button" onClick={() => { setUseRecovery(!useRecovery); setCode(""); setError("") }}>{useRecovery ? "Use authenticator instead" : "Lost your phone? Use a recovery code"}</button> : null}
            {phase === "verify" ? <button className="ng-account-link" type="button" onClick={() => { setPhase("token"); setCode(""); setQrDataUrl(""); setManualKey("") }}>Start QR setup again</button> : null}
          </form>
        ) : null}
        {error && <p className="ng-account-error" role="alert">{error}</p>}
        <p className="ng-account-footer">No password. No email required. Protected by your authenticator.</p>
      </section>
    </main>
  )
}
