# NextGuide

NextGuide is an **independent, all-in-one documentation framework for Next.js**. Build file-based MDX guides, API references, and documentation websites with a built-in component library.

**Documentation:** https://m1nsook.github.io/NextGuide/

## Test the current GitHub build (no npm release needed)

**Use this path for Developer Mode acceptance testing.** The `main` branch is the current source of truth; the previously published npm `alpha` may not contain current changes. You do **not** need to copy NextGuide's source into your test application.

1. Open a **separate** [NextGuide GitHub repository](https://github.com/m1nsook/NextGuide) checkout in GitHub Desktop and pull `main`.
2. Open PowerShell in that checkout and run:

```powershell
bun install
bun run pack:dev
```

`pack:dev` builds the one-package distribution, runs the CLI/distribution tests, then creates `nextguide-0.0.1-alpha.2.tgz` in the **repository root**. Nothing is published to npm or uploaded to GitHub.

3. Open PowerShell in your **separate, existing Next.js application** and install **only the tarball**:

```powershell
bun add "C:\path\to\NextGuide\nextguide-0.0.1-alpha.2.tgz"
bunx nextguide --version
bunx nextguide init --developer
bun run dev
```

Use your actual absolute path in the `bun add` command; do not paste the placeholder path unchanged. The result is one normal installed dependency, with no monorepo files or development workspaces in the test app. Open `/docs` on the port reported by Next.js.

**Repeat testing after changes:** pull `main`, rerun `bun run pack:dev`, then rerun `bun add "C:\path\to\NextGuide\nextguide-0.0.1-alpha.2.tgz"` from your test application. This uses the rebuilt package, rather than an older npm alpha.

If you do not have a Next.js test application yet, create one in a **different directory** with `bunx create-next-app@latest my-docs`. Do not install `github:m1nsook/NextGuide` directly: the repository root is a private workspace, **not** the installable `nextguide` package.

## Installing published releases (later)

When Account Mode is complete and a tested npm release is published, the normal installation in a Next.js project will be:

```powershell
bun add nextguide
bunx nextguide init --developer
bun run dev
```

The initializer creates working documentation routes, MDX pages, sidebar navigation, a JSON config and CSS. It detects `app/`, `src/app/`, `pages/`, and `src/pages/`, and handles JavaScript and TypeScript projects. Existing files are not overwritten. Use `--dry-run` to preview the generated files.

Open `/docs` on your application's local Next.js server. To create additional MDX pages and update navigation automatically, use:

```powershell
bunx nextguide page add guides/setup --title Setup
bunx nextguide page add guides/advanced --dry-run
```

The new command reads `nextguide.config.json`, preserves existing pages and sidebar entries, and creates nested directories safely.

For new applications, first create a Next.js project with `bunx create-next-app@latest my-docs`. See [the complete installation guide](https://m1nsook.github.io/NextGuide/docs/getting-started/installation/) and [the generated-file explanation](https://m1nsook.github.io/NextGuide/docs/getting-started/generated-files/).

**Development release note:** Current GitHub changes are not necessarily available under npm's `alpha` tag. Use the tarball instructions above to test what is merged into `main`. Do not publish until Account Mode is complete.

## Installed version and manual update checks

```powershell
bunx nextguide --version
bunx nextguide version check
bunx nextguide version check --tag alpha
```

`--version` runs offline and prints the installed package's version. `version check` contacts npm **only when requested** and compares the installed version with a published dist-tag; `--json` returns machine-readable status. It **does not automatically install or upgrade anything**. NextGuide's public npm release remains on hold until Account Mode is complete.

The version selector in the official documentation sidebar is website-only. Generated Developer Mode sites do not include a NextGuide-branded version control.

## One npm package

```tsx
import { createDocs } from "nextguide/mdx"
import { createOpenAPI } from "nextguide/openapi"
import { Docs, OpenAPI } from "nextguide/components"
import { Button, Dialog, Table, Tabs } from "nextguide/ui"
import { CodeWindow, CodeTabs, FileTree } from "nextguide/blocks"
import { UIIcon, BrandIcon } from "nextguide/icons"
import "nextguide/styles.css"
```

No separate renderer packages or shadcn registry installer are required. React and Next.js are host framework peer dependencies.

## Developer Mode and Account Mode

**Developer Mode** is file-first, database-free, and suitable for static hosting or regular Next.js deployment. NextGuide's official documentation uses this model on GitHub Pages.

**Account Mode** is planned. The protected ownership wizard, SQLite database, authenticated editor, and `/admin` are not implemented yet and are not advertised as working.

## Develop NextGuide

Clone the project with GitHub Desktop and run:

```powershell
bun install
bun run dev
```

Documentation preview: http://localhost:4310

Before a release, validate the CLI, bundled distribution and documentation build (including `npm pack --dry-run` on Windows):

```powershell
bun run --cwd packages/nextguide test
bun run --cwd packages/nextguide build
bun run --cwd packages/nextguide test:dist
bun run build:web
```

The npm release is manual and requires an authenticated maintainer. The GitHub Pages workflow publishes a read-only static export; it does not publish to npm.

## License

NextGuide is MIT licensed. Third-party MIT copyright and permission notices, including the original renderer source attribution, are preserved in the repository and npm package notices. See [License & attribution](https://m1nsook.github.io/NextGuide/docs/credits/).
