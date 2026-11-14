import { describe, expect, it } from 'vitest'
import { disabledDigits, isCellError, isDigitDisabled, cellHighlights, visibleErrorCount } from './selectors'
import { reduceGame } from './state'
import { deepFreeze, playing, SOLUTION } from './game.test-helpers'

describe('selection highlights', () => {
  it('has no highlights until a cell is selected', () => {
    expect(cellHighlights(playing())).toEqual({ selected: null, peers: [], matching: [] })
  })

  it('highlights peers for an empty cell without highlighting other empties', () => {
    const state = reduceGame(playing(), { type: 'select', cell: 2 })
    const result = cellHighlights(deepFreeze(state))
    expect(result.selected).toBe(2)
    expect(result.peers).toHaveLength(20)
    expect(result.peers).toEqual(expect.arrayContaining([0, 8, 11, 20, 29, 74]))
    expect(result.peers).not.toContain(2)
    expect(result.peers).not.toContain(40)
    expect(result.matching).toEqual([])
  })

  it('highlights equal digits and peers for givens and user entries', () => {
    let state = reduceGame(playing(), { type: 'select', cell: 0 })
    expect(cellHighlights(state).matching).toEqual([0, 14, 71])
    state = reduceGame(state, { type: 'select', cell: 2 })
    state = reduceGame(state, { type: 'insert', digit: 5, now: 1500 })
    expect(cellHighlights(state).matching).toEqual([0, 2, 14, 71])
  })
})

describe('error presentation', () => {
  it('hides live mistakes when detection is off while retaining the actual total', () => {
    let state = reduceGame(playing(), { type: 'select', cell: 2 })
    state = reduceGame(state, { type: 'insert', digit: 1, now: 1500 }, { detectErrors: false })
    expect(state.errors).toBe(1)
    expect(isCellError(state, 2)).toBe(true)
    expect(isCellError(state, 0)).toBe(false)
    expect(isCellError(state, 3)).toBe(false)
    expect(isCellError(state, 2, { detectErrors: false })).toBe(false)
    expect(visibleErrorCount(state, { detectErrors: false })).toBeNull()
    expect(visibleErrorCount(state)).toBe(1)
    state = reduceGame(state, { type: 'erase' })
    expect(isCellError(state, 2)).toBe(false)
    expect(visibleErrorCount(state)).toBe(1)
  })
})

describe('completed keypad digits', () => {
  it('disables only fully correct digits with detection on and re-enables after undo/erase', () => {
    const givens = [...SOLUTION]
    givens[0] = givens[2] = 0
    let state = reduceGame(playing(givens), { type: 'select', cell: 0 })
    expect(isDigitDisabled(state, 5)).toBe(false)
    state = reduceGame(state, { type: 'insert', digit: 5, now: 1500 })
    expect(isDigitDisabled(state, 5)).toBe(true)
    expect(disabledDigits(state)).toContain(5)
    const atOtherCell = reduceGame(state, { type: 'select', cell: 2 })
    expect(reduceGame(atOtherCell, { type: 'insert', digit: 5, now: 1600 })).toBe(atOtherCell)
    expect(isDigitDisabled(reduceGame(state, { type: 'undo' }), 5)).toBe(false)
    expect(isDigitDisabled(reduceGame(state, { type: 'erase' }), 5)).toBe(false)
  })

  it('does not disable nine copies that conflict in a unit with detection off', () => {
    const state = playing(Array<number>(81).fill(0))
    const entries = [...state.entries]
    for (let cell = 0; cell < 9; cell++) entries[cell] = 1
    expect(isDigitDisabled({ ...state, entries }, 1, { detectErrors: false })).toBe(false)
  })

  it('with detection off uses legal visible placement rather than the hidden solution', () => {
    const state = playing(Array<number>(81).fill(0))
    // Digit 1 occupies the solution's digit-2 locations: legal, but entirely incorrect.
    const entries = SOLUTION.map(digit => digit === 2 ? 1 : 0)
    const visible = deepFreeze({ ...state, entries })
    expect(isDigitDisabled(visible, 1, { detectErrors: false })).toBe(true)
    expect(isDigitDisabled(visible, 1)).toBe(false)
    expect(disabledDigits(visible, { detectErrors: false })).toEqual([1])
    // A poison solution proves the detection-off branch never reads it.
    const puzzle = { ...state.puzzle, get solution(): readonly number[] { throw new Error('Hidden solution read') } }
    expect(isDigitDisabled({ ...visible, puzzle }, 1, { detectErrors: false })).toBe(true)
    const selected = reduceGame(visible, { type: 'select', cell: 0 })
    expect(reduceGame(selected, { type: 'insert', digit: 1, now: 1600 }, { detectErrors: false })).toBe(selected)
  })
})
