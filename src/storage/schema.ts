import { isValidBoard } from '../engine/board'
import { countSolutions } from '../engine/search'
import { classifyLogically, LOGICAL_LEVELS, type LogicalLevel } from '../engine/solver'
import { createGame, elapsedTimeMs, type CellChange, type GameState } from '../game/state'
import type { GameSettings } from '../game/settings'

export const SAVE_VERSION = 1
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024
export type SavedGame = Omit<GameState, 'activeSinceMs' | 'status'> & {
  readonly status: 'inactive' | 'paused' | 'completed'
}
export interface CompletedGame {
  readonly attemptId: string
  readonly puzzleId: string
  readonly level: LogicalLevel
  readonly completedAt: string
  readonly elapsedMs: number
  readonly errors: number
}
export interface SavedData {
  readonly version: typeof SAVE_VERSION
  readonly activeGame: SavedGame | null
  readonly settings: GameSettings
  readonly usedPuzzleIds: readonly string[]
  readonly completedGames: readonly CompletedGame[]
}

export function emptySavedData(): SavedData {
  return { version: SAVE_VERSION, activeGame: null, settings: { detectErrors: true }, usedPuzzleIds: [], completedGames: [] }
}
export function saveGame(game: GameState | null, now: number): SavedGame | null {
  if (!game) return null
  const { activeSinceMs: _runtimeClock, ...saved } = game
  return { ...saved, elapsedMs: elapsedTimeMs(game, now), status: game.status === 'playing' ? 'paused' : game.status }
}
export function restoreGame(game: SavedGame | null): GameState | null {
  return game ? { ...game, activeSinceMs: null } : null
}

function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new Error('Invalid Sudoku save data')
}
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  requireValid(value !== null && typeof value === 'object' && !Array.isArray(value))
  const result = value as Record<string, unknown>
  requireValid(Object.keys(result).length === keys.length && keys.every(key => Object.hasOwn(result, key)))
  return result
}
function id(value: unknown): string {
  requireValid(typeof value === 'string' && value.trim().length > 0 && value.length <= 256)
  return value
}
function puzzleId(value: unknown): string {
  requireValid(typeof value === 'string' && /^[0-9]{81}$/.test(value))
  return value
}
function number(value: unknown, integer = false): number {
  requireValid(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER
    && (!integer || Number.isSafeInteger(value)))
  return value
}
function digit(value: unknown): number {
  const result = number(value, true)
  requireValid(result <= 9)
  return result
}
function index(value: unknown): number {
  const result = number(value, true)
  requireValid(result < 81)
  return result
}
function board(value: unknown): number[] {
  requireValid(Array.isArray(value) && value.length === 81)
  return Array.from(value, digit)
}
function level(value: unknown): LogicalLevel {
  requireValid(typeof value === 'string' && LOGICAL_LEVELS.includes(value as LogicalLevel))
  return value as LogicalLevel
}

