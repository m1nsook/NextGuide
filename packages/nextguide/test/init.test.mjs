import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { initDeveloper } from '../lib/init.mjs'

function fixture({ folder = 'src/app', typescript = true, both = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'nextguide-init-'))
  mkdirSync(join(directory, folder), { recursive: true })
  if (both) mkdirSync(join(directory, 'pages'), { recursive: true })
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'example', dependencies: { next: '^16.4.5', nextguide: '^0.0.1-alpha.2' } }))
  if (typescript) writeFileSync(join(directory, 'tsconfig.json'), '{}')
  return directory
}
function inspect(directory, folders) {
  return { ok: true, issues: [], routers: folders.map(folder => ({ folder, name: folder.endsWith('app') ? 'App Router' : 'Pages Router' })) }
}
function read(directory, file) { return readFileSync(join(directory, file), 'utf8') }
function clear(directory) { rmSync(directory, { recursive: true, force: true }) }

test('initializes src/app TypeScript project with real pages and config', () => {
  const d = fixture()
  try {
    const r = initDeveloper(d, inspect(d, ['src/app']))
    assert.equal(r.created.length, 17)
    assert.ok(existsSync(join(d, 'src/app/og/[...slug]/route.ts')))
    assert.match(read(d, 'src/app/og/[...slug]/route.ts'), /NextGuideOgCard/)
    assert.equal(r.mode, 'developer')
    assert.ok(existsSync(join(d, 'src/app/docs/[[...slug]]/page.tsx')))
    assert.ok(existsSync(join(d, 'src/app/docs/layout.tsx')))
    assert.match(read(d, 'src/lib/nextguide.ts'), /createDocs/)
    assert.match(read(d, 'src/app/docs/[[...slug]]/page.tsx'), /generateStaticParams/)
    assert.match(read(d, 'src/app/docs/layout.tsx'), /nextguide\/styles.css/)
    assert.equal(JSON.parse(read(d, 'nextguide.config.json')).mode, 'developer')
  } finally { clear(d) }
})

test('supports JavaScript app/ projects', () => {
  const d = fixture({ folder: 'app', typescript: false })
  try {
    initDeveloper(d, inspect(d, ['app']))
    assert.ok(existsSync(join(d, 'app/docs/[[...slug]]/page.jsx')))
    assert.ok(existsSync(join(d, 'lib/nextguide.js')))
    assert.doesNotMatch(read(d, 'app/docs/layout.jsx'), /ReactNode/)
  } finally { clear(d) }
})

test('supports Pages Router and creates _app for global styles', () => {
  const d = fixture({ folder: 'pages' })
  try {
    initDeveloper(d, inspect(d, ['pages']))
    assert.ok(existsSync(join(d, 'pages/docs/[[...slug]].tsx')))
    assert.match(read(d, 'pages/_app.tsx'), /nextguide\/styles.css/)
    assert.match(read(d, 'pages/docs/[[...slug]].tsx'), /getStaticPaths/)
    assert.match(read(d, 'pages/docs/[[...slug]].tsx'), /getStaticProps/)
  } finally { clear(d) }
})

test('preserves custom pages/_app while adding only CSS imports', () => {
  const d = fixture({ folder: 'src/pages' })
  try {
    writeFileSync(join(d, 'src/pages/_app.tsx'), 'export default function App({ Component, pageProps }) { return <Component {...pageProps} /> }\n')
    const r = initDeveloper(d, inspect(d, ['src/pages']))
    assert.deepEqual(r.modified, ['src/pages/_app.tsx'])
    assert.match(read(d, 'src/pages/_app.tsx'), /^import "nextguide\/styles.css"/)
    assert.match(read(d, 'src/pages/_app.tsx'), /return <Component/)
  } finally { clear(d) }
})

test('dry-run does not create any files', () => {
  const d = fixture()
  try {
    const r = initDeveloper(d, inspect(d, ['src/app']), { dryRun: true })
    assert.equal(r.dryRun, true)
    assert.ok(r.created.includes('nextguide.config.json'))
    assert.equal(existsSync(join(d, 'nextguide.config.json')), false)
  } finally { clear(d) }
})

