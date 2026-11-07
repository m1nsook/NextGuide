# NextGuide

**Build documentation that feels like part of your Next.js application.**

NextGuide is an all-in-one documentation framework for Next.js. Write MDX guides, publish API references, and build accessible, responsive documentation with reusable components—all in one `nextguide` package.

[![npm version](https://img.shields.io/npm/v/nextguide?label=npm&color=2563eb)](https://www.npmjs.com/package/nextguide)
[![npm downloads](https://img.shields.io/npm/dw/nextguide?label=weekly%20downloads&color=64748b)](https://www.npmjs.com/package/nextguide)
[![License: MIT](https://img.shields.io/badge/license-MIT-22a06b)](LICENSE)
[![Next.js 15–16](https://img.shields.io/badge/Next.js-15%20%7C%2016-111827)](https://nextjs.org/)

**[Documentation](https://m1nsook.github.io/NextGuide/)** · **[Components](https://m1nsook.github.io/NextGuide/components/ui/)** · **[npm](https://www.npmjs.com/package/nextguide)** · **[Report an issue](https://github.com/m1nsook/NextGuide/issues)**

## Quick start

Start with an existing Next.js application, or create one:

```bash
bunx create-next-app@latest my-docs
cd my-docs
bun add nextguide@alpha
bunx nextguide init --developer
bun run dev
```

Visit `/docs` on the address printed by Next.js. NextGuide generates documentation pages, navigation metadata, a component registry, and the required styles and routes. You can inspect the changes beforehand with `bunx nextguide init --developer --dry-run`.

> **Release status:** NextGuide is currently published on the npm `alpha` channel. The published version may lag behind development; Account Mode and recent navigation fixes are not yet part of a verified stable release. See the [installation guide](https://m1nsook.github.io/NextGuide/docs/getting-started/installation/) for the supported workflow.

## What you get

- **Ready-to-use documentation:** responsive sidebar, search, table of contents, breadcrumbs, page tools, and light/dark appearance.
- **MDX authoring:** editable files inside your project, with callouts, code examples, tabs, file trees, cards, and more.
- **API references:** OpenAPI support from the same package.
- **Your stack, your hosting:** Next.js App Router or Pages Router, TypeScript or JavaScript; static deployment options for Developer Mode.
- **Safe changes:** CLI commands generate files in the appropriate directories and preserve existing user-authored content.

## Choose a workflow

| Developer Mode | Account Mode |
| --- | --- |
| Edit MDX and configuration files using your editor and Git. | Manage content and site settings through a browser dashboard. |
| Works with static exports and standard Next.js deployments. | Requires a persistent Next.js server and private storage. |
| **Available in the published alpha** (features vary by alpha version). | **In development; not yet published to npm.** |

Learn more: [Developer Mode](https://m1nsook.github.io/NextGuide/docs/getting-started/developer-mode/) · [Account Mode preview](https://m1nsook.github.io/NextGuide/docs/getting-started/account-mode/).

## Add a page

```bash
bunx nextguide page add guides/installation --title "Installation"
```

The CLI creates the MDX file and updates the sidebar metadata. [Learn about page creation](https://m1nsook.github.io/NextGuide/docs/getting-started/adding-pages/).

## Components from one package

```tsx
import { CodeWindow, CodeTabs, Callout, FileTree } from "nextguide/blocks"
import { Button, Dialog, Tabs } from "nextguide/ui"
import { createDocs } from "nextguide/mdx"
import "nextguide/styles.css"
```

Explore the [component catalog](https://m1nsook.github.io/NextGuide/components/ui/) for demos and usage examples.

## Upgrade an existing site

Don't reinitialize an existing project. Use `bunx nextguide upgrade --dry-run` to preview configuration changes. To adopt updated generated layouts, use `bunx nextguide upgrade --refresh-generated --dry-run` and review the backups before applying. Your MDX pages and `_meta.json` navigation are preserved. See [upgrading safely](https://m1nsook.github.io/NextGuide/docs/getting-started/upgrading/).

## Contributing

Bug reports, documentation improvements, and code contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for source builds, local package testing, and development commands. For 1.0.0 progress, follow the [release checklist](https://github.com/m1nsook/NextGuide/issues/31).

## License

MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](packages/nextguide/THIRD_PARTY_NOTICES.md) for third-party attribution.