function parseGame(value: unknown, checkpoint: () => void): SavedGame {
  const game = object(value, ['attemptId', 'puzzle', 'entries', 'selectedCell', 'history', 'errors', 'status', 'elapsedMs'])
  const data = object(game.puzzle, ['id', 'givens', 'solution', 'level'])
  const puzzle = { id: puzzleId(data.id), givens: board(data.givens), solution: board(data.solution), level: level(data.level) }
  const fresh = createGame(puzzle, id(game.attemptId))
  const { activeSinceMs: _runtimeClock, ...base } = fresh
  requireValid(isValidBoard(puzzle.givens)
    && puzzle.givens.every((value, cell) => (value === 0) === (puzzle.givens[80 - cell] === 0)))
  requireValid(countSolutions(puzzle.givens, checkpoint) === 1)
  requireValid(classifyLogically(puzzle.givens, checkpoint) === puzzle.level)
  const entries = board(game.entries)
  requireValid(puzzle.givens.every((digit, cell) => digit === 0 || entries[cell] === digit))
  requireValid(Array.isArray(game.history))
  const replay = [...puzzle.givens]
  let mistakes = 0
  const history: CellChange[] = game.history.map(value => {
    checkpoint()
    const move = object(value, ['cell', 'before', 'after'])
    const change = { cell: index(move.cell), before: digit(move.before), after: digit(move.after) }
    requireValid(puzzle.givens[change.cell] === 0 && change.before === replay[change.cell] && change.before !== change.after)
    // A completed attempt cannot have further moves, including an erase.
    requireValid(!replay.every((value, cell) => value === puzzle.solution[cell]))
    replay[change.cell] = change.after
    if (change.after !== 0 && change.after !== puzzle.solution[change.cell]) mistakes++
    return change
  })
  requireValid(replay.every((digit, cell) => digit === entries[cell]))
  const errors = number(game.errors, true)
  requireValid(errors >= mistakes)
  requireValid(game.status === 'paused' || game.status === 'inactive' || game.status === 'completed')
  requireValid((game.status === 'completed') === entries.every((digit, cell) => digit === puzzle.solution[cell]))
  return { ...base, entries, history, errors, status: game.status,
    selectedCell: game.selectedCell === null ? null : index(game.selectedCell), elapsedMs: number(game.elapsedMs) }
}

/** Strict incoming boundary; certificate/search work is bounded and never used to grade by guessing. */
export function parseSavedData(text: string, now: () => number = () => performance.now()): SavedData {
  requireValid(text.length <= MAX_BACKUP_BYTES && new TextEncoder().encode(text).byteLength <= MAX_BACKUP_BYTES)
  const started = now()
  const checkpoint = () => { requireValid(now() - started < 1000) }
  const data = object(JSON.parse(text), ['version', 'activeGame', 'settings', 'usedPuzzleIds', 'completedGames'])
  requireValid(data.version === SAVE_VERSION)
  const settings = object(data.settings, ['detectErrors'])
  requireValid(typeof settings.detectErrors === 'boolean')
  requireValid(Array.isArray(data.usedPuzzleIds) && Array.isArray(data.completedGames))
  const usedPuzzleIds = data.usedPuzzleIds.map(value => { checkpoint(); return puzzleId(value) })
  const used = new Set(usedPuzzleIds)
  requireValid(used.size === usedPuzzleIds.length)
  const attempts = new Set<string>()
  const completedGames = data.completedGames.map(value => {
    checkpoint()
    const record = object(value, ['attemptId', 'puzzleId', 'level', 'completedAt', 'elapsedMs', 'errors'])
    const attemptId = id(record.attemptId)
    requireValid(!attempts.has(attemptId))
    attempts.add(attemptId)
    requireValid(typeof record.completedAt === 'string'
      && Number.isFinite(Date.parse(record.completedAt)) && new Date(record.completedAt).toISOString() === record.completedAt)
    const result: CompletedGame = { attemptId, puzzleId: puzzleId(record.puzzleId), level: level(record.level),
      completedAt: record.completedAt, elapsedMs: number(record.elapsedMs), errors: number(record.errors, true) }
    requireValid(used.has(result.puzzleId))
    return result
  })
  const activeGame = data.activeGame === null ? null : parseGame(data.activeGame, checkpoint)
  requireValid(!activeGame || (used.has(activeGame.puzzle.id) && !attempts.has(activeGame.attemptId)))
  checkpoint()
  return { version: SAVE_VERSION, activeGame, settings: { detectErrors: settings.detectErrors }, usedPuzzleIds, completedGames }
}

/** Internal typed snapshots are produced by game transitions; external text always uses parseSavedData. */
export function serializeSavedData(data: SavedData): string {
  const text = JSON.stringify(data)
  requireValid(new TextEncoder().encode(text).byteLength <= MAX_BACKUP_BYTES)
  return text
}
