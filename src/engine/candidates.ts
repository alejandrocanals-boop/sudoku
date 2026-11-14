import { assertValidBoard, isValidBoard, UNITS, type Board } from './board'

export const ALL_CANDIDATES = 0b1111111110
export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

export const PEERS: readonly (readonly number[])[] = Array.from({ length: 81 }, (_, cell) =>
  [...new Set(UNITS.filter(unit => unit.includes(cell)).flat())].filter(peer => peer !== cell),
)

export interface CandidateState {
  readonly board: Board
  /** Digit d is represented by bit 1 << d; filled cells have mask 0. */
  readonly candidates: readonly number[]
}

export type Technique = 'naked-single' | 'hidden-single' | 'locked-candidates'
  | 'naked-pair' | 'hidden-pair' | 'naked-triple' | 'hidden-triple'
  | 'x-wing' | 'swordfish' | 'xy-wing' | 'xyz-wing' | 'simple-coloring'

export interface LogicalStep {
  readonly technique: Technique
  readonly placement?: { readonly cell: number; readonly digit: number }
  readonly eliminations: readonly { readonly cell: number; readonly digit: number }[]
}

export function createCandidateState(board: Board): CandidateState {
  assertValidBoard(board)
  return {
    board: [...board],
    candidates: board.map((digit, cell) => digit ? 0 : PEERS[cell]!.reduce(
      (mask, peer) => mask & ~(1 << board[peer]!), ALL_CANDIDATES,
    )),
  }
}

export function hasContradiction(state: CandidateState): boolean {
  if (!isValidBoard(state.board)) return true
  if (state.board.some((digit, cell) => digit === 0 && state.candidates[cell] === 0)) return true
  return UNITS.some(unit => DIGITS.some(digit =>
    !unit.some(cell => state.board[cell] === digit
      || (state.candidates[cell]! & (1 << digit)) !== 0),
  ))
}

/** Applies a step produced by the technique finders without rebuilding candidates.
 * Both inputs are preserved. Propagation only removes candidates.
 */
export function applyLogicalStep(state: CandidateState, step: LogicalStep): CandidateState {
  const board = [...state.board]
  const candidates = [...state.candidates]
  if (step.placement) {
    const { cell, digit } = step.placement
    board[cell] = digit
    candidates[cell] = 0
    for (const peer of PEERS[cell]!) candidates[peer]! &= ~(1 << digit)
  }
  for (const { cell, digit } of step.eliminations) candidates[cell]! &= ~(1 << digit)
  return { board, candidates }
}
