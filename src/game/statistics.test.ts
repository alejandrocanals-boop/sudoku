import { describe, expect, it } from 'vitest'
import { generatePuzzle } from '../engine/generator'
import { createSeededRandom } from '../engine/random'
import { SaveRepository, SAVE_KEY } from '../storage/repository'
import { emptySavedData, parseSavedData, saveGame, serializeSavedData, type CompletedGame } from '../storage/schema'
import { createGame, reduceGame } from './state'
import { clearStatistics, newestFirst, recordCompletion, summarizeStatistics } from './statistics'

const result = generatePuzzle('easy', { random: createSeededRandom(2026) })
if (result.status !== 'success') throw new Error('Expected puzzle fixture')
const puzzle = result.puzzle
let completed = reduceGame(createGame(puzzle, 'attempt-1'), { type: 'resume', now: 0 })
const firstEmpty = puzzle.givens.findIndex(digit => digit === 0)
completed = reduceGame(completed, { type: 'select', cell: firstEmpty })
completed = reduceGame(completed, { type: 'insert', digit: puzzle.solution[firstEmpty] === 1 ? 2 : 1, now: 100 })
completed = reduceGame(completed, { type: 'undo' })
for (let cell = 0; cell < 81; cell++) {
  if (puzzle.givens[cell]) continue
  completed = reduceGame(completed, { type: 'select', cell })
  completed = reduceGame(completed, { type: 'insert', digit: puzzle.solution[cell]!, now: 5000 })
}
const initial = { ...emptySavedData(), activeGame: saveGame(completed, 5000), usedPuzzleIds: [puzzle.id] }
const at = '2026-11-14T18:00:00.000Z'

describe('completion recording', () => {
  it('records actual errors, duration and level while clearing the active game in one document', () => {
    const saved = recordCompletion(initial, completed, at)
    expect(saved.activeGame).toBeNull()
    expect(saved.completedGames).toEqual([{
      attemptId: 'attempt-1', puzzleId: puzzle.id, level: 'easy', completedAt: at, elapsedMs: 5000, errors: 1,
    }])
    expect(saved.settings).toBe(initial.settings)
    expect(saved.usedPuzzleIds).toBe(initial.usedPuzzleIds)
    expect(initial.activeGame).not.toBeNull()
    expect(initial.completedGames).toEqual([])
    expect(parseSavedData(serializeSavedData(saved))).toEqual(saved)
  })

  it('does not duplicate an attempt or change its first recorded date when replayed', () => {
    const once = recordCompletion(initial, completed, at)
    const twice = recordCompletion(once, completed, '2026-11-15T18:00:00.000Z')
    expect(twice.completedGames).toBe(once.completedGames)
    expect(twice).toEqual(once)
    expect(recordCompletion(parseSavedData(serializeSavedData(once)), completed, at)).toEqual(once)
  })

  it('allows two distinct completed attempts of the same puzzle', () => {
    const once = recordCompletion(initial, completed, at)
    const twice = recordCompletion(once, { ...completed, attemptId: 'attempt-2' }, at)
    expect(twice.completedGames).toHaveLength(2)
    expect(twice.usedPuzzleIds).toEqual([puzzle.id])
  })

  it('rejects incomplete games', () => {
    expect(() => recordCompletion(initial, createGame(puzzle, 'other'), at)).toThrow()
  })

  it('does not clear a different active attempt when an older completion is replayed', () => {
    const once = recordCompletion(initial, completed, at)
    const activeGame = saveGame(createGame(puzzle, 'new-active'), 0)
    const replayed = recordCompletion({ ...once, activeGame }, completed, at)
    expect(replayed.activeGame).toBe(activeGame)
    expect(replayed.completedGames).toBe(once.completedGames)
  })

  it('retries a failed atomic write without losing the pending result or adding duplicates', () => {
    let raw: string | null = serializeSavedData(initial)
    let fail = true
    const repository = new SaveRepository(() => ({
      getItem: () => raw,
      setItem: (key, text) => { expect(key).toBe(SAVE_KEY); if (fail) throw new Error('Quota'); raw = text },
    }))
    repository.load()
    const recorded = recordCompletion(initial, completed, at)
    expect(repository.save(recorded).ok).toBe(false)
    expect(parseSavedData(raw!).activeGame?.status).toBe('completed')
    expect(parseSavedData(raw!).completedGames).toEqual([])
    fail = false
    expect(repository.save(recorded).ok).toBe(true)
    expect(repository.load()).toEqual({ ok: true, data: recorded })
    expect(recordCompletion(parseSavedData(raw!), completed, at).completedGames).toHaveLength(1)
  })
})

function record(attemptId: string, level: CompletedGame['level'], elapsedMs: number, completedAt = at): CompletedGame {
  return { attemptId, puzzleId: puzzle.id, level, elapsedMs, errors: 0, completedAt }
}
describe('statistics and history', () => {
  it('represents unavailable best/average times as null while empty totals remain zero', () => {
    const stats = summarizeStatistics([])
    expect(stats).toMatchObject({ count: 0, totalMs: 0, maxLevelCount: 0 })
    expect(stats.byLevel.map(level => level.level)).toEqual(['easy', 'medium', 'hard', 'expert'])
    expect(stats.byLevel.every(level => level.count === 0 && level.bestMs === null && level.averageMs === null)).toBe(true)
  })

  it('calculates all tiers, total active time, zero-duration bests and proportional counts from real records', () => {
    const input = Object.freeze([
      record('a', 'easy', 0), record('b', 'easy', 90000), record('c', 'medium', 30000), record('d', 'expert', 3601000),
    ].map(value => Object.freeze(value)))
    const stats = summarizeStatistics(input)
    expect(stats).toMatchObject({ count: 4, totalMs: 3721000, maxLevelCount: 2 })
    expect(stats.byLevel).toEqual([
      { level: 'easy', count: 2, bestMs: 0, averageMs: 45000 },
      { level: 'medium', count: 1, bestMs: 30000, averageMs: 30000 },
      { level: 'hard', count: 0, bestMs: null, averageMs: null },
      { level: 'expert', count: 1, bestMs: 3601000, averageMs: 3601000 },
    ])
  })

  it('orders records newest first without changing the stored array', () => {
    const oldest = record('old', 'easy', 1, '2025-01-01T00:00:00.000Z')
    const newest = record('new', 'easy', 1, '2026-01-01T00:00:00.000Z')
    const input = Object.freeze([oldest, newest])
    expect(newestFirst(input)).toEqual([newest, oldest])
    expect(input).toEqual([oldest, newest])
    expect(newestFirst([])).toEqual([])
  })

  it('clears only completion records, preserving active progress, settings and used IDs', () => {
    const recorded = recordCompletion(initial, completed, at)
    const activeGame = saveGame(createGame(puzzle, 'another'), 0)
    const input = { ...recorded, activeGame, settings: { detectErrors: false } }
    const cleared = clearStatistics(input)
    expect(cleared.completedGames).toEqual([])
    expect(cleared.activeGame).toBe(input.activeGame)
    expect(cleared.settings).toBe(input.settings)
    expect(cleared.usedPuzzleIds).toBe(input.usedPuzzleIds)
    expect(input.completedGames).toHaveLength(1)
    expect(summarizeStatistics(cleared.completedGames).count).toBe(0)
  })
})
