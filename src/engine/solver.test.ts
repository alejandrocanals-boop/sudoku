import { describe, expect, it } from 'vitest'
import { BOXES, COLUMNS, isCompleteBoard, ROWS } from './board'
import {
  ALL_CANDIDATES, applyLogicalStep, createCandidateState, hasContradiction,
  type CandidateState,
} from './candidates'
import {
  findHiddenPair, findHiddenSingle, findLockedCandidates, findNakedPair, findNakedSingle,
} from './techniques'
import { classifyLogically, findLogicalStep, solveLogically } from './solver'
import { countSolutions } from './search'

const mask = (...digits: number[]) => digits.reduce((value, digit) => value | (1 << digit), 0)
const parse = (text: string) => [...text].map(Number)
const easy = parse('530070000600195000098000060800060003400803001700020006060000280000419005000080079')
const solution = parse('534678912672195348198342567859761423426853791713924856961537284287419635345286179')
// Fixed unique regression puzzle: singles stall; locked candidates and a naked pair unlock it.
const medium = parse('000008000600000340098302000800700000006003001000920050000000000000419030040000109')

function fixture(): { board: number[]; candidates: number[] } {
  return { board: Array<number>(81).fill(0), candidates: Array<number>(81).fill(ALL_CANDIDATES) }
}

function transpose(state: CandidateState): CandidateState {
  const indices = Array.from({ length: 81 }, (_, index) => (index % 9) * 9 + Math.floor(index / 9))
  return { board: indices.map(index => state.board[index]!), candidates: indices.map(index => state.candidates[index]!) }
}

describe('persistent candidates', () => {
  it('initializes from givens without mutating or retaining the input', () => {
    const input = Object.freeze([...easy])
    const state = createCandidateState(input)
    expect(state.board).not.toBe(input)
    expect(state.candidates[0]).toBe(0)
    expect(state.candidates[2]).toBe(mask(1, 2, 4))
    expect(input).toEqual(easy)
    expect(() => createCandidateState([0])).toThrow(RangeError)
  })

  it('preserves eliminations across placements and propagates only to peers', () => {
    const state = createCandidateState(Array<number>(81).fill(0))
    const eliminated = applyLogicalStep(state, {
      technique: 'locked-candidates', eliminations: [{ cell: 80, digit: 9 }],
    })
    const next = applyLogicalStep(eliminated, {
      technique: 'naked-single', placement: { cell: 0, digit: 1 }, eliminations: [],
    })
    expect(next.board[0]).toBe(1)
    expect(next.candidates[0]).toBe(0)
    for (const peer of [1, 9, 10]) expect(next.candidates[peer]! & mask(1)).toBe(0)
    expect(next.candidates[40]).toBe(ALL_CANDIDATES)
    expect(next.candidates[80]).toBe(ALL_CANDIDATES & ~mask(9))
    expect(state.candidates[80]).toBe(ALL_CANDIDATES)
    expect(eliminated.board[0]).toBe(0)
    expect(state.board.every(digit => digit === 0)).toBe(true)
  })

  it('detects an empty cell without candidates', () => {
    const state = fixture()
    state.candidates[40] = 0
    expect(hasContradiction(state)).toBe(true)
  })

  it('detects a unit with no place for a missing digit even without empty masks', () => {
    const state = fixture()
    for (const cell of ROWS[0]!) state.candidates[cell]! &= ~mask(9)
    expect(state.candidates.every(value => value !== 0)).toBe(true)
    expect(hasContradiction(state)).toBe(true)
  })
})

describe('singles', () => {
  it('finds a naked single and gives it priority over other techniques', () => {
    const state = fixture()
    state.candidates[40] = mask(7)
    expect(findNakedSingle(state)?.placement).toEqual({ cell: 40, digit: 7 })
    expect(findLogicalStep(state, 'medium')?.technique).toBe('naked-single')
    expect(findNakedSingle(fixture())).toBeUndefined()
  })

  it.each([['row', ROWS[0]!], ['column', COLUMNS[0]!], ['box', BOXES[0]!]] as const)(
    'finds a hidden single in a %s', (_, unit) => {
      const state = fixture()
      for (const cell of unit.slice(1)) state.candidates[cell]! &= ~mask(9)
      expect(findHiddenSingle(state)?.placement).toEqual({ cell: unit[0], digit: 9 })
      expect(findLogicalStep(state, 'easy')?.technique).toBe('hidden-single')
    },
  )
})

describe('locked candidates', () => {
  it.each(['row', 'column'] as const)('finds pointing from a box into a %s', orientation => {
    const state = fixture()
    for (const cell of [9, 10, 11, 18, 19, 20]) state.candidates[cell]! &= ~mask(5)
    const step = findLockedCandidates(orientation === 'row' ? state : transpose(state))
    const cells = orientation === 'row' ? [3, 4, 5, 6, 7, 8] : [27, 36, 45, 54, 63, 72]
    expect(step?.eliminations).toEqual(cells.map(cell => ({ cell, digit: 5 })))
  })

  it.each(['row', 'column'] as const)('finds claiming from a %s into a box', orientation => {
    const state = fixture()
    for (const cell of [3, 4, 5, 6, 7, 8]) state.candidates[cell]! &= ~mask(5)
    const step = findLockedCandidates(orientation === 'row' ? state : transpose(state))
    const cells = orientation === 'row' ? [9, 10, 11, 18, 19, 20] : [1, 2, 10, 11, 19, 20]
    expect(step?.eliminations).toEqual(cells.map(cell => ({ cell, digit: 5 })))
    expect(findLogicalStep(state, 'easy')).toBeUndefined()
  })

  it('does not eliminate when the candidates span lines and boxes', () => {
    expect(findLockedCandidates(fixture())).toBeUndefined()
  })
})

