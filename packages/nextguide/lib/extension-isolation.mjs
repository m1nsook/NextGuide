/**
 * Account Mode-only, Linux prototype for executable add-on isolation.
 *
 * Third-party JS NEVER runs in the Next.js host process. The compiled single
 * module is SHA-256 checked against the authorization-bound release digest,
 * staged in a private directory, and executed behind explicit Linux user,
 * mount, network, IPC and PID namespaces via bubblewrap. prlimit and a
 * watchdog bound CPU, address space, descriptors and wall time.
 *
 * This is NOT a general marketplace installer, archive verifier, Windows
 * sandbox, or an assertion that Linux namespaces defend against kernel bugs.
 * Deploy under a dedicated UNPRIVILEGED OS user; use stronger cgroup/VM
 * isolation before enabling general public third-party extensions.
 */
import { spawn as nodeSpawn } from "node:child_process"
import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const worker = fileURLToPath(new URL("./extension-worker.mjs", import.meta.url))
const HASH = /^[a-f0-9]{64}$/
const MESSAGE_LIMIT = 65_536
const OUTPUT_LIMIT = 1024 * 1024
const MAX_SOURCE = 1024 * 1024
const DEFAULT_LIFETIME = 15_000
const ID = /^[a-zA-Z0-9_-]{1,64}$/

function error(code, detail) {
  const failure = new Error(detail)
  failure.code = code
  return failure
}

function executable(path) {
  if (typeof path !== "string" || !path.startsWith("/") || !existsSync(path)) {
    throw error("SANDBOX_UNAVAILABLE", "Required trusted Linux sandbox binary is missing.")
  }
  const target = realpathSync(path)
  if (!target.startsWith("/usr/")) {
    throw error("SANDBOX_UNAVAILABLE", "Sandbox executables must resolve inside /usr.")
  }
  return path
}

