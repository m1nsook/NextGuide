import assert from "node:assert/strict"
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const output = join(root, "dist")

test("all-in-one exports are present", () => {
  for (const key of [".", "./core", "./mdx", "./mdx/server", "./mdx/client", "./openapi", "./components", "./ui", "./icons", "./blocks", "./ui/primitives", "./ui/interactive", "./fonts", "./fonts/catalog", "./site/next", "./styles.css", "./extensions", "./extensions/runtime", "./extensions/views", "./extensions/ui", "./extensions/storage", "./extensions/catalog"]) {
    assert.ok(manifest.exports[key], key)
  }
})
test("no published workspace packages are needed", () => {
  assert.ok(manifest.peerDependencies.next)
  assert.ok(manifest.peerDependencies.react)
  assert.equal(Object.keys(manifest.dependencies).some(dep => dep.startsWith("@ariadocs/")), false)
  assert.equal(JSON.stringify(manifest.dependencies).includes("workspace:"), false)
})
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => {
    const absolute = join(path, entry.name)
    return entry.isDirectory() ? walk(absolute) : [absolute]
  })
}
test("every published export resolves to a compiled file", () => {
  for (const [name, target] of Object.entries(manifest.exports)) {
    const filenames = typeof target === "string" ? [target] : [target.default, target.types]
    for (const filename of filenames) assert.ok(existsSync(join(root, filename)), name + ": " + filename)
  }
  for (const filename of Object.values(manifest.imports["#read-file"])) {
    assert.ok(existsSync(join(root, filename)), filename)
  }
})
test("compiled code contains no internal workspace imports", () => {
  for (const filename of walk(output).filter(x => /\.(?:js|d\.ts|css)$/.test(x))) {
    const source = readFileSync(filename, "utf8")
    assert.doesNotMatch(source, /@(?:ariadocs|nextguide-internal)\/(?:core|mdx|openapi|components)/, filename)
    assert.doesNotMatch(source, /@workspace\//, filename)
  }
})

test("public JS modules import from the self-contained package", async () => {
  const [core, mdx, api, components, ui, icons, fonts] = await Promise.all([
    import("nextguide/core"),
    import("nextguide/mdx"),
    import("nextguide/openapi"),
    import("nextguide/components"),
    import("nextguide/ui"),
    import("nextguide/icons"),
    import("nextguide/fonts"),
  ])
  assert.equal(typeof core.slugify, "function")
  assert.equal(typeof mdx.createDocs, "function")
  assert.equal(typeof api.parseOpenAPI, "function")
  assert.ok(components.Docs)
  assert.equal(typeof components.DocsStarterShell, "function")
  assert.equal(typeof ui.Button, "function")
  assert.equal(typeof icons.BrandIcon, "function")
  assert.equal(typeof fonts.FontPicker, "function")
  assert.equal(typeof fonts.validateFontSelection, "function")
  const blocks = await import("nextguide/blocks")
  assert.equal(typeof blocks.CodeWindow, "function")
  assert.equal(typeof blocks.CodeTabs, "function")
  assert.equal(typeof blocks.FileTree, "function")
  assert.equal(typeof ui.DialogContent, "function")
  assert.equal(typeof ui.TabsTrigger, "function")
  assert.equal(typeof ui.Table, "function")
})

test("all engine modules live in the single NextGuide source package", () => {
  const projectRoot = dirname(dirname(root))
  for (const legacy of ["lib-core", "lib-mdx", "lib-openapi", "lib-components", "ui"]) {
    assert.equal(existsSync(join(projectRoot, "packages", legacy, "package.json")), false,
      "Unexpected extra workspace package: " + legacy)
  }
  for (const module of ["core", "mdx", "openapi", "components", "ui", "blocks", "fonts", "icons"]) {
    assert.ok(existsSync(join(root, "src", module)),
      "Missing NextGuide source module: " + module)
  }
})

test("Developer Mode page creation ships in the CLI package", () => {
  for (const filename of ["bin/nextguide.mjs", "lib/init.mjs", "lib/page.mjs", "lib/page-cli.mjs"]) {
    assert.ok(existsSync(join(root, filename)), filename + " is required in the npm package")
  }
})

test("documentation site does not depend on the removed UI workspace", () => {
  const website = join(dirname(dirname(root)), "apps", "web")
  for (const file of [
    "package.json",
    "next.config.mjs",
    "postcss.config.mjs",
    "app/layout.tsx",
    "components/docs-sidebar.tsx",
  ]) {
    const source = readFileSync(join(website, file), "utf8")
    assert.doesNotMatch(source, /@workspace\/ui|packages\/ui\//, file)
  }
  assert.equal(existsSync(join(website, "components.json")), false,
    "Removed shadcn workspace registry config should not be restored")
})

test("official and generated documentation use the same package-owned version selector", () => {
  const projectRoot = dirname(dirname(root))
  const siteLayout = readFileSync(join(projectRoot, "apps/web/app/(docs)/layout.tsx"), "utf8")
  const side = readFileSync(join(root, "src/components/site/sidebar.tsx"), "utf8")
  const selector = readFileSync(join(root, "src/components/site/version-selector.tsx"), "utf8")
  const generated = readFileSync(join(root, "lib/init.mjs"), "utf8")
  assert.match(siteLayout, /nextguidePackage\.version/)
  assert.match(side, /DocsVersionSelector/)
  assert.match(selector, /Development/)
  assert.match(generated, /fullLayoutSource/)
  assert.match(readFileSync(join(root, "lib/starter-templates.mjs"), "utf8"), /DocsSiteSidebar/)
})
test("official documentation keyboard shortcut uses Lucide Command, not literal glyph", () => {
  const projectRoot = dirname(dirname(root))
  const search = readFileSync(join(root, "src/components/site/search.tsx"), "utf8")
  assert.match(search, /<Command/)
  assert.doesNotMatch(search, /⌘K/)
})

test("code window and tabbed code use only their outer border and radius", () => {
  const styles = readFileSync(join(root, "src/blocks/styles.css"), "utf8")
  const source = readFileSync(join(root, "src/blocks/index.tsx"), "utf8")
  assert.match(styles, /\.ng-code-window\s*>\s*\.ng-code-pre\s*\{[^}]*border:0;[^}]*border-radius:0/)
  assert.match(styles, /\.ng-code-tabs-panel\s*>\s*\.ng-code-window\s*>\s*\.ng-code-pre\s*\{[^}]*border:0;[^}]*border-radius:0/)
  assert.match(styles, /\.ng-code-tabs-panel>\.ng-code-window\{margin:0;border:0;border-radius:0\}/)
  assert.match(source, /<pre className=\{"ng-code-pre"/)
  assert.match(source, /className="ng-code-tabs-panel"/)
})

test("official docs search displays OS-appropriate keyboard shortcut without hydration mismatch", () => {
  const website = join(dirname(dirname(root)), "apps/web")
  const search = readFileSync(join(root, "src/components/site/search.tsx"), "utf8")
  assert.match(search, /useSyncExternalStore\(noSubscribe, isMacPlatform, nonAppleServerSnapshot\)/)
  assert.match(search, /userAgentData\?\.platform/)
  assert.match(search, /"Command plus K" : "Control plus K"/)
  assert.match(search, /mac \? <Command[^>]+> : <span>Ctrl<\/span>/)
  assert.match(search, /<SearchShortcut \/>/)
  assert.match(search, /event\.metaKey \|\| event\.ctrlKey/)
})


test("language-aware code windows include TypeScript and JavaScript icons and a Radix variant picker", () => {
  const source = readFileSync(join(root, "src/blocks/index.tsx"), "utf8")
  const styles = readFileSync(join(root, "src/blocks/styles.css"), "utf8")
  const docs = readFileSync(join(dirname(dirname(root)), "apps/web/contents/components/ui/code-windows.mdx"), "utf8")
  assert.match(source, /siJavascript, siTypescript/)
  assert.match(source, /TYPESCRIPT_LANGUAGES/)
  assert.match(source, /JAVASCRIPT_LANGUAGES/)
  assert.match(source, /key === "json" \? FileJson2/)
  assert.match(source, /key === "mdx"/)
  assert.match(source, /SHELL_LANGUAGES\.has\(key\) \? Terminal/)
  assert.match(source, /alternatives\?: CodeVariant\[\]/)
  assert.match(source, /<Select value=\{String\(index\)\} onValueChange=/)
  assert.match(source, /<SelectTrigger aria-label="Select code language"/)
  assert.match(source, /<CopyButton value=\{selectedCode\}/)
  assert.match(source, /tokenize\(code, language\)/)
  assert.match(source, /highlightCode\(selectedCode, selectedLanguage\)/)
  assert.match(source, /<pre className=\{"ng-code-pre"/)
  assert.match(styles, /\.ng-code-header \.ng-code-language-select/)
  assert.match(docs, /language="typescript"/)
  assert.match(docs, /language: "javascript"/)
})


test("reusable page actions do not depend on Next.js module resolution or unavailable brand icons", () => {
  const source = readFileSync(join(root, "src/components/docs/page-tools.tsx"), "utf8")
  assert.doesNotMatch(source, /from ["']next\/link["']/)
  assert.doesNotMatch(source, /\bGithub\b/)
  assert.match(source, /import \{ siGithub \} from "simple-icons"/)
  assert.match(source, /siGithub\.path/)
  assert.match(source, /<a href=\{item.href\}/)
})


test("shipped Developer Mode starter contains full styles, search, navigation and MDX registry", () => {
  const shell = readFileSync(join(root, "src/components/docs/starter-shell.tsx"), "utf8")
  const css = readFileSync(join(root, "src/components/styles/starter.css"), "utf8")
  const imports = readFileSync(join(root, "src/components/styles/index.css"), "utf8")
  const generator = readFileSync(join(root, "lib/init.mjs"), "utf8")
  const templates = readFileSync(join(root, "lib/starter-templates.mjs"), "utf8")
  const components = readFileSync(join(root, "lib/starter-components.mjs"), "utf8")
  const starter = readFileSync(join(root, "lib/starter-content.mjs"), "utf8")
  assert.match(shell, /export function DocsStarterShell/)
  assert.match(shell, /nextguide:theme/)
  assert.match(shell, /searchIndex\.filter/)
  assert.match(shell, /Control|Ctrl K/)
  assert.match(shell, /ng-site-sidebar/)
  assert.match(css, /\.ng-site-article-layout/)
  assert.match(css, /\.ng-site-search-dialog/)
  assert.match(css, /data-ng-resolved="dark"/)
  assert.match(imports, /@import "\.\/starter\.css"/)
  assert.match(generator, /fullLayoutSource/)
  assert.match(generator, /fullPagesPageSource/)
  assert.match(generator, /GENERATED_MDX_COMPONENTS/)
  assert.match(templates, /DocsSiteSidebar/)
  assert.match(templates, /components=\{nextguideMdxComponents\}/)
  assert.match(templates, /DocsSitePage/)
  assert.match(templates, /nextguide\/site\.css/)
  assert.match(components, /CodeWindow/)
  assert.match(components, /Accordion/)
  assert.match(starter, /content\/docs\/components\/examples\.mdx/)
  assert.match(starter, /content\/docs\/guides\/writing\.mdx/)
})

test("official docs site and installed sites resolve the same package UI", async () => {
  const site = await import("../dist/components/site/index.js")
  assert.equal(typeof site.DocsSiteSidebar, "function")
  assert.equal(typeof site.DocsSitePage, "function")
  assert.equal(typeof site.DocsSiteSearchProvider, "function")
  assert.equal(typeof site.DocsSiteProviders, "function")
  assert.equal(typeof site.NextGuideBuildBadge, "function")
  const editor = readFileSync(join(root, "src/account/mdx-editor.tsx"), "utf8")
  assert.ok(editor.includes("@monaco-editor/react"))
  assert.ok(editor.includes("/_nextguide/monaco/vs"))
  assert.ok(readFileSync(join(root, "src/account/studio.tsx"), "utf8").includes("<AccountMdxEditor"))
  const css = readFileSync(join(root, "dist/components/styles/site.css"), "utf8")
  const officialCss = readFileSync(join(root, "../../apps/web/app/site.css"), "utf8")
  assert.match(css, /--background: #ffffff/)
  assert.match(css, /--background: #0e1014/)
  assert.match(officialCss, /nextguide\/site.css/)
})

test("NextGuide OG artwork renders official branding without a Next.js runtime", async () => {
  const { NextGuideOgCard, NEXTGUIDE_OG_SIZE } = await import("../dist/og/index.js")
  const React = await import("react")
  const { renderToStaticMarkup } = await import("react-dom/server")
  assert.deepEqual(NEXTGUIDE_OG_SIZE, { width: 1200, height: 630 })
  const html = renderToStaticMarkup(React.createElement(NextGuideOgCard, {
    siteName: "Example Documentation",
    title: "Getting started with NextGuide",
    description: "An interactive documentation example",
    section: "Documentation",
    appearance: "dark",
    accent: "purple",
  }))
  assert.match(html, /Example Documentation/)
  assert.match(html, /Getting started with NextGuide/)
  assert.match(html, /An interactive documentation example/)
  assert.match(html, /<svg/)
  assert.match(html, /viewBox="0 0 1072 1072"/)
})

// The Next.js navigation adapter is package-owned, but Next.js itself is a
// host peer. Bun workspace installs do not guarantee the Next.js package will
// be visible to the package compiler, so map type-only peer contracts.
test("strict ESM Next.js peer subpaths compile without hoisted Next.js types", () => {
  const project = JSON.parse(readFileSync(join(root, "tsconfig.json"), "utf8"))
  assert.equal(project.compilerOptions.paths["next/link.js"][0], "./src/types/next-link.d.ts")
  assert.equal(project.compilerOptions.paths["next/navigation.js"][0], "./src/types/next-navigation.d.ts")
  assert.ok(existsSync(join(root, "src/types/next-link.d.ts")))
  assert.ok(existsSync(join(root, "src/types/next-navigation.d.ts")))
  assert.equal("next" in manifest.dependencies, false, "Next.js must remain a host peer")
  const compiled = readFileSync(join(root, "dist/components/site/next-navigation.js"), "utf8")
  assert.match(compiled, /from ["']next\/link\.js["']/)
  assert.match(compiled, /from ["']next\/navigation\.js["']/)
  // Next.js is a peer: this module is exercised in a packed Next.js app,
  // not imported by this isolated library distribution test.
  assert.match(compiled, /function NextDocsNavigationLink/)
  assert.match(compiled, /linkAs: NextDocsNavigationLink/)
})

test("Build badge contains a versioned dialog and docs prefetch is enabled", () => {
  const badge = readFileSync(join(root, "src/components/site/build-badge.tsx"), "utf8")
  const sidebar = readFileSync(join(root, "src/components/site/sidebar.tsx"), "utf8")
  for (const part of ["DialogTrigger asChild", "DialogTitle", "NextGuide version", "View source on GitHub"]) assert.ok(badge.includes(part), part)
  assert.ok(sidebar.includes("<NextGuideBuildBadge version={version}"))
  const navigation = readFileSync(join(root, "dist/components/site/next-navigation.js"), "utf8")
  assert.ok(navigation.includes("prefetch: true"))
  assert.ok(navigation.includes("targets.length >= 18"))
})

test("Account Mode ships the supplied shadcn Base UI Vega controls independently from docs", () => {
  const css = readFileSync(join(root, "dist/account/account.css"), "utf8")
  const access = readFileSync(join(root, "src/account/client.tsx"), "utf8")
  const studio = readFileSync(join(root, "src/account/studio.tsx"), "utf8")
  const menu = readFileSync(join(root, "src/account/theme-menu.tsx"), "utf8")
  const button = readFileSync(join(root, "src/account/ui/button.tsx"), "utf8")
  assert.ok(css.includes('@import "shadcn/tailwind.css"'))
  assert.ok(css.includes(":root:has(.ng-account-root)"))
  assert.ok(css.includes(":root.dark:has(.ng-account-root)"))
  assert.ok(!css.includes('@import "../components/styles/site.css"'), "Docs styling must not leak into account UI")
  assert.ok(button.includes("@base-ui/react/button"), "Vega Base UI controls must be used")
  assert.ok(access.includes("<AccountProviders>"))
  assert.ok(access.includes("<Card>"))
  assert.ok(access.includes("<Input"))
  assert.ok(studio.includes("<SidebarProvider"))
  assert.ok(studio.includes("<AccountMdxEditor"))
  assert.ok(studio.includes("<AccountThemeMenu"))
  assert.ok(menu.includes("DropdownMenuTrigger render="))
  assert.ok(menu.includes('value: "system"'))
  const badge = readFileSync(join(root, "src/components/site/build-badge.tsx"), "utf8")
  assert.ok(badge.includes("getComputedStyle(docsRoot).fontFamily"))
  assert.ok(badge.includes("style={{ fontFamily: dialogFont }}"))
  for (const family of ["--ng-preview-inter", "--ng-preview-geist", "--ng-preview-ibm-plex-sans",
    "--ng-preview-jetbrains-mono", "--ng-preview-geist-mono", "--ng-preview-ibm-plex-mono"]) {
    assert.ok(studio.includes(family), "Font preview missing " + family)
  }
})

test("extension exports ship with declarations and safe client boundary", async () => {
  const [extensions, runtime, views, ui, storage, catalog, network] = await Promise.all([
    import("nextguide/extensions"),
    import("nextguide/extensions/runtime"),
    import("nextguide/extensions/views"),
    import("nextguide/extensions/ui"),
    import("nextguide/extensions/storage"),
    import("nextguide/extensions/catalog"),
    import("nextguide/extensions/network"),
  ])
  assert.equal(typeof extensions.createExtensionHost, "function")
  assert.equal(typeof runtime.createExtensionBroker, "function")
  assert.equal(typeof views.validateExtensionView, "function")
  assert.equal(typeof ui.ExtensionView, "function")
  assert.equal(typeof storage.createExtensionFileStorage, "function")
  assert.equal(typeof catalog.createVerifiedRegistryClient, "function")
  assert.equal(typeof network.createRestrictedExtensionHttpsAdapter, "function")
  const source = readFileSync(join(root, "dist/extensions/ui.js"), "utf8")
  assert.match(source, /^"use client";?/)
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/)
  assert.doesNotMatch(source, /\beval\s*\(/)
})

test("official add-on docs have their own route, navigation and real NextGuide blocks", () => {
  const website = join(dirname(dirname(root)), "apps", "web")
  const contents = join(website, "contents", "addons")
  const read = (path) => readFileSync(join(website, path), "utf8")
  assert.ok(existsSync(join(website, "app/(addons)/addons/[[...slug]]/page.tsx")))
  assert.ok(existsSync(join(website, "app/(addons)/layout.tsx")))
  assert.match(read("lib/source.ts"), /contents\/addons/)
  assert.match(read("lib/navigation.ts"), /getAddonsNavigation/)
  assert.match(read("components/docs-sidebar.tsx"), /basePath/)
  assert.match(read("app/page.tsx"), /href="\/addons"/)
  const catalog = JSON.parse(readFileSync(join(contents, "_meta.json"), "utf8"))
  for (const name of ["index", "getting-started", "manifest", "components", "api",
    "permissions", "publishing", "updates", "marketplace"]) {
    assert.ok(catalog.some(item => item.slug === name), "missing add-on guide: " + name)
    assert.ok(existsSync(join(contents, name + ".mdx")))
  }
  const gettingStarted = read("contents/addons/getting-started.mdx")
  const manifest = read("contents/addons/manifest.mdx")
  const publishing = read("contents/addons/publishing.mdx")
  assert.match(gettingStarted, /<FileTree/)
  assert.match(gettingStarted, /<CodeWindow/)
  assert.match(gettingStarted, /<CodeTabs/)
  assert.match(manifest, /<FileTree/)
  assert.match(manifest, /<CodeWindow/)
  assert.match(publishing, /https:\/\/github\.com\/apps\/nextguide-publisher/)
  assert.doesNotMatch(publishing, /ngapi\.m1nsook\.com|\/admin/)
  assert.doesNotMatch(publishing, /GITHUB_TOKEN|fine-grained personal access token/)
  assert.match(read("contents/addons/components.mdx"), /<ExtensionView/)
  const baseMeta = JSON.parse(read("contents/docs/_meta.json"))
  assert.equal(baseMeta.some(item => item.slug === "addons"), false)
  for (const old of ["index", "manifest", "publishing", "api"]) {
    const legacy = read("contents/docs/addons/" + old + ".mdx")
    assert.match(legacy, /\/addons/)
  }
})

test("public add-on guides do not disclose internal registry routes", () => {
  const website = join(dirname(dirname(root)), "apps", "web")
  const guides = ["index", "publishing", "getting-started", "updates", "marketplace", "api"]
  for (const guide of guides) {
    const content = readFileSync(join(website, "contents/addons/" + guide + ".mdx"), "utf8")
    assert.doesNotMatch(content, /ngapi\.m1nsook\.com|\/admin\b/,
      "Public page must not advertise operator-only registry details: " + guide)
  }
})
