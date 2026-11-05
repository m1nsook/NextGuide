# NextGuide

**NextGuide is an independent, open-source documentation framework for Next.js.** It includes MDX, OpenAPI, documentation blocks, an integrated UI library, icons, and typography in one npm package.

**Official documentation:** https://m1nsook.github.io/NextGuide/

**Repository:** https://github.com/m1nsook/NextGuide

## Current development status

NextGuide is in alpha. The all-in-one renderer, OpenAPI tools, documentation components and static website exist. The expanded UI library and live component gallery are in development for **0.0.1-alpha.2**. The project initializer, authenticated admin, SQLite storage, and first-run ownership verification are not implemented yet.

The public documentation is built from Developer Mode-style **static content**. It is deployed through GitHub Pages and does not need accounts or a database.

## Install

Inside an existing Next.js application:

```powershell
bun add nextguide@alpha
```

The currently published version determines which exports are available. The full component gallery requires version 0.0.1-alpha.2 or newer.

```tsx
import { createDocs } from "nextguide/mdx"
import { createOpenAPI } from "nextguide/openapi"
import { Docs, OpenAPI } from "nextguide/components"
import { Button, Card, Dialog, Table, Tabs } from "nextguide/ui"
import { CodeWindow, CodeTabs, FileTree, Callout, Steps } from "nextguide/blocks"
import { UIIcon, BrandIcon } from "nextguide/icons"
import { FontPicker } from "nextguide/fonts"
import "nextguide/styles.css"
```

Next.js and React are peer dependencies. NextGuide itself is one npm package—no separate documentation-core or shadcn registry installation is required.

## Local development

Clone the repository using GitHub Desktop. From its root on Windows:

```powershell
bun install
bun run dev
```

Open `http://localhost:4310`.

To verify before merging:

```powershell
bun run --cwd packages/nextguide build
bun run --cwd packages/nextguide test:dist
bun run build:web
```

GitHub Actions checks the AIO package and static documentation export on PRs, and deploys Pages when changes merge to `main`.

## Installation modes

**Developer Mode:** MDX/configuration files, Git-native changes and static export. This is how NextGuide's official documentation runs.

**Account Mode (planned):** Persistent Next.js server with embedded SQLite, a single-use terminal-issued ownership token, a protected `/setup` wizard, visual font selection, and `/admin` page management. The server implementation isn't ready for local testing yet.

The planned `bunx nextguide init` and `bunx nextguide init --developer` commands are **not implemented**. The existing CLI supports `doctor` for inspecting Next.js App Router and Pages Router projects.

## Publishing

Release packaging is manual and requires an authenticated npm account. Do not publish directly from the CI workflow. From `packages/nextguide` on Windows use `npm.cmd pack --dry-run` to validate the tarball and `npm.cmd publish --tag alpha --access public` only once packaging and local tests pass.

## License and attribution

NextGuide is MIT licensed. Some original rendering code was adapted from MIT-licensed upstream source; its original copyright and complete permission notice remain in `LICENSE.txt` and `packages/nextguide/THIRD_PARTY_NOTICES.md`. See [License & attribution](https://m1nsook.github.io/NextGuide/docs/credits/).