test('refuses to overwrite existing user files before changing anything', () => {
  const d = fixture()
  try {
    writeFileSync(join(d, 'nextguide.config.json'), '{"personal":true}\n')
    assert.throws(() => initDeveloper(d, inspect(d, ['src/app'])), /Refusing to overwrite/)
    assert.equal(read(d, 'nextguide.config.json'), '{"personal":true}\n')
    assert.equal(existsSync(join(d, 'src/lib/nextguide.ts')), false)
  } finally { clear(d) }
})

test('requires router selection when project has both App and Pages routers', () => {
  const d = fixture({ both: true })
  try {
    assert.throws(() => initDeveloper(d, inspect(d, ['src/app', 'pages'])), /Multiple matching router/)
    const r = initDeveloper(d, inspect(d, ['src/app', 'pages']), { router: 'pages' })
    assert.equal(r.router.name, 'Pages Router')
  } finally { clear(d) }
})

test('rejects missing or invalid Next.js projects', () => {
  const d = fixture()
  try {
    assert.throws(() => initDeveloper(d, { ok: false, issues: ['No Next.js'], routers: [] }), /No Next.js/)
    assert.equal(existsSync(join(d, 'nextguide.config.json')), false)
  } finally { clear(d) }
})

test('re-running init is safe and does not modify existing files', () => {
  const d = fixture()
  try {
    initDeveloper(d, inspect(d, ['src/app']))
    const before = read(d, 'content/docs/index.mdx')
    assert.throws(() => initDeveloper(d, inspect(d, ['src/app'])), /Refusing to overwrite/)
    assert.equal(read(d, 'content/docs/index.mdx'), before)
  } finally { clear(d) }
})

test('generated App Router route supports Cache Components without dynamicParams', () => {
  const d = fixture()
  try {
    initDeveloper(d, inspect(d, ['src/app']))
    const source = read(d, 'src/app/docs/[[...slug]]/page.tsx')
    assert.match(source, /generateStaticParams/)
    assert.doesNotMatch(source, /dynamicParams\s*=/)
    assert.equal(JSON.parse(read(d, 'nextguide.config.json')).basePath, '/docs')
  } finally { clear(d) }
})

test('root mount backs up an existing homepage without destroying it', () => {
  const d = fixture()
  try {
    const original = 'export default function Home() { return <div>My old homepage</div> }\n'
    writeFileSync(join(d, 'src/app/page.tsx'), original)
    assert.throws(
      () => initDeveloper(d, inspect(d, ['src/app']), { basePath: '/' }),
      /--replace-home/
    )
    assert.equal(read(d, 'src/app/page.tsx'), original)
    const result = initDeveloper(d, inspect(d, ['src/app']), { basePath: '/', replaceHome: true })
    assert.equal(result.basePath, '/')
    assert.deepEqual(result.backedUp, ['src/app/page.tsx.nextguide-backup'])
    assert.ok(existsSync(join(d, 'src/app/(nextguide)/layout.tsx')))
    assert.ok(existsSync(join(d, 'src/app/(nextguide)/[[...slug]]/page.tsx')))
    assert.equal(read(d, 'src/app/page.tsx.nextguide-backup'), original)
    assert.equal(existsSync(join(d, 'src/app/page.tsx')), false)
    assert.equal(JSON.parse(read(d, 'nextguide.config.json')).basePath, '/')
    assert.match(read(d, 'content/docs/index.mdx'), /\]\(\/getting-started\)/)
    assert.match(read(d, 'src/app/(nextguide)/layout.tsx'), /basePath=\{"\/"\}/)
  } finally { clear(d) }
})

test('root mount dry-run reports the backup without editing homepage', () => {
  const d = fixture()
  try {
    writeFileSync(join(d, 'src/app/page.tsx'), 'my homepage')
    const result = initDeveloper(d, inspect(d, ['src/app']), { basePath: '/', replaceHome: true, dryRun: true })
    assert.deepEqual(result.backedUp, ['src/app/page.tsx.nextguide-backup'])
    assert.equal(read(d, 'src/app/page.tsx'), 'my homepage')
    assert.equal(existsSync(join(d, 'nextguide.config.json')), false)
    assert.equal(existsSync(join(d, 'src/app/(nextguide)/layout.tsx')), false)
  } finally { clear(d) }
})

