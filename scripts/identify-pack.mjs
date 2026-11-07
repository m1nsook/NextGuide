/**
 * Rename the npm-generated development tarball to an immutable, content-based
 * filename. The package version intentionally stays the same while alpha
 * development continues, but a new build must not look like an old archive.
 *
 * Works on Windows and Unix, and requires neither Git nor an additional npm
 * package. Does not modify the package payload or publish anything.
 */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, renameSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const { name, version } = JSON.parse(readFileSync(join(root, "packages/nextguide/package.json"), "utf8"))
const oldName = `${name.replace(/^@/, "").replaceAll("/", "-")}-${version}.tgz`
const oldPath = join(root, oldName)
if (!existsSync(oldPath)) {
  throw new Error("npm pack did not create the expected archive: " + oldPath)
}
const digest = createHash("sha256").update(readFileSync(oldPath)).digest("hex").slice(0, 12)
const newName = `${name.replace(/^@/, "").replaceAll("/", "-")}-${version}-${digest}.tgz`
const newPath = join(root, newName)
renameSync(oldPath, newPath)

process.stdout.write("\n◆ NextGuide development package ready\n")
process.stdout.write("  Version   " + version + "\n")
process.stdout.write("  Archive   " + basename(newPath) + "\n")
process.stdout.write("  SHA-256   " + digest + " (filename prefix)\n")
process.stdout.write("\nInstall in your Next.js project:\n")
process.stdout.write('  bun add "' + newPath + '"\n')
process.stdout.write("\nThen update an existing Developer Mode installation:\n")
process.stdout.write("  bunx nextguide upgrade --refresh-generated --dry-run\n")
process.stdout.write("  bunx nextguide upgrade --refresh-generated\n")
process.stdout.write("\nDo not install the older nextguide-" + version + ".tgz archive.\n")
