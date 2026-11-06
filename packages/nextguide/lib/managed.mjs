import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

export const MANIFEST_FILE = ".nextguide/managed-files.json"
export const packageVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version

export const hashContent = (content) => createHash("sha256").update(content, "utf8").digest("hex")

export function managedManifest({ router, basePath, files }, previous = {}) {
  const hashes = { ...(previous.files ?? {}) }
  for (const [filename, content] of Object.entries(files)) {
    if (filename !== MANIFEST_FILE) hashes[filename] = hashContent(content)
  }
  return {
    schemaVersion: 1,
    packageVersion,
    router: router.folder,
    basePath,
    files: hashes,
  }
}

export function stringifyManifest(record) {
  return JSON.stringify(record, null, 2) + "\n"
}
