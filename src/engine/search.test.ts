import { describe, expect, it } from 'vitest'
import { isCompleteBoard, isValidBoard, UNITS } from './board'
import { countSolutions, generateCompleteBoard } from './search'

const puzzle = [...(
  '530070000' + '600195000' + '098000060'
  + '800060003' + '400803001' + '700020006'
  + '060000280' + '000419005' + '000080079'
)].map(Number)
const solved = [...(
  '534678912' + '672195348' + '198342567'
  + '859761423' + '426853791' + '713924856'
  + '961537284' + '287419635' + '345286179'
)].map(Number)

function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

describe('solution counting', () => {
  it('rejects invalid boards instead of reporting them as unsatisfiable', () => {
    expect(() => countSolutions([0])).toThrow(RangeError)
    const invalid = [...puzzle]
    invalid[2] = 5
    expect(() => countSolutions(invalid)).toThrow(RangeError)
  })

  it('returns zero for a locally valid puzzle with no solution', () => {
    const impossible = [...puzzle]
    impossible[2] = 1
    expect(isValidBoard(impossible)).toBe(true)
    const snapshot = [...impossible]
    expect(countSolutions(Object.freeze(impossible))).toBe(0)
    expect(impossible).toEqual(snapshot)
  })

  it('counts one for a unique puzzle and preserves its givens', () => {
    const input = Object.freeze([...puzzle])
    expect(countSolutions(input)).toBe(1)
    expect(input).toEqual(puzzle)
    expect(countSolutions(input)).toBe(1)
  })

  it('counts one for a completed board or a single missing digit', () => {
    expect(isCompleteBoard(solved)).toBe(true)
    expect(countSolutions(solved)).toBe(1)
    const almost = [...solved]
    almost[80] = 0
    expect(countSolutions(almost)).toBe(1)
    expect(almost[80]).toBe(0)
  })

  it('caps an empty board with many solutions at two', () => {
    const empty = Object.freeze(Array<number>(81).fill(0))
    expect(countSolutions(empty)).toBe(2)
    expect(empty.every(digit => digit === 0)).toBe(true)
  })
})

describe('complete grid generation', () => {
  it.each([0, 1, 42, 2026, 0xffffffff])('generates a complete grid for seed %s', seed => {
    const board = generateCompleteBoard(seededRandom(seed))
    expect(isCompleteBoard(board)).toBe(true)
    for (const unit of UNITS) {
      expect(unit.map(index => board[index]).sort())
        .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    }
    expect(countSolutions(board)).toBe(1)
  })

  it('is reproducible and varies with the random source', () => {
    const first = generateCompleteBoard(seededRandom(42))
    expect(generateCompleteBoard(seededRandom(42))).toEqual(first)
    expect(generateCompleteBoard(seededRandom(43))).not.toEqual(first)
  })

  it('supports the default source and valid extreme values', () => {
    expect(isCompleteBoard(generateCompleteBoard())).toBe(true)
    expect(isCompleteBoard(generateCompleteBoard(() => 0))).toBe(true)
    expect(isCompleteBoard(generateCompleteBoard(() => 0.999999))).toBe(true)
  })

  it.each([-0.1, 1, NaN, Infinity])('rejects invalid random output %s', value => {
    expect(() => generateCompleteBoard(() => value)).toThrow(RangeError)
  })
})
