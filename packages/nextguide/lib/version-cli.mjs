import { checkVersion } from "./version.mjs"
import { cliUi } from "./cli-ui.mjs"

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
    cliUi.heading("NextGuide version", "commands")
    process.stdout.write(versionHelp)
    return
  }
  const [command, ...options] = args
  if (command !== "check") {
    cliUi.fail(`Unknown version command: ${command}`)
    process.stderr.write(versionHelp)
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
      cliUi.fail(`Unknown version argument: ${option}`)
      process.exitCode = 2
      return
    }
  }
  if (tag !== "latest" && tag !== "alpha") {
    cliUi.fail("The version tag must be latest or alpha.")
    process.exitCode = 2
    return
  }
  try {
    const result = await checkVersion(installed, { tag })
    if (json) {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n")
      return
    }
    cliUi.heading("NextGuide version", "check")
    cliUi.field("Installed:", result.installed)
    if (result.status === "not-published") {
      cliUi.warn(`No NextGuide version is tagged '${tag}' on npm yet.`)
    } else {
      cliUi.field(`npm ${tag}:`, result.published)
      if (result.status === "update-available") {
        cliUi.warn(`Update available. When you choose to upgrade: bun add nextguide@${tag}`)
      } else if (result.status === "ahead") {
        cliUi.note("Your installed version is newer than this published npm channel.")
      } else {
        cliUi.success("You are up to date for this npm channel.")
      }
    }
  } catch (error) {
    cliUi.fail(`Could not check NextGuide versions: ${error.message}`)
    process.exitCode = 1
  }
}
