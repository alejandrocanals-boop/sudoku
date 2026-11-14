import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { build, createServer } from 'vite'
import { openBrowserPage } from './browser-client.mjs'

const temp = resolve('node_modules/.tmp')
await mkdir(temp, { recursive: true })
const first = await mkdtemp(join(temp, 'pwa-first-'))
const second = await mkdtemp(join(temp, 'pwa-second-'))
const checks = []
let page
let directory = first
let port
const base = '/sudoku/'
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.map': 'application/json' }
const server = createHttpServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname
    if (!path.startsWith(base)) throw new Error('Outside project base')
    const file = resolve(directory, decodeURIComponent(path.slice(base.length)) || 'index.html')
    if (!file.startsWith(directory + sep)) throw new Error('Outside test build')
    const body = await readFile(file)
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
    response.end(body)
  } catch { response.writeHead(404); response.end('Not found') }
})
const listen = async number => {
  await new Promise((done, reject) => { server.once('error', reject); server.listen(number, '127.0.0.1', done) })
  port = server.address().port
}
const stop = async () => {
  if (!server.listening) return
  const closed = new Promise(resolve => server.close(resolve))
  server.closeAllConnections()
  await closed
}
const runtime = await createServer({ configFile: false, cacheDir: 'node_modules/.tmp/pwa-check-vite',
  optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false } })
