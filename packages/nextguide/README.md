# NextGuide

**Documentation for Next.js, without a stack of separate packages.**

Create a responsive documentation site with MDX, OpenAPI references, reusable UI components, search, navigation, and customizable appearance.

[![npm version](https://img.shields.io/npm/v/nextguide?label=npm&color=2563eb)](https://www.npmjs.com/package/nextguide)
[![npm downloads](https://img.shields.io/npm/dw/nextguide?label=weekly%20downloads&color=64748b)](https://www.npmjs.com/package/nextguide)
[![MIT License](https://img.shields.io/badge/license-MIT-22a06b)](https://github.com/m1nsook/NextGuide/blob/main/LICENSE)

**[Documentation](https://m1nsook.github.io/NextGuide/)** · **[Components](https://m1nsook.github.io/NextGuide/components/ui/)** · **[GitHub](https://github.com/m1nsook/NextGuide)**

## Get started

From a Next.js project:

```bash
bun add nextguide@alpha
bunx nextguide init --developer
bun run dev
```

Open `/docs` on your local development server. The CLI creates the documentation routes, sample MDX pages, navigation, styling, and component registry, without requiring you to copy files from an example project.

Using npm? Replace the first two commands with `npm install nextguide@alpha` and `npx nextguide init --developer`.

> NextGuide is currently released on the npm alpha channel. The latest development changes and Account Mode are not guaranteed to be present in the published alpha package.

## Features

- **MDX-first content:** author pages inside `content/docs` and track them with Git.
- **Complete documentation layout:** responsive navigation, search, page actions, breadcrumbs, code samples, and table of contents.
- **Component library:** accessible UI primitives, callouts, code windows, tabs, steps, file trees, and more.
- **OpenAPI:** reusable API reference components and rendering tools.
- **Flexible deployment:** Next.js App Router and Pages Router; static hosting supported in Developer Mode.
- **One dependency:** all NextGuide modules ship under the `nextguide` package name. Next.js and React are peer dependencies.

## Developer Mode

Generate your site and customize the defaults:

```bash
bunx nextguide init --developer --system --accent:teal
bunx nextguide page add guides/setup --title "Setup"
```

The initializer supports TypeScript and JavaScript, `app/` and `pages/`, and documentation at `/docs` or the website root. It will not silently overwrite existing project files.

See [Developer Mode](https://m1nsook.github.io/NextGuide/docs/getting-started/developer-mode/), [generated files](https://m1nsook.github.io/NextGuide/docs/getting-started/generated-files/), and [adding pages](https://m1nsook.github.io/NextGuide/docs/getting-started/adding-pages/).

## Account Mode

Account Mode is an **unreleased** browser-managed workflow. Its source implementation includes authenticator-based enrollment, recovery codes, a site setup wizard, and a protected documentation editor. It requires a persistent Next.js App Router server and private storage; it is not a static-hosting feature.

Read the [Account Mode preview and security considerations](https://m1nsook.github.io/NextGuide/docs/getting-started/account-mode/). Do not use the unreleased source preview for production authentication.

## Use the components

```tsx
import { createDocs } from "nextguide/mdx"
import { CodeWindow, Callout, FileTree } from "nextguide/blocks"
import { Button, Dialog, Tabs } from "nextguide/ui"
import "nextguide/styles.css"
```

[Browse live component examples](https://m1nsook.github.io/NextGuide/components/ui/).

## Extension runtime foundation (source preview)

The single NextGuide package now includes `nextguide/extensions`,
`nextguide/extensions/runtime`, `nextguide/extensions/storage`,
`nextguide/extensions/views`, `nextguide/extensions/ui`,
`nextguide/extensions/catalog`, and `nextguide/extensions/network`.

These provide a typed capability contract, a trusted lifecycle host, a
permission-gated message broker, private per-extension JSON storage, and a
declarative React view renderer using NextGuide's own UI components,
and a pinned-key verifier for ngapi's signed, read-only registry index.

**Security boundary:** These APIs do not execute, import, or sandbox
third-party marketplace JavaScript. Signed v2 package verification, OS/browser
isolation, and the Account Mode marketplace installer are still in development.
Content-only v1 add-ons remain compatible. Read the
[extension runtime roadmap](https://m1nsook.github.io/NextGuide/docs/addons/api/).

## Upgrades and support

Preview an existing Developer Mode upgrade with `bunx nextguide upgrade --dry-run`. Generated-file updates require the explicit `--refresh-generated` flag and keep backups. Read [the upgrade guide](https://m1nsook.github.io/NextGuide/docs/getting-started/upgrading/).

For issues and feature requests, visit [GitHub Issues](https://github.com/m1nsook/NextGuide/issues).

## License

[MIT](https://github.com/m1nsook/NextGuide/blob/main/LICENSE). Third-party attribution is included in the published `THIRD_PARTY_NOTICES.md`.