test('root Pages Router generates a catch-all and preserves the original homepage', () => {
  const d = fixture({ folder: 'pages' })
  try {
    writeFileSync(join(d, 'pages/index.tsx'), 'export default function Original() { return null }\n')
    initDeveloper(d, inspect(d, ['pages']), { basePath: '/', replaceHome: true })
    assert.ok(existsSync(join(d, 'pages/[[...slug]].tsx')))
    assert.equal(read(d, 'pages/index.tsx.nextguide-backup').includes('Original'), true)
    assert.match(read(d, 'pages/[[...slug]].tsx'), /basePath=\{"\/"\}/)
    assert.equal(existsSync(join(d, 'pages/docs/[[...slug]].tsx')), false)
  } finally { clear(d) }
})

test('root mount refuses an occupied backup path, preserving all user files', () => {
  const d = fixture()
  try {
    writeFileSync(join(d, 'src/app/page.tsx'), 'original')
    writeFileSync(join(d, 'src/app/page.tsx.nextguide-backup'), 'previous backup')
    assert.throws(
      () => initDeveloper(d, inspect(d, ['src/app']), { basePath: '/', replaceHome: true }),
      /already exists/
    )
    assert.equal(read(d, 'src/app/page.tsx'), 'original')
    assert.equal(read(d, 'src/app/page.tsx.nextguide-backup'), 'previous backup')
    assert.equal(existsSync(join(d, 'nextguide.config.json')), false)
  } finally { clear(d) }
})

test('invalid mount paths are rejected before writing files', () => {
  const d = fixture()
  try {
    for (const basePath of ['/blog', '/docs/', '', '../']) {
      assert.throws(() => initDeveloper(d, inspect(d, ['src/app']), { basePath }), /Documentation path/)
    }
    assert.equal(existsSync(join(d, 'nextguide.config.json')), false)
  } finally { clear(d) }
})


test('generates @/lib/nextguide imports when the Next.js project maps @/* to src', () => {
  const d = fixture()
  try {
    writeFileSync(join(d, 'tsconfig.json'), JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }))
    initDeveloper(d, inspect(d, ['src/app']))
    assert.match(read(d, 'src/app/docs/layout.tsx'), /from "@\/lib\/nextguide"/)
    assert.match(read(d, 'src/app/docs/[[...slug]]/page.tsx'), /from "@\/lib\/nextguide"/)
  } finally { clear(d) }
})

test('respects a custom root alias for a root-mounted Pages Router', () => {
  const d = fixture({ folder: 'pages' })
  try {
    writeFileSync(join(d, 'tsconfig.json'), JSON.stringify({ compilerOptions: { paths: { '~/*': ['./*'] } } }))
    initDeveloper(d, inspect(d, ['pages']), { basePath: '/' })
    assert.match(read(d, 'pages/[[...slug]].tsx'), /from "~\/lib\/nextguide"/)
    assert.match(read(d, 'pages/_app.tsx'), /import "~\/styles\/nextguide\.css"/)
    assert.match(read(d, 'lib/nextguide.ts'), /import config from "~\/nextguide\.config\.json"/)
  } finally { clear(d) }
})

test('app routes wrap asynchronous navigation and MDX content in Suspense', () => {
  const d = fixture()
  try {
    initDeveloper(d, inspect(d, ['src/app']))
    const layout = read(d, 'src/app/docs/layout.tsx')
    const page = read(d, 'src/app/docs/[[...slug]]/page.tsx')
    assert.match(layout, /<Suspense/)
    assert.match(layout, /<DocumentationSite>/)
    assert.match(page, /<Suspense/)
    assert.match(page, /<DocumentationBody params=\{params\}/)
    assert.doesNotMatch(page, /dynamicParams\s*=/)
  } finally { clear(d) }
})

test('resolves every generated local import using the existing Next.js @/* source alias', () => {
  const d = fixture()
  try {
    writeFileSync(join(d, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { paths: { '@/*': ['./src/*'] } },
    }))
    initDeveloper(d, inspect(d, ['src/app']))
    const layout = read(d, 'src/app/docs/layout.tsx')
    const page = read(d, 'src/app/docs/[[...slug]]/page.tsx')
    const lib = read(d, 'src/lib/nextguide.ts')
    assert.match(layout, /from "@\/lib\/nextguide"/)
    assert.match(layout, /import "@\/styles\/nextguide\.css"/)
    assert.match(page, /from "@\/lib\/nextguide"/)
    // nextguide.config.json is at the project root, outside the src/* alias.
    assert.match(lib, /import config from "\.\.\/\.\.\/nextguide\.config\.json"/)
    assert.doesNotMatch(layout, /from "\.\.\/\.\.\/lib\/nextguide"/)
  } finally { clear(d) }
})

