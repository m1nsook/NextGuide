# NextGuide

**An all-in-one Next.js documentation framework** with MDX, OpenAPI, UI components, icons, and site typography.

## Install

```powershell
bun add nextguide@alpha
bunx nextguide init --developer
bun run dev
```

The initializer generates a real `/docs` route, starter MDX, sidebar navigation, editable project CSS, and a JSON config. It supports both **App Router** and **Pages Router**, with or without `src/`, in TypeScript or JavaScript projects. Run in the root of an existing Next.js application.

```powershell
bunx nextguide init --developer --dry-run
bunx nextguide init --developer --router app
bunx nextguide doctor --json
```

The installer never silently overwrites project files. When both routers exist, select `--router app` or `--router pages`.

## Add documentation pages

```powershell
bunx nextguide page add changelog --title Changelog
bunx nextguide page add guides/windows --title "Windows setup"
bunx nextguide page add guides/api --dry-run
```

`page add` creates editable MDX files and their nested `_meta.json` navigation, using the existing project's configured `contentDir`. It preserves custom sidebar entries, never overwrites existing pages, and supports `--project <path>`, `--description <text>`, and `--json`.

**Minimum version:** `0.0.1-alpha.2` for the working Developer Mode initializer and expanded UI components. Earlier alpha versions do not include these features. Account Mode, `/setup`, and `/admin` remain in development.

## Check the installed version

```powershell
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
