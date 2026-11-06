import { addPage } from "./page.mjs"

export const pageHelp = `NextGuide Developer Mode — add documentation pages

Usage:
  nextguide page add <slug> [options]

Options:
  --title <text>          Page title (defaults to title-cased slug)
  --description <text>    Page description in MDX frontmatter
  --project <path>       Next.js project directory (defaults to current directory)
  --dry-run              Show the planned changes without writing files
  --json                 Return paths and URL as JSON
  --help                 Show page command help

Examples:
  nextguide page add changelog
  nextguide page add guides/installation --title "Installation"
  nextguide page add guides/windows --dry-run

Run nextguide init first. The command preserves existing pages and navigation.
`

export function pageCommand(args) {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    process.stdout.write(pageHelp)
    return
  }
  const [action, ...options] = args
  if (action !== "add") {
    process.stderr.write(`Unknown page action: ${action}\n${pageHelp}`)
    process.exitCode = 2
    return
  }
  let slug
  let project = process.cwd()
  let title
  let description
  let dryRun = false
  let json = false
  for (let i = 0; i < options.length; i++) {
    const token = options[i]
    if (token === "--help" || token === "-h") {
      process.stdout.write(pageHelp)
      return
    }
    if (token === "--dry-run") dryRun = true
    else if (token === "--json") json = true
    else if (token === "--title" || token === "--description" || token === "--project") {
      const value = options[++i]
      if (!value || value.startsWith("--")) {
        process.stderr.write(`${token} requires a value.\n`)
        process.exitCode = 2
        return
      }
      if (token === "--title") title = value
      else if (token === "--description") description = value
      else project = value
    } else if (!token.startsWith("-") && slug === undefined) slug = token
    else {
      process.stderr.write(`Unknown page argument: ${token}\n`)
      process.exitCode = 2
      return
    }
  }
  if (slug === undefined) {
    process.stderr.write("Missing page slug. Example: nextguide page add guides/installation\n")
    process.exitCode = 2
    return
  }
  try {
    const result = addPage(project, slug, { title, description, dryRun })
    const { projectDirectory, href, created, modified } = result
    if (json) {
      process.stdout.write(JSON.stringify({
        mode: "developer", projectDirectory, href, dryRun,
        created: created.map(file => file.path),
        modified: modified.map(file => file.path),
      }, null, 2) + "\n")
      return
    }
    process.stdout.write(`NextGuide: ${dryRun ? "page preview" : "page created"}\n`)
    process.stdout.write(`Project: ${projectDirectory}\n`)
    for (const item of created) process.stdout.write(`  ${dryRun ? "WOULD CREATE" : "CREATE"} ${item.path}\n`)
    for (const item of modified) process.stdout.write(`  ${dryRun ? "WOULD UPDATE" : "UPDATE"} ${item.path}\n`)
    process.stdout.write(`URL: ${href}\n`)
  } catch (error) {
    process.stderr.write(`NextGuide page add failed: ${error.message}\n`)
    process.exitCode = 1
  }
}