const previousNodeEnv = process.env.NODE_ENV
try {
  const { solveLogically } = await runtime.ssrLoadModule('/src/engine/solver.ts')
  // The auxiliary SSR server sets NODE_ENV=development; these are real production builds.
  process.env.NODE_ENV = 'production'
  for (const [outDir, tag] of [[first, 'A'], [second, 'B']]) {
    await build({ configFile: resolve('vite.config.ts'), base, logLevel: 'silent',
      build: { outDir, emptyOutDir: true },
      plugins: [{ name: 'test-update-marker', generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'pwa-check-version.js', source: `/* ${tag} */` })
      } }],
    })
  }
  await listen(0)
  const url = `http://127.0.0.1:${port}${base}`
  page = await openBrowserPage(process.argv[2])
  await page.command('Network.enable')
  await page.command('Network.setCacheDisabled', { cacheDisabled: true })
  await page.command('Page.navigate', { url })
  await page.wait(`document.querySelector('.home') && navigator.serviceWorker.controller`)
  const manifest = await page.evaluate(`fetch(document.querySelector('link[rel="manifest"]').href).then(r=>r.json())`)
  assert.equal(manifest.scope, base)
  assert.equal(manifest.id, base)
  assert.equal(manifest.start_url, base)
  assert.equal(manifest.display, 'standalone')
  const registration = await page.evaluate(`navigator.serviceWorker.ready.then(r=>({scope:r.scope,script:r.active.scriptURL}))`)
  assert.equal(registration.scope, url)
  assert.equal(registration.script, `${url}sw.js`)
  const resources = await page.evaluate(`(async()=>{const urls=[...document.querySelectorAll('script[src],link[href]')].map(e=>e.src||e.href);urls.push(...${JSON.stringify(manifest.icons.map(icon => icon.src))});return Promise.all(urls.map(async u=>{const r=await fetch(u);return {url:r.url,status:r.status}}))})()`)
  assert.ok(resources.every(resource => resource.status === 200 && resource.url.startsWith(url)))
  checks.push('Scoped project manifest, registration, icons and all HTML-linked assets resolve under /sudoku/')

  const click = async text => {
    await page.evaluate(`(()=>{const root=document.querySelector('dialog[open]')||document;const b=[...root.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)});if(!b||b.disabled)throw new Error('Missing button '+${JSON.stringify(text)});b.click()})()`)
  }
  const grid = `[...document.querySelectorAll('[role="gridcell"]')]`
  const newGame = async () => {
    await click('NUEVA PARTIDA')
    await click('FÁCIL')
    if (await page.evaluate(`!!document.querySelector('dialog[open]')`)) {
      await page.evaluate(`document.querySelector('dialog .primary').click()`)
    }
    await page.wait(`${grid}.length===81`)
  }
  const solveCurrent = async () => {
    const givens = await page.evaluate(`${grid}.map(c=>c.getAttribute('aria-readonly')==='true'?Number(c.textContent):0)`)
    const solved = solveLogically(givens, 'easy')
    assert.equal(solved.status, 'solved')
    await page.evaluate(`(async()=>{const s=${JSON.stringify(solved.state.board)};for(let i=0;i<81;i++){const c=[...document.querySelectorAll('[role="gridcell"]')];if(!c.length)break;if(Number(c[i].textContent)===s[i])continue;c[i].click();await new Promise(requestAnimationFrame);document.querySelector('.keypad button[aria-label="INTRODUCIR '+s[i]+'"]').click();await new Promise(requestAnimationFrame)}})()`)
    await page.wait(`document.querySelector('dialog h2')?.textContent==='¡ENHORABUENA!'`)
  }
  await newGame()
  const originalId = await page.evaluate(`JSON.parse(localStorage.getItem('sudoku.save')).activeGame.puzzle.id`)
  const cell = await page.evaluate(`${grid}.findIndex(c=>!c.textContent)`)
  await page.evaluate(`${grid}[${cell}].click()`)
  await page.evaluate(`document.querySelector('.keypad button[aria-label="INTRODUCIR 1"]').click()`)
  await page.close()
  page = null
  await stop()
  // New tab + unavailable HTTP server + disabled browser HTTP cache: only the installed SW can serve this URL.
  page = await openBrowserPage(process.argv[2])
  await page.command('Network.enable')
  await page.command('Network.setCacheDisabled', { cacheDisabled: true })
  await page.command('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  await page.command('Page.navigate', { url: `${url}?cold-offline=1` })
  await page.wait(`document.querySelector('.home')`)
  assert.ok(await page.evaluate(`!!navigator.serviceWorker.controller`))
  const recovered = await page.evaluate(`JSON.parse(localStorage.getItem('sudoku.save'))`)
  assert.equal(recovered.activeGame.puzzle.id, originalId)
  assert.equal(recovered.activeGame.entries[cell], 1)
  assert.equal(recovered.activeGame.history.length, 1)
  const offlineAssets = await page.evaluate(`Promise.all(${JSON.stringify(['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/sudoku.svg'].map(path => base + path))}.map(async u=>{const r=await fetch(u);return r.status}))`)
  assert.ok(offlineAssets.every(status => status === 200))
  assert.equal(await page.evaluate(`getComputedStyle(document.documentElement).backgroundColor`), 'rgb(243, 246, 251)')
  await click('CONTINUAR')
  await page.wait(`${grid}.length===81`)
  assert.equal(await page.evaluate(`Number(${grid}[${cell}].textContent)`), 1)
  await click('DESHACER')
  await page.wait(`${grid}[${cell}].textContent===''`)
  assert.equal(await page.evaluate(`JSON.parse(localStorage.getItem('sudoku.save')).activeGame.errors`), recovered.activeGame.errors)
  await click('VOLVER AL INICIO')
  await newGame()
  const offlineId = await page.evaluate(`JSON.parse(localStorage.getItem('sudoku.save')).activeGame.puzzle.id`)
  assert.notEqual(offlineId, originalId)
  await solveCurrent()
  await click('VOLVER AL INICIO')
  assert.equal(await page.evaluate(`JSON.parse(localStorage.getItem('sudoku.save')).completedGames.length`), 1)
  checks.push('Cold launch in a new tab with server stopped and HTTP cache disabled restores progress and undo data')
  checks.push('A fresh generator worker, uniqueness-rated puzzle, full play and completion work with no server/network')

  await newGame()
  const beforeUpdate = await page.evaluate(`localStorage.getItem('sudoku.save')`)
  const timeOrigin = await page.evaluate(`performance.timeOrigin`)
  directory = second
  await listen(port)
  await page.command('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  await page.evaluate(`navigator.serviceWorker.getRegistration().then(r=>r.update())`)
  await page.wait(`navigator.serviceWorker.getRegistration().then(r=>r.waiting?.state==='installed')`)
  assert.equal(await page.evaluate(`performance.timeOrigin`), timeOrigin)
  assert.equal(await page.evaluate(`${grid}.length`), 81)
  assert.equal(await page.evaluate(`document.querySelector('.update-notice')`), null)
  assert.equal(JSON.parse(await page.evaluate(`localStorage.getItem('sudoku.save')`)).activeGame.attemptId,
    JSON.parse(beforeUpdate).activeGame.attemptId)
  checks.push('Second real build installs as waiting without reloading or interrupting an active game')
  await solveCurrent()
  await click('VOLVER AL INICIO')
  await page.wait(`document.querySelector('.update-notice')`)
  const savedBeforeReload = await page.evaluate(`localStorage.getItem('sudoku.save')`)
  await click('ACTUALIZAR')
  await page.wait(`performance.timeOrigin!==${timeOrigin} && document.querySelector('.home')`)
  assert.equal(await page.evaluate(`localStorage.getItem('sudoku.save')`), savedBeforeReload)
  assert.equal(await page.evaluate(`fetch('${base}pwa-check-version.js').then(r=>r.text())`), '/* B */')
  checks.push('Explicit update from idle home activates build B, reloads once and preserves the complete saved document')
  assert.deepEqual(page.exceptions, [])
  await mkdir('node_modules/.tmp/pwa-check', { recursive: true })
  await writeFile('node_modules/.tmp/pwa-check/result.json', JSON.stringify({ base, checks }, null, 2))
  console.log(JSON.stringify({ base, checks }, null, 2))
} catch (error) {
  if (page) console.error(JSON.stringify({ body: await page.evaluate('document.body.innerText'), exceptions: page.exceptions }, null, 2))
  throw error
} finally {
  await page?.close()
  await stop()
  await runtime.close()
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = previousNodeEnv
  for (const path of [first, second]) {
    // Validate absolute targets before recursive deletion of only this script's generated build directories.
    assert.equal(dirname(resolve(path)), temp)
    await access(path)
    await rm(path, { recursive: true, force: true })
  }
}
