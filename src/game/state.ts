import { assertValidBoard, isCompleteBoard, type Board } from '../engine/board'
import type { Puzzle } from '../engine/generator'
import { LOGICAL_LEVELS } from '../engine/solver'
import { isDigitDisabled } from './selectors'
import { DEFAULT_GAME_SETTINGS, type GameSettings } from './settings'

export { DEFAULT_GAME_SETTINGS, type GameSettings } from './settings'

export interface CellChange {
  readonly cell: number
  readonly before: number
  readonly after: number
}

export interface GameState {
  readonly attemptId: string
  readonly puzzle: Puzzle
  /** Full visible board, including the immutable givens. */
  readonly entries: Board
  readonly selectedCell: number | null
  readonly history: readonly CellChange[]
  /** Counts incorrect insertions/replacements even when live detection is off. */
  readonly errors: number
  readonly status: 'inactive' | 'playing' | 'paused' | 'completed'
  readonly elapsedMs: number
  /** Runtime-only monotonic timestamp; must never be restored as a running clock. */
  readonly activeSinceMs: number | null
}

export type GameAction =
  | { readonly type: 'select'; readonly cell: number | null }
  | { readonly type: 'insert'; readonly digit: number; readonly now: number }
  | { readonly type: 'erase' | 'undo' }
  | { readonly type: 'resume' | 'pause' | 'hide' | 'leave' | 'checkpoint'; readonly now: number }
  /** Dispatch only after confirmation; the caller supplies a fresh attempt ID. */
  | { readonly type: 'restart'; readonly attemptId: string; readonly now: number }

function assertAttemptId(id: string): void {
  if (!id.trim()) throw new RangeError('Expected a nonempty attempt ID')
}

function assertTimestamp(now: number): void {
  if (!Number.isFinite(now) || now < 0) throw new RangeError('Expected a nonnegative finite monotonic timestamp')
}

/** Copies the certified engine puzzle; uniqueness/classification are not recomputed here. */
export function createGame(puzzle: Puzzle, attemptId: string): GameState {
  assertAttemptId(attemptId)
  assertValidBoard(puzzle.givens)
  if (!isCompleteBoard(puzzle.solution)
    || !puzzle.givens.some(digit => digit === 0)
    || puzzle.givens.some((digit, cell) => digit !== 0 && digit !== puzzle.solution[cell])
    || puzzle.id !== puzzle.givens.join('') || !LOGICAL_LEVELS.includes(puzzle.level)) {
    throw new RangeError('Expected a playable puzzle with matching givens, solution, ID and level')
  }
  return {
    attemptId,
    puzzle: { ...puzzle, givens: [...puzzle.givens], solution: [...puzzle.solution] },
    entries: [...puzzle.givens], selectedCell: null, history: [], errors: 0,
    status: 'inactive', elapsedMs: 0, activeSinceMs: null,
  }
}

/** now comes from a monotonic clock, such as performance.now(), supplied by the caller. */
export function elapsedTimeMs(state: GameState, now: number): number {
  assertTimestamp(now)
  if (state.activeSinceMs === null) return state.elapsedMs
  if (now < state.activeSinceMs) throw new RangeError('Monotonic time cannot move backwards')
  return state.elapsedMs + now - state.activeSinceMs
}

function changeCell(state: GameState, digit: number): GameState {
  const cell = state.selectedCell
  if (cell === null || state.puzzle.givens[cell] !== 0 || state.entries[cell] === digit) return state
  const entries = [...state.entries]
  const before = entries[cell]!
  entries[cell] = digit
  return {
    ...state, entries,
    history: [...state.history, { cell, before, after: digit }],
    errors: state.errors + (digit !== 0 && digit !== state.puzzle.solution[cell] ? 1 : 0),
  }
}

/** Pure transitions only. UI/lifecycle code dispatches hide/leave before saving;
 * visible/foreground events never implicitly resume play. Completed attempts are frozen.
 */
export function reduceGame(
  state: GameState, action: GameAction, settings: GameSettings = DEFAULT_GAME_SETTINGS,
): GameState {
  if (state.status === 'completed') return state
  switch (action.type) {
    case 'resume':
      if (state.status === 'playing') return state
      assertTimestamp(action.now)
      return { ...state, status: 'playing', activeSinceMs: action.now }
    case 'pause':
    case 'hide':
      if (state.status !== 'playing') return state
      return { ...state, status: 'paused', elapsedMs: elapsedTimeMs(state, action.now), activeSinceMs: null }
    case 'leave':
      if (state.status === 'inactive') return state
      return { ...state, status: 'inactive', elapsedMs: elapsedTimeMs(state, action.now), activeSinceMs: null }
    case 'checkpoint':
      if (state.status !== 'playing') return state
      return { ...state, elapsedMs: elapsedTimeMs(state, action.now), activeSinceMs: action.now }
    case 'restart': {
      assertAttemptId(action.attemptId)
      if (action.attemptId === state.attemptId) throw new RangeError('Restart requires a fresh attempt ID')
      assertTimestamp(action.now)
      const fresh = createGame(state.puzzle, action.attemptId)
      return { ...fresh, status: state.status, activeSinceMs: state.status === 'playing' ? action.now : null }
    }
    case 'select':
      if (state.status !== 'playing') return state
      if (action.cell !== null && (!Number.isInteger(action.cell) || action.cell < 0 || action.cell > 80)) {
        throw new RangeError('Expected a cell index from 0 to 80 or null')
      }
      return action.cell === state.selectedCell ? state : { ...state, selectedCell: action.cell }
    case 'insert': {
      if (state.status !== 'playing') return state
      if (!Number.isInteger(action.digit) || action.digit < 1 || action.digit > 9) {
        throw new RangeError('Expected a digit from 1 to 9')
      }
      const elapsedMs = elapsedTimeMs(state, action.now)
      if (isDigitDisabled(state, action.digit, settings)) return state
      const next = changeCell(state, action.digit)
      if (next === state || !next.entries.every((digit, cell) => digit === next.puzzle.solution[cell])) return next
      return { ...next, status: 'completed', elapsedMs, activeSinceMs: null }
    }
    case 'erase':
      return state.status === 'playing' ? changeCell(state, 0) : state
    case 'undo': {
      if (state.status !== 'playing' || state.history.length === 0) return state
      const last = state.history.at(-1)!
      const entries = [...state.entries]
      entries[last.cell] = last.before
      return { ...state, entries, history: state.history.slice(0, -1) }
    }
  }
}

export function formatElapsedTime(milliseconds: number): string {
  assertTimestamp(milliseconds)
  const seconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds / 60) % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds % 60)}`
    : `${pad(minutes)}:${pad(seconds % 60)}`
}
