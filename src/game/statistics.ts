import { LOGICAL_LEVELS } from '../engine/solver'
import type { CompletedGame, SavedData } from '../storage/schema'
import type { GameState } from './state'

/** Record and clear the active attempt in the same document, idempotently by attempt ID. */
export function recordCompletion(data: SavedData, game: GameState, completedAt: string): SavedData {
  if (game.status !== 'completed') throw new Error('Only completed attempts can be recorded')
  const exists = data.completedGames.some(record => record.attemptId === game.attemptId)
  const record: CompletedGame = {
    attemptId: game.attemptId, puzzleId: game.puzzle.id, level: game.puzzle.level,
    completedAt, elapsedMs: game.elapsedMs, errors: game.errors,
  }
  return { ...data, activeGame: data.activeGame?.attemptId === game.attemptId ? null : data.activeGame,
    completedGames: exists ? data.completedGames : [...data.completedGames, record] }
}

export function clearStatistics(data: SavedData): SavedData {
  return { ...data, completedGames: [] }
}

export function summarizeStatistics(records: readonly CompletedGame[]) {
  const byLevel = LOGICAL_LEVELS.map(level => {
    const matching = records.filter(record => record.level === level)
    const totalMs = matching.reduce((sum, record) => sum + record.elapsedMs, 0)
    return {
      level, count: matching.length,
      bestMs: matching.length ? matching.reduce((best, record) => Math.min(best, record.elapsedMs), Infinity) : null,
      averageMs: matching.length ? totalMs / matching.length : null,
    }
  })
  return {
    count: records.length,
    totalMs: records.reduce((sum, record) => sum + record.elapsedMs, 0),
    byLevel, maxLevelCount: Math.max(...byLevel.map(level => level.count)),
  }
}

export function newestFirst(records: readonly CompletedGame[]): CompletedGame[] {
  return [...records].sort((first, second) => Date.parse(second.completedAt) - Date.parse(first.completedAt))
}
