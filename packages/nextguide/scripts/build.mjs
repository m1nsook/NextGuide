import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const here = fileURLToPath(new URL("..", import.meta.url))
const workspace = resolve(here, "../..")
const out = join(here, "dist")
const libraries = ["core", "openapi", "mdx", "components"]
const internal = /@nextguide-internal\/(core|openapi|mdx|components)(?![\w-])/g

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(command + " " + args.join(" ") + " failed with exit code " + result.status)
}

function rewriteDirectory(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) {
      rewriteDirectory(path)
    } else if (/\.(?:js|d\.ts)$/.test(entry.name)) {
      const before = readFileSync(path, "utf8")
      const after = before.replace(internal, "nextguide/$1")
      if (after !== before) writeFileSync(path, after)
    }
  }
}

// Build only the internal renderer libraries. Building web^... would include
// nextguide once the docs app depends on it and cause a recursive build.
run("bun", ["x", "turbo", "run", "build",
  "--filter=@nextguide-internal/core", "--filter=@nextguide-internal/openapi",
  "--filter=@nextguide-internal/mdx", "--filter=@nextguide-internal/components",
], workspace)
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

for (const library of libraries) {
  const built = join(workspace, "packages", "lib-" + library, "dist")
  if (!existsSync(join(built, "index.js")) || !existsSync(join(built, "index.d.ts"))) {
    throw new Error("Missing compiled " + library + ". Run bun install at repository root before building.")
  }
  const dest = join(out, library)
  cpSync(built, dest, { recursive: true })
  rewriteDirectory(dest)
}

run("bun", ["x", "tsc", "--project", join(here, "tsconfig.json")], workspace)
for (const name of ["ui", "icons"]) {
  const file = join(out, name, "index.js")
  if (!existsSync(file)) throw new Error("Missing NextGuide " + name + " entry")
  writeFileSync(file, '"use client";\n' + readFileSync(file, "utf8"))
}
const picker = join(out, "fonts", "picker.js")
if (!existsSync(picker)) throw new Error("Missing font picker")
writeFileSync(picker, '"use client";\n' + readFileSync(picker, "utf8"))
cpSync(join(here, "src/ui/theme.css"), join(out, "ui/theme.css"))
cpSync(join(here, "src/fonts/picker.css"), join(out, "fonts/picker.css"))
cpSync(join(here, "src/blocks/styles.css"), join(out, "blocks/styles.css"))
cpSync(join(here, "src/ui/primitives.css"), join(out, "ui/primitives.css"))
cpSync(join(here, "src/ui/interactive.css"), join(out, "ui/interactive.css"))
writeFileSync(join(out, "styles.css"), [
  '@import "./components/styles/index.css";',
  '@import "./ui/theme.css";',
  '@import "./ui/primitives.css";',
  '@import "./ui/interactive.css";',
  '@import "./blocks/styles.css";',
  '@import "./fonts/picker.css";',
  ''
].join("\n"))
writeFileSync(join(out, "index.js"), 'export { createDocs } from "./mdx/index.js";\nexport { createOpenAPI } from "./openapi/index.js";\n')
writeFileSync(join(out, "index.d.ts"), 'export { createDocs } from "./mdx/index.js";\nexport { createOpenAPI } from "./openapi/index.js";\n')
console.log("NextGuide all-in-one distribution assembled")
