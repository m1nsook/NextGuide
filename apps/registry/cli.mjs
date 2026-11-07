#!/usr/bin/env node
// Offline reviewer/publisher. Never put registry.private.pem on the public VPS.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { generateSigningKeys, initializeRegistry,
  revokeRelease, readRegistry } from "./lib.mjs"

const HELP = [
  "NextGuide Registry — offline review and publishing CLI",
  "",
  "keygen  --dir /secure/offline/keys",
  "init    --data /var/lib/nextguide-registry --key /secure/offline/keys/registry.private.pem",
  "revoke  --data ... --key ... --id publisher.addon --version 1.0.0",
  "verify  --data ... --public /path/to/registry.public.pem",
  "",
  "Publishing is done through verified GitHub Release submissions and the owner web dashboard.",
  "Store the private Ed25519 key in restricted VPS storage, never in a public web directory.",
].join("\n")
function parse(argv) {
  const result = {}
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i]
    if (!name?.startsWith("--") || !/^[a-z-]+$/.test(name.slice(2)) ||
        !argv[i + 1] || argv[i + 1].startsWith("--")) throw Error("Expected --name value")
    if (Object.hasOwn(result, name.slice(2))) throw Error("Duplicate option " + name)
    result[name.slice(2)] = argv[i + 1]
  }
  return result
}
function options(params, needed, allowed) {
  for (const key of Object.keys(params)) if (!allowed.includes(key)) throw Error("Unknown option --" + key)
  for (const key of needed) if (!params[key]) throw Error("Missing --" + key)
}
export function run(argv) {
  const command = argv[0]
  if (!command || command === "--help" || command === "help") { console.log(HELP); return }
  const p = parse(argv.slice(1))
  if (command === "keygen") {
    options(p, ["dir"], ["dir"])
    const result = generateSigningKeys(p.dir)
    console.log("Keep the PRIVATE signing key offline:", result.privateFile)
    console.log("Copy only the PUBLIC key to the registry VPS:", result.publicFile)
    console.log("Pinned key ID:", result.keyId)
    return result
  }
  if (command === "verify") {
    options(p, ["data", "public"], ["data", "public"])
    const { payload } = readRegistry(p.data, readFileSync(p.public, "utf8"))
    console.log("Registry signature verified:", payload.releases.length, "releases")
    return payload
  }
  if (!["init", "revoke"].includes(command)) throw Error(HELP)
  const needed = command === "init" ? [] : ["id", "version"]
  options(p, ["data", "key", ...needed], ["data", "key", ...needed])
  const privatePem = readFileSync(p.key, "utf8")
  if (command === "init") {
    const result = initializeRegistry(p.data, privatePem)
    console.log("Initialized signed registry:", p.data)
    return result
  }
  const result = revokeRelease(p.data, privatePem, p.id, p.version)
  console.log("Revoked release:", result.manifest.id, result.manifest.version)
  return result
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { run(process.argv.slice(2)) }
  catch (error) {
    console.error("Registry command failed:", error instanceof Error ? error.message : "unknown")
    process.exitCode = 1
  }
}
