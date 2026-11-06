import assert from "node:assert/strict"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const workspace = fileURLToPath(new URL("../", import.meta.url))
const cli = join(workspace, "packages", "nextguide", "bin", "nextguide.mjs")
const packageDir = join(workspace, "packages", "nextguide")
const { version } = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"))
const root = mkdtempSync(join(tmpdir(), "nextguide-smoke-"))
const tarball = join(root, `nextguide-${version}.tgz`)
const opts = { encoding: "utf8", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXTGUIDE_PAGES: "0" } }

function run(command, args, directory) {
  const result = spawnSync(command, args, { ...opts, cwd: directory, maxBuffer: 12 * 1024 * 1024 })
  if (result.status !== 0) {
    throw new Error(`Command failed (${command} ${args.join(" ")}):\n${result.stdout}\n${result.stderr}`)
  }
  return result.stdout
}

function createSite(router) {
  const folder = join(root, router)
  mkdirSync(join(folder, "src", router === "app" ? "app" : "pages"), { recursive: true })
  writeFileSync(join(folder, "package.json"), JSON.stringify({
    name: "nextguide-starter-smoke-" + router, private: true,
    type: "module",
    dependencies: {
      next: "16.3.8", react: "19.3.0", "react-dom": "19.3.0",
      nextguide: "file:" + tarball
    },
    devDependencies: {
      typescript: "^5.9.2", "@types/react": "^19.1.9",
      "@types/react-dom": "^19.1.7", "@types/node": "^22.10.0"
    }
  }, null, 2))
  writeFileSync(join(folder, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2017", lib: ["dom", "dom.iterable", "esnext"], allowJs: true,
      skipLibCheck: true, strict: true, noEmit: true, esModuleInterop: true,
      module: "esnext", moduleResolution: "bundler", resolveJsonModule: true,
      isolatedModules: true, jsx: "react-jsx", incremental: true
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"]
  }, null, 2))
  writeFileSync(join(folder, "next.config.mjs"), 'export default { output: "export", trailingSlash: true, images: { unoptimized: true } }\n')
  if (router === "app") {
    writeFileSync(join(folder, "src", "app", "layout.tsx"),
      'import type { ReactNode } from "react"\nexport default function RootLayout({ children }: { children: ReactNode }) { return <html lang="en"><body>{children}</body></html> }\n')
  }
  // Exercise the package as a real npm consumer, with independently resolved
  // React dependencies, not an artificial workspace symlink layout.
  run("bun", ["install"], folder)
  const output = run(process.execPath, [cli, "init", "--developer", "--router", router], folder)
  assert.match(output, /CREATE/)
  run(process.execPath, [join(folder, "node_modules", "next", "dist", "bin", "next"), "build"], folder)
  for (const page of ["docs/index.html", "docs/getting-started/index.html"]) {
    assert.ok(existsSync(join(folder, "out", page)), `Missing ${router} output: ${page}`)
  }
  const homepage = readFileSync(join(folder, "out", "docs", "index.html"), "utf8")
  assert.match(homepage, /Welcome to NextGuide/)
  console.log(`NextGuide ${router} Router: installed tarball generated a static site successfully`)
}

try {
  run("npm", ["pack", "--ignore-scripts", "--pack-destination", root], packageDir)
  assert.ok(existsSync(tarball), "npm pack did not create the expected tarball")
  createSite("app")
  createSite("pages")
} finally {
  rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 })
}
