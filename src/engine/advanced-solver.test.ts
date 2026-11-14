import { describe, expect, it } from 'vitest'
import { ROWS } from './board'
import { applyLogicalStep, createCandidateState, hasContradiction } from './candidates'
import { countSolutions } from './search'
import { classifyLogically, findLogicalStep, LOGICAL_LEVELS, solveLogically, type LogicalLevel } from './solver'

const parse = (text: string) => [...text].map(Number)
const solution = parse('534678912672195348198342567859761423426853791713924856961537284287419635345286179')
// Fixed, uniquely solvable regression grids with the same independently known solution.
const fixtures = [
  {
    level: 'hard', technique: 'hidden-triple',
    puzzle: '000000902070100040000002007850060000420850001010000800000000284000009005040206070',
  },
  {
    level: 'expert', technique: 'xyz-wing',
    puzzle: '030600900000000048198000000000700000406050001010024800901000000080000035000080170',
  },
] as const

function verifyDeductions(puzzle: readonly number[], level: LogicalLevel) {
  const result = solveLogically(puzzle, level)
  let state = createCandidateState(puzzle)
  for (const step of result.steps) {
    Object.freeze(state.board)
    Object.freeze(state.candidates)
    expect(findLogicalStep(state, level)).toEqual(step)
    if (step.placement) expect(step.placement.digit).toBe(solution[step.placement.cell])
    for (const { cell, digit } of step.eliminations) {
      expect(digit).not.toBe(solution[cell])
      expect(state.candidates[cell]! & (1 << digit)).not.toBe(0)
    }
    const next = applyLogicalStep(state, step)
    expect(hasContradiction(next)).toBe(false)
    for (let cell = 0; cell < 81; cell++) {
      // No eliminated bit may return on a later step.
      expect(next.candidates[cell]! & ~state.candidates[cell]!).toBe(0)
      if (next.board[cell] === 0) {
        expect(next.candidates[cell]! & (1 << solution[cell]!)).not.toBe(0)
      } else {
        expect(next.board[cell]).toBe(solution[cell])
      }
    }
    state = next
  }
  expect(state).toEqual(result.state)
  expect(result.status).not.toBe('contradiction')
  return result
}

describe.each(fixtures)('$level classification', ({ level, technique, puzzle }) => {
  it('uses the lowest completing cumulative tier from the original givens', () => {
    const input = Object.freeze(parse(puzzle))
    expect(countSolutions(input)).toBe(1)
    for (const lower of LOGICAL_LEVELS.slice(0, LOGICAL_LEVELS.indexOf(level))) {
      expect(solveLogically(input, lower).status).toBe('stalled')
    }
    const result = solveLogically(input, level)
    expect(result.status).toBe('solved')
    expect(result.state.board).toEqual(solution)
    expect(result.steps.some(step => step.technique === technique)).toBe(true)
    expect(classifyLogically(input)).toBe(level)
    expect(solveLogically(input, level)).toEqual(result)
    expect(input).toEqual(parse(puzzle))
  })

  it('preserves the unique solution and persistent candidates after every deduction', () => {
    verifyDeductions(parse(puzzle), level)
  })
})

// Additional fixed grids exercise every remaining advanced technique on real candidate states.
it.each([
  ['xy-wing', '030070900070100008008000000000001000420800090000024000960500004007000035000280070'],
  ['simple-coloring', '500600002600000340000040000800060420006053000000900050000507000207010600005000109'],
  ['x-wing', '500000900070000048100340507050760020400000001000900000901500000200000000000080079'],
  ['naked-triple', '500070000670000008008300000000061020006003700000920050900500000280000030000006100'],
  ['swordfish', '534600000000090000008340000000701020026003090010000806961000004000009000300080000'],
] as const)('validates every %s trace deduction against an independently unique solution', (technique, puzzle) => {
  const input = Object.freeze(parse(puzzle))
  expect(countSolutions(input)).toBe(1)
  const result = verifyDeductions(input, 'expert')
  expect(result.steps.some(step => step.technique === technique)).toBe(true)
  expect(input).toEqual(parse(puzzle))
})

it('enables X-Wing only from hard and XYZ-Wing only at expert', () => {
  const blank = Array<number>(81).fill(0)
  const base = createCandidateState(blank)
  const candidates = [...base.candidates]
  for (const row of [0, 4]) {
    for (const cell of ROWS[row]!) {
      if (![1, 4].includes(cell % 9)) candidates[cell]! &= ~(1 << 5)
    }
  }
  const fish = { board: base.board, candidates }
  expect(findLogicalStep(fish, 'medium')).toBeUndefined()
  expect(findLogicalStep(fish, 'hard')?.technique).toBe('x-wing')
  expect(findLogicalStep(fish, 'expert')?.technique).toBe('x-wing')

  const wings = [...base.candidates]
  wings[0] = (1 << 1) | (1 << 2) | (1 << 3)
  wings[4] = (1 << 1) | (1 << 3)
  wings[10] = (1 << 2) | (1 << 3)
  const wing = { board: base.board, candidates: wings }
  expect(findLogicalStep(wing, 'hard')).toBeUndefined()
  expect(findLogicalStep(wing, 'expert')?.technique).toBe('xyz-wing')
})

it('stalls at expert when the supported deductions cannot progress', () => {
  const blank = Array<number>(81).fill(0)
  expect(solveLogically(blank, 'expert')).toEqual({
    status: 'stalled', state: createCandidateState(blank), steps: [],
  })
  expect(classifyLogically(blank)).toBeNull()
})
