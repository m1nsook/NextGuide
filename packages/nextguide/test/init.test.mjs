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