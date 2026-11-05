# NextGuide

A Next.js documentation platform built from the [MIT-licensed Aria Docs](https://github.com/nisabmohd/Aria-Docs) source.

**Official documentation (built with NextGuide):** https://m1nsook.github.io/NextGuide/

> Early development preview (0.1.0). Rendering and reference website: in progress. Browser setup wizard, administrator, account/developer CLI modes: planned and not yet released.

## Requirements

- **Next.js is required.** The integration roadmap includes both **App Router** (`app/` or `src/app/`) and **Pages Router** (`pages/` or `src/pages/`).
- Bun 1.4+ and Node.js 20+ for local development.
- No Docker required.

## Local development

Open the repository in GitHub Desktop, then in the project's root run:

```powershell
bun install
bun run dev
```

Open **http://localhost:4310**. The workspace builds its local packages before starting the Next.js documentation application.

To validate locally:

```powershell
bun run build:web
bun run lint
bun run check-types
```

## GitHub Pages

The NextGuide documentation in `apps/web/` is deployed from this same repository through `.github/workflows/nextguide-pages.yml` using a **static Next.js export** and a `/NextGuide` base path.

Enable **Settings → Pages → Build and deployment → Source: GitHub Actions** once. The workflow verifies builds on PRs and publishes the documentation after changes reach `main`. The published website is **read-only**: no `/admin` or `/setup` backend can run on GitHub Pages.

See the [Pages deployment guide](https://m1nsook.github.io/NextGuide/docs/deployment/github-pages/).

## First npm alpha

The `packages/nextguide/` workspace contains a real, minimal early-alpha CLI (`nextguide doctor`) for detecting local Next.js projects and either router. The setup wizard, `/admin`, and the CLI's `init` command are **not** implemented yet.

To publish `0.0.1-alpha.0` to the public npm registry, a package owner signs in locally and runs these commands from the project root:

```powershell
cd packages/nextguide
npm whoami
npm pack --dry-run
npm publish --tag alpha
```

Publishing requires npm authentication and 2FA. The publish is **manual**; GitHub Actions only test/build and deploy the read-only docs. Once published, try `bunx nextguide@alpha doctor` from a Next.js project. The unscoped package `nextguide` is public; the repository itself is still under active development.

## Roadmap

- Guided `/setup` wizard (site title, description, accent picker, logo, favicon and settings)
- Terminal-issued one-time owner verification token
- **Account mode** (default): admin credentials and `/admin` browser CMS
- **Developer mode**: edit MDX, OpenAPI and configuration as files
- Next.js App Router and Pages Router adapters

Planned commands, **not implemented/published yet**:

```powershell
bun add nextguide
bunx nextguide init
bunx nextguide init --developer
```

The original `@ariadocs/*` names remain in the source workspace for now as the internal rendering engine.

## License and attribution

NextGuide modifications: MIT, see `LICENSE`. Original Aria Docs source: MIT © Mohd. Nisab, see `LICENSE.txt` and package-level notices. Keep all attribution and license notices when redistributing.