test('supports root-based @/* aliases, including the root config import', () => {
  const d = fixture({ folder: 'app' })
  try {
    writeFileSync(join(d, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { paths: { '@/*': ['./*'] } },
    }))
    initDeveloper(d, inspect(d, ['app']))
    assert.match(read(d, 'app/docs/layout.tsx'), /from "@\/lib\/nextguide"/)
    assert.match(read(d, 'app/docs/layout.tsx'), /import "@\/styles\/nextguide\.css"/)
    assert.match(read(d, 'lib/nextguide.ts'), /import config from "@\/nextguide\.config\.json"/)
  } finally { clear(d) }
})

test('uses custom source aliases for Pages Router files and existing _app CSS patches', () => {
  const d = fixture({ folder: 'src/pages' })
  try {
    writeFileSync(join(d, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { paths: { '~/*': ['./src/*'] } },
    }))
    writeFileSync(join(d, 'src/pages/_app.tsx'), 'export default function App() { return null }\n')
    const result = initDeveloper(d, inspect(d, ['src/pages']))
    assert.deepEqual(result.modified, ['src/pages/_app.tsx'])
    assert.match(read(d, 'src/pages/docs/[[...slug]].tsx'), /from "~\/lib\/nextguide"/)
    assert.match(read(d, 'src/pages/_app.tsx'), /import "~\/styles\/nextguide\.css"/)
    assert.match(read(d, 'src/pages/_app.tsx'), /import "nextguide\/styles\.css"/)
    assert.match(read(d, 'src/lib/nextguide.ts'), /from "\.\.\/\.\.\/nextguide\.config\.json"/)
  } finally { clear(d) }
})

test('falls back to depth-correct relative paths when no matching alias exists', () => {
  for (const folder of ['app', 'src/app', 'pages', 'src/pages']) {
    const d = fixture({ folder })
    try {
      writeFileSync(join(d, 'tsconfig.json'), JSON.stringify({
        compilerOptions: { paths: { '~/*': ['./unrelated/*'] } },
      }))
      initDeveloper(d, inspect(d, [folder]))
      if (folder.endsWith('app')) {
        const layout = read(d, `${folder}/docs/layout.tsx`)
        const page = read(d, `${folder}/docs/[[...slug]]/page.tsx`)
        assert.match(layout, /from "\.\.\/\.\.\/lib\/nextguide"/)
        assert.match(layout, /import "\.\.\/\.\.\/styles\/nextguide\.css"/)
        assert.match(page, /from "\.\.\/\.\.\/\.\.\/lib\/nextguide"/)
      } else {
        const page = read(d, `${folder}/docs/[[...slug]].tsx`)
        const app = read(d, `${folder}/_app.tsx`)
        assert.match(page, /from "\.\.\/\.\.\/lib\/nextguide"/)
        assert.match(app, /import "\.\.\/styles\/nextguide\.css"/)
      }
    } finally { clear(d) }
  }
})

test('parses jsconfig path mappings with JSONC comments without changing configuration', () => {
  const d = fixture({ folder: 'app', typescript: false })
  try {
    const config = '{\n  // Custom JavaScript paths\n  "compilerOptions": {\n    "paths": { "@/*": ["./*"], },\n  },\n}\n'
    writeFileSync(join(d, 'jsconfig.json'), config)
    initDeveloper(d, inspect(d, ['app']))
    assert.equal(read(d, 'jsconfig.json'), config)
    assert.match(read(d, 'app/docs/layout.jsx'), /from "@\/lib\/nextguide"/)
    assert.match(read(d, 'app/docs/layout.jsx'), /import "@\/styles\/nextguide\.css"/)
    assert.match(read(d, 'lib/nextguide.js'), /from "@\/nextguide\.config\.json"/)
  } finally { clear(d) }
})