/** Does not accept a marketplace-supplied command, path, or environment. */
export function createLinuxExtensionRunner({
  broker,
  bubblewrap = "/usr/bin/bwrap",
  prlimit = "/usr/bin/prlimit",
  node = "/usr/bin/node",
  startupMs = 5_000,
  lifetimeMs = DEFAULT_LIFETIME,
  cpuSeconds = 5,
  addressSpaceBytes = 8 * 1024 ** 3,
  spawn = nodeSpawn,
} = {}) {
  if (!broker || typeof broker.openSession !== "function") {
    throw error("CONFIGURATION", "A trusted extension capability broker is required.")
  }
  if (![startupMs, lifetimeMs, cpuSeconds, addressSpaceBytes].every(Number.isSafeInteger) ||
    startupMs < 100 || startupMs > 30_000 ||
    lifetimeMs < startupMs || lifetimeMs > 60_000 ||
    cpuSeconds < 1 || cpuSeconds > 30 ||
    addressSpaceBytes < 1024 ** 3 || addressSpaceBytes > 16 * 1024 ** 3) {
    throw error("CONFIGURATION", "Invalid extension execution limits.")
  }
  if (typeof spawn !== "function") throw error("CONFIGURATION", "Invalid process launcher.")

  return {
    async start({ manifest, code, artifactSha256 } = {}) {
      // Never downgrade to an ordinary child process/worker on other systems,
      // under root, or when the Linux sandbox is not available.
      if (process.platform !== "linux" || typeof process.getuid !== "function" || process.getuid() === 0) {
        throw error("SANDBOX_UNAVAILABLE", "Executable add-ons require an unprivileged Linux sandbox.")
      }
      const bwrap = executable(bubblewrap)
      const limiter = executable(prlimit)
      const runtime = executable(node)
      if (typeof code !== "string" || !HASH.test(artifactSha256)) {
        throw error("INVALID_ARTIFACT", "Expected a compiled module and lowercase SHA-256.")
      }
      const bytes = Buffer.from(code, "utf8")
      if (bytes.length < 1 || bytes.length > MAX_SOURCE ||
          createHash("sha256").update(bytes).digest("hex") !== artifactSha256) {
        throw error("INVALID_ARTIFACT", "Extension bytes do not match the approved release digest.")
      }

      // Authorization binds the exact manifest, digest and owner grants.
      const session = await broker.openSession(manifest, artifactSha256)
      let scratch
      let child
      let started = false
      let stopped = false
      let startupTimer
      let lifetimeTimer
      let resolveStartup
      let rejectStartup
      let pending = 0
      let stdoutBuffer = ""
      let stdoutBytes = 0
      let stderrBytes = 0

      const ready = new Promise((resolve, reject) => {
        resolveStartup = resolve
        rejectStartup = reject
      })
      function terminate(code, message) {
        if (stopped) return
        stopped = true
        clearTimeout(startupTimer)
        clearTimeout(lifetimeTimer)
        session.close()
        if (!started) rejectStartup(error(code, message))
        if (child) {
          // The wrapper execs bwrap and shares this process group with the
          // sandboxed Node descendants; kill the group, not just the leader.
          try { process.kill(-child.pid, "SIGKILL") }
          catch { try { child.kill("SIGKILL") } catch { /* already exited */ } }
        }
        if (scratch) rmSync(scratch, { force: true, recursive: true })
      }
      function send(payload) {
        if (stopped) return
        const wire = JSON.stringify(payload) + "\n"
        if (Buffer.byteLength(wire) > MESSAGE_LIMIT ||
            child.stdin.destroyed || child.stdin.writableLength > OUTPUT_LIMIT) {
          terminate("IPC_LIMIT", "Extension IPC response exceeded limits.")
          return
        }
        child.stdin.write(wire, err => {
          if (err && !stopped) terminate("IPC_ERROR", "Extension IPC disconnected.")
        })
      }
      async function onMessage(message) {
        if (!message || typeof message !== "object" || Array.isArray(message)) {
          terminate("IPC_PROTOCOL", "Invalid extension IPC message.")
          return
        }
        if (message.type === "ready" && !started) {
          started = true
          clearTimeout(startupTimer)
          resolveStartup(handle)
          return
        }
        if (message.type === "error") {
          terminate("EXTENSION_ERROR", "Extension activation failed.")
          return
        }
        if (message.type !== "call" || typeof message.id !== "string" ||
            !ID.test(message.id) || typeof message.method !== "string" || pending >= 16) {
          terminate("IPC_PROTOCOL", "Invalid or excessive extension IPC request.")
          return
        }
        pending++
        try {
          const result = await session.handle({
            id: message.id, method: message.method, params: message.params ?? {},
          })
          send({ type: "result", ...result })
        } catch {
          send({ type: "result", id: message.id, ok: false,
            error: { code: "INTERNAL_ERROR", message: "Extension capability failed." } })
        } finally { pending-- }
      }
      const handle = Object.freeze({
        extensionId: session.extensionId,
        contributions: () => stopped ? [] : session.contributions(),
        stop: () => terminate("STOPPED", "Extension was stopped."),
        get active() { return started && !stopped },
      })

      try {
        scratch = mkdtempSync(join(tmpdir(), "nextguide-extension-"))
        const source = join(scratch, "entry.mjs")
        writeFileSync(source, bytes, { mode: 0o400, flag: "wx" })
        // bubblewrap maps the invoking unprivileged host UID into a user
        // namespace. The source is read-only inside the sandbox.
        chmodSync(source, 0o444)

        // Explicit --unshare-user is essential: --unshare-all uses
        // --unshare-user-try on some bubblewrap versions and may downgrade.
        const args = [
          "--cpu=" + cpuSeconds + ":" + cpuSeconds,
          "--as=" + addressSpaceBytes + ":" + addressSpaceBytes,
          "--nofile=64:64", "--fsize=1048576:1048576",
          "--", bwrap,
          "--unshare-user", "--unshare-pid", "--unshare-net",
          "--unshare-ipc", "--unshare-uts",
          "--die-with-parent", "--clearenv",
          "--ro-bind", "/usr", "/usr",
        ]
        for (const lib of ["/lib", "/lib64"]) {
          if (existsSync(lib)) args.push("--ro-bind", lib, lib)
        }
        args.push(
          "--dir", "/extension", "--dir", "/runner",
          "--ro-bind", source, "/extension/entry.mjs",
          "--ro-bind", worker, "/runner/worker.mjs",
          "--tmpfs", "/tmp", "--dev", "/dev",
          "--setenv", "HOME", "/tmp", "--setenv", "PATH", "/usr/bin",
          "--chdir", "/tmp",
          "--", runtime, "--no-addons", "--max-old-space-size=128",
          "/runner/worker.mjs"
        )
        child = spawn(limiter, args, {
          detached: true, shell: false, stdio: ["pipe", "pipe", "pipe"],
          env: { PATH: "/usr/bin" }, windowsHide: true,
        })
        child.on("error", () => terminate("SANDBOX_UNAVAILABLE", "Sandbox process failed to start."))
        child.on("exit", () => terminate("SANDBOX_EXIT", "Sandbox process exited."))
        child.stdout.on("data", chunk => {
          if (stopped) return
          stdoutBytes += chunk.length
          if (stdoutBytes > OUTPUT_LIMIT) {
            terminate("IPC_LIMIT", "Extension exceeded IPC output quota.")
            return
          }
          stdoutBuffer += chunk.toString("utf8")
          if (Buffer.byteLength(stdoutBuffer) > MESSAGE_LIMIT) {
            terminate("IPC_LIMIT", "Extension IPC message was too large.")
            return
          }
          let offset
          while (!stopped && (offset = stdoutBuffer.indexOf("\n")) >= 0) {
            const line = stdoutBuffer.slice(0, offset)
            stdoutBuffer = stdoutBuffer.slice(offset + 1)
            let message
            try { message = JSON.parse(line) }
            catch { terminate("IPC_PROTOCOL", "Extension emitted invalid IPC."); return }
            void onMessage(message)
          }
        })
        child.stderr.on("data", chunk => {
          stderrBytes += chunk.length
          if (stderrBytes > 32_768) {
            terminate("IPC_LIMIT", "Extension stderr quota exceeded.")
          }
        })
        startupTimer = setTimeout(() =>
          terminate("STARTUP_TIMEOUT", "Sandbox did not become ready."), startupMs)
        lifetimeTimer = setTimeout(() =>
          terminate("LIFETIME_LIMIT", "Sandbox execution time limit reached."), lifetimeMs)
        return await ready
      } catch (cause) {
        terminate("SANDBOX_UNAVAILABLE", "Sandbox could not be started.")
        throw cause
      }
    },
  }
}
