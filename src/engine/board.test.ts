import { describe, expect, it } from 'vitest'
import { BOXES, COLUMNS, isCompleteBoard, isValidBoard, ROWS, UNITS } from './board'

describe('board validation', () => {
  it('defines the 27 standard units and covers each cell three times', () => {
    expect(UNITS).toHaveLength(27)
    for (const group of [ROWS, COLUMNS, BOXES]) {
      expect(group).toHaveLength(9)
      expect([...group.flat()].sort((a, b) => a - b))
        .toEqual(Array.from({ length: 81 }, (_, index) => index))
      for (const unit of group) expect(new Set(unit).size).toBe(9)
    }
    expect(ROWS[0]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(COLUMNS[8]).toEqual([8, 17, 26, 35, 44, 53, 62, 71, 80])
    expect(BOXES[4]).toEqual([30, 31, 32, 39, 40, 41, 48, 49, 50])
  })

  it('accepts an empty board, but does not consider it complete', () => {
    expect(isValidBoard(Array(81).fill(0))).toBe(true)
    expect(isCompleteBoard(Array(81).fill(0))).toBe(false)
  })

  it.each([null, undefined, {}, '0'.repeat(81), [], Array(80).fill(0),
    Array(82).fill(0), Array(81)])('rejects malformed input %#', input => {
    expect(isValidBoard(input)).toBe(false)
    expect(isCompleteBoard(input)).toBe(false)
  })

  it.each([-1, 10, 1.5, NaN, Infinity, '1', null, undefined])(
    'rejects invalid cell value %s', value => {
      const board = Array(81).fill(0)
      board[40] = value
      expect(isValidBoard(board)).toBe(false)
    },
  )

  it.each([
    ['row', 0, 8], ['column', 0, 72], ['box', 0, 10],
  ] as const)('rejects duplicate digits in a %s', (_, first, second) => {
    const board = Array<number>(81).fill(0)
    board[first] = board[second] = 5
    expect(isValidBoard(board)).toBe(false)
    expect(isCompleteBoard(board)).toBe(false)
  })
})
