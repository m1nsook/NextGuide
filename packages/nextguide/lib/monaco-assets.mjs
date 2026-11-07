// Monaco assets are served by the user's own Next.js server, not a CDN.
// This module runs only on the Node.js side of Account Mode init/upgrade.
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, resolve, sep } from "node:path"
import { randomUUID } from "node:crypto"

const require = createRequire(import.meta.url)
const VERSION = "0.52.2"
const ASSET_DIR = join("public", "_nextguide", "monaco", "vs")

function checkNoSymlink(root, file) {
  const target = resolve(root, file)
  if (!target.startsWith(root + sep)) throw new Error("Monaco assets must stay inside the project.")
  let current = root
  for (const segment of file.split(/[\\/]+/)) {
    current = join(current, segment)
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new Error("Refusing symlink in Monaco public asset path: " + file)
    }
  }
}

/** Idempotently copy the vendored, pinned Monaco AMD bundle into /public. */
export function installMonacoAssets(projectDirectory) {
  const root = resolve(projectDirectory)
  checkNoSymlink(root, ASSET_DIR)
  const sourceRoot = dirname(require.resolve("monaco-editor/package.json"))
  const source = join(sourceRoot, "min", "vs")
  const sourceLoader = join(source, "loader.js")
  if (!existsSync(sourceLoader)) {
    throw new Error("Installed monaco-editor package is missing its web assets. Reinstall nextguide dependencies.")
  }
  const destination = join(root, ASSET_DIR)
  const stamp = join(destination, ".nextguide-version")
  if (existsSync(destination)) {
    const version = existsSync(stamp) ? readFileSync(stamp, "utf8").trim() : null
    if (version === VERSION && existsSync(join(destination, "loader.js"))) return false
    throw new Error("Monaco asset directory is already present but not managed by this NextGuide version. Back it up before upgrading: " + ASSET_DIR)
  }

  mkdirSync(dirname(destination), { recursive: true })
  const staging = destination + ".nextguide-tmp-" + randomUUID()
  try {
    cpSync(source, staging, { recursive: true, force: false, errorOnExist: true })
    writeFileSync(join(staging, ".nextguide-version"), VERSION + "\n", { flag: "wx" })
    renameSync(staging, destination)
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true })
  }
  return true
}
