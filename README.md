# NextGuide

NextGuide is an **independent, all-in-one documentation framework for Next.js**. Build file-based MDX guides, API references, and documentation websites with a built-in component library.

**Documentation:** https://m1nsook.github.io/NextGuide/

## Get started

Inside an existing Next.js project:

```powershell
bun add nextguide@alpha
bunx nextguide init --developer
bun run dev
```

The initializer creates working documentation routes, MDX pages, sidebar navigation, a JSON config and CSS. It detects `app/`, `src/app/`, `pages/`, and `src/pages/`, and handles JavaScript and TypeScript projects. Existing files are not overwritten. Use `--dry-run` to preview the generated files.

Open `/docs` on your application's local Next.js server.

For new applications, first create a Next.js project with `bunx create-next-app@latest my-docs`. See [the complete installation guide](https://m1nsook.github.io/NextGuide/docs/getting-started/installation/) and [the generated-file explanation](https://m1nsook.github.io/NextGuide/docs/getting-started/generated-files/).

**Release note:** `nextguide init` requires `0.0.1-alpha.2` or later. The package is manually published to npm after its release checks pass; earlier alphas are CLI/renderer previews.

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

Before a release, validate the CLI, bundled distribution and documentation build:

```powershell
bun run --cwd packages/nextguide test
bun run --cwd packages/nextguide build
bun run --cwd packages/nextguide test:dist
bun run build:web
```

The npm release is manual and requires an authenticated maintainer. The GitHub Pages workflow publishes a read-only static export; it does not publish to npm.

## License

NextGuide is MIT licensed. Third-party MIT copyright and permission notices, including the original renderer source attribution, are preserved in the repository and npm package notices. See [License & attribution](https://m1nsook.github.io/NextGuide/docs/credits/).
