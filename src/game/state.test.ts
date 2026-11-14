import { describe, expect, it } from 'vitest'
import { completionSummary } from './selectors'
import { createGame, reduceGame, type GameAction } from './state'
import { deepFreeze, GIVENS, playing, puzzle, SOLUTION } from './game.test-helpers'

describe('new game and input', () => {
  it('starts inactive with a defensive copy and no selected digit or cell', () => {
    const input = puzzle()
    const state = createGame(input, 'attempt-1')
    expect(state).toMatchObject({
      status: 'inactive', selectedCell: null, history: [], errors: 0, elapsedMs: 0, activeSinceMs: null,
    })
    expect(state.entries).toEqual(GIVENS)
    expect(state.puzzle).toEqual(input)
    expect(state.entries).not.toBe(input.givens)
    expect(state.puzzle.givens).not.toBe(input.givens)
    expect(state.puzzle.solution).not.toBe(input.solution)
    expect(state.puzzle).not.toBe(input)
  })

  it('requires selecting a cell first and allows selecting givens but never editing them', () => {
    const state = deepFreeze(playing())
    expect(reduceGame(state, { type: 'insert', digit: 1, now: 1100 })).toBe(state)
    expect(reduceGame(state, { type: 'erase' })).toBe(state)
    const selected = reduceGame(state, { type: 'select', cell: 0 })
    expect(selected.selectedCell).toBe(0)
    expect(reduceGame(selected, { type: 'insert', digit: 1, now: 1100 })).toBe(selected)
    expect(reduceGame(selected, { type: 'erase' })).toBe(selected)
    expect(selected.history).toEqual([])
    expect(selected.errors).toBe(0)
    expect(reduceGame(selected, { type: 'select', cell: null }).selectedCell).toBeNull()
    expect(reduceGame(selected, { type: 'select', cell: 0 })).toBe(selected)
  })

  it('counts actual wrong insertions and replacements, but excludes no-ops and corrections', () => {
    let state = reduceGame(playing(), { type: 'select', cell: 2 })
    const blank = deepFreeze(state)
    state = reduceGame(state, { type: 'insert', digit: 1, now: 1100 })
    expect(state.errors).toBe(1)
    expect(state.history).toEqual([{ cell: 2, before: 0, after: 1 }])
    expect(reduceGame(state, { type: 'insert', digit: 1, now: 1200 })).toBe(state)
    state = reduceGame(deepFreeze(state), { type: 'insert', digit: 2, now: 1300 })
    expect(state.errors).toBe(2)
    state = reduceGame(deepFreeze(state), { type: 'insert', digit: 4, now: 1400 })
    expect(state.errors).toBe(2)
    expect(state.history).toHaveLength(3)
    expect(state.entries[2]).toBe(4)
    expect(blank.entries[2]).toBe(0)
    expect(blank.history).toEqual([])
    expect(blank.errors).toBe(0)
  })

  it('counts mistakes even with live detection switched off and imposes no mistake limit', () => {
    let state = reduceGame(playing(), { type: 'select', cell: 2 })
    for (let index = 0; index < 20; index++) {
      state = reduceGame(state, { type: 'insert', digit: index % 2 + 1, now: 1100 + index }, { detectErrors: false })
    }
    expect(state.errors).toBe(20)
    expect(state.status).toBe('playing')
  })

  it.each([-1, 81, 1.5, NaN])('rejects invalid selected cell %s', cell => {
    expect(() => reduceGame(playing(), { type: 'select', cell })).toThrow(RangeError)
  })
  it.each([0, -1, 10, 1.5, NaN])('rejects invalid digit %s', digit => {
    expect(() => reduceGame(playing(), { type: 'insert', digit, now: 1100 })).toThrow(RangeError)
  })

  it('rejects inconsistent engine puzzle data and missing attempt identity', () => {
    expect(() => createGame(puzzle(), ' ')).toThrow(RangeError)
    expect(() => createGame({ ...puzzle(), id: 'wrong' }, 'id')).toThrow(RangeError)
    expect(() => createGame({ ...puzzle(), solution: GIVENS }, 'id')).toThrow(RangeError)
    const inconsistent = [...GIVENS]
    inconsistent[2] = 1
    expect(() => createGame(puzzle(inconsistent), 'id')).toThrow(RangeError)
    expect(() => createGame(puzzle(SOLUTION), 'id')).toThrow(RangeError)
  })
})

