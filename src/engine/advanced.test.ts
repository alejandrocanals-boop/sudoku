import { describe, expect, it } from 'vitest'
import { BOXES, COLUMNS, ROWS } from './board'
import { ALL_CANDIDATES, applyLogicalStep, type CandidateState, type LogicalStep } from './candidates'
import { findNakedTriple, findHiddenTriple } from './subsets'
import { findXWing, findSwordfish } from './fish'
import { findXYWing, findXYZWing } from './wings'
import { findSimpleColoring } from './coloring'

const mask = (...digits: number[]) => digits.reduce((value, digit) => value | (1 << digit), 0)
function fixture() {
  return { board: Array<number>(81).fill(0), candidates: Array<number>(81).fill(ALL_CANDIDATES) }
}
function transpose(state: CandidateState): CandidateState {
  const indices = Array.from({ length: 81 }, (_, cell) => (cell % 9) * 9 + Math.floor(cell / 9))
  return { board: indices.map(cell => state.board[cell]!), candidates: indices.map(cell => state.candidates[cell]!) }
}
function cellsOf(step: LogicalStep | undefined) {
  return step?.eliminations.map(({ cell }) => cell).sort((a, b) => a - b)
}

describe('triples', () => {
  it.each([
    ['row', ROWS[0]!, [0, 4, 8]], ['column', COLUMNS[0]!, [0, 36, 72]],
    ['box', BOXES[0]!, [0, 10, 20]],
  ] as const)('finds a naked triple of three different bivalue cells in a %s', (_, unit, triple) => {
    const state = fixture()
    state.candidates[triple[0]] = mask(1, 2)
    state.candidates[triple[1]] = mask(2, 3)
    state.candidates[triple[2]] = mask(1, 3)
    const step = findNakedTriple(state)
    expect(step?.technique).toBe('naked-triple')
    expect(step?.eliminations).toEqual(unit.filter(cell => !triple.some(member => member === cell))
      .flatMap(cell => [1, 2, 3].map(digit => ({ cell, digit }))))
  })

  it.each([
    ['row', ROWS[0]!, [0, 4, 8]], ['column', COLUMNS[0]!, [0, 36, 72]],
    ['box', BOXES[0]!, [0, 10, 20]],
  ] as const)('finds a hidden triple with overlapping digit locations in a %s', (_, unit, triple) => {
    const state = fixture()
    for (const cell of unit) state.candidates[cell]! &= ~mask(1, 2, 3)
    state.candidates[triple[0]] = mask(1, 2, 4)
    state.candidates[triple[1]] = mask(2, 3, 5)
    state.candidates[triple[2]] = mask(1, 3, 6)
    const step = findHiddenTriple(state)
    expect(step?.technique).toBe('hidden-triple')
    expect(step?.eliminations).toEqual(triple.map((cell, index) => ({ cell, digit: index + 4 })))
    const next = applyLogicalStep(state, step!)
    expect(triple.map(cell => next.candidates[cell])).toEqual([mask(1, 2), mask(2, 3), mask(1, 3)])
  })

  it('rejects three cells with four combined digits', () => {
    const state = fixture()
    state.candidates[0] = mask(1, 2)
    state.candidates[4] = mask(2, 3)
    state.candidates[8] = mask(1, 4)
    expect(findNakedTriple(state)).toBeUndefined()
  })

  it('rejects three hidden digits spread across four cells', () => {
    const state = fixture()
    for (const cell of ROWS[0]!) state.candidates[cell]! &= ~mask(1, 2, 3)
    state.candidates[0]! |= mask(1, 2)
    state.candidates[3]! |= mask(2, 3)
    state.candidates[6]! |= mask(1)
    state.candidates[8]! |= mask(3)
    expect(findHiddenTriple(state)).toBeUndefined()
  })

  it('reports no step when the hidden triple is already restricted', () => {
    const state = fixture()
    for (const cell of ROWS[0]!) state.candidates[cell]! &= ~mask(1, 2, 3)
    for (const cell of [0, 4, 8]) state.candidates[cell] = mask(1, 2, 3)
    expect(findHiddenTriple(state)).toBeUndefined()
    expect(findNakedTriple(state)).toBeUndefined()
  })
})

function fishFixture(size: 2 | 3) {
  const state = fixture()
  const bases = size === 2 ? [0, 4] : [0, 3, 6]
  const covers = size === 2 ? [[1, 4], [1, 4]] : [[1, 4], [4, 7], [1, 7]]
  bases.forEach((row, index) => {
    for (const cell of ROWS[row]!) {
      if (!covers[index]!.includes(cell % 9)) state.candidates[cell]! &= ~mask(5)
    }
  })
  return { state, bases, covers: [...new Set(covers.flat())] }
}

