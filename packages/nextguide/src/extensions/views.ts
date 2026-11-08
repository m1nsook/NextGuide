/** Data-only UI descriptors. Third-party React/HTML is never imported here. */
export type ExtensionViewNode =
  | { type: "text"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; level: 2 | 3 | 4 }
  | { type: "badge"; text: string }
  | { type: "link"; text: string; href: string }
  | { type: "button"; text: string; action: string }
  | { type: "divider" }
  | { type: "stack"; children: ExtensionViewNode[] }
  | { type: "card"; children: ExtensionViewNode[] }

export type ViewIssue = { path: string; message: string }
export type ViewValidation = { valid: boolean; issues: ViewIssue[]; view: ExtensionViewNode | null }

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function safeExtensionLink(href: string): boolean {
  if (typeof href !== "string" || href.length === 0 || href.length > 512 ||
      /[\u0000-\u001f\u007f\\]/.test(href)) return false
  if (href.startsWith("/") && !href.startsWith("//")) return true
  try {
    const parsed = new URL(href)
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
  } catch { return false }
}

/**
 * Validate untrusted, declarative view trees. No HTML, CSS, script, callback,
 * arbitrary props or executable modules can enter the rendering layer.
 */
export function validateExtensionView(input: unknown): ViewValidation {
  const issues: ViewIssue[] = []
  const issue = (path: string, message: string) => {
    if (issues.length < 40) issues.push({ path, message })
  }
  let seen = 0
  let budget = 0
  function parse(value: unknown, path: string, depth: number): ExtensionViewNode | null {
    if (++seen > 128 || depth > 8) {
      issue(path, "View exceeds the 128-node or eight-level limit.")
      return null
    }
    if (!isObject(value) || typeof value.type !== "string") {
      issue(path, "View node must be an object with a supported type.")
      return null
    }
    const type = value.type
    const permitted: Record<string, string[]> = {
      text: ["type", "text"], paragraph: ["type", "text"],
      heading: ["type", "text", "level"], badge: ["type", "text"],
      link: ["type", "text", "href"], button: ["type", "text", "action"],
      divider: ["type"], stack: ["type", "children"], card: ["type", "children"],
    }
    if (!Object.hasOwn(permitted, type)) {
      issue(path + ".type", "Unsupported view node type.")
      return null
    }
    for (const key of Object.keys(value)) {
      if (!permitted[type].includes(key)) issue(path + "." + key, "Unexpected view property.")
    }
    if (type === "divider") return { type: "divider" }
    if (type === "stack" || type === "card") {
      if (!Array.isArray(value.children) || value.children.length > 32) {
        issue(path + ".children", "Children must be an array of at most 32 nodes.")
        return null
      }
      const children: ExtensionViewNode[] = []
      for (let i = 0; i < value.children.length; i++) {
        const child = parse(value.children[i], path + ".children[" + i + "]", depth + 1)
        if (child) children.push(child)
      }
      return type === "stack" ? { type, children } : { type, children }
    }
    if (typeof value.text !== "string" || value.text.length > 2048) {
      issue(path + ".text", "Text must be a string of at most 2048 characters.")
      return null
    }
    budget += value.text.length
    if (budget > 24000) issue(path, "View text exceeds total limit.")
    if (type === "text" || type === "paragraph" || type === "badge") {
      return { type, text: value.text }
    }
    if (type === "heading") {
      if (![2, 3, 4].includes(value.level as number)) {
        issue(path + ".level", "Heading level must be 2, 3, or 4.")
        return null
      }
      return { type: "heading", text: value.text, level: value.level as 2 | 3 | 4 }
    }
    if (type === "link") {
      if (!safeExtensionLink(value.href as string)) {
        issue(path + ".href", "Links must be local paths or HTTPS URLs without credentials.")
        return null
      }
      return { type: "link", text: value.text, href: value.href as string }
    }
    if (type === "button") {
      if (typeof value.action !== "string" || !/^[a-z][a-z0-9_.-]{0,79}$/.test(value.action)) {
        issue(path + ".action", "Action identifiers must be safe lowercase names.")
        return null
      }
      return { type: "button", text: value.text, action: value.action }
    }
    issue(path + ".type", "Unsupported view node.")
    return null
  }
  const view = parse(input, "view", 0)
  return { valid: issues.length === 0 && view !== null, issues,
    view: issues.length === 0 ? view : null }
}
