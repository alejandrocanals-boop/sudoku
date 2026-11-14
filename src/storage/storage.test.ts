import { describe, expect, it, vi } from 'vitest'
import { generatePuzzle } from '../engine/generator'
import { createSeededRandom } from '../engine/random'
import { createGame, elapsedTimeMs, reduceGame } from '../game/state'
import { MAX_BACKUP_BYTES, emptySavedData, parseSavedData, restoreGame, saveGame, serializeSavedData, type SavedData } from './schema'
import { SAVE_KEY, SaveRepository, type StoragePort } from './repository'
import { readBackup } from './backup'

const generated = generatePuzzle('easy', { random: createSeededRandom(2026) })
if (generated.status !== 'success') throw new Error('Expected fixture generation')
const puzzle = generated.puzzle
const cell = puzzle.givens.findIndex(digit => digit === 0)
const wrong = puzzle.solution[cell] === 1 ? 2 : 1
function fixture(): SavedData {
  let game = reduceGame(createGame(puzzle, 'attempt-1'), { type: 'resume', now: 100 })
  game = reduceGame(game, { type: 'select', cell })
  game = reduceGame(game, { type: 'insert', digit: wrong, now: 500 })
  return { ...emptySavedData(), activeGame: saveGame(game, 1100), usedPuzzleIds: [puzzle.id] }
}
class MemoryStorage implements StoragePort {
  raw: string | null = null
  readError = false
  writeError = false
  writes = 0
  getItem() {
    if (this.readError) throw new Error('SecurityError')
    return this.raw
  }
  setItem(key: string, value: string) {
    expect(key).toBe(SAVE_KEY)
    if (this.writeError) throw new Error('QuotaExceededError')
    this.raw = value
    this.writes++
  }
}

