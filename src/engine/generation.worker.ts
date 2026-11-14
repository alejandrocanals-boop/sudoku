import { generatePuzzle } from './generator'
import { createSeededRandom } from './random'
import type { GenerationWorkerReply, GenerationWorkerRequest } from './generation-protocol'

self.onmessage = (event: MessageEvent<GenerationWorkerRequest>) => {
  const { level, limits, seed } = event.data
  let reply: GenerationWorkerReply
  try {
    const result = generatePuzzle(level, {
      ...limits, random: seed === undefined ? Math.random : createSeededRandom(seed),
    })
    reply = { type: 'result', result }
  } catch (error) {
    reply = { type: 'error', message: error instanceof Error ? error.message : 'Generation worker failed' }
  }
  self.postMessage(reply)
}
