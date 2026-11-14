/** Row-major cells: 0 is empty, 1–9 are digits. */
export type Board = readonly number[]

export const ROWS: readonly (readonly number[])[] = Array.from(
  { length: 9 },
  (_, row) => Array.from({ length: 9 }, (_, column) => row * 9 + column),
)

export const COLUMNS: readonly (readonly number[])[] = Array.from(
  { length: 9 },
  (_, column) => Array.from({ length: 9 }, (_, row) => row * 9 + column),
)

export const BOXES: readonly (readonly number[])[] = Array.from(
  { length: 9 },
  (_, box) => Array.from({ length: 9 }, (_, offset) =>
    (Math.floor(box / 3) * 3 + Math.floor(offset / 3)) * 9
    + (box % 3) * 3 + offset % 3),
)

export const UNITS: readonly (readonly number[])[] = [...ROWS, ...COLUMNS, ...BOXES]

/** Checks shape, cell values and duplicate digits; does not establish solvability. */
export function isValidBoard(value: unknown): value is Board {
  if (!Array.isArray(value) || value.length !== 81) return false
  // Iteration also rejects holes in sparse arrays.
  for (const cell of value) {
    if (!Number.isInteger(cell) || cell < 0 || cell > 9) return false
  }
  return UNITS.every(unit => {
    let seen = 0
    for (const index of unit) {
      const digit = value[index] as number
      if (digit === 0) continue
      const bit = 1 << digit
      if (seen & bit) return false
      seen |= bit
    }
    return true
  })
}

export function assertValidBoard(value: unknown): asserts value is Board {
  if (!isValidBoard(value)) {
    throw new RangeError('Expected 81 integer cells (0–9) without duplicate unit digits')
  }
}

export function isCompleteBoard(value: unknown): value is Board {
  return isValidBoard(value) && value.every(digit => digit !== 0)
}
