import { UNITS } from './board'
import { DIGITS, type CandidateState, type LogicalStep } from './candidates'
import { eliminationStep } from './technique-utils'

export function findNakedSingle(state: CandidateState): LogicalStep | undefined {
  for (let cell = 0; cell < 81; cell++) {
    const mask = state.candidates[cell]!
    if (mask && (mask & (mask - 1)) === 0) {
      return { technique: 'naked-single', placement: { cell, digit: Math.log2(mask) }, eliminations: [] }
    }
  }
}

export function findHiddenSingle(state: CandidateState): LogicalStep | undefined {
  for (const unit of UNITS) {
    for (const digit of DIGITS) {
      const cells = unit.filter(cell => state.candidates[cell]! & (1 << digit))
      if (cells.length === 1) {
        return { technique: 'hidden-single', placement: { cell: cells[0]!, digit }, eliminations: [] }
      }
    }
  }
}

/** Includes pointing (box to line) and claiming (line to box). */
export function findLockedCandidates(state: CandidateState): LogicalStep | undefined {
  for (const source of UNITS) {
    for (const target of UNITS) {
      if (source.filter(cell => target.includes(cell)).length !== 3) continue
      for (const digit of DIGITS) {
        const cells = source.filter(cell => state.candidates[cell]! & (1 << digit))
        if (cells.length < 2 || !cells.every(cell => target.includes(cell))) continue
        const step = eliminationStep(state, 'locked-candidates',
          target.filter(cell => !source.includes(cell)), 1 << digit)
        if (step) return step
      }
    }
  }
}

export function findNakedPair(state: CandidateState): LogicalStep | undefined {
  for (const unit of UNITS) {
    for (const first of unit) {
      const mask = state.candidates[first]!
      if (DIGITS.filter(digit => mask & (1 << digit)).length !== 2) continue
      const pair = unit.filter(cell => state.candidates[cell] === mask)
      if (pair.length !== 2) continue
      const step = eliminationStep(state, 'naked-pair',
        unit.filter(cell => !pair.includes(cell)), mask)
      if (step) return step
    }
  }
}

export function findHiddenPair(state: CandidateState): LogicalStep | undefined {
  for (const unit of UNITS) {
    for (const first of DIGITS) {
      const cells = unit.filter(cell => state.candidates[cell]! & (1 << first))
      if (cells.length !== 2) continue
      for (const second of DIGITS) {
        if (second <= first) continue
        const other = unit.filter(cell => state.candidates[cell]! & (1 << second))
        if (other.length !== 2 || !other.every(cell => cells.includes(cell))) continue
        const step = eliminationStep(state, 'hidden-pair', cells, ~((1 << first) | (1 << second)))
        if (step) return step
      }
    }
  }
}
