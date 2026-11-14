import type { Puzzle } from '../engine/generator'
import { createGame, reduceGame } from './state'

export const SOLUTION = [...'534678912672195348198342567859761423426853791713924856961537284287419635345286179'].map(Number)
export const GIVENS = [...'530070000600195000098000060800060003400803001700020006060000280000419005000080079'].map(Number)
export function puzzle(givens = GIVENS): Puzzle {
  return { id: givens.join(''), givens: [...givens], solution: [...SOLUTION], level: 'easy' }
}
export function playing(givens = GIVENS) {
  return reduceGame(createGame(puzzle(givens), 'attempt-1'), { type: 'resume', now: 1000 })
}
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}
