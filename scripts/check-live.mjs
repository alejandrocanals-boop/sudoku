import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createServer } from 'vite'
import { openBrowserPage } from './browser-client.mjs'

const address = new URL(process.argv[2])
assert.equal(address.protocol, 'https:')
assert.ok(address.hostname.endsWith('.github.io') && address.pathname.endsWith('/'))
const base = address.pathname
const checks = []
const output = resolve('node_modules/.tmp/live-check')
await mkdir(output, { recursive: true })
async function get(path) {
  const url = new URL(path, address)
  const response = await fetch(url, { cache: 'no-store' })
  assert.equal(response.status, 200, `${url.pathname}: ${response.status}`)
  return response
}
const html = await (await get('')).text()
assert.ok(html.includes('lang="es"'))
const manifest = await (await get('manifest.webmanifest')).json()
for (const key of ['id', 'scope', 'start_url']) assert.equal(manifest[key], base)
assert.equal(manifest.name, 'SUDOKU')
assert.equal(manifest.display, 'standalone')
for (const icon of manifest.icons) {
  assert.ok(icon.src.startsWith(base))
  const image = Buffer.from(await (await get(icon.src)).arrayBuffer())
  const size = Number(icon.sizes.split('x')[0])
  assert.equal(image.readUInt32BE(16), size)
  assert.equal(image.readUInt32BE(20), size)
}
const apple = Buffer.from(await (await get('icons/apple-touch-icon.png')).arrayBuffer())
assert.equal(apple.readUInt32BE(16), 180)
const sw = await (await get('sw.js')).text()
const entries = [...sw.matchAll(/\burl:\s*["']([^"']+)["']/g)].map(match => match[1])
assert.ok(entries.some(path => path.includes('generation.worker-')))
const runtime = sw.match(/\.\/(workbox-[a-zA-Z0-9-]+)/)[1] + '.js'
for (const path of [...new Set([...entries, runtime, 'sw.js'])]) {
  const url = new URL(path, address)
  assert.ok(url.pathname.startsWith(base))
  const response = await get(path)
  if (/\.(js|html|css)$/.test(path)) {
    const text = await response.text()
    assert.ok(!/(?:[A-Z]:[/\\]Users[/\\]|\/home\/runner\/|sourceMappingURL=)/i.test(text), 'Published local path or map reference')
  }
}
assert.equal((await fetch(new URL('sw.js.map', address))).status, 404)
assert.equal((await fetch(new URL(runtime + '.map', address))).status, 404)
checks.push('Public HTTPS, lowercase base, scoped manifest, all precached assets, 192/512/180 icons and generator worker return valid responses')
checks.push('Deployed SW/runtime have no map references, and audit source maps are not publicly available')

let page
const engine = await createServer({ configFile: false, cacheDir: 'node_modules/.tmp/live-check-vite',
  optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false } })
