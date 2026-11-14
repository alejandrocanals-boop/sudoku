import assert from 'node:assert/strict'
import { readFile, readdir, access } from 'node:fs/promises'
import { resolve, join } from 'node:path'

const root = resolve(process.argv[2] ?? 'dist')
const manifest = JSON.parse(await readFile(join(root, 'manifest.webmanifest'), 'utf8'))
const base = manifest.scope
assert.equal(manifest.name, 'SUDOKU')
assert.equal(manifest.short_name, 'SUDOKU')
assert.equal(manifest.lang, 'es')
assert.equal(manifest.display, 'standalone')
assert.equal(manifest.orientation, 'portrait')
assert.equal(manifest.id, base)
assert.equal(manifest.start_url, base)
assert.equal(manifest.theme_color.toUpperCase(), '#F3F6FB')
assert.equal(manifest.background_color.toUpperCase(), '#F3F6FB')
for (const [filename, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const png = await readFile(join(root, 'icons', filename))
  assert.equal(png.subarray(1, 4).toString(), 'PNG')
  assert.equal(png.readUInt32BE(16), size)
  assert.equal(png.readUInt32BE(20), size)
}
const html = await readFile(join(root, 'index.html'), 'utf8')
assert.ok(html.includes(`${base}icons/apple-touch-icon.png`))
assert.ok(html.includes(`${base}manifest.webmanifest`))
assert.ok(!html.includes('%BASE_URL%'))
const worker = await readFile(join(root, 'sw.js'), 'utf8')
assert.ok(worker.includes('SKIP_WAITING'), 'Activation must remain message-gated')
const entries = [...worker.matchAll(/\burl:\s*["']([^"']+)["']/g)].map(match => match[1])
assert.ok(entries.some(url => /generation\.worker-.*\.js$/.test(url)), 'Generator worker must be precached')
assert.ok(entries.some(url => url.endsWith('index.html')))
assert.ok(entries.some(url => url.includes('workbox-window')))
for (const filename of ['manifest.webmanifest', 'icons/sudoku.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']) {
  assert.ok(entries.includes(filename), `Missing offline asset: ${filename}`)
}
for (const entry of entries) {
  const path = new URL(entry, `https://example.invalid${base}`).pathname
  assert.ok(path.startsWith(base), `Escaping cache entry: ${entry}`)
  await access(join(root, path.slice(base.length)))
}
const maps = (await readdir(root)).filter(name => /^(?:workbox-.*|sw)\.js\.map$/.test(name))
assert.ok(maps.length >= 2)
const sources = []
for (const map of maps) sources.push(...JSON.parse(await readFile(join(root, map), 'utf8')).sources)
assert.ok(sources.some(source => source.includes('workbox-precaching')))
assert.ok(sources.every(source => !/(?:^|\/)(?:deepmerge|glob|minimatch|@rollup\/plugin-node-resolve)(?:\/|$)/.test(source)),
  'Affected build-only packages must not be shipped in the generated SW/runtime')
console.log(`PWA artifacts verified: ${base}, ${entries.length} cache entries, icons, asset paths and SW source-map audit.`)