describe('pairs', () => {
  it.each([
    ['row', ROWS[0]!, [0, 4]], ['column', COLUMNS[0]!, [0, 36]],
    ['box', BOXES[0]!, [0, 10]],
  ] as const)('finds a naked pair in a %s', (_, unit, pair) => {
    const state = fixture()
    for (const cell of pair) state.candidates[cell] = mask(2, 7)
    const step = findNakedPair(state)
    expect(step?.eliminations).toEqual(unit.filter(cell => !pair.some(member => member === cell))
      .flatMap(cell => [2, 7].map(digit => ({ cell, digit }))))
    expect(applyLogicalStep(state, step!).candidates[pair[0]]).toBe(mask(2, 7))
    expect(findLogicalStep(state, 'easy')).toBeUndefined()
  })

  it.each([
    ['row', ROWS[0]!, [0, 4]], ['column', COLUMNS[0]!, [0, 36]],
    ['box', BOXES[0]!, [0, 10]],
  ] as const)('finds a hidden pair in a %s', (_, unit, pair) => {
    const state = fixture()
    for (const cell of unit) state.candidates[cell]! &= ~mask(2, 7)
    state.candidates[pair[0]] = mask(2, 3, 7)
    state.candidates[pair[1]] = mask(2, 7, 8)
    const step = findHiddenPair(state)
    expect(step?.eliminations).toEqual([
      { cell: pair[0], digit: 3 }, { cell: pair[1], digit: 8 },
    ])
    const next = applyLogicalStep(state, step!)
    for (const cell of pair) expect(next.candidates[cell]).toBe(mask(2, 7))
  })

  it('rejects three identical two-candidate cells as a naked pair', () => {
    const state = fixture()
    for (const cell of [0, 4, 8]) state.candidates[cell] = mask(2, 7)
    expect(findNakedPair(state)).toBeUndefined()
  })

  it('rejects hidden digits whose combined locations occupy three cells', () => {
    const state = fixture()
    for (const cell of ROWS[0]!) state.candidates[cell]! &= ~mask(2, 7)
    for (const cell of [0, 4]) state.candidates[cell]! |= mask(2)
    for (const cell of [4, 8]) state.candidates[cell]! |= mask(7)
    expect(findHiddenPair(state)).toBeUndefined()
  })

  it('does not report eliminations when a pair has nothing to remove', () => {
    const state = fixture()
    for (const cell of ROWS[0]!) state.candidates[cell]! &= ~mask(2, 7)
    state.candidates[0] = state.candidates[4] = mask(2, 7)
    expect(findNakedPair(state)).toBeUndefined()
    expect(findHiddenPair(state)).toBeUndefined()
  })
})

describe('logical solving and classification', () => {
  it('solves and classifies singles as easy, preserving givens and determinism', () => {
    const input = Object.freeze([...easy])
    const result = solveLogically(input, 'easy')
    expect(result.status).toBe('solved')
    expect(result.state.board).toEqual(solution)
    expect(result.steps.every(step => step.technique.endsWith('single'))).toBe(true)
    expect(solveLogically(input, 'easy')).toEqual(result)
    expect(classifyLogically(input)).toBe('easy')
    expect(input).toEqual(easy)
  })

  it('classifies medium only when easy stalls, starting from the original givens', () => {
    const input = Object.freeze([...medium])
    expect(countSolutions(input)).toBe(1)
    expect(solveLogically(input, 'easy').status).toBe('stalled')
    const result = solveLogically(input, 'medium')
    expect(result.status).toBe('solved')
    expect(result.state.board).toEqual(solution)
    expect(result.steps.some(step => step.technique === 'locked-candidates')).toBe(true)
    expect(result.steps.some(step => step.technique === 'naked-pair')).toBe(true)
    expect(classifyLogically(input)).toBe('medium')
    expect(solveLogically(input, 'medium')).toEqual(result)
    expect(input).toEqual(medium)
  })

  it.each([['easy', easy], ['medium', medium]] as const)(
    'preserves the unique solution through every %s deduction', (level, puzzle) => {
      const result = solveLogically(puzzle, level)
      let state = createCandidateState(puzzle)
      for (const step of result.steps) {
        // Independently verified unique solution is an oracle for every deduction.
        if (step.placement) {
          expect(step.placement.digit).toBe(solution[step.placement.cell])
        }
        for (const { cell, digit } of step.eliminations) {
          expect(digit).not.toBe(solution[cell])
          expect(state.candidates[cell]! & mask(digit)).not.toBe(0)
        }
        expect(findLogicalStep(state, level)).toEqual(step)
        state = applyLogicalStep(state, step)
        expect(hasContradiction(state)).toBe(false)
        for (let cell = 0; cell < 81; cell++) {
          if (state.board[cell] === 0) {
            expect(state.candidates[cell]! & mask(solution[cell]!)).not.toBe(0)
          } else {
            expect(state.board[cell]).toBe(solution[cell])
          }
        }
      }
      expect(state).toEqual(result.state)
    },
  )

  it('does not guess or classify an empty board', () => {
    const input = Array<number>(81).fill(0)
    expect(solveLogically(input, 'medium').status).toBe('stalled')
    expect(solveLogically(input, 'medium').steps).toEqual([])
    expect(classifyLogically(input)).toBeNull()
  })

  it('handles complete, contradictory and invalid boards', () => {
    expect(solveLogically(solution, 'easy').steps).toEqual([])
    expect(isCompleteBoard(solveLogically(solution, 'easy').state.board)).toBe(true)
    const impossible = [...easy]
    impossible[2] = 1
    expect(solveLogically(impossible, 'medium').status).toBe('contradiction')
    expect(classifyLogically(impossible)).toBeNull()
    expect(() => classifyLogically([1])).toThrow(RangeError)
  })
})
