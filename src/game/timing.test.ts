import { describe, expect, it } from 'vitest'
import { createGame, elapsedTimeMs, formatElapsedTime, reduceGame, type GameAction } from './state'
import { isBoardVisible } from './selectors'
import { deepFreeze, playing, puzzle } from './game.test-helpers'

describe('active time', () => {
  it('starts only on explicit resume and does not reset an already running timer', () => {
    const initial = createGame(puzzle(), 'id')
    expect(elapsedTimeMs(initial, 500000)).toBe(0)
    expect(isBoardVisible(initial)).toBe(false)
    const state = reduceGame(deepFreeze(initial), { type: 'resume', now: 1000 })
    expect(elapsedTimeMs(state, 2500)).toBe(1500)
    expect(reduceGame(state, { type: 'resume', now: 2000 })).toBe(state)
    expect(isBoardVisible(state)).toBe(true)
  })

  it.each(['pause', 'hide', 'leave'] as const)('%s stops time without background catch-up', type => {
    const active = playing()
    const stopped = reduceGame(deepFreeze(active), { type, now: 3000 })
    expect(stopped.activeSinceMs).toBeNull()
    expect(stopped.elapsedMs).toBe(2000)
    expect(isBoardVisible(stopped)).toBe(false)
    expect(elapsedTimeMs(stopped, 500000)).toBe(2000)
    expect(reduceGame(stopped, { type: 'checkpoint', now: 500000 })).toBe(stopped)
    const resumed = reduceGame(stopped, { type: 'resume', now: 500000 })
    expect(elapsedTimeMs(resumed, 501000)).toBe(3000)
    expect(elapsedTimeMs(active, 3000)).toBe(2000)
  })

  it('blocks gameplay while inactive or paused and requires explicit resume', () => {
    const actions: GameAction[] = [
      { type: 'select', cell: 2 }, { type: 'insert', digit: 1, now: 6000 }, { type: 'erase' }, { type: 'undo' },
    ]
    const selected = reduceGame(playing(), { type: 'select', cell: 2 })
    for (const type of ['pause', 'leave'] as const) {
      const state = reduceGame(selected, { type, now: 3000 })
      for (const action of actions) expect(reduceGame(deepFreeze(state), action)).toBe(state)
    }
  })

  it('settles checkpoints without double counting and ignores repeated suspension', () => {
    let state = playing()
    state = reduceGame(state, { type: 'checkpoint', now: 2200 })
    expect(state.elapsedMs).toBe(1200)
    expect(state.activeSinceMs).toBe(2200)
    expect(elapsedTimeMs(state, 3000)).toBe(2000)
    state = reduceGame(state, { type: 'checkpoint', now: 3000 })
    state = reduceGame(state, { type: 'pause', now: 4000 })
    expect(state.elapsedMs).toBe(3000)
    expect(reduceGame(state, { type: 'pause', now: 9000 })).toBe(state)
    expect(reduceGame(state, { type: 'hide', now: 9000 })).toBe(state)
    state = reduceGame(state, { type: 'leave', now: 9000 })
    expect(state.status).toBe('inactive')
    expect(state.elapsedMs).toBe(3000)
    expect(reduceGame(state, { type: 'leave', now: 99000 })).toBe(state)
  })

  it.each([-1, NaN, Infinity])('rejects invalid time %s', now => {
    expect(() => elapsedTimeMs(playing(), now)).toThrow(RangeError)
    expect(() => reduceGame(createGame(puzzle(), 'id'), { type: 'resume', now })).toThrow(RangeError)
    expect(() => formatElapsedTime(now)).toThrow(RangeError)
  })

  it('rejects backwards timestamps during an active segment', () => {
    expect(() => elapsedTimeMs(playing(), 999)).toThrow(RangeError)
    expect(() => reduceGame(playing(), { type: 'pause', now: 999 })).toThrow(RangeError)
    expect(() => reduceGame(playing(), { type: 'checkpoint', now: 999 })).toThrow(RangeError)
  })
})

it.each([
  [0, '00:00'], [999, '00:00'], [1000, '00:01'], [60000, '01:00'],
  [3599999, '59:59'], [3600000, '01:00:00'], [3661000, '01:01:01'], [360000000, '100:00:00'],
])('formats %s milliseconds as %s', (milliseconds, expected) => {
  expect(formatElapsedTime(milliseconds as number)).toBe(expected)
})
