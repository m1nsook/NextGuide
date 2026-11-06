import { checkVersion } from "./version.mjs"

export const versionHelp = `NextGuide version commands

Usage:
  nextguide --version                Show the installed NextGuide version (offline)
  nextguide version check            Compare against npm's latest dist-tag
  nextguide version check --tag alpha Compare against the prerelease channel
  nextguide version check --json     Return machine-readable results

Checking is on demand, read-only, and uses npm's public registry.
It does not install a package or modify your project.
`

export async function versionCommand(args, installed) {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    process.stdout.write(versionHelp)
    return
  }
  const [command, ...options] = args
  if (command !== "check") {
    process.stderr.write(`Unknown version command: ${command}\n${versionHelp}`)
    process.exitCode = 2
    return
  }
  let json = false
  let tag = "latest"
  for (let i = 0; i < options.length; i++) {
    const option = options[i]
    if (option === "--json") json = true
    else if (option === "--tag" && options[i + 1]) tag = options[++i]
    else {
      process.stderr.write(`Unknown version argument: ${option}\n`)
      process.exitCode = 2
      return
    }
  }
  if (tag !== "latest" && tag !== "alpha") {
    process.stderr.write("The version tag must be latest or alpha.\n")
    process.exitCode = 2
    return
  }
  try {
    const result = await checkVersion(installed, { tag })
    if (json) {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n")
      return
    }
    process.stdout.write(`NextGuide ${result.installed} (installed)\n`)
    if (result.status === "not-published") {
      process.stdout.write(`No NextGuide version is tagged '${tag}' on npm yet.\n`)
    } else {
      process.stdout.write(`npm ${tag}: ${result.published}\n`)
      if (result.status === "update-available") {
        process.stdout.write(`Update available. When you choose to upgrade: bun add nextguide@${tag}\n`)
      } else if (result.status === "ahead") {
        process.stdout.write("Your installed version is newer than this published npm channel.\n")
      } else {
        process.stdout.write("You are up to date for this npm channel.\n")
      }
    }
  } catch (error) {
    process.stderr.write(`Could not check NextGuide versions: ${error.message}\n`)
    process.exitCode = 1
  }
}
