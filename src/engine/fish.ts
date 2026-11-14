import { COLUMNS, ROWS } from './board'
import { DIGITS, type CandidateState, type LogicalStep } from './candidates'
import { combinations, eliminationStep } from './technique-utils'

/** Basic fish only: disjoint row/column bases, without fins or sashimi variants. */
function findFish(state: CandidateState, size: 2 | 3): LogicalStep | undefined {
  for (const bases of [ROWS, COLUMNS]) {
    for (const digit of DIGITS) {
      const lines = bases.map(unit => unit.filter(cell => state.candidates[cell]! & (1 << digit)))
        .filter(cells => cells.length >= 2 && cells.length <= size)
      const coverOf = (cell: number) => bases === ROWS ? cell % 9 : Math.floor(cell / 9)
      for (const selected of combinations(lines, size)) {
        const cells = selected.flat()
        const covers = new Set(cells.map(coverOf))
        if (covers.size !== size) continue
        const targets = Array.from({ length: 81 }, (_, cell) => cell)
          .filter(cell => covers.has(coverOf(cell)) && !cells.includes(cell))
        const step = eliminationStep(state, size === 2 ? 'x-wing' : 'swordfish', targets, 1 << digit)
        if (step) return step
      }
    }
  }
}

export const findXWing = (state: CandidateState): LogicalStep | undefined => findFish(state, 2)
export const findSwordfish = (state: CandidateState): LogicalStep | undefined => findFish(state, 3)
