import { addPage } from "./page.mjs"
import { cliUi } from "./cli-ui.mjs"

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
    cliUi.heading("NextGuide page", "Developer Mode")
    process.stdout.write(pageHelp)
    return
  }
  const [action, ...options] = args
  if (action !== "add") {
    cliUi.fail(`Unknown page action: ${action}`)
    process.stderr.write(pageHelp)
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
        cliUi.fail(`${token} requires a value.`)
        process.exitCode = 2
        return
      }
      if (token === "--title") title = value
      else if (token === "--description") description = value
      else project = value
    } else if (!token.startsWith("-") && slug === undefined) slug = token
    else {
      cliUi.fail(`Unknown page argument: ${token}`)
      process.exitCode = 2
      return
    }
  }
  if (slug === undefined) {
    cliUi.fail("Missing page slug. Example: nextguide page add guides/installation")
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
    cliUi.heading("NextGuide Developer Mode", dryRun ? "page preview" : "page created")
    cliUi.field("Project:", projectDirectory)
    for (const item of created) cliUi.file(dryRun ? "WOULD CREATE" : "CREATE", item.path)
    for (const item of modified) cliUi.file(dryRun ? "WOULD UPDATE" : "UPDATE", item.path)
    cliUi.field("URL:", href)
    if (dryRun) cliUi.note("Preview only — no files were modified.")
    else cliUi.success("Page created and navigation updated.")
  } catch (error) {
    cliUi.fail(`NextGuide page add failed: ${error.message}`)
    process.exitCode = 1
  }
}
