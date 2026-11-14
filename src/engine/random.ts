import type { RandomSource } from './search'

export function createSeededRandom(seed: number): RandomSource {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('Seed must be an unsigned 32-bit integer')
  }
  let state = seed
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

export function shuffleInPlace<T>(items: T[], random: RandomSource): void {
  for (let index = items.length - 1; index > 0; index--) {
    const value = random()
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('Random source must return a finite value in [0, 1)')
    }
    const other = Math.floor(value * (index + 1))
    ;[items[index], items[other]] = [items[other]!, items[index]!]
  }
}
