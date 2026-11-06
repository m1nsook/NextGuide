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
    assert.equal(r.created.length, 8)
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
    assert.match(read(d, 'src/app/(nextguide)/layout.tsx'), /href="\/"/)
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
    assert.match(read(d, 'pages/[[...slug]].tsx'), /href="\/"/)
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

test('uses the right relative fallback for custom aliases and the root Pages Router', () => {
  const d = fixture({ folder: 'pages' })
  try {
    writeFileSync(join(d, 'tsconfig.json'), JSON.stringify({ compilerOptions: { paths: { '~/*': ['./*'] } } }))
    initDeveloper(d, inspect(d, ['pages']), { basePath: '/' })
    assert.match(read(d, 'pages/[[...slug]].tsx'), /from "\.\.\/lib\/nextguide"/)
  } finally { clear(d) }
})

test('app routes wrap asynchronous navigation and MDX content in Suspense', () => {
  const d = fixture()
  try {
    initDeveloper(d, inspect(d, ['src/app']))
    const layout = read(d, 'src/app/docs/layout.tsx')
    const page = read(d, 'src/app/docs/[[...slug]]/page.tsx')
    assert.match(layout, /<Suspense/)
    assert.match(layout, /<DocumentationNavigation\s*\/>/)
    assert.match(page, /<Suspense/)
    assert.match(page, /<DocumentationBody params=\{params\}/)
    assert.doesNotMatch(page, /dynamicParams\s*=/)
  } finally { clear(d) }
})
