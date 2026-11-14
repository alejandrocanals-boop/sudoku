import { type Board } from './board'
import {
  applyLogicalStep, createCandidateState, hasContradiction,
  type CandidateState, type LogicalStep,
} from './candidates'
import {
  findHiddenPair, findHiddenSingle, findLockedCandidates, findNakedPair, findNakedSingle,
} from './techniques'
import { findHiddenTriple, findNakedTriple } from './subsets'
import { findSwordfish, findXWing } from './fish'
import { findXYWing, findXYZWing } from './wings'
import { findSimpleColoring } from './coloring'

export const LOGICAL_LEVELS = ['easy', 'medium', 'hard', 'expert'] as const
export type LogicalLevel = typeof LOGICAL_LEVELS[number]
export interface LogicalResult {
  readonly status: 'solved' | 'stalled' | 'contradiction'
  readonly state: CandidateState
  readonly steps: readonly LogicalStep[]
}

/** Stable priority: restart from singles after every placement or elimination. */
export function findLogicalStep(state: CandidateState, level: LogicalLevel): LogicalStep | undefined {
  const single = findNakedSingle(state) ?? findHiddenSingle(state)
  if (single || level === 'easy') return single
  const medium = findLockedCandidates(state) ?? findNakedPair(state) ?? findHiddenPair(state)
  if (medium || level === 'medium') return medium
  const hard = findNakedTriple(state) ?? findHiddenTriple(state) ?? findXWing(state)
  if (hard || level === 'hard') return hard
  return findSwordfish(state) ?? findXYWing(state) ?? findXYZWing(state) ?? findSimpleColoring(state)
}

/** Uses deductions only; stalled does not imply unsatisfiable or unique. */
export function solveLogically(board: Board, level: LogicalLevel, checkpoint?: () => void): LogicalResult {
  let state = createCandidateState(board)
  const steps: LogicalStep[] = []
  // Each step fills a cell or removes at least one candidate, so progress is finite.
  while (true) {
    checkpoint?.()
    if (hasContradiction(state)) return { status: 'contradiction', state, steps }
    if (state.board.every(digit => digit !== 0)) return { status: 'solved', state, steps }
    const step = findLogicalStep(state, level)
    if (!step) return { status: 'stalled', state, steps }
    steps.push(step)
    state = applyLogicalStep(state, step)
  }
}

/** Tries cumulative tiers independently from the original givens.
 * null means unresolved by the implemented tiers; uniqueness is checked separately.
 */
export function classifyLogically(board: Board, checkpoint?: () => void): LogicalLevel | null {
  for (const level of LOGICAL_LEVELS) {
    if (solveLogically(board, level, checkpoint).status === 'solved') return level
  }
  return null
}
