#!/usr/bin/env node
// Manual release acceptance: browser checks the generated Next.js docs site
// keeps ONE browser document across internal links (no full-page flash).
// Node 22+, Chrome/Chromium. No Playwright, GitHub Actions, or cloud services.
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const startingUrl = process.env.NEXTGUIDE_TEST_URL || process.argv[2]
if (!startingUrl) {
  console.error("Usage: NEXTGUIDE_TEST_URL=http://127.0.0.1:3000/docs node scripts/verify-docs-navigation-browser.mjs")
  process.exit(2)
}
const starting = new URL(startingUrl)
if (starting.protocol !== "http:" && starting.protocol !== "https:") throw Error("Expected a served documentation website.")
const prefix = starting.pathname.replace(/\/+$/, "") || "/"
const profile = mkdtempSync(join(tmpdir(), "nextguide-browser-"))
const chrome = process.env.NEXTGUIDE_CHROME || process.env.CHROME_PATH || (process.platform === "win32"
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : "chromium")
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(fn, label, timeout = 25000) {
  const start = Date.now()
  let lastError = null
  while (Date.now() - start < timeout) {
    try { const result = await fn(); if (result) return result }
    catch (error) { lastError = error }
    await pause(125)
  }
  throw Error("Timed out waiting for " + label + (lastError ? ": " + lastError.message : ""))
}

let child
let socket
try {
  const args = ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", "--remote-allow-origins=*", "--user-data-dir=" + profile, "about:blank"]
  if (typeof process.getuid === "function" && process.getuid() === 0) args.unshift("--no-sandbox")
  child = spawn(chrome, args, { stdio: "ignore" })
  let spawnError = null
  child.on("error", error => { spawnError = error })
  const port = await until(() => {
    if (spawnError) throw spawnError
    const file = join(profile, "DevToolsActivePort")
    if (!existsSync(file)) return 0
    return Number(readFileSync(file, "utf8").split("\n")[0])
  }, "local Chromium debug port")
  const tabs = await fetch("http://127.0.0.1:" + port + "/json/list").then(x => x.json())
  const tab = tabs.find(value => value.type === "page")
  assert.ok(tab?.webSocketDebuggerUrl, "Chromium did not expose a page target")
  socket = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true })
    socket.addEventListener("error", reject, { once: true })
  })
  let sequence = 1
  const pending = new Map()
  socket.addEventListener("message", event => {
    let value
    try { value = JSON.parse(event.data) } catch { return }
    if (value.id && pending.has(value.id)) {
      const { resolve, reject } = pending.get(value.id)
      pending.delete(value.id)
      if (value.error) reject(Error(JSON.stringify(value.error)))
      else resolve(value.result)
    }
  })
  async function command(method, params = {}) {
    const id = sequence++
    return Promise.race([
      new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        socket.send(JSON.stringify({ id, method, params }))
      }),
      pause(10000).then(() => { if (pending.has(id)) throw Error("Chrome DevTools command timed out: " + method) }),
    ])
  }
  async function evaluate(expression) {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw Error("Browser JavaScript error: " + result.exceptionDetails.text)
    return result.result?.value
  }
  await command("Page.enable")
  await command("Runtime.enable")
  await command("Page.navigate", { url: starting.href })
  await until(async () => await evaluate("document.readyState") === "complete" &&
    await evaluate('Boolean(document.querySelector("[data-slot=docs-nav] a[href]"))'), "documentation page")

  // Give the Next.js client router time to hydrate before clicking.
  await pause(850)
  const candidateLinks = await evaluate('Array.from(document.querySelectorAll("[data-slot=docs-nav] a[href]")).map(a => ({href: a.href, label: a.textContent?.trim() || ""}))')
  const candidates = candidateLinks.filter(link => {
    const url = new URL(link.href)
    return url.origin === starting.origin && url.pathname !== starting.pathname &&
      (prefix === "/" || url.pathname === prefix || url.pathname.startsWith(prefix + "/"))
  })
  assert.ok(candidates.length >= 2, "Need at least two navigable documentation pages for the release check.")
  const destination = new URL(candidates[0].href)
  const backDestination = new URL(candidates[1].href)
  const mark = "ng-rel-" + process.pid + "-" + Date.now()
  await evaluate("window.__nextguideDocumentMarker = " + JSON.stringify(mark) +
    '; window.__nextguideSidebarNode = document.querySelector("aside"); true')

  async function clickTo(url) {
    const found = await evaluate('(function(){const match=Array.from(document.querySelectorAll("[data-slot=docs-nav] a[href]")).find(a => new URL(a.href).pathname===' + JSON.stringify(url.pathname) + ');if(!match) return false;match.click();return true})()')
    assert.ok(found, "Missing sidebar link: " + url.pathname)
    await until(async () => (await evaluate("location.pathname")) === url.pathname, "route " + url.pathname)
    assert.equal(await evaluate("window.__nextguideDocumentMarker"), mark,
      "FULL PAGE RELOAD detected navigating to " + url.pathname + ". A Next.js client transition must preserve window state.")
    assert.equal(await evaluate('document.querySelector("aside") === window.__nextguideSidebarNode'), true,
      "Sidebar was remounted during route transition to " + url.pathname)
    assert.equal(await evaluate('document.body.innerText.includes("Loading documentation…")'), false,
      "Visible loading documentation placeholder leaked into the user site.")
  }
  await clickTo(destination)
  await clickTo(backDestination)
  await evaluate("history.back()")
  await until(async () => (await evaluate("location.pathname")) === destination.pathname, "browser Back")
  assert.equal(await evaluate("window.__nextguideDocumentMarker"), mark, "Browser Back caused a full page reload.")
  console.log("PASS: Developer Mode navigation kept the same document, sidebar, and dark/light theme state.")
  console.log("Checked sidebar transitions and browser Back on " + starting.origin + " (Chrome/Chromium).")
} finally {
  try { socket?.close() } catch {}
  try { child?.kill() } catch {}
  rmSync(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 200 })
}
