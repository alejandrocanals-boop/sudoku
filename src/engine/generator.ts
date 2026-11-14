import { assertValidBoard, isCompleteBoard, type Board } from './board'
import { shuffleInPlace } from './random'
import { countSolutions, generateCompleteBoard, type RandomSource } from './search'
import { classifyLogically, LOGICAL_LEVELS, type LogicalLevel } from './solver'

export const DEFAULT_GENERATION_LIMITS = { maxAttempts: 2000, maxDurationMs: 10_000 } as const
export const GENERATION_RETRY_MESSAGE = 'NO SE HA ENCONTRADO UN SUDOKU DE ESTE NIVEL. VUELVE A INTENTARLO.'

export interface Puzzle {
  readonly id: string
  readonly givens: Board
  readonly solution: Board
  readonly level: LogicalLevel
}

export interface GenerationLimits {
  readonly maxAttempts?: number
  readonly maxDurationMs?: number
  readonly usedPuzzleIds?: readonly string[]
}

export interface GenerationOptions extends GenerationLimits {
  readonly signal?: AbortSignal
  readonly random?: RandomSource
  /** Monotonic milliseconds; injectable for deterministic budget tests. */
  readonly now?: () => number
}

export interface GenerationMetrics {
  readonly attempts: number
  readonly evaluated: number
  readonly matched: number
  readonly duplicates: number
  readonly elapsedMs: number
}

export type GenerationResult =
  | { readonly status: 'success'; readonly puzzle: Puzzle; readonly metrics: GenerationMetrics }
  | { readonly status: 'exhausted'; readonly reason: 'attempt-limit' | 'time-limit'; readonly message: string; readonly metrics: GenerationMetrics }
  | { readonly status: 'cancelled'; readonly message: string; readonly metrics: GenerationMetrics }

class GenerationStopped extends Error {
  readonly reason: 'cancelled' | 'time-limit'
  constructor(reason: 'cancelled' | 'time-limit') {
    super(reason)
    this.reason = reason
  }
}

export function puzzleId(givens: Board): string {
  assertValidBoard(givens)
  return givens.join('')
}

export function validateGenerationLimits(level: LogicalLevel, options: GenerationLimits): void {
  if (!LOGICAL_LEVELS.includes(level)) throw new RangeError('Unknown Sudoku level')
  const attempts = options.maxAttempts ?? DEFAULT_GENERATION_LIMITS.maxAttempts
  const duration = options.maxDurationMs ?? DEFAULT_GENERATION_LIMITS.maxDurationMs
  if (!Number.isSafeInteger(attempts) || attempts < 1) throw new RangeError('maxAttempts must be a positive safe integer')
  if (!Number.isFinite(duration) || duration <= 0 || duration > 2_147_483_647) {
    throw new RangeError('maxDurationMs must be positive and fit a signed 32-bit timer')
  }
}

/** Removes 180-degree pairs, including the center as its own independent group.
 * Every retained removal has exactly one solution. The input is preserved.
 */
export function carveSymmetricPuzzle(
  solution: Board, random: RandomSource, checkpoint?: () => void,
): number[] {
  if (!isCompleteBoard(solution)) throw new RangeError('Expected a complete valid solution')
  const givens = [...solution]
  const groups = Array.from({ length: 41 }, (_, index) => index)
  shuffleInPlace(groups, random)
  for (const first of groups) {
    checkpoint?.()
    const second = 80 - first
    const firstDigit = givens[first]!
    const secondDigit = givens[second]!
    givens[first] = givens[second] = 0
    if (countSolutions(givens, checkpoint) !== 1) {
      givens[first] = firstDigit
      givens[second] = secondDigit
    }
  }
  return givens
}

/** Synchronous engine for explicit requests. Browser callers should use the worker client.
 * No storage writes: the caller records an ID only after accepting the returned puzzle.
 */
export function generatePuzzle(level: LogicalLevel, options: GenerationOptions = {}): GenerationResult {
  validateGenerationLimits(level, options)
  const maxAttempts = options.maxAttempts ?? DEFAULT_GENERATION_LIMITS.maxAttempts
  const duration = options.maxDurationMs ?? DEFAULT_GENERATION_LIMITS.maxDurationMs
  const random = options.random ?? Math.random
  const now = options.now ?? (() => performance.now())
  const started = now()
  const used = new Set(options.usedPuzzleIds)
  let attempts = 0
  let evaluated = 0
  let matched = 0
  let duplicates = 0
  const metrics = (): GenerationMetrics => ({
    attempts, evaluated, matched, duplicates, elapsedMs: Math.max(0, now() - started),
  })
  const checkpoint = () => {
    if (options.signal?.aborted) throw new GenerationStopped('cancelled')
    if (now() - started >= duration) throw new GenerationStopped('time-limit')
  }
  try {
    for (; attempts < maxAttempts;) {
      checkpoint()
      attempts++
      const solution = generateCompleteBoard(random, checkpoint)
      const givens = carveSymmetricPuzzle(solution, random, checkpoint)
      const actualLevel = classifyLogically(givens, checkpoint)
      evaluated++
      checkpoint()
      if (actualLevel !== level) continue
      matched++
      const id = puzzleId(givens)
      if (used.has(id)) {
        duplicates++
        continue
      }
      return { status: 'success', puzzle: { id, givens, solution, level }, metrics: metrics() }
    }
    return { status: 'exhausted', reason: 'attempt-limit', message: GENERATION_RETRY_MESSAGE, metrics: metrics() }
  } catch (error) {
    if (!(error instanceof GenerationStopped)) throw error
    if (error.reason === 'cancelled') {
      return { status: 'cancelled', message: 'GENERACIÓN CANCELADA', metrics: metrics() }
    }
    return { status: 'exhausted', reason: 'time-limit', message: GENERATION_RETRY_MESSAGE, metrics: metrics() }
  }
}
