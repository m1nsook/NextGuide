# NextGuide

An independent, all-in-one Next.js documentation framework with MDX, OpenAPI, themes, icons, and an integrated component library.

**Current branch target: `0.0.1-alpha.2` (not automatically published).** The publicly available version may be older. The project initializer, Account Mode, `/setup`, and `/admin` are not implemented yet.

## Install

```powershell
bun add nextguide@alpha
```

Next.js and React are required peers. NextGuide bundles its own documentation engine and UI library; a separate shadcn setup is unnecessary.

## Rendering and content

```tsx
import { createDocs } from "nextguide/mdx"
import { createOpenAPI } from "nextguide/openapi"
import { Docs, OpenAPI } from "nextguide/components"
import "nextguide/styles.css"
```

For client-side MDX rendering, use `nextguide/mdx/client`; for standalone server rendering, use `nextguide/mdx/server`.

## Built-in UI (alpha.2)

```tsx
import { Button, Card, Tabs, Table, Dialog, Input } from "nextguide/ui"
import { CodeWindow, CodeTabs, FileTree, Callout, Steps, Step, LinkCards, LinkCard } from "nextguide/blocks"
import { UIIcon, BrandIcon } from "nextguide/icons"
import { FontPicker, DEFAULT_FONTS } from "nextguide/fonts"
```

These additional components and their documentation gallery are part of the `alpha.2` source branch. Older releases may not export `nextguide/blocks`.

The UI uses shadcn-style tokens with Radix-backed interactive elements. The documentation blocks include copyable/titled code windows, tabs, collapsible file trees, callouts, steps and links. Default CSS is included in `nextguide/styles.css`.

## Fonts

NextGuide will allow first-run selection of independent body, heading, and code fonts, with visual previews: Inter, Geist, IBM Plex Sans, system/Segoe UI, JetBrains Mono, Geist Mono, IBM Plex Mono, and system monospace. Host applications self-host their chosen open fonts via `next/font/google`. Segoe UI is used only when installed as a system font.

## CLI

```powershell
bunx nextguide@alpha --version
bunx nextguide@alpha doctor --json
```

`nextguide init` is planned and will not claim to work before implementation.

## Links

- [Documentation and live component examples](https://m1nsook.github.io/NextGuide/)
- [Repository](https://github.com/m1nsook/NextGuide)
- [License and third-party notices](https://github.com/m1nsook/NextGuide/blob/main/packages/nextguide/THIRD_PARTY_NOTICES.md)

NextGuide is MIT licensed. Original third-party copyrights and permission notices are preserved in `THIRD_PARTY_NOTICES.md`.
