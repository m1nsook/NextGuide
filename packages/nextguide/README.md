# NextGuide — all-in-one framework alpha

NextGuide is an MIT-licensed, Next.js-based documentation framework built from the Aria Docs renderer. Install **one** package instead of separately installing core, MDX, OpenAPI, UI libraries, and icon packs.

> **Development status:** 0.0.1-alpha.1 is a work in progress in the repository and has **not been published**. The published alpha.0 contains only the `doctor` CLI. The project initializer, setup-token verification, account mode, and `/admin` are still under development.

## Installation (next alpha)

```sh
bun add nextguide
```

Next.js and React are required peer dependencies. For a new project, install Next.js and React first; the future `nextguide init` command will scaffold them.

## Public API targets

```tsx
import { createDocs } from "nextguide/mdx"
import { createOpenAPI } from "nextguide/openapi"
import { Docs, OpenAPI } from "nextguide/components"
import { Button, Card, Input } from "nextguide/ui"
import { UIIcon, BrandIcon } from "nextguide/icons"
import { FontPicker, DEFAULT_FONTS } from "nextguide/fonts"
import "nextguide/styles.css"
```

These are the targets for **alpha.1**, and should only be used after the distribution tests pass and alpha.1 is published. `nextguide/mdx/server` and `nextguide/mdx/client` provide distinct server/client rendering entrypoints.

The included shadcn-style UI components are compiled and bundled with NextGuide — no shadcn CLI is required. Lucide provides interface icons, while Simple Icons supplies selected popular brands; users can still import specific icons from their original libraries for more choices.

## First-run font choice

The future `/setup` wizard will show a live, rendered font comparison in the browser. Visitors can preview **body, heading, and code fonts separately**, using Inter, Geist, IBM Plex Sans, Segoe UI, System UI, JetBrains Mono, Geist Mono, IBM Plex Mono, and a system monospace option.

Google fonts are loaded and self-hosted by the Next.js application's static `next/font/google` declarations, not dynamically by name. `FontPicker` receives the set of loaded font CSS variables. Segoe UI is a **system-only** font and uses a fallback on devices without it. Choices are saved as font IDs in the site's configuration; the wizard must verify the server's one-time ownership token before committing account-mode settings.

## Current CLI

```sh
bunx nextguide@alpha --help
bunx nextguide@alpha doctor --json
```

`doctor` checks for Next.js and App Router/Pages Router directories. The project initializer isn't implemented yet.

## Licensing

NextGuide is MIT-licensed and includes MIT-licensed source derived from [Aria Docs](https://github.com/nisabmohd/Aria-Docs). See `THIRD_PARTY_NOTICES.md`. Brand logos are trademarks of their owners.

## Links

- [Source repository](https://github.com/m1nsook/NextGuide)
- [Documentation](https://m1nsook.github.io/NextGuide/)
