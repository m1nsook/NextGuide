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
const nextVersion = process.env.NEXTGUIDE_NEXT_VERSION ?? "16.4.5"
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

function createSite(router, basePath = "/docs", cacheComponents = false) {
  const folder = join(root, `${router}-${basePath === "/" ? "root" : "docs"}-${cacheComponents ? "cache" : "export"}`)
  mkdirSync(join(folder, "src", router === "app" ? "app" : "pages"), { recursive: true })
  writeFileSync(join(folder, "package.json"), JSON.stringify({
    name: "nextguide-starter-smoke-" + router, private: true,
    type: "module",
    dependencies: {
      next: nextVersion, react: "19.3.0", "react-dom": "19.3.0",
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
  writeFileSync(join(folder, "next.config.mjs"), cacheComponents
    ? 'export default { cacheComponents: true }\n'
    : 'export default { output: "export", trailingSlash: true, images: { unoptimized: true } }\n')
  if (router === "app") {
    writeFileSync(join(folder, "src", "app", "layout.tsx"),
      'import type { ReactNode } from "react"\nexport default function RootLayout({ children }: { children: ReactNode }) { return <html lang="en"><body>{children}</body></html> }\n')
    if (basePath === "/") {
      writeFileSync(join(folder, "src", "app", "page.tsx"), "export default function Home() { return <p>Existing home</p> }\n")
    }
  } else if (basePath === "/") {
    writeFileSync(join(folder, "src", "pages", "index.tsx"), "export default function Home() { return <p>Existing home</p> }\n")
  }
  // Exercise the package as a real npm consumer, with independently resolved
  // React dependencies, not an artificial workspace symlink layout.
  run("bun", ["install"], folder)
  const output = run(process.execPath, [cli, "init", "--developer", "--router", router, "--base-path", basePath, "--yes", ...(basePath === "/" ? ["--replace-home"] : [])], folder)
  assert.match(output, /CREATE/)
  run(process.execPath, [join(folder, "node_modules", "next", "dist", "bin", "next"), "build"], folder)
  if (!cacheComponents) {
    for (const page of (basePath === "/" ? ["index.html", "getting-started/index.html"] : ["docs/index.html", "docs/getting-started/index.html"])) {
      assert.ok(existsSync(join(folder, "out", page)), `Missing ${router} output: ${page}`)
    }
    const homepage = readFileSync(join(folder, "out", basePath === "/" ? "index.html" : "docs/index.html"), "utf8")
    // Verify actual rendered output, not an outdated example-page heading.
    assert.match(homepage, /Welcome to your docs/, "Starter MDX homepage must render")
    assert.match(homepage, /Documentation navigation|Documentation pages/, "Starter sidebar must render")
    assert.match(homepage, /Start building/, "Starter MDX sections must render")
    assert.match(homepage, /Component showcase/, "Starter's bundled MDX link cards must render")
  }
  if (basePath === "/") {
    const backup = router === "app" ? "src/app/page.tsx.nextguide-backup" : "src/pages/index.tsx.nextguide-backup"
    assert.ok(existsSync(join(folder, backup)), "Existing homepage must be preserved")
  }
  console.log(`NextGuide ${router} Router at ${basePath} on Next.js ${nextVersion}: built successfully (cacheComponents=${cacheComponents})`)
}

try {
  run("npm", ["pack", "--ignore-scripts", "--pack-destination", root], packageDir)
  assert.ok(existsSync(tarball), "npm pack did not create the expected tarball")
  createSite("app", "/docs")
  createSite("app", "/")
  createSite("pages", "/docs")
  createSite("pages", "/")
  createSite("app", "/docs", true)
} finally {
  rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 })
}