describe('versioned save boundary', () => {
  it('round-trips settings, used IDs and the full game without a live clock or background catch-up', () => {
    const input = fixture()
    const text = serializeSavedData(input)
    const data = parseSavedData(text)
    expect(data).toEqual(input)
    expect(serializeSavedData(data)).toBe(text)
    expect(text).not.toContain('activeSinceMs')
    const restored = restoreGame(data.activeGame)!
    expect(restored.status).toBe('paused')
    expect(elapsedTimeMs(restored, 900000)).toBe(1000)
    expect(restored.errors).toBe(1)
    const resumed = reduceGame(restored, { type: 'resume', now: 900000 })
    expect(elapsedTimeMs(resumed, 901000)).toBe(2000)
    expect(reduceGame(resumed, { type: 'undo' }).entries).toEqual(puzzle.givens)
    expect(reduceGame(resumed, { type: 'undo' }).errors).toBe(1)
  })

  it('retains removed-history mistakes and wrong duplicates without requiring a legal user board', () => {
    const data = fixture()
    const game = restoreGame(data.activeGame)!
    const resumed = reduceGame(game, { type: 'resume', now: 0 })
    const undone = reduceGame(resumed, { type: 'undo' })
    expect(parseSavedData(serializeSavedData({ ...data, activeGame: saveGame(undone, 10) })).activeGame?.errors).toBe(1)
  })

  it('preserves validated completed records and pending completion without producing new records', () => {
    const data = fixture()
    const record = { attemptId: 'previous', puzzleId: puzzle.id, level: puzzle.level,
      completedAt: '2026-11-14T10:00:00.000Z', elapsedMs: 1234, errors: 2 }
    const withHistory = { ...data, completedGames: [record], settings: { detectErrors: false } }
    expect(parseSavedData(serializeSavedData(withHistory))).toEqual(withHistory)
    let game = reduceGame(createGame(puzzle, 'attempt-2'), { type: 'resume', now: 0 })
    for (let index = 0; index < 81; index++) {
      if (puzzle.givens[index]) continue
      game = reduceGame(game, { type: 'select', cell: index })
      game = reduceGame(game, { type: 'insert', digit: puzzle.solution[index]!, now: 1000 })
    }
    const pending = parseSavedData(serializeSavedData({ ...data, activeGame: saveGame(game, 1000) }))
    expect(restoreGame(pending.activeGame)?.status).toBe('completed')
    expect(pending.completedGames).toEqual([])
  })

  it.each([
    ['future version', (d: any) => { d.version = 2 }],
    ['missing field', (d: any) => { delete d.settings }],
    ['unknown field', (d: any) => { d.extra = true }],
    ['invalid setting', (d: any) => { d.settings.detectErrors = 'false' }],
    ['duplicate ID', (d: any) => { d.usedPuzzleIds.push(d.usedPuzzleIds[0]) }],
    ['missing active ID', (d: any) => { d.usedPuzzleIds = [] }],
    ['clock baseline', (d: any) => { d.activeGame.activeSinceMs = 100 }],
    ['running status', (d: any) => { d.activeGame.status = 'playing' }],
    ['changed given', (d: any) => { const c = d.activeGame.puzzle.givens.findIndex((n: number) => n); d.activeGame.entries[c] = 0 }],
    ['wrong solution', (d: any) => { d.activeGame.puzzle.solution[0] = 0 }],
    ['wrong tier', (d: any) => { d.activeGame.puzzle.level = 'expert' }],
    ['bad history', (d: any) => { d.activeGame.history[0].before = 8 }],
    ['unexplained entries', (d: any) => { d.activeGame.history = [] }],
    ['undercounted errors', (d: any) => { d.activeGame.errors = 0 }],
    ['negative time', (d: any) => { d.activeGame.elapsedMs = -1 }],
    ['fractional errors', (d: any) => { d.activeGame.errors = 1.5 }],
    ['invalid selection', (d: any) => { d.activeGame.selectedCell = 81 }],
    ['false completion', (d: any) => { d.activeGame.status = 'completed' }],
  ])('rejects %s', (_, mutate) => {
    const data = JSON.parse(serializeSavedData(fixture()))
    mutate(data)
    expect(() => parseSavedData(JSON.stringify(data))).toThrow()
  })

  it('rejects incomplete, malformed and over-budget input', () => {
    for (const text of ['null', '[]', '{', '{}']) expect(() => parseSavedData(text)).toThrow()
    let time = 0
    expect(() => parseSavedData(serializeSavedData(fixture()), () => time += 1100)).toThrow()
    expect(() => parseSavedData(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow()
  })

  it('rejects nonunique givens even when a compatible solution is supplied', () => {
    const data = fixture()
    const active = data.activeGame!
    const givens = Array<number>(81).fill(0)
    const ambiguous = { ...data, usedPuzzleIds: ['0'.repeat(81)], activeGame: {
      ...active, puzzle: { ...active.puzzle, id: '0'.repeat(81), givens },
    } }
    expect(() => parseSavedData(JSON.stringify(ambiguous))).toThrow()
  })

  it.each(['duplicate', 'active-collision', 'date', 'missing-id', 'time'] as const)(
    'validates completed record integrity: %s', kind => {
      const data = fixture()
      const record = { attemptId: 'past', puzzleId: puzzle.id, level: puzzle.level,
        completedAt: '2026-11-14T10:00:00.000Z', elapsedMs: 1234, errors: 0 }
      const completedGames = [record]
      if (kind === 'duplicate') completedGames.push(record)
      if (kind === 'active-collision') record.attemptId = 'attempt-1'
      if (kind === 'date') record.completedAt = 'not a date'
      if (kind === 'missing-id') record.puzzleId = '0'.repeat(81)
      if (kind === 'time') record.elapsedMs = -1
      expect(() => parseSavedData(JSON.stringify({ ...data, completedGames }))).toThrow()
    },
  )
})

describe('safe repository writes', () => {
  it('uses recoverable defaults only for absent data and writes one versioned key', () => {
    const storage = new MemoryStorage()
    const repository = new SaveRepository(() => storage)
    expect(repository.load()).toEqual({ ok: true, data: emptySavedData() })
    expect(storage.writes).toBe(0)
    expect(repository.save(fixture())).toEqual({ ok: true })
    expect(parseSavedData(storage.raw!)).toEqual(fixture())
  })

  it.each(['read', 'invalid', 'future'] as const)('blocks automatic writes after %s failure and can retry recovery', kind => {
    const storage = new MemoryStorage()
    const original = kind === 'invalid' ? '{broken' : kind === 'future' ? '{"version":42}' : serializeSavedData(fixture())
    storage.raw = original
    storage.readError = kind === 'read'
    const repository = new SaveRepository(() => storage)
    expect(repository.load().ok).toBe(false)
    expect(repository.save(emptySavedData()).ok).toBe(false)
    expect(storage.raw).toBe(original)
    expect(storage.writes).toBe(0)
    storage.readError = false
    storage.raw = serializeSavedData(fixture())
    expect(repository.load()).toEqual({ ok: true, data: fixture() })
  })

  it('retains the previous document on quota failure and retries without losing edits', () => {
    const storage = new MemoryStorage()
    const repository = new SaveRepository(() => storage)
    repository.load()
    repository.save(fixture())
    const original = storage.raw
    storage.writeError = true
    const changed = { ...fixture(), settings: { detectErrors: false } }
    expect(repository.save(changed)).toEqual({ ok: false, issue: 'write' })
    expect(storage.raw).toBe(original)
    storage.writeError = false
    expect(repository.save(changed)).toEqual({ ok: true })
  })

  it('detects another tab changing the document instead of overwriting it', () => {
    const storage = new MemoryStorage()
    const repository = new SaveRepository(() => storage)
    repository.load()
    storage.raw = serializeSavedData(fixture())
    expect(repository.save(emptySavedData())).toEqual({ ok: false, issue: 'conflict' })
    expect(parseSavedData(storage.raw).activeGame).not.toBeNull()
  })

  it('adopts a confirmed valid import only after its atomic storage write succeeds', () => {
    const storage = new MemoryStorage()
    storage.raw = 'unreadable'
    const repository = new SaveRepository(() => storage)
    repository.load()
    storage.writeError = true
    const imported = parseSavedData(serializeSavedData(fixture()))
    expect(repository.import(imported).ok).toBe(false)
    expect(storage.raw).toBe('unreadable')
    storage.writeError = false
    expect(repository.import(imported).ok).toBe(true)
    expect(repository.load()).toEqual({ ok: true, data: imported })
  })

  it('handles an inaccessible localStorage getter as a recoverable read error', () => {
    const repository = new SaveRepository(() => { throw new Error('SecurityError') })
    expect(repository.load()).toEqual({ ok: false, issue: 'read' })
  })
})

it('validates a file before import and rejects large files before reading', async () => {
  const text = vi.fn(async () => serializeSavedData(fixture()))
  await expect(readBackup({ size: 1000, text })).resolves.toEqual(fixture())
  text.mockClear()
  await expect(readBackup({ size: MAX_BACKUP_BYTES + 1, text })).rejects.toThrow()
  expect(text).not.toHaveBeenCalled()
  await expect(readBackup({ size: 10, text: async () => 'invalid' })).rejects.toThrow()
})
