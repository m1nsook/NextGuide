# NextGuide

**An all-in-one Next.js documentation framework** with MDX, OpenAPI, UI components, icons, and site typography.

## Fully equipped Developer Mode starter

Running `bunx nextguide init --developer` now creates a real documentation site instead of the earlier minimal skeleton. The generated site has responsive navigation, local Ctrl/Cmd+K search, a table of contents, breadcrumbs, page actions, light/dark/system controls, a preconfigured MDX component registry and live examples. **One package:** `nextguide` provides both the layout and components. See [the generated project file map](https://m1nsook.github.io/NextGuide/docs/getting-started/generated-files/).

## Install for development testing (before npm publication)

To test a current GitHub build in a **different** Next.js application, run `bun install` and `bun run pack:dev` at the root of the NextGuide source checkout. This builds and tests `packages/nextguide` and writes an installable `nextguide-0.0.1-alpha.2.tgz` package archive in the source checkout's root.

In the **separate application** run:

```sh
bun add "C:\path\to\NextGuide\nextguide-0.0.1-alpha.2.tgz"
bunx nextguide init --developer
bun run dev
```

Replace the path with the actual absolute path to the generated file. The application installs only the packaged NextGuide dependency, not the repository or its workspace tooling. The npm `alpha` tag does **not** represent the current GitHub build.

## Install from npm (after Account Mode release)

```sh
bun add nextguide
bunx nextguide init --developer
bun run dev
```

The initializer generates a real `/docs` route, starter MDX, sidebar navigation, editable project CSS, and a JSON config. It supports both **App Router** and **Pages Router**, with or without `src/`, in TypeScript or JavaScript projects. Run in the root of an existing Next.js application.

```sh
bunx nextguide init --developer --dry-run
bunx nextguide init --developer --router app
bunx nextguide doctor --json
```

The installer never silently overwrites project files. When both routers exist, select `--router app` or `--router pages`.

## Documentation location and compatibility

The installer asks whether to use `/docs` (default) or the homepage `/`. For automated installs, use `--base-path /docs --yes` or `--base-path / --replace-home --yes`. The latter backs up an existing homepage rather than silently deleting it.

Generated App Router files omit `dynamicParams` and use Suspense around asynchronous navigation and MDX rendering for Next.js 16.4 Cache Components. Generated files resolve **all local imports** (documentation libraries, stylesheet, project config and Pages Router `_app`) against the project's existing TypeScript/JavaScript aliases, using correct relative imports where an alias cannot reach the target.

From the NextGuide source checkout, `bun run compat:next` tests packaged installations with current Next.js. A manual-only GitHub Actions workflow is available for stable/canary compatibility checks and opt-in update PRs.


## Developer Mode appearance and safe upgrades

```sh
bunx nextguide init --developer --system --accent:teal
bunx nextguide upgrade --dry-run
bunx nextguide upgrade
bunx nextguide upgrade --refresh-generated --dry-run
```

Choose `--light` (the default), `--dark`, or `--system`. Select from blue, red, green, purple, yellow, orange, teal, and pink accessible accent presets. Existing projects use `upgrade` without recreating the Next.js application; MDX and navigation are preserved. The optional `--refresh-generated` step is explicit, makes backups, and only replaces marked NextGuide starter files. Read the [upgrade guide](https://m1nsook.github.io/NextGuide/docs/getting-started/upgrading/).

## Add documentation pages

```sh
bunx nextguide page add changelog --title Changelog
bunx nextguide page add guides/windows --title "Windows setup"
bunx nextguide page add guides/api --dry-run
```

`page add` creates editable MDX files and their nested `_meta.json` navigation, using the existing project's configured `contentDir`. It preserves custom sidebar entries, never overwrites existing pages, and supports `--project <path>`, `--description <text>`, and `--json`.

**Minimum version:** `0.0.1-alpha.2` for published Developer Mode. Account Mode authentication is being built on a source branch; it is **not yet published to npm**, and the visual editor is still planned.

## Check the installed version

```sh
bunx nextguide --version
bunx nextguide version check
bunx nextguide version check --tag alpha --json
```

The first command is offline. The explicit `version check` command compares the local version against npm's `latest` tag by default, or `alpha` when requested. It reports unpublished versions and network errors clearly and does not change any packages or files.

The official NextGuide documentation site's version selector is **not** generated into users' projects.

## Use the built-in components

```tsx
import { createDocs } from "nextguide/mdx"
import { createOpenAPI } from "nextguide/openapi"
import { Docs, OpenAPI } from "nextguide/components"
import { Button, Card, Dialog, Table } from "nextguide/ui"
import { CodeWindow, CodeTabs, FileTree, Callout, Steps } from "nextguide/blocks"
import { UIIcon, BrandIcon } from "nextguide/icons"
import { FontPicker, DEFAULT_FONTS } from "nextguide/fonts"
import "nextguide/styles.css"
```

Next.js and React are peer dependencies. All NextGuide documentation modules and UI components are part of the one `nextguide` package; no separate registry installation is necessary.

## Documentation

- [Install and start the server](https://m1nsook.github.io/NextGuide/docs/getting-started/installation/)
- [Generated project files, with the full code](https://m1nsook.github.io/NextGuide/docs/getting-started/generated-files/)
- [Component gallery with exact live demos](https://m1nsook.github.io/NextGuide/components/ui/)
- [MDX and OpenAPI](https://m1nsook.github.io/NextGuide/docs/)

## License and credit

NextGuide is MIT licensed. The full original upstream MIT copyright and permission notice is included in `THIRD_PARTY_NOTICES.md`, alongside other third-party licensing information. Brand assets remain trademarks of their respective owners.

## Account Mode preview (source branch only)

Account Mode combines QR-based authenticator enrollment and recovery codes with a browser-based site wizard and authenticated documentation studio. The studio manages MDX pages, sidebar ordering, site identity, fonts, accents, media, and account security. There are no passwords or mandatory emails.

```sh
# Install a locally built NextGuide package containing Account Mode first.
bunx nextguide init --account
bun run dev
# Open /setup and enter the one-time token printed by the CLI.
```

This requires App Router and a **persistent Next.js server**, not `output: "export"`. For VPS hosting, configure `NEXTGUIDE_DATA_DIR` as a private persistent directory and `NEXTGUIDE_PUBLIC_URL` as the public HTTPS origin. The site wizard and CMS editor are included in source, pending packaged-install and build verification before npm publication.

Read the [Account Mode setup and security notes](https://m1nsook.github.io/NextGuide/docs/getting-started/account-mode/).
