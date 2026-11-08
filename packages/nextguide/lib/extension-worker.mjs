/**
 * Runs only INSIDE the Linux bubblewrap namespace. Never import this in the
 * privileged Next.js host. Third-party modules receive JSON broker calls,
 * not Node handles or credentials (Node builtins remain confined by the OS).
 */
const pending = new Map()
let counter = 0
let buffer = ""
let stopped = false
let cleanup = null

function write(message) {
  const line = JSON.stringify(message) + "\n"
  if (Buffer.byteLength(line) > 65_536) throw Error("IPC message too large")
  process.stdout.write(line)
}

function request(method, params = {}) {
  if (stopped) return Promise.reject(Error("Extension stopped"))
  const id = "r" + (++counter).toString(36)
  if (pending.size >= 16) return Promise.reject(Error("Too many capability calls"))
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    try { write({ type: "call", id, method, params }) }
    catch (cause) { pending.delete(id); reject(cause) }
  })
}

async function receive(message) {
  if (message.type === "result" && typeof message.id === "string") {
    const waiter = pending.get(message.id)
    if (!waiter) return
    pending.delete(message.id)
    if (message.ok === true) waiter.resolve(message.result)
    else waiter.reject(Error(message.error?.code ?? "CAPABILITY_DENIED"))
  } else if (message.type === "stop") {
    stopped = true
    for (const waiter of pending.values()) waiter.reject(Error("Extension stopped"))
    pending.clear()
    try { if (typeof cleanup === "function") await cleanup() }
    finally { process.exit(0) }
  } else {
    process.exit(1)
  }
}

process.stdin.setEncoding("utf8")
process.stdin.on("data", chunk => {
  buffer += chunk
  if (Buffer.byteLength(buffer) > 65_536) process.exit(1)
  let end
  while ((end = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, end)
    buffer = buffer.slice(end + 1)
    try { void receive(JSON.parse(line)) }
    catch { process.exit(1) }
  }
})
process.stdin.on("end", () => process.exit(0))

try {
  // This import is intentionally in the OS-confined child, never in Next.js.
  const module = await import("file:///extension/entry.mjs")
  const activate = module.activate ?? module.default
  if (typeof activate !== "function") throw Error("No exported activate function")
  cleanup = await activate(Object.freeze({ request }))
  if (!stopped) write({ type: "ready" })
} catch {
  write({ type: "error" })
  process.exitCode = 1
}
