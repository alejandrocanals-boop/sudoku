import { describe, expect, it, vi } from 'vitest'
import { isCompleteBoard } from './board'
import { createSeededRandom } from './random'
import { countSolutions, generateCompleteBoard } from './search'
import { classifyLogically, solveLogically, type LogicalLevel } from './solver'
import { carveSymmetricPuzzle, generatePuzzle, puzzleId, type GenerationResult } from './generator'

const solution = [...'534678912672195348198342567859761423426853791713924856961537284287419635345286179'].map(Number)
const deterministic = (seed: number) => ({ random: createSeededRandom(seed), now: () => 0 })
function success(result: GenerationResult) {
  expect(result.status).toBe('success')
  if (result.status !== 'success') throw new Error('Expected generation success')
  return result.puzzle
}

describe('symmetric carving', () => {
  it('preserves a curated solution and retains exactly one solution with symmetric holes', () => {
    const input = Object.freeze([...solution])
    const givens = carveSymmetricPuzzle(input, createSeededRandom(42))
    expect(input).toEqual(solution)
    expect(countSolutions(givens)).toBe(1)
    expect(givens.some(digit => digit === 0)).toBe(true)
    givens.forEach((digit, cell) => {
      expect(digit === 0).toBe(givens[80 - cell] === 0)
      if (digit) expect(digit).toBe(solution[cell])
    })
    expect(carveSymmetricPuzzle(input, createSeededRandom(42))).toEqual(givens)
  })

  it('treats the center independently and rejects further non-unique pair removals', () => {
    for (const seed of [1, 2, 3]) {
      const givens = carveSymmetricPuzzle(solution, createSeededRandom(seed))
      for (let first = 0; first <= 40; first++) {
        if (givens[first] === 0) continue
        const removed = [...givens]
        removed[first] = removed[80 - first] = 0
        expect(countSolutions(removed)).toBe(2)
      }
    }
  })

  it('requires a valid complete solution and validates canonical IDs', () => {
    expect(() => carveSymmetricPuzzle(Array<number>(81).fill(0), Math.random)).toThrow(RangeError)
    expect(() => puzzleId([0])).toThrow(RangeError)
    expect(puzzleId(Array<number>(81).fill(0))).toBe('0'.repeat(81))
  })
})

describe('exact-level generation', () => {
  it.each([
    ['easy', 2026], ['medium', 2026], ['hard', 2028], ['expert', 2026],
  ] as const)('produces a new unique symmetric %s puzzle with a deterministic seed', (level, seed) => {
    const result = generatePuzzle(level, { ...deterministic(seed), maxAttempts: 200 })
    const puzzle = success(result)
    expect(puzzle.level).toBe(level)
    expect(puzzle.id).toBe(puzzle.givens.join(''))
    expect(puzzle.id).toHaveLength(81)
    expect(isCompleteBoard(puzzle.solution)).toBe(true)
    expect(countSolutions(puzzle.givens)).toBe(1)
    expect(classifyLogically(puzzle.givens)).toBe(level)
    expect(solveLogically(puzzle.givens, level).state.board).toEqual(puzzle.solution)
    puzzle.givens.forEach((digit, cell) => {
      expect(digit === 0).toBe(puzzle.givens[80 - cell] === 0)
      if (digit) expect(digit).toBe(puzzle.solution[cell])
    })
    expect(result.metrics.matched).toBe(1)
    expect(result.metrics.attempts).toBeLessThanOrEqual(200)
    expect(result.metrics.evaluated).toBe(result.metrics.attempts)
  })

  it('is reproducible across the entire generation pipeline', () => {
    expect(generatePuzzle('medium', deterministic(2026))).toEqual(generatePuzzle('medium', deterministic(2026)))
  })

  it('exhausts the attempt limit instead of substituting another difficulty', () => {
    success(generatePuzzle('easy', { ...deterministic(2026), maxAttempts: 1 }))
    const result = generatePuzzle('hard', { ...deterministic(2026), maxAttempts: 1 })
    expect(result).toMatchObject({
      status: 'exhausted', reason: 'attempt-limit',
      metrics: { attempts: 1, evaluated: 1, matched: 0 },
    })
    expect('puzzle' in result).toBe(false)
    if (result.status === 'exhausted') expect(result.message).toContain('VUELVE A INTENTARLO')
  })

  it('excludes exact used IDs without mutating the caller list and permits a fresh retry', () => {
    const first = success(generatePuzzle('easy', deterministic(2026)))
    const usedPuzzleIds = Object.freeze([first.id])
    const duplicate = generatePuzzle('easy', { ...deterministic(2026), usedPuzzleIds, maxAttempts: 1 })
    expect(duplicate).toMatchObject({
      status: 'exhausted', reason: 'attempt-limit', metrics: { matched: 1, duplicates: 1 },
    })
    const next = success(generatePuzzle('easy', { ...deterministic(2026), usedPuzzleIds }))
    expect(next.id).not.toBe(first.id)
    expect(usedPuzzleIds).toEqual([first.id])
  })
})

