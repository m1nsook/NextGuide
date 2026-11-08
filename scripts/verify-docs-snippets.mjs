import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

// JSX/MDX code props use JavaScript strings: \n creates a line break;
// \\n passes the literal two-character sequence to CodeWindow/CodeTabs.
const contents = fileURLToPath(new URL("../apps/web/contents/", import.meta.url))
const doubleEscapedNewline = "\\" + "\\" + "n"
let scanned = 0
const failures = []
function scan(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name)
    if (item.isDirectory()) { scan(path); continue }
    if (!item.isFile() || !item.name.endsWith(".mdx")) continue
    scanned++
    readFileSync(path, "utf8").split("\n").forEach((line, i) => {
      if (line.includes(doubleEscapedNewline)) {
        failures.push(path + ":" + (i + 1) + ": double-escaped newline in MDX")
      }
    })
  }
}
scan(contents)
if (failures.length) {
  throw Error("Official docs contain literal \\n in snippets:\n" + failures.join("\n"))
}
console.log("Verified " + scanned + " official MDX pages: no double-escaped newlines")
