import { createServer } from 'vite'
import { performance } from 'node:perf_hooks'
import { writeFile } from 'node:fs/promises'
import { cpus } from 'node:os'

const samples = Number(process.argv[2] ?? 10)
if (!Number.isSafeInteger(samples) || samples < 1) throw new Error('Expected a positive sample count')
const server = await createServer({ configFile: false, server: { middlewareMode: true } })
try {
  const { generatePuzzle } = await server.ssrLoadModule('/src/engine/generator.ts')
  const { createSeededRandom } = await server.ssrLoadModule('/src/engine/random.ts')
  const records = []
  for (const level of ['easy', 'medium', 'hard', 'expert']) {
    for (let sample = 0; sample < samples; sample++) {
      const seed = 2026 + sample
      const start = performance.now()
      const heartbeat = new Promise(resolve => setTimeout(() => resolve(performance.now() - start), 0))
      const result = generatePuzzle(level, { random: createSeededRandom(seed) })
      const blockedMs = performance.now() - start
      const timerDelayMs = await heartbeat
      records.push({ level, seed, status: result.status, ...result.metrics, blockedMs, timerDelayMs })
    }
  }
  const summaries = ['easy', 'medium', 'hard', 'expert'].map(level => {
    const rows = records.filter(record => record.level === level)
    const times = rows.map(row => row.elapsedMs).sort((a, b) => a - b)
    const total = key => rows.reduce((sum, row) => sum + row[key], 0)
    return {
      level, successes: rows.filter(row => row.status === 'success').length, requests: rows.length,
      evaluated: total('evaluated'), acceptanceRate: total('matched') / total('evaluated'),
      meanMs: total('elapsedMs') / rows.length, p95Ms: times[Math.ceil(times.length * 0.95) - 1],
      maxTimerDelayMs: Math.max(...rows.map(row => row.timerDelayMs)),
    }
  })
  const output = { node: process.version, platform: process.platform, cpu: cpus()[0]?.model, summaries, records }
  if (process.argv[3]) await writeFile(process.argv[3], `${JSON.stringify(output, null, 2)}\n`)
  console.log(JSON.stringify(summaries, null, 2))
} finally {
  await server.close()
}
