import { UNITS } from './board'
import { DIGITS, PEERS, type CandidateState, type LogicalStep } from './candidates'
import { eliminationStep } from './technique-utils'

function strongLinks(state: CandidateState, digit: number): Map<number, Set<number>> {
  const links = new Map<number, Set<number>>()
  for (const unit of UNITS) {
    const cells = unit.filter(cell => state.candidates[cell]! & (1 << digit))
    if (cells.length !== 2) continue
    const [first, second] = cells as [number, number]
    if (!links.has(first)) links.set(first, new Set())
    if (!links.has(second)) links.set(second, new Set())
    links.get(first)!.add(second)
    links.get(second)!.add(first)
  }
  return links
}

function colorComponent(links: Map<number, Set<number>>, start: number) {
  const colors = new Map<number, number>([[start, 0]])
  let consistent = true
  for (const [cell, color] of colors) {
    for (const peer of links.get(cell)!) {
      if (!colors.has(peer)) colors.set(peer, 1 - color)
      else if (colors.get(peer) === color) consistent = false
    }
  }
  return { colors, consistent }
}

/** Single-digit conjugate chains; components are never combined (no multi-colors). */
export function findSimpleColoring(state: CandidateState): LogicalStep | undefined {
  for (const digit of DIGITS) {
    const links = strongLinks(state, digit)
    const visited = new Set<number>()
    for (const start of links.keys()) {
      if (visited.has(start)) continue
      const { colors, consistent } = colorComponent(links, start)
      for (const cell of colors.keys()) visited.add(cell)
      // An odd cycle is inconsistent; it cannot justify a normal coloring deduction.
      if (!consistent) continue
      const groups = [0, 1].map(color => [...colors.keys()].filter(cell => colors.get(cell) === color))
      for (const group of groups) {
        if (!group.some(cell => group.some(other => PEERS[cell]!.includes(other)))) continue
        const step = eliminationStep(state, 'simple-coloring', group, 1 << digit)
        if (step) return step // Color wrap: this entire color must be false.
      }
      const targets = state.candidates.map((_, cell) => cell).filter(cell => !colors.has(cell)
        && groups.every(group => group.some(peer => PEERS[cell]!.includes(peer))))
      const step = eliminationStep(state, 'simple-coloring', targets, 1 << digit)
      if (step) return step // Color trap: an uncolored cell sees both colors.
    }
  }
}