describe('erase and undo', () => {
  it('retains undo history and entries across leaving and explicitly continuing', () => {
    let state = reduceGame(playing(), { type: 'select', cell: 2 })
    state = reduceGame(state, { type: 'insert', digit: 1, now: 1100 })
    const changed = deepFreeze(state)
    state = reduceGame(state, { type: 'leave', now: 2000 })
    state = reduceGame(deepFreeze(state), { type: 'resume', now: 100000 })
    expect(state.history).toEqual(changed.history)
    expect(state.entries).toEqual(changed.entries)
    state = reduceGame(state, { type: 'undo' })
    expect(state.entries).toEqual(GIVENS)
    expect(state.errors).toBe(1)
    expect(state.elapsedMs).toBe(1000)
  })

  it('restores prior boards through replacements and erasure, preserving the mistake total', () => {
    let state = reduceGame(playing(), { type: 'select', cell: 2 })
    expect(reduceGame(state, { type: 'erase' })).toBe(state)
    state = reduceGame(state, { type: 'insert', digit: 1, now: 1100 })
    state = reduceGame(state, { type: 'insert', digit: 2, now: 1200 })
    state = reduceGame(state, { type: 'erase' })
    expect(state.entries[2]).toBe(0)
    expect(state.history.at(-1)).toEqual({ cell: 2, before: 2, after: 0 })
    expect(reduceGame(state, { type: 'erase' })).toBe(state)
    // Undo concerns the last changed cell even if a different cell is selected now.
    state = reduceGame(state, { type: 'select', cell: 3 })
    for (const expected of [2, 1, 0]) {
      state = reduceGame(deepFreeze(state), { type: 'undo' })
      expect(state.entries[2]).toBe(expected)
      expect(state.selectedCell).toBe(3)
      expect(state.errors).toBe(2)
      expect(state.elapsedMs).toBe(0)
      expect(state.activeSinceMs).toBe(1000)
    }
    expect(state.history).toEqual([])
    expect(reduceGame(state, { type: 'undo' })).toBe(state)
  })
})

describe('restart', () => {
  it.each(['playing', 'paused', 'inactive'] as const)('resets the same puzzle and preserves %s lifecycle state', status => {
    let state = reduceGame(playing(), { type: 'select', cell: 2 })
    state = reduceGame(state, { type: 'insert', digit: 1, now: 1100 })
    state = reduceGame(state, { type: 'checkpoint', now: 2000 })
    if (status === 'paused') state = reduceGame(state, { type: 'pause', now: 3000 })
    if (status === 'inactive') state = reduceGame(state, { type: 'leave', now: 3000 })
    const fresh = reduceGame(deepFreeze(state), { type: 'restart', attemptId: 'attempt-2', now: 5000 })
    expect(fresh.puzzle).toEqual(state.puzzle)
    expect(fresh).toMatchObject({
      attemptId: 'attempt-2', entries: GIVENS, selectedCell: null, history: [], errors: 0, elapsedMs: 0, status,
      activeSinceMs: status === 'playing' ? 5000 : null,
    })
    expect(state.errors).toBe(1)
    expect(() => reduceGame(state, { type: 'restart', attemptId: 'attempt-1', now: 5000 })).toThrow(RangeError)
  })
})

describe('completion', () => {
  it('does not complete a full board until every entry matches the solution', () => {
    const givens = [...SOLUTION]
    givens[2] = givens[80] = 0
    let state = reduceGame(playing(givens), { type: 'select', cell: 2 })
    state = reduceGame(state, { type: 'insert', digit: 9, now: 1100 })
    state = reduceGame(state, { type: 'select', cell: 80 })
    state = reduceGame(state, { type: 'insert', digit: 4, now: 1200 })
    expect(state.entries.every(digit => digit !== 0)).toBe(true)
    expect(state.status).toBe('playing')
    expect(state.errors).toBe(2)
    expect(completionSummary(state)).toBeNull()
  })

  it('freezes the solved board and time once, retaining a stable identity and all errors', () => {
    const givens = [...SOLUTION]
    givens[2] = givens[80] = 0
    let state = reduceGame(playing(givens), { type: 'select', cell: 2 })
    state = reduceGame(state, { type: 'insert', digit: 9, now: 1500 })
    state = reduceGame(state, { type: 'insert', digit: 4, now: 2000 })
    state = reduceGame(state, { type: 'select', cell: 80 })
    expect(completionSummary(state)).toBeNull()
    state = reduceGame(deepFreeze(state), { type: 'insert', digit: 9, now: 6500 })
    expect(state.entries).toEqual(SOLUTION)
    expect(state).toMatchObject({ status: 'completed', elapsedMs: 5500, activeSinceMs: null, errors: 1 })
    const summary = completionSummary(state)
    expect(summary).toEqual({ attemptId: 'attempt-1', puzzleId: givens.join(''), level: 'easy', elapsedMs: 5500, errors: 1 })
    const actions: GameAction[] = [
      { type: 'insert', digit: 9, now: 99999 }, { type: 'erase' }, { type: 'undo' },
      { type: 'select', cell: 2 }, { type: 'resume', now: 99999 },
      { type: 'pause', now: 99999 }, { type: 'hide', now: 99999 }, { type: 'leave', now: 99999 },
      { type: 'checkpoint', now: 99999 }, { type: 'restart', attemptId: 'attempt-2', now: 99999 },
    ]
    for (const action of actions) expect(reduceGame(deepFreeze(state), action)).toBe(state)
    expect(completionSummary(state)).toEqual(summary)
  })
})
