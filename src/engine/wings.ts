import { PEERS, type CandidateState, type LogicalStep } from './candidates'
import { combinations, digitCount, eliminationStep } from './technique-utils'

function findWing(state: CandidateState, size: 2 | 3): LogicalStep | undefined {
  for (let pivot = 0; pivot < 81; pivot++) {
    const pivotMask = state.candidates[pivot]!
    if (digitCount(pivotMask) !== size) continue
    const wings = PEERS[pivot]!.filter(cell => digitCount(state.candidates[cell]!) === 2)
    for (const [first, second] of combinations(wings, 2)) {
      const firstMask = state.candidates[first!]!
      const secondMask = state.candidates[second!]!
      const common = firstMask & secondMask
      if (digitCount(common) !== 1) continue
      if (size === 2) {
        // XZ and YZ, sharing Z outside the XY pivot.
        if ((common & pivotMask) !== 0 || (firstMask | secondMask) !== (pivotMask | common)) continue
      } else {
        // Both pincers are subsets of XYZ and together contain all three digits.
        if ((firstMask | secondMask) !== pivotMask) continue
      }
      const targets = PEERS[first!]!.filter(cell => cell !== pivot && cell !== second
        && PEERS[second!]!.includes(cell) && (size === 2 || PEERS[pivot]!.includes(cell)))
      const step = eliminationStep(state, size === 2 ? 'xy-wing' : 'xyz-wing', targets, common)
      if (step) return step
    }
  }
}

export const findXYWing = (state: CandidateState): LogicalStep | undefined => findWing(state, 2)
export const findXYZWing = (state: CandidateState): LogicalStep | undefined => findWing(state, 3)
