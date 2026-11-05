# NextGuide CLI — alpha

[NextGuide](https://github.com/m1nsook/NextGuide) is a documentation platform built on **Next.js** and the MIT-licensed **Aria Docs** rendering libraries.

**This is an early developer-preview CLI, not a full NextGuide installation.** It does not yet scaffold a documentation site or implement the first-run wizard, user accounts, or `/admin`. Please do not use it to set up a production documentation site.

## Requirements

- Node.js 20 or newer (for the CLI)
- A Next.js project (Next.js is mandatory for NextGuide)
- Bun is recommended for NextGuide's developer workflow

## Available commands

Run from your Next.js project directory:

```powershell
bunx nextguide@alpha --help
bunx nextguide@alpha --version
bunx nextguide@alpha doctor
bunx nextguide@alpha doctor --json
```

`doctor` checks whether the current project declares Next.js, and detects either `app/`, `src/app/`, `pages/`, or `src/pages/`. It doesn't modify any files or send data to a server.

The `init`, `/setup`, and `/admin` flows are being developed and are not included in this alpha.

## Documentation

- [Official documentation](https://m1nsook.github.io/NextGuide/)
- [Source code](https://github.com/m1nsook/NextGuide)

## Attribution

NextGuide is built from the MIT-licensed [Aria Docs](https://github.com/nisabmohd/Aria-Docs) project. The renderer's original license and copyright notices remain in the source repository. The CLI package is MIT-licensed, copyright © 2026 민숙 MISO.
