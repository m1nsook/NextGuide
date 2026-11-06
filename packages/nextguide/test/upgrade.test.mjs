import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { initDeveloper, normalizeAppearance } from '../lib/init.mjs'
import { upgradeDeveloper, planUpgrade } from '../lib/upgrade.mjs'

const cli = fileURLToPath(new URL('../bin/nextguide.mjs', import.meta.url))
function fixture(folder = 'src/app') {
  const directory = mkdtempSync(join(tmpdir(), 'nextguide-upgrade-'))
  mkdirSync(join(directory, folder), { recursive: true })
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'fixture', dependencies: { next: '^16.4.5' } }))
  writeFileSync(join(directory, 'tsconfig.json'), '{}')
  return {
    directory,
    inspection: { ok: true, issues: [], routers: [{ folder, name: folder.endsWith('app') ? 'App Router' : 'Pages Router' }] },
    read: (path) => readFileSync(join(directory, path), 'utf8'),
    write: (path, content) => writeFileSync(join(directory, path), content),
    clear: () => rmSync(directory, { recursive: true, force: true }),
  }
}

test('new init defaults to forced light mode and high-contrast blue accent', () => {
  const f = fixture()
  try {
    initDeveloper(f.directory, f.inspection)
    const config = JSON.parse(f.read('nextguide.config.json'))
    assert.deepEqual(config.appearance, { mode: 'light', accent: 'blue' })
    assert.match(f.read('src/app/docs/layout.tsx'), /data-ng-theme=\{appearance.mode\}/)
    assert.match(f.read('src/app/docs/layout.tsx'), /data-ng-accent=\{appearance.accent\}/)
    const css = f.read('src/styles/nextguide.css')
    assert.match(css, /data-ng-theme="system"/)
    assert.match(css, /data-ng-theme="dark"/)
    assert.match(css, /--ng-starter-link-light: #1d4ed8/)
    assert.doesNotMatch(css, /@media \(prefers-color-scheme: dark\) \{ \.ng-starter \{/)
  } finally { f.clear() }
})

test('initialization accepts all three modes and accent options and rejects invalid values', () => {
  const f = fixture('pages')
  try {
    initDeveloper(f.directory, f.inspection, { appearance: { mode: 'dark', accent: 'yellow' } })
    assert.deepEqual(JSON.parse(f.read('nextguide.config.json')).appearance, { mode: 'dark', accent: 'yellow' })
    assert.match(f.read('pages/docs/[[...slug]].tsx'), /data-ng-theme=\{appearance.mode\}/)
    assert.throws(() => normalizeAppearance({ mode: 'sepia' }), /Invalid appearance mode/)
    assert.throws(() => normalizeAppearance({ accent: 'invisible' }), /Invalid accent/)
  } finally { f.clear() }
})

test('upgrade adds missing config defaults without touching authored MDX, sidebar or routes', () => {
  const f = fixture()
  try {
    initDeveloper(f.directory, f.inspection)
    const old = JSON.parse(f.read('nextguide.config.json'))
    delete old.appearance
    delete old.basePath
    old.site.customField = { owner: 'mine' }
    f.write('nextguide.config.json', JSON.stringify(old, null, 2) + '\n')
    f.write('content/docs/index.mdx', '---\ntitle: My edited content\n---\nPersonal!\n')
    f.write('content/docs/_meta.json', '[{"slug":"custom","title":"Custom"}]\n')
    const route = f.read('src/app/docs/layout.tsx')
    const plan = planUpgrade(f.directory, f.inspection, { dryRun: true })
    assert.equal(plan.updates.length, 1)
    const result = upgradeDeveloper(f.directory, f.inspection)
    assert.equal(result.changes.length, 1)
    assert.ok(existsSync(join(f.directory, 'nextguide.config.json.nextguide-backup')))
    assert.deepEqual(JSON.parse(f.read('nextguide.config.json')).appearance, { mode: 'light', accent: 'blue' })
    assert.equal(JSON.parse(f.read('nextguide.config.json')).site.customField.owner, 'mine')
    assert.equal(f.read('content/docs/index.mdx').includes('Personal!'), true)
    assert.equal(f.read('content/docs/_meta.json').includes('Custom'), true)
    assert.equal(f.read('src/app/docs/layout.tsx'), route)
    assert.equal(upgradeDeveloper(f.directory, f.inspection).changes.length, 0)
  } finally { f.clear() }
})

test('dry-run and CLI flags are non-destructive and config changes are explicit', () => {
  const f = fixture()
  try {
    initDeveloper(f.directory, f.inspection)
    const before = f.read('nextguide.config.json')
    const result = upgradeDeveloper(f.directory, f.inspection, { appearance: { mode: 'system', accent: 'purple' }, dryRun: true })
    assert.equal(result.dryRun, true)
    assert.equal(f.read('nextguide.config.json'), before)
    const child = spawnSync(process.execPath, [cli, 'upgrade', '--system', '--accent:purple'], { cwd: f.directory, encoding: 'utf8' })
    assert.equal(child.status, 0, child.stderr)
    assert.deepEqual(JSON.parse(f.read('nextguide.config.json')).appearance, { mode: 'system', accent: 'purple' })
  } finally { f.clear() }
})

test('CLI init --dark and --accent:red persist appearance; contradictory modes fail', () => {
  const f = fixture()
  try {
    const invalid = spawnSync(process.execPath, [cli, 'init', '--light', '--dark', '--yes'], { cwd: f.directory, encoding: 'utf8' })
    assert.equal(invalid.status, 2)
    const done = spawnSync(process.execPath, [cli, 'init', '--dark', '--accent:red', '--yes'], { cwd: f.directory, encoding: 'utf8' })
    assert.equal(done.status, 0, done.stderr)
    assert.deepEqual(JSON.parse(f.read('nextguide.config.json')).appearance, { mode: 'dark', accent: 'red' })
  } finally { f.clear() }
})

test('explicit generated-file refresh backs up edits but never overwrites MDX', () => {
  const f = fixture()
  try {
    initDeveloper(f.directory, f.inspection)
    const file = 'src/styles/nextguide.css'
    const original = f.read(file) + '\n/* Custom CSS */\n'
    f.write(file, original)
    f.write('content/docs/index.mdx', 'MY PERSONAL MDX\n')
    const result = upgradeDeveloper(f.directory, f.inspection, { refreshGenerated: true, appearance: { mode: 'dark', accent: 'teal' } })
    assert.equal(f.read('content/docs/index.mdx'), 'MY PERSONAL MDX\n')
    assert.equal(f.read(file).includes('Custom CSS'), false)
    const backup = result.changes.find((x) => x.path === file)?.backup
    assert.ok(backup)
    assert.equal(f.read(backup), original)
    assert.equal(JSON.parse(f.read('nextguide.config.json')).appearance.accent, 'teal')
    assert.equal(upgradeDeveloper(f.directory, f.inspection, { refreshGenerated: true }).changes.length, 0)
  } finally { f.clear() }
})

test('refuses to refresh unmarked files even when requested', () => {
  const f = fixture()
  try {
    initDeveloper(f.directory, f.inspection)
    f.write('src/app/docs/layout.tsx', '// Custom user layout\n')
    const config = f.read('nextguide.config.json')
    assert.throws(() => upgradeDeveloper(f.directory, f.inspection, { refreshGenerated: true }), /Refusing to replace user-owned file/)
    assert.equal(f.read('nextguide.config.json'), config)
  } finally { f.clear() }
})

test('malformed and newer schema configurations are never rewritten', () => {
  const f = fixture()
  try {
    initDeveloper(f.directory, f.inspection)
    f.write('nextguide.config.json', '{not valid json')
    assert.throws(() => upgradeDeveloper(f.directory, f.inspection), /not valid JSON/)
    const future = JSON.stringify({ mode: 'developer', schemaVersion: 99 })
    f.write('nextguide.config.json', future)
    assert.throws(() => upgradeDeveloper(f.directory, f.inspection), /Unsupported NextGuide configuration schema/)
    assert.equal(f.read('nextguide.config.json'), future)
  } finally { f.clear() }
})
