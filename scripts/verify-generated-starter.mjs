import assert from "node:assert/strict"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const workspace = fileURLToPath(new URL("../", import.meta.url))
const require = createRequire(join(workspace, "apps", "web", "package.json"))
const nextBin = join(dirname(require.resolve("next/package.json")), "dist", "bin", "next")
const cli = join(workspace, "packages", "nextguide", "bin", "nextguide.mjs")
const root = mkdtempSync(join(workspace, ".nextguide-smoke-"))
const opts = { encoding: "utf8", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXTGUIDE_PAGES: "0" } }

function run(command, args, directory) {
  const processResult = spawnSync(command, args, { ...opts, cwd: directory, maxBuffer: 12 * 1024 * 1024 })
  if (processResult.status !== 0) {
    throw new Error(`Command failed (${command} ${args.join(" ")}):\n${processResult.stdout}\n${processResult.stderr}`)
  }
  return processResult.stdout
}

function createSite(router) {
  const folder = join(root, router)
  mkdirSync(join(folder, "src", router === "app" ? "app" : "pages"), { recursive: true })
  writeFileSync(join(folder, "package.json"), JSON.stringify({
    name: "nextguide-starter-smoke-" + router, private: true,
    type: "module", dependencies: {
      next: "16.3.8", react: "19.3.0", "react-dom": "19.3.0", nextguide: "0.0.1-alpha.2"
    }
  }, null, 2))
  const modules = join(folder, "node_modules")
  mkdirSync(modules, { recursive: true })
  // Bun may install workspace packages under apps/web/node_modules rather than
  // the monorepo root. Link dependencies to the smoke fixture explicitly.
  for (const packageName of ["next", "react", "react-dom", "nextguide"]) {
    const packageFile = require.resolve(packageName + "/package.json")
    symlinkSync(dirname(packageFile), join(modules, packageName), "dir")
  }
  writeFileSync(join(folder, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2017", lib: ["dom", "dom.iterable", "esnext"], allowJs: true,
      skipLibCheck: true, strict: true, noEmit: true, esModuleInterop: true,
      module: "esnext", moduleResolution: "bundler", resolveJsonModule: true,
      isolatedModules: true, jsx: "react-jsx", incremental: true
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"], exclude: ["node_modules"]
  }, null, 2))
  writeFileSync(join(folder, "next.config.mjs"), 'export default { output: "export", trailingSlash: true, images: { unoptimized: true } }\n')
  if (router === "app") {
    writeFileSync(join(folder, "src", "app", "layout.tsx"),
      'import type { ReactNode } from "react"\nexport default function RootLayout({ children }: { children: ReactNode }) { return <html lang="en"><body>{children}</body></html> }\n')
  }
  const output = run(process.execPath, [cli, "init", "--developer", "--router", router], folder)
  assert.match(output, /CREATE/)
  run(process.execPath, [nextBin, "build"], folder)
  for (const page of ["docs/index.html", "docs/getting-started/index.html"]) {
    assert.ok(existsSync(join(folder, "out", page)), `Missing ${router} output: ${page}`)
  }
  const homepage = readFileSync(join(folder, "out", "docs", "index.html"), "utf8")
  assert.match(homepage, /Welcome to NextGuide/)
  console.log(`NextGuide ${router} Router: generated project builds to static HTML`)
}

try {
  createSite("app")
  createSite("pages")
} finally {
  rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 })
}