describe.each([
  ['x-wing', 2, findXWing], ['swordfish', 3, findSwordfish],
] as const)('%s', (technique, size, find) => {
  it.each(['rows', 'columns'])('eliminates only from cover lines outside the %s bases', orientation => {
    const { state, bases, covers } = fishFixture(size)
    const targets = Array.from({ length: 81 }, (_, cell) => cell)
      .filter(cell => !bases.includes(Math.floor(cell / 9)) && covers.includes(cell % 9))
    const step = find(orientation === 'rows' ? state : transpose(state))
    expect(step?.technique).toBe(technique)
    expect(step?.eliminations.every(({ digit }) => digit === 5)).toBe(true)
    expect(cellsOf(step)).toEqual((orientation === 'rows' ? targets
      : targets.map(cell => (cell % 9) * 9 + Math.floor(cell / 9))).sort((a, b) => a - b))
  })

  it('rejects an extra candidate outside the cover lines', () => {
    const { state } = fishFixture(size)
    state.candidates[8]! |= mask(5)
    expect(find(state)).toBeUndefined()
  })

  it('does not emit a step when there are no cover candidates to eliminate', () => {
    const { state, bases, covers } = fishFixture(size)
    for (let cell = 0; cell < 81; cell++) {
      if (!bases.includes(Math.floor(cell / 9)) && covers.includes(cell % 9)) {
        state.candidates[cell]! &= ~mask(5)
      }
    }
    expect(find(state)).toBeUndefined()
  })
})

describe('wings', () => {
  it('XY-Wing removes Z from common pincer peers, even if they do not see the pivot', () => {
    const state = fixture()
    state.candidates[0] = mask(1, 2)
    state.candidates[4] = mask(1, 3)
    state.candidates[27] = mask(2, 3)
    expect(findXYWing(state)).toEqual({
      technique: 'xy-wing', eliminations: [{ cell: 31, digit: 3 }],
    })
  })

  it('XYZ-Wing requires the target to see pivot and both pincers', () => {
    const state = fixture()
    state.candidates[0] = mask(1, 2, 3)
    state.candidates[4] = mask(1, 3)
    state.candidates[10] = mask(2, 3)
    const step = findXYZWing(state)
    expect(step).toEqual({
      technique: 'xyz-wing', eliminations: [{ cell: 1, digit: 3 }, { cell: 2, digit: 3 }],
    })
    const next = applyLogicalStep(state, step!)
    expect(next.candidates[13]! & mask(3)).toBe(mask(3))
    expect(next.candidates[0]).toBe(mask(1, 2, 3))
  })

  it('rejects pincers without a common Z', () => {
    const state = fixture()
    state.candidates[0] = mask(1, 2)
    state.candidates[4] = mask(1, 3)
    state.candidates[27] = mask(2, 4)
    expect(findXYWing(state)).toBeUndefined()
    state.candidates[0] = mask(1, 2, 3)
    expect(findXYZWing(state)).toBeUndefined()
  })

  it('rejects a wing cell that cannot see any other pattern cell', () => {
    const state = fixture()
    state.candidates[0] = mask(1, 2)
    state.candidates[4] = mask(1, 3)
    state.candidates[80] = mask(2, 3)
    expect(findXYWing(state)).toBeUndefined()
    state.candidates[0] = mask(1, 2, 3)
    expect(findXYZWing(state)).toBeUndefined()
  })
})

function restrictDigit(state: ReturnType<typeof fixture>, unit: readonly number[], cells: readonly number[]) {
  for (const cell of unit) {
    if (!cells.includes(cell)) state.candidates[cell]! &= ~mask(5)
  }
}

describe('simple coloring', () => {
  it('uses a multi-link component to trap uncolored cells seeing opposite colors', () => {
    const state = fixture()
    restrictDigit(state, ROWS[0]!, [0, 4])
    restrictDigit(state, COLUMNS[4]!, [4, 40])
    restrictDigit(state, ROWS[4]!, [36, 40])
    const step = findSimpleColoring(state)
    expect(step?.technique).toBe('simple-coloring')
    expect(step?.eliminations.every(({ digit }) => digit === 5)).toBe(true)
    expect(cellsOf(step)).toEqual([9, 18, 27, 45, 54, 63, 72])
  })

  it('color wrap eliminates the whole conflicting color, including remote nodes', () => {
    const state = fixture()
    restrictDigit(state, ROWS[0]!, [0, 1])
    restrictDigit(state, COLUMNS[1]!, [1, 10])
    restrictDigit(state, ROWS[1]!, [10, 14])
    restrictDigit(state, COLUMNS[5]!, [14, 32])
    const step = findSimpleColoring(state)
    expect(cellsOf(step)).toEqual([0, 10, 32])
    expect(step?.eliminations.every(({ digit }) => digit === 5)).toBe(true)
  })

  it('does not combine independently colored components', () => {
    const state = fixture()
    restrictDigit(state, ROWS[0]!, [0, 4])
    restrictDigit(state, ROWS[4]!, [36, 40])
    expect(findSimpleColoring(state)).toBeUndefined()
  })

  it('does not turn units with three possible locations into strong links', () => {
    const state = fixture()
    restrictDigit(state, ROWS[0]!, [0, 1, 4])
    restrictDigit(state, COLUMNS[1]!, [1, 10, 37])
    expect(findSimpleColoring(state)).toBeUndefined()
  })
})

it.each([
  findNakedTriple, findHiddenTriple, findXWing, findSwordfish,
  findXYWing, findXYZWing, findSimpleColoring,
])('finders preserve frozen input and require an actual pattern (%#)', find => {
  const original = fixture()
  const state = { board: Object.freeze(original.board), candidates: Object.freeze(original.candidates) }
  expect(find(state)).toBeUndefined()
})