test('App Router generated pages expose breadcrumbs, Markdown copy, Ask AI and optional edit source', () => {
  const d = fixture()
  try {
    initDeveloper(d, inspect(d, ['src/app']))
    const route = read(d, 'src/app/docs/[[...slug]]/page.tsx')
    const lib = read(d, 'src/lib/nextguide.ts')
    assert.match(route, /DocsSitePage/)
    assert.match(route, /markdown=/)
    assert.match(route, /await docs\.read\(\{ slug \}\)/)
    assert.match(route, /editBase \? editBase/)
    assert.match(lib, /export const editBase/)
    assert.match(lib, /editBaseRaw\.endsWith/)
    assert.match(route, /href: "\/docs"/)
  } finally { clear(d) }
})

test('Pages Router generated pages also receive raw Markdown and safe breadcrumbs at both base paths', () => {
  for (const basePath of ['/docs', '/']) {
    const d = fixture({ folder: 'src/pages' })
    try {
      initDeveloper(d, inspect(d, ['src/pages']), { basePath })
      const file = 'src/pages/' + (basePath === '/' ? '[[...slug]].tsx' : 'docs/[[...slug]].tsx')
      const route = read(d, file)
      assert.match(route, /DocsSitePage/)
      assert.match(route, /markdown=/)
      assert.match(route, /markdown: await docs\.read\(\{ slug \}\)/)
      assert.match(route, /editBase \? editBase/)
      assert.match(route, /title: i === segments\.length - 1/)
      assert.match(route, /slug\.split\("\/"\)\.filter\(Boolean\)/)
    } finally { clear(d) }
  }
})


test('first install creates a complete documentation website and wired MDX examples', () => {
  const d = fixture()
  try {
    const result = initDeveloper(d, inspect(d, ['src/app']))
    assert.ok(result.created.includes('src/lib/nextguide-mdx-components.tsx'))
    const layout = read(d, 'src/app/docs/layout.tsx')
    const page = read(d, 'src/app/docs/[[...slug]]/page.tsx')
    const lib = read(d, 'src/lib/nextguide.ts')
    const components = read(d, 'src/lib/nextguide-mdx-components.tsx')
    assert.match(layout, /DocsSiteSidebar/)
    assert.match(layout, /DocsSiteSearchProvider entries=\{searchIndex\}/)
    assert.match(layout, /siteName=\{site.name\}/)
    assert.match(page, /toc=\{toc\}/)
    assert.match(page, /DocsSitePage/)
    assert.match(lib, /components: nextguideMdxComponents/)
    assert.match(lib, /getSearchIndex/)
    for (const name of ['Callout', 'CodeWindow', 'CodeTabs', 'FileTree', 'Steps', 'Tabs', 'Accordion', 'Dialog', 'Table', 'Alert']) {
      assert.ok(components.includes(name), name + ' is available by default in MDX')
    }
    assert.match(read(d, 'content/docs/index.mdx'), /<LinkCards>/)
    assert.match(read(d, 'content/docs/components/examples.mdx'), /<Tabs defaultValue=/)
    assert.ok(existsSync(join(d, 'content/docs/guides/writing.mdx')))
    assert.ok(existsSync(join(d, 'content/docs/api-reference.mdx')))
  } finally { clear(d) }
})

test('Pages Router also gets the full shell and reusable MDX components', () => {
  const d = fixture({ folder: 'pages' })
  try {
    initDeveloper(d, inspect(d, ['pages']))
    const route = read(d, 'pages/docs/[[...slug]].tsx')
    assert.match(route, /DocsSiteSidebar/)
    assert.match(route, /getSearchIndex/)
    assert.match(route, /components=\{nextguideMdxComponents\}/)
    assert.match(route, /toc=\{toc\}/)
    assert.match(read(d, 'lib/nextguide.ts'), /components: nextguideMdxComponents/)
    assert.match(read(d, 'pages/_app.tsx'), /nextguide\/styles\.css/)
  } finally { clear(d) }
})

test('initialization fixes the real create-next-app root html without changing its classes', () => {
  const d = fixture()
  try {
    const root = 'src/app/layout.tsx'
    const original = [
      'import type { ReactNode } from "react"',
      'export default function RootLayout({ children }: { children: ReactNode }) {',
      '  return <html lang="en" className={`geist-variable ${"geist-mono"} h-full antialiased`}>',
      '    <body>{children}</body></html>',
      '}',
      '',
    ].join('\n')
    writeFileSync(join(d, root), original)
    const result = initDeveloper(d, inspect(d, ['src/app']))
    assert.deepEqual(result.modified, [root])
    assert.deepEqual(result.backedUp, [root + '.nextguide-backup'])
    const updated = read(d, root)
    assert.match(updated, /<html suppressHydrationWarning lang="en" className=/)
    assert.match(updated, /geist-variable/)
    assert.equal(read(d, root + '.nextguide-backup'), original)
    assert.equal(updated.split('suppressHydrationWarning').length - 1, 1)
  } finally { clear(d) }
})

