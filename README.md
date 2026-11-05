# NextGuide

**NextGuide** is a Next.js documentation platform built from the [Aria Docs](https://github.com/nisabmohd/Aria-Docs) foundation. It is under active development; the browser-based first-run setup wizard and administration panel are **not implemented yet**.

This repository currently provides the initial source workspace for local testing and NextGuide branding. Aria Docs' original MIT notices remain in `LICENSE.txt` and the upstream package license files.

## Requirements

- **Next.js is required.** The planned NextGuide integration supports both **App Router** and **Pages Router** (including `src/app` and `src/pages` layouts).
- Bun 1.4+ for installation, builds, and local testing.
- Node.js 20+ for Next.js toolchain compatibility.
- No Docker, GitHub Actions, or hosted CI is required.

## Local development (Windows / Bun)

Clone this repository with **GitHub Desktop**. In the project folder:

```powershell
bun install
bun run dev
```

Open **http://localhost:4310**. The first run builds the local workspace packages before starting Next.js.

Other local commands:

```powershell
bun run build
bun run lint
bun run check-types
bun run test
```

The Next.js application is at `apps/web`; shared Aria Docs libraries are under `packages/`. Package import names remain `@ariadocs/*` temporarily to preserve compatibility while NextGuide is developed.

## Planned installation modes

| Mode | Intended experience |
| --- | --- |
| Account mode (default) | First-run `/setup` wizard, ownership token, admin account, browser-based `/admin` CMS and site settings |
| Developer mode | Manage configuration and MDX/OpenAPI content directly as files, with optional static export |

Planned commands (not available yet): `bun add nextguide`, `bunx nextguide init`, and `bunx nextguide init --developer`. Both Next.js routers are in scope.

## Design direction

Reuse the Next.js/Aria Docs engine, rebrand it to NextGuide, and refine the public documentation and eventual administration UI using the shadcn/ui design language from [BSIS.dev](https://github.com/m1nsook/BSIS.dev). Typography: Inter and JetBrains Mono; dark and light mode; selectable accent color.

## Security direction

The future first-run flow will display a one-time setup token in the server terminal. The owner must enter it at `/setup` before configuration or admin account creation. The token must be hashed in storage, rate-limited and invalidated after setup.

## Licensing

NextGuide additions: MIT, see `LICENSE`. Original Aria Docs source: MIT © Mohd. Nisab, see `LICENSE.txt` and the package-level licenses. Preserve those notices in derivative releases.
