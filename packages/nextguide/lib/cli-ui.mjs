/**
 * Shared console presentation for every NextGuide CLI command.
 *
 * No runtime dependencies or terminal detection packages. Output remains plain
 * for redirected streams, CI, NO_COLOR and TERM=dumb; --json bypasses it.
 * FORCE_COLOR=1 is supported for testing and explicit opt-in.
 */
const isColor = (stream) => process.env.NO_COLOR === undefined &&
  process.env.FORCE_COLOR !== "0" &&
  process.env.TERM !== "dumb" &&
  (Boolean(stream.isTTY) || /^(1|2|3|true)$/.test(process.env.FORCE_COLOR ?? ""))

function tint(text, code, stream = process.stdout) {
  return isColor(stream) ? "\u001b[" + code + "m" + text + "\u001b[0m" : text
}
const write = (value, stream = process.stdout) => stream.write(value + "\n")

export const cliUi = {
  heading(message, detail = "") {
    write(tint("◆", "35") + " " + tint(message, "1;36") +
      (detail ? " " + tint(detail, "2") : ""))
  },
  field(label, value) {
    write("  " + tint(label, "2") + " " + String(value))
  },
  file(action, path) {
    const key = action.replace(/^WOULD /, "")
    const code = key === "CREATE" ? "32" : key === "UPDATE" ? "36" : "33"
    const glyph = key === "CREATE" ? "+" : key === "UPDATE" ? "~" : "↳"
    write("  " + tint(glyph, code) + " " + tint(action.padEnd(12), "1;" + code) + " " + path)
  },
  backup(path) {
    write("    " + tint("↳ Backup:", "33") + " " + path)
  },
  success(message) { write(tint("✓", "1;32") + " " + message) },
  note(message) { write(tint("i", "1;34") + " " + message) },
  warn(message) { write(tint("!", "1;33") + " " + message) },
  fail(message) { write(tint("×", "1;31", process.stderr) + " " + message, process.stderr) },
  error(message) { write(tint("×", "1;31", process.stderr) + " " + message, process.stderr) },
  prompt(question) { return tint("◆", "35") + " " + tint(question, "36") },
  blank() { process.stdout.write("\n") },
}

export function terminalColorsEnabled(stream = process.stdout) {
  return isColor(stream)
}
