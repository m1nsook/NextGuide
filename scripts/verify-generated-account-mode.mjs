// Full Account Mode acceptance test: packed npm consumer, Next.js server, TOTP, CMS and media.
// Explicit/manual only: bun run compat:account. Does not trigger GitHub Actions.
import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { spawn, spawnSync } from "node:child_process"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const workspace = fileURLToPath(new URL("../", import.meta.url))
const sourcePackage = join(workspace, "packages", "nextguide")
const { version } = JSON.parse(readFileSync(join(sourcePackage, "package.json"), "utf8"))
const nextVersion = process.env.NEXTGUIDE_NEXT_VERSION ?? "16.4.5"
const root = mkdtempSync(join(tmpdir(), "nextguide-account-smoke-"))
const project = join(root, "consumer")
const store = join(root, "private")
const tarball = join(root, `nextguide-${version}.tgz`)
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXTGUIDE_DATA_DIR: store }

function run(command, args, cwd = project, overrides = {}) {
  const p = spawnSync(command, args, {
    cwd, env: { ...env, ...overrides }, encoding: "utf8", maxBuffer: 20 * 1024 * 1024,
  })
  if (p.error || p.status !== 0)
    throw new Error(`${command} ${args.join(" ")} failed:\n${p.stdout}\n${p.stderr}\n${p.error ?? ""}`)
  return p.stdout
}
async function openPort() {
  const server = createServer()
  await new Promise((ok, fail) => server.once("error", fail).listen(0, "127.0.0.1", ok))
  const port = server.address().port
  await new Promise((ok, fail) => server.close(error => error ? fail(error) : ok()))
  return port
}
async function ready(origin, proc) {
  for (let i = 0; i < 150; i++) {
    if (proc.exitCode !== null) throw Error("Next.js process exited before startup")
    try {
      const response = await fetch(origin + "/api/nextguide/account/status", { signal: AbortSignal.timeout(800) })
      if (response.ok) return
    } catch { /* server still starting */ }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw Error("Next.js server never became ready")
}
function totp(secret, now = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  let bits = 0, buffer = 0
  const bytes = []
  for (const character of secret.toUpperCase()) {
    buffer = (buffer << 5) | alphabet.indexOf(character)
    bits += 5
    if (bits >= 8) bytes.push((buffer >>> (bits -= 8)) & 255)
  }
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)))
  const sha = createHmac("sha1", Buffer.from(bytes)).update(counter).digest()
  const offset = sha[19] & 15
  return String((sha.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0")
}
async function api(origin, action, value, cookie = "") {
  const response = await fetch(origin + "/api/nextguide/" + action, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(value),
    redirect: "manual",
  })
  let payload = {}
  try { payload = await response.json() } catch { /* logout redirects */ }
  return { response, payload }
}
function assertNoSecrets(projectPath, token) {
  const config = readFileSync(join(projectPath, "nextguide.config.json"), "utf8")
  assert.ok(!config.includes(token), "The setup token must never be stored in project configuration")
}

