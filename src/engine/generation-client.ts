import {
  DEFAULT_GENERATION_LIMITS, GENERATION_RETRY_MESSAGE, validateGenerationLimits,
  type GenerationLimits, type GenerationResult,
} from './generator'
import type { GenerationWorkerReply, GenerationWorkerRequest } from './generation-protocol'
import { createSeededRandom } from './random'
import type { LogicalLevel } from './solver'

export interface PuzzleRequestOptions extends GenerationLimits {
  readonly signal?: AbortSignal
  readonly seed?: number
}

/** One worker per explicit request; always terminated on completion or failure.
 * Abort rejects with AbortError; the total request watchdog rejects with TimeoutError.
 * Exhausted search returns the engine's retryable result. No synchronous UI fallback.
 */
export async function requestPuzzle(
  level: LogicalLevel, options: PuzzleRequestOptions = {},
): Promise<GenerationResult> {
  validateGenerationLimits(level, options)
  if (options.seed !== undefined) createSeededRandom(options.seed)
  const { signal, seed, maxAttempts, maxDurationMs, usedPuzzleIds } = options
  if (signal?.aborted) throw new DOMException('GENERACIÓN CANCELADA', 'AbortError')
  const request: GenerationWorkerRequest = { level, limits: { maxAttempts, maxDurationMs, usedPuzzleIds }, seed }
  const duration = maxDurationMs ?? DEFAULT_GENERATION_LIMITS.maxDurationMs
  const started = performance.now()
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./generation.worker.ts', import.meta.url), { type: 'module' })
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      worker.onmessage = null
      worker.onerror = null
      worker.onmessageerror = null
      worker.terminate()
    }
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    const onAbort = () => fail(new DOMException('GENERACIÓN CANCELADA', 'AbortError'))
    signal?.addEventListener('abort', onAbort, { once: true })
    worker.onmessage = (event: MessageEvent<GenerationWorkerReply>) => {
      if (settled) return
      if (performance.now() - started >= duration) {
        fail(new DOMException(GENERATION_RETRY_MESSAGE, 'TimeoutError'))
        return
      }
      if (event.data.type === 'error') {
        fail(new Error(event.data.message))
        return
      }
      settled = true
      cleanup()
      resolve(event.data.result)
    }
    worker.onerror = () => fail(new Error('NO SE HA PODIDO GENERAR EL SUDOKU. VUELVE A INTENTARLO.'))
    worker.onmessageerror = () => fail(new Error('NO SE HA PODIDO RECIBIR EL SUDOKU. VUELVE A INTENTARLO.'))
    timer = setTimeout(() => fail(new DOMException(GENERATION_RETRY_MESSAGE, 'TimeoutError')),
      Math.max(0, duration - (performance.now() - started)))
    if (signal?.aborted) onAbort()
    else {
      try {
        worker.postMessage(request)
      } catch (error) {
        fail(error instanceof Error ? error : new Error('Could not send generation request'))
      }
    }
  })
}
