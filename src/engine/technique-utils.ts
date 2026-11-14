import { DIGITS, type CandidateState, type LogicalStep, type Technique } from './candidates'

export function* combinations<T>(items: readonly T[], size: number, start = 0): Generator<T[]> {
  if (size === 0) {
    yield []
    return
  }
  for (let index = start; index <= items.length - size; index++) {
    for (const rest of combinations(items, size - 1, index + 1)) {
      yield [items[index]!, ...rest]
    }
  }
}

export function digitCount(mask: number): number {
  return DIGITS.filter(digit => mask & (1 << digit)).length
}

export function eliminationStep(
  state: CandidateState, technique: Technique, cells: readonly number[], mask: number,
): LogicalStep | undefined {
  const eliminations = cells.flatMap(cell => DIGITS
    .filter(digit => state.candidates[cell]! & mask & (1 << digit))
    .map(digit => ({ cell, digit })))
  if (eliminations.length) return { technique, eliminations }
}