async function verify() {
  const port = await openPort()
  const origin = `http://127.0.0.1:${port}`
  env.NEXTGUIDE_PUBLIC_URL = origin
  mkdirSync(join(project, "src", "app"), { recursive: true })
  writeFileSync(join(project, "package.json"), JSON.stringify({
    name: "nextguide-account-smoke", private: true, type: "module",
    dependencies: { next: nextVersion, react: "19.3.0", "react-dom": "19.3.0",
      nextguide: "file:" + tarball },
    devDependencies: { typescript: "^5.9.2", tailwindcss: "^4.3.4", "@tailwindcss/postcss": "^4.3.4",
      "@types/react": "^19.1.9", "@types/react-dom": "^19.1.7", "@types/node": "^22.10.0" },
  }, null, 2))
  writeFileSync(join(project, "tsconfig.json"), JSON.stringify({
    compilerOptions: { target: "ES2017", lib: ["dom", "dom.iterable", "esnext"], allowJs: true,
      skipLibCheck: true, strict: true, noEmit: true, esModuleInterop: true, module: "esnext",
      moduleResolution: "bundler", resolveJsonModule: true, isolatedModules: true,
      jsx: "react-jsx", incremental: true },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  }, null, 2))
  writeFileSync(join(project, "postcss.config.mjs"), 'export default { plugins: { "@tailwindcss/postcss": {} } }\n')
  writeFileSync(join(project, "next.config.mjs"), "export default { cacheComponents: true }\n")
  writeFileSync(join(project, "src", "app", "layout.tsx"),
    'import type { ReactNode } from "react"\nimport "./globals.css"\nexport default function Root({children}: {children:ReactNode}){return <html lang="en"><body>{children}</body></html>}\n')
  writeFileSync(join(project, "src", "app", "globals.css"), '@import "tailwindcss";\n')
  run("npm", ["pack", "--ignore-scripts", "--pack-destination", root], sourcePackage)
  assert.ok(existsSync(tarball), "npm package tarball missing")
  run("bun", ["install"])
  const cli = join(project, "node_modules", "nextguide", "bin", "nextguide.mjs")
  const output = run(process.execPath, [cli, "init", "--account", "--yes"])
  assert.match(output, /ONE-TIME ACCOUNT SETUP TOKEN/)
  const token = output.match(/ONE-TIME ACCOUNT SETUP TOKEN \(save until enrollment\):\n([^\n]+)/)?.[1]
  assert.ok(token && token.length >= 30, "CLI must print a long owner setup token")
  assertNoSecrets(project, token)
  assert.equal(JSON.parse(readFileSync(join(project, "nextguide.config.json"), "utf8")).mode, "account")
  const admin = readFileSync(join(project, "src/app/admin/page.tsx"), "utf8")
  assert.match(admin, /verifySession/)
  run(process.execPath, [join(project, "node_modules/next/dist/bin/next"), "build"])
  const server = spawn(process.execPath, [join(project, "node_modules/next/dist/bin/next"),
    "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: project, env, stdio: ["ignore", "pipe", "pipe"],
  })
  let outputLog = ""
  server.stdout.on("data", chunk => { outputLog += chunk.toString().slice(0, 3000) })
  server.stderr.on("data", chunk => { outputLog += chunk.toString().slice(0, 3000) })
  try {
    await ready(origin, server)
    const status = await fetch(origin + "/api/nextguide/account/status").then(r => r.json())
    assert.equal(status.initialized, false)
    const unauthorized = await fetch(origin + "/api/nextguide/studio/overview")
    assert.equal(unauthorized.status, 401)
    const initial = await api(origin, "account/begin", { token })
    assert.equal(initial.response.status, 200, JSON.stringify(initial.payload))
    assert.match(initial.payload.qrDataUrl, /^data:image\/png;base64,/)
    const code = totp(initial.payload.manualKey)
    const final = await api(origin, "account/finish", { token, code })
    assert.equal(final.response.status, 200, JSON.stringify(final.payload))
    assert.equal(final.payload.recoveryCodes.length, 10)
    const cookie = final.response.headers.get("set-cookie")?.split(";")[0]
    assert.ok(cookie?.startsWith("ng_account_session="), "Session cookie missing")
    const access = await fetch(origin + "/api/nextguide/studio/overview", { headers: { Cookie: cookie } })
    assert.equal(access.status, 200)
    const dashboard = await fetch(origin + "/admin", { headers: { Cookie: cookie } })
    assert.equal(dashboard.status, 200, "Authenticated /admin must not fail while prerendering")
    assert.match(await dashboard.text(), /NextGuide/)
    const localMonaco = await fetch(origin + "/_nextguide/monaco/vs/loader.js")
    assert.equal(localMonaco.status, 200, "Monaco must load locally without a CDN")
    const overview = await access.json()
    assert.ok(overview.pages.length >= 5)
    const configured = await api(origin, "studio/save-settings", { ...overview.site,
      name: "Smoke Test Docs", description: "Account Mode acceptance test",
      accent: "teal", theme: "dark", setupComplete: true }, cookie)
    assert.equal(configured.response.status, 200, JSON.stringify(configured.payload))
    const content = await api(origin, "studio/save-page", {
      slug: "guides/account-acceptance", title: "Acceptance test", description: "Real file",
      body: "## Account Mode editing works", version: null,
    }, cookie)
    assert.equal(content.response.status, 200, JSON.stringify(content.payload))
    const read = await fetch(origin + "/docs/guides/account-acceptance")
    assert.equal(read.status, 200, "Newly created page must work after production build")
    assert.match(await read.text(), /Account Mode editing works/)
    const docsHome = await fetch(origin + "/docs")
    assert.equal(docsHome.status, 200)
    assert.match(await docsHome.text(), /Smoke Test Docs/)
    const image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO9x0BUAAAAASUVORK5CYII="
    const upload = await api(origin, "studio/upload-media", { mime: "image/png", base64: image }, cookie)
    assert.equal(upload.response.status, 200, JSON.stringify(upload.payload))
    const mediaResponse = await fetch(origin + upload.payload.url)
    assert.equal(mediaResponse.status, 200)
    assert.equal(mediaResponse.headers.get("content-type"), "image/png")
    const logout = await api(origin, "account/logout", {}, cookie)
    assert.equal(logout.response.status, 303)
    const locked = await fetch(origin + "/api/nextguide/studio/overview", { headers: { Cookie: cookie } })
    assert.equal(locked.status, 401, "Logged-out sessions must no longer authorize writes")
    console.log("NextGuide Account Mode packaged consumer: setup, TOTP, protected studio, MDX, image serving and logout PASS")
  } catch (error) {
    throw new Error(String(error) + "\nNext.js server logs:\n" + outputLog)
  } finally {
    server.kill("SIGTERM")
  }
}
try { await verify() }
finally { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }) }
