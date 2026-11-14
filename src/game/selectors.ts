import { UNITS } from '../engine/board'
import { DIGITS, PEERS } from '../engine/candidates'
import type { GameState } from './state'
import { DEFAULT_GAME_SETTINGS, type GameSettings } from './settings'

export function isDigitDisabled(state: GameState, digit: number, settings: GameSettings = DEFAULT_GAME_SETTINGS): boolean {
  if (settings.detectErrors) {
    return state.entries.filter((value, cell) => value === digit && state.puzzle.solution[cell] === digit).length === 9
  }
  // Deliberately uses visible entries only: never consult the solution when detection is off.
  return state.entries.filter(value => value === digit).length === 9
    && UNITS.every(unit => unit.filter(cell => state.entries[cell] === digit).length === 1)
}

export function disabledDigits(state: GameState, settings: GameSettings = DEFAULT_GAME_SETTINGS): readonly number[] {
  return DIGITS.filter(digit => isDigitDisabled(state, digit, settings))
}

export function isCellError(state: GameState, cell: number, settings: GameSettings = DEFAULT_GAME_SETTINGS): boolean {
  return settings.detectErrors && state.entries[cell] !== 0 && state.entries[cell] !== state.puzzle.solution[cell]
}

export function visibleErrorCount(state: GameState, settings: GameSettings = DEFAULT_GAME_SETTINGS): number | null {
  return settings.detectErrors ? state.errors : null
}

export function cellHighlights(state: GameState): {
  selected: number | null; peers: readonly number[]; matching: readonly number[]
} {
  const selected = state.selectedCell
  if (selected === null) return { selected, peers: [], matching: [] }
  const digit = state.entries[selected]!
  return {
    selected, peers: PEERS[selected]!,
    matching: digit === 0 ? [] : state.entries.flatMap((value, cell) => value === digit ? [cell] : []),
  }
}

export const isBoardVisible = (state: GameState): boolean => state.status === 'playing'

/** Stable attempt identity for later exactly-once recording; reading this has no side effects. */
export function completionSummary(state: GameState) {
  if (state.status !== 'completed') return null
  return {
    attemptId: state.attemptId, puzzleId: state.puzzle.id, level: state.puzzle.level,
    elapsedMs: state.elapsedMs, errors: state.errors,
  }
}