test('init dry-run reports the root hydration patch without modifying host files', () => {
  const d = fixture()
  try {
    const root = 'src/app/layout.tsx'
    const original = '<html lang="en"><body>test</body></html>\n'
    writeFileSync(join(d, root), original)
    const result = initDeveloper(d, inspect(d, ['src/app']), { dryRun: true })
    assert.deepEqual(result.modified, [root])
    assert.deepEqual(result.backedUp, [root + '.nextguide-backup'])
    assert.equal(read(d, root), original)
    assert.equal(existsSync(join(d, root + '.nextguide-backup')), false)
  } finally { clear(d) }
})

test('initialization leaves already hydration-safe root layouts untouched', () => {
  const d = fixture()
  try {
    const root = 'src/app/layout.tsx'
    const original = '<html lang="en" suppressHydrationWarning><body>OK</body></html>\n'
    writeFileSync(join(d, root), original)
    const result = initDeveloper(d, inspect(d, ['src/app']))
    assert.deepEqual(result.modified, [])
    assert.equal(read(d, root), original)
    assert.equal(existsSync(join(d, root + '.nextguide-backup')), false)
  } finally { clear(d) }
})

test('refuses unsafe root layouts rather than changing user-owned JSX blindly', () => {
  const d = fixture()
  try {
    const root = 'src/app/layout.tsx'
    const original = 'export default function Layout({ children }) { return <CustomHtml>{children}</CustomHtml> }\n'
    writeFileSync(join(d, root), original)
    assert.throws(() => initDeveloper(d, inspect(d, ['src/app'])), /Cannot safely locate the root <html>/)
    assert.equal(read(d, root), original)
    assert.equal(existsSync(join(d, 'nextguide.config.json')), false)
  } finally { clear(d) }
})

test('generated OG image routes reuse NextGuide branding and support App Router root paths', () => {
  for (const folder of ['src/app', 'app']) {
    const d = fixture({ folder })
    try {
      const result = initDeveloper(d, inspect(d, [folder]), { basePath: '/docs' })
      const image = read(d, folder + '/og/[...slug]/route.ts')
      assert.match(image, /from "nextguide\/og"/)
      assert.match(image, /getFrontmatter/)
      assert.match(image, /generateStaticParams/)
      assert.match(image, /siteName: site.name/)
      assert.match(image, /appearance: appearance.mode/)
      assert.equal(result.created.length, 17)
    } finally { clear(d) }
  }
})

test('Pages Router can still initialize without an unsupported dynamic image route', () => {
  const d = fixture({ folder: 'src/pages' })
  try {
    const result = initDeveloper(d, inspect(d, ['src/pages']))
    assert.ok(result.created.length >= 16)
    assert.ok(!result.created.some((p) => p.includes('/og/[...slug]/route.')))
  } finally { clear(d) }
})


test('generated Developer Mode uses App Router links and never shows loading text during navigation', () => {
  const d = fixture()
  try {
    initDeveloper(d, inspect(d, ['src/app']))
    const layout = read(d, 'src/app/docs/layout.tsx')
    const page = read(d, 'src/app/docs/[[...slug]]/page.tsx')
    assert.match(layout, /nextguide\/site\/next/)
    assert.match(layout, /NextDocsSiteSidebar/)
    assert.match(layout, /NextDocsSiteSearchProvider/)
    assert.match(layout, /NextDocsSiteClientNavigation/)
    assert.doesNotMatch(layout, /Loading documentation/)
    assert.doesNotMatch(page, /Loading page/)
    assert.match(layout, /fallback=\{null\}/)
    assert.match(page, /fallback=\{null\}/)
    assert.match(read(d, 'src/lib/nextguide.ts'), /getSidebar/)
    const mdx = read(d, 'src/lib/nextguide-mdx-components.tsx')
    assert.match(mdx, /NextDocsSiteMdxLink/)
    assert.match(mdx, /a: NextDocsSiteMdxLink/)

  } finally { clear(d) }
})
