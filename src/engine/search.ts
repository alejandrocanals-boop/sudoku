import { assertValidBoard, type Board } from './board'
import { shuffleInPlace } from './random'

/** Each call must return a finite value in [0, 1). */
export type RandomSource = () => number
export type SolutionCount = 0 | 1 | 2

const ALL_DIGITS = 0b1111111110

function boxOf(index: number): number {
  return Math.floor(index / 27) * 3 + Math.floor((index % 9) / 3)
}

function search(input: Board, limit: 1 | 2, random?: RandomSource, checkpoint?: () => void) {
  const board = [...input]
  const rows = Array<number>(9).fill(0)
  const columns = Array<number>(9).fill(0)
  const boxes = Array<number>(9).fill(0)
  for (let index = 0; index < 81; index++) {
    const digit = board[index]!
    if (digit === 0) continue
    rows[Math.floor(index / 9)]! |= 1 << digit
    columns[index % 9]! |= 1 << digit
    boxes[boxOf(index)]! |= 1 << digit
  }

  let count = 0
  let solution: number[] | undefined

  function visit(): void {
    checkpoint?.()
    let selected = -1
    let candidates: number[] = []
    // Choose the most constrained cell to keep the search small.
    for (let index = 0; index < 81; index++) {
      if (board[index] !== 0) continue
      const mask = ALL_DIGITS & ~(
        rows[Math.floor(index / 9)]! | columns[index % 9]! | boxes[boxOf(index)]!
      )
      if (mask === 0) return
      const digits = []
      for (let digit = 1; digit <= 9; digit++) {
        if (mask & (1 << digit)) digits.push(digit)
      }
      if (selected === -1 || digits.length < candidates.length) {
        selected = index
        candidates = digits
      }
    }
    if (selected === -1) {
      count++
      if (random) solution = [...board]
      return
    }
    if (random) shuffleInPlace(candidates, random)
    const row = Math.floor(selected / 9)
    const column = selected % 9
    const box = boxOf(selected)
    for (const digit of candidates) {
      const bit = 1 << digit
      board[selected] = digit
      rows[row]! |= bit
      columns[column]! |= bit
      boxes[box]! |= bit
      visit()
      board[selected] = 0
      rows[row]! &= ~bit
      columns[column]! &= ~bit
      boxes[box]! &= ~bit
      if (count >= limit) return
    }
  }

  visit()
  return { count: count as SolutionCount, solution }
}

/** Returns 2 for any puzzle with at least two solutions; never mutates input.
 * Invalid boards throw; a valid but unsatisfiable board returns 0.
 * Stops at the second solution; an optional checkpoint can enforce caller budgets.
 */
export function countSolutions(board: Board, checkpoint?: () => void): SolutionCount {
  assertValidBoard(board)
  return search(board, 2, undefined, checkpoint).count
}

/** Randomized backtracking; pass a seeded source for repeatable generation. */
export function generateCompleteBoard(random: RandomSource = Math.random, checkpoint?: () => void): number[] {
  const { solution } = search(Array<number>(81).fill(0), 1, random, checkpoint)
  if (!solution) throw new Error('Could not generate a complete Sudoku board')
  return solution
}