describe('budgets and cancellation', () => {
  it('cancels before any attempt or random draw', () => {
    const controller = new AbortController()
    controller.abort()
    const random = vi.fn(Math.random)
    expect(generatePuzzle('easy', { signal: controller.signal, random })).toMatchObject({
      status: 'cancelled', metrics: { attempts: 0, evaluated: 0 },
    })
    expect(random).not.toHaveBeenCalled()
  })

  it('checks cancellation during backtracking, not just between attempts', () => {
    const controller = new AbortController()
    let draws = 0
    const random = () => {
      if (++draws === 3) controller.abort()
      return 0.5
    }
    expect(generatePuzzle('expert', { random, signal: controller.signal })).toMatchObject({
      status: 'cancelled', metrics: { attempts: 1, evaluated: 0 },
    })
    expect(draws).toBeLessThan(20)
  })

  it('expires inside the first attempt using a monotonic injected clock', () => {
    let clock = 0
    const result = generatePuzzle('hard', {
      random: createSeededRandom(1), now: () => clock++, maxDurationMs: 8,
    })
    expect(result).toMatchObject({
      status: 'exhausted', reason: 'time-limit', metrics: { attempts: 1, evaluated: 0 },
    })
    expect('puzzle' in result).toBe(false)
  })

  it('propagates checkpoints through searching, carving and logical classification', () => {
    const stop = new Error('Stopped')
    const checkpoint = () => { throw stop }
    expect(() => countSolutions(Array<number>(81).fill(0), checkpoint)).toThrow(stop)
    expect(() => generateCompleteBoard(Math.random, checkpoint)).toThrow(stop)
    expect(() => carveSymmetricPuzzle(solution, Math.random, checkpoint)).toThrow(stop)
    expect(() => classifyLogically(solution, checkpoint)).toThrow(stop)
    expect(() => solveLogically(solution, 'easy', checkpoint)).toThrow(stop)
  })

  it.each([0, -1, 1.5, Infinity, NaN])('rejects invalid attempt limit %s', maxAttempts => {
    expect(() => generatePuzzle('easy', { maxAttempts })).toThrow(RangeError)
  })
  it.each([0, -1, Infinity, NaN, 2 ** 31])('rejects invalid time budget %s', maxDurationMs => {
    expect(() => generatePuzzle('easy', { maxDurationMs })).toThrow(RangeError)
  })
  it('rejects invalid levels or random sources instead of masking programming errors', () => {
    expect(() => generatePuzzle('unknown' as LogicalLevel)).toThrow(RangeError)
    expect(() => generatePuzzle('easy', { random: () => 1 })).toThrow(RangeError)
    expect(() => createSeededRandom(-1)).toThrow(RangeError)
    expect(() => createSeededRandom(2 ** 32)).toThrow(RangeError)
  })
})