try {
  const { solveLogically } = await engine.ssrLoadModule('/src/engine/solver.ts')
  page = await openBrowserPage(process.argv[3])
  await page.command('Storage.clearDataForOrigin', { origin: address.origin, storageTypes: 'local_storage,service_workers,cache_storage' })
  await page.command('Network.enable')
  await page.command('Network.setCacheDisabled', { cacheDisabled: true })
  await page.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await page.command('Page.navigate', { url: address.href })
  await page.wait(`document.querySelector('.home') && navigator.serviceWorker.controller`)
  const registration = await page.evaluate(`navigator.serviceWorker.ready.then(r=>({scope:r.scope,script:r.active.scriptURL}))`)
  assert.equal(registration.scope, address.href)
  assert.equal(registration.script, new URL('sw.js', address).href)
  const click = async text => page.evaluate(`(()=>{const root=document.querySelector('dialog[open]')||document;const b=[...root.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)});if(!b||b.disabled)throw new Error('Unavailable button');b.click()})()`)
  const cells = `[...document.querySelectorAll('[role="gridcell"]')]`
  await click('NUEVA PARTIDA')
  await click('FÁCIL')
  await page.wait(`${cells}.length===81`)
  const first = await page.evaluate(`JSON.parse(localStorage.getItem('sudoku.save'))`)
  const cell = first.activeGame.puzzle.givens.findIndex(digit => digit === 0)
  await page.evaluate(`${cells}[${cell}].click()`)
  await click('INTRODUCIR 1')
  await page.close()
  page = await openBrowserPage(process.argv[3])
  await page.command('Network.enable')
  await page.command('Network.setCacheDisabled', { cacheDisabled: true })
  await page.command('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  await page.command('Page.navigate', { url: `${address.href}?offline-check=${Date.now()}` })
  await page.wait(`document.querySelector('.home')`)
  assert.ok(page.responses.some(response => response.type === 'Document' && response.fromServiceWorker))
  assert.equal(await page.evaluate(`fetch(${JSON.stringify(new URL(`not-cached-${Date.now()}.txt`, address).href)},{cache:'no-store'}).then(()=>false,()=>true)`), true)
  const restored = await page.evaluate(`JSON.parse(localStorage.getItem('sudoku.save'))`)
  assert.equal(restored.activeGame.entries[cell], 1)
  assert.equal(restored.activeGame.history.length, 1)
  await click('CONTINUAR')
  await page.wait(`${cells}.length===81`)
  await click('DESHACER')
  await page.wait(`${cells}[${cell}].textContent===''`)
  checks.push('Live site cold-starts in a new tab with HTTP cache disabled/offline networking; document is served by SW, uncached network fails, progress/undo recover')
  await click('VOLVER AL INICIO')
  await click('NUEVA PARTIDA')
  await click('FÁCIL')
  await click('NUEVA PARTIDA')
  await page.wait(`${cells}.length===81`)
  const next = await page.evaluate(`JSON.parse(localStorage.getItem('sudoku.save'))`)
  assert.notEqual(next.activeGame.puzzle.id, first.activeGame.puzzle.id)
  const solved = solveLogically(next.activeGame.puzzle.givens, 'easy')
  assert.equal(solved.status, 'solved')
  await page.evaluate(`(async()=>{const s=${JSON.stringify(solved.state.board)};for(let i=0;i<81;i++){const c=[...document.querySelectorAll('[role="gridcell"]')];if(!c.length)break;if(Number(c[i].textContent)===s[i])continue;c[i].click();await new Promise(requestAnimationFrame);document.querySelector('.keypad button[aria-label="INTRODUCIR '+s[i]+'"]').click();await new Promise(requestAnimationFrame)}})()`)
  await page.wait(`document.querySelector('dialog h2')?.textContent==='¡ENHORABUENA!'`)
  assert.equal(await page.evaluate(`JSON.parse(localStorage.getItem('sudoku.save')).completedGames.length`), 1)
  await click('VOLVER AL INICIO')
  await click('AJUSTES')
  const downloads = await mkdtemp(join(output, 'backup-'))
  await page.command('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads })
  await click('EXPORTAR COPIA')
  let backup
  for (let attempt = 0; attempt < 100; attempt++) {
    try { backup = JSON.parse(await readFile(join(downloads, 'sudoku-copia.json'), 'utf8')); break } catch { await new Promise(resolve => setTimeout(resolve, 50)) }
  }
  assert.equal(backup?.completedGames.length, 1)
  assert.equal(backup?.activeGame, null)
  assert.equal(backup?.usedPuzzleIds.length, 2)
  checks.push('Public deployment generates a different puzzle, completes it, stores one result and exports a valid JSON backup while offline')
  assert.deepEqual(page.exceptions, [])
  await writeFile(join(output, 'result.json'), JSON.stringify({ url: address.href, checks }, null, 2))
  console.log(JSON.stringify({ url: address.href, checks }, null, 2))
} catch (error) {
  if (page) console.error(JSON.stringify({ body: await page.evaluate('document.body.innerText'), exceptions: page.exceptions }, null, 2))
  throw error
} finally {
  await page?.close()
  await engine.close()
}
