import { UNITS } from './board'
import { DIGITS, type CandidateState, type LogicalStep } from './candidates'
import { combinations, digitCount, eliminationStep } from './technique-utils'

export function findNakedTriple(state: CandidateState): LogicalStep | undefined {
  for (const unit of UNITS) {
    const cells = unit.filter(cell => state.candidates[cell]! > 0
      && digitCount(state.candidates[cell]!) <= 3)
    for (const triple of combinations(cells, 3)) {
      const mask = triple.reduce((value, cell) => value | state.candidates[cell]!, 0)
      if (digitCount(mask) !== 3) continue
      const step = eliminationStep(state, 'naked-triple',
        unit.filter(cell => !triple.includes(cell)), mask)
      if (step) return step
    }
  }
}

export function findHiddenTriple(state: CandidateState): LogicalStep | undefined {
  for (const unit of UNITS) {
    const digits = DIGITS.filter(digit => {
      const count = unit.filter(cell => state.candidates[cell]! & (1 << digit)).length
      return count > 0 && count <= 3
    })
    for (const triple of combinations(digits, 3)) {
      const mask = triple.reduce((value, digit) => value | (1 << digit), 0)
      const cells = unit.filter(cell => state.candidates[cell]! & mask)
      if (cells.length !== 3) continue
      const step = eliminationStep(state, 'hidden-triple', cells, ~mask)
      if (step) return step
    }
  }
}
