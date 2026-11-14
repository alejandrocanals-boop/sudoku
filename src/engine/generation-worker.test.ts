import { once } from 'node:events'
import { mkdtemp, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import { build } from 'vite'
import { expect, it } from 'vitest'
import type { GenerationWorkerReply } from './generation-protocol'
import { countSolutions } from './search'
import { classifyLogically } from './solver'

it('bundles the actual browser worker and runs its engine off the requesting thread', async () => {
  const base = resolve('node_modules/.tmp')
  await mkdir(base, { recursive: true })
  const directory = await mkdtemp(join(base, 'generation-worker-'))
  // Validate the absolute cleanup target before creating artifacts or entering finally.
  if (dirname(resolve(directory)) !== base) throw new Error('Unexpected worker test directory')
  let worker: Worker | undefined
  let heartbeat: ReturnType<typeof setInterval> | undefined
  try {
    // The scaffold does not import the client yet; compile its real Vite worker entry explicitly.
    await build({
      configFile: false, logLevel: 'silent', base: './',
      build: {
        outDir: directory, emptyOutDir: true,
        lib: { entry: resolve('src/engine/generation-client.ts'), formats: ['es'], fileName: 'client' },
      },
    })
    const assets = await readdir(join(directory, 'assets'))
    const entry = assets.find(file => /^generation\.worker-.*\.js$/.test(file))
    expect(entry).toBeDefined()
    // Node bridge supplies only Web Worker's message API; engine code is the built browser asset.
    worker = new Worker(`
      const { parentPort, workerData } = require('node:worker_threads');
      globalThis.self = globalThis;
      globalThis.postMessage = data => parentPort.postMessage(data);
      parentPort.on('message', data => globalThis.onmessage({ data }));
      import(workerData).then(() => parentPort.postMessage({ ready: true }));
    `, { eval: true, workerData: pathToFileURL(join(directory, 'assets', entry!)).href })
    expect((await once(worker, 'message'))[0]).toEqual({ ready: true })
    let ticks = 0
    heartbeat = setInterval(() => ticks++, 1)
    const reply = once(worker, 'message')
    worker.postMessage({ level: 'hard', limits: { maxAttempts: 200, maxDurationMs: 10_000 }, seed: 2028 })
    const [message] = await reply as [GenerationWorkerReply]
    clearInterval(heartbeat)
    expect(ticks).toBeGreaterThan(0)
    expect(message.type).toBe('result')
    if (message.type !== 'result' || message.result.status !== 'success') {
      throw new Error('Expected a successful worker result')
    }
    expect(message.result.puzzle.level).toBe('hard')
    expect(countSolutions(message.result.puzzle.givens)).toBe(1)
    expect(classifyLogically(message.result.puzzle.givens)).toBe('hard')
  } finally {
    clearInterval(heartbeat)
    await worker?.terminate()
    await rm(directory, { recursive: true, force: true })
  }
}, 15_000)
