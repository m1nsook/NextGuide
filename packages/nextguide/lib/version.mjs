const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/

function parts(version) {
  const match = VERSION_PATTERN.exec(version)
  if (!match) throw new Error(`Invalid package version: ${version}`)
  return { core: match.slice(1, 4).map(Number), pre: match[4] ? match[4].split(".") : [] }
}

// Return -1, 0, or 1 following SemVer precedence, ignoring build metadata.
export function compareVersions(left, right) {
  const a = parts(left)
  const b = parts(right)
  for (let i = 0; i < 3; i++) {
    if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i] ? 1 : -1
  }
  if (a.pre.length === 0 || b.pre.length === 0) {
    return a.pre.length === b.pre.length ? 0 : a.pre.length === 0 ? 1 : -1
  }
  const size = Math.max(a.pre.length, b.pre.length)
  for (let i = 0; i < size; i++) {
    const x = a.pre[i]
    const y = b.pre[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (x === y) continue
    const xn = /^(0|[1-9]\d*)$/.test(x)
    const yn = /^(0|[1-9]\d*)$/.test(y)
    if (xn && yn) {
      if (BigInt(x) !== BigInt(y)) return BigInt(x) > BigInt(y) ? 1 : -1
    } else if (xn !== yn) {
      return xn ? -1 : 1
    } else {
      return x > y ? 1 : -1
    }
  }
  return 0
}

const REGISTRY_URL = "https://registry.npmjs.org/-/package/nextguide/dist-tags"

// Only checks npm when called. Never installs packages or alters lockfiles.
export async function checkVersion(installed, { tag = "latest", fetchImpl = fetch } = {}) {
  if (tag !== "latest" && tag !== "alpha") throw new Error("Tag must be latest or alpha")
  parts(installed)
  const response = await fetchImpl(REGISTRY_URL, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  })
  if (!response.ok && response.status !== 404) {
    throw new Error(`npm registry returned HTTP ${response.status}`)
  }
  const tags = response.status === 404 ? {} : await response.json()
  if (tags === null || typeof tags !== "object" || Array.isArray(tags)) {
    throw new Error("Invalid npm registry dist-tags response")
  }
  const published = tags[tag]
  if (published === undefined) {
    return { installed, published: null, tag, status: "not-published", updateAvailable: false }
  }
  if (typeof published !== "string") throw new Error("Invalid published version returned by npm")
  const comparison = compareVersions(installed, published)
  return {
    installed, published, tag,
    status: comparison < 0 ? "update-available" : comparison > 0 ? "ahead" : "up-to-date",
    updateAvailable: comparison < 0,
  }
}
