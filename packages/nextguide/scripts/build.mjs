import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const here = fileURLToPath(new URL("..", import.meta.url))
const out = join(here, "dist")
const require = createRequire(import.meta.url)

function run(command, args) {
  const child = spawnSync(command, args, {
    cwd: here, stdio: "inherit", shell: false,
  })
  if (child.error) throw child.error
  if (child.status !== 0) throw new Error(command + " failed with exit code " + child.status)
}

// Compile all NextGuide modules from this ONE package. There is no
// cross-package workspace build, Turborepo filter, or private npm dependency.
rmSync(out, { recursive: true, force: true })
run(process.execPath, [require.resolve("typescript/bin/tsc"), "--project", join(here, "tsconfig.json")])

for (const name of ["core", "mdx", "openapi", "components", "ui", "blocks", "icons", "fonts"]) {
  if (!existsSync(join(out, name, "index.js"))) {
    throw new Error("Missing compiled NextGuide module: " + name)
  }
}

// TypeScript emits JS and declarations; CSS is copied as an asset.
cpSync(join(here, "src/components/styles"), join(out, "components/styles"), { recursive: true })
for (const asset of [
  ["src/ui/theme.css", "ui/theme.css"],
  ["src/ui/primitives.css", "ui/primitives.css"],
  ["src/ui/interactive.css", "ui/interactive.css"],
  ["src/blocks/styles.css", "blocks/styles.css"],
  ["src/fonts/picker.css", "fonts/picker.css"],
]) {
  const destination = join(out, asset[1])
  mkdirSync(join(out, asset[1].split("/")[0]), { recursive: true })
  cpSync(join(here, asset[0]), destination)
}
cpSync(join(here, "src/account/account.css"), join(out, "account/account.css"))
for (const name of ["ui/index.js", "icons/index.js", "fonts/picker.js", "blocks/index.js"]) {
  const path = join(out, name)
  const source = readFileSync(path, "utf8")
  if (!/^\s*["']use client["'];?/.test(source)) {
    writeFileSync(path, '"use client";\n' + source)
  }
}
writeFileSync(join(out, "styles.css"), [
  '@import "./components/styles/index.css";',
  '@import "./ui/theme.css";',
  '@import "./ui/primitives.css";',
  '@import "./ui/interactive.css";',
  '@import "./blocks/styles.css";',
  '@import "./fonts/picker.css";',
  "",
].join("\n"))
writeFileSync(join(out, "index.js"),
  'export { createDocs } from "./mdx/index.js";\nexport { createOpenAPI } from "./openapi/index.js";\n')
writeFileSync(join(out, "index.d.ts"),
  'export { createDocs } from "./mdx/index.js";\nexport { createOpenAPI } from "./openapi/index.js";\n')
console.log("NextGuide: one source package, one build, one npm distribution")
