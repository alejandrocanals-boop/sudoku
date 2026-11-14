import { useCallback, useEffect, useRef, useState } from 'react'
import { reduceGame, type GameAction, type GameState } from '../game/state'
import { DEFAULT_GAME_SETTINGS } from '../game/settings'
import { SaveRepository, type StorageIssue } from '../storage/repository'
import { emptySavedData, restoreGame, saveGame, type CompletedGame, type SavedData } from '../storage/schema'
import { clearStatistics, recordCompletion } from '../game/statistics'

export function useSavedSession(onRestore: (game: GameState | null) => void) {
  const [repository] = useState(() => new SaveRepository(() => window.localStorage))
  const [loaded, setLoaded] = useState(false)
  const [issue, setIssue] = useState<StorageIssue | null>(null)
  const [game, setGame] = useState<GameState | null>(null)
  const [settings, setSettings] = useState(DEFAULT_GAME_SETTINGS)
  const [completedGames, setCompletedGames] = useState<readonly CompletedGame[]>([])
  const hydrated = useRef(false)
  const data = useRef(emptySavedData())
  const current = useRef<GameState | null>(null)
  const usedIds = useRef<readonly string[]>([])

  const snapshot = useCallback((): SavedData => ({
    ...data.current, usedPuzzleIds: usedIds.current,
    activeGame: current.current?.status === 'completed' ? null : saveGame(current.current, performance.now()),
  }), [])
  const persist = useCallback(() => {
    if (!hydrated.current) return false
    const result = repository.save(snapshot())
    setIssue(result.ok ? null : result.issue)
    return result.ok
  }, [repository, snapshot])
  const adopt = useCallback((saved: SavedData, restored = restoreGame(saved.activeGame)) => {
    data.current = saved
    usedIds.current = saved.usedPuzzleIds
    current.current = restored
    setGame(current.current)
    setSettings(saved.settings)
    setCompletedGames(saved.completedGames)
    setIssue(null)
    onRestore(current.current)
  }, [onRestore])
  const reload = useCallback(() => {
    const result = repository.load()
    if (result.ok) {
      const restored = restoreGame(result.data.activeGame)
      const saved = restored?.status === 'completed'
        ? recordCompletion(result.data, restored, new Date().toISOString()) : result.data
      // Recover item-08 pending completions once; a failed write remains retryable in memory.
      const write = saved === result.data ? { ok: true as const } : repository.save(saved)
      adopt(saved, restored)
      if (!write.ok) setIssue(write.issue)
    } else setIssue(result.issue)
  }, [repository, adopt])
  const update = useCallback((change: (value: GameState | null) => GameState | null) => {
    const next = change(current.current)
    if (next === current.current) return
    if (next?.status === 'completed' && (current.current?.status !== 'completed' || next.attemptId !== current.current.attemptId)) {
      data.current = recordCompletion(data.current, next, new Date().toISOString())
      setCompletedGames(data.current.completedGames)
    }
    current.current = next
    setGame(next)
    persist()
  }, [persist])
  const dispatch = useCallback((action: GameAction) => {
    update(value => value ? reduceGame(value, action, data.current.settings) : value)
  }, [update])

  useEffect(() => {
    let mounted = true
    // Avoid I/O during rendering and StrictMode's discarded initial mount.
    queueMicrotask(() => {
      if (!mounted) return
      reload()
      hydrated.current = true
      setLoaded(true)
    })
    return () => { mounted = false }
  }, [reload])
  useEffect(() => {
    const hide = () => {
      dispatch({ type: 'hide', now: performance.now() })
      persist()
    }
    const visibility = () => { if (document.hidden) hide() }
    const timer = setInterval(() => {
      if (current.current?.status === 'playing') dispatch({ type: 'checkpoint', now: performance.now() })
    }, 5000)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', hide)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', hide)
    }
  }, [dispatch, persist])

  return {
    loaded, issue, game, settings, completedGames, current, usedIds, update, dispatch, persist, reload, snapshot,
    recoveryText: () => repository.recoveryText,
    rememberId: (id: string) => { usedIds.current = [...usedIds.current, id] },
    setDetectErrors: (detectErrors: boolean) => {
      const settings = { detectErrors }
      data.current = { ...data.current, settings }
      setSettings(settings)
      persist()
    },
    importData: (saved: SavedData): boolean => {
      const restored = restoreGame(saved.activeGame)
      const normalized = restored?.status === 'completed' ? recordCompletion(saved, restored, new Date().toISOString()) : saved
      const result = repository.import(normalized)
      if (result.ok) adopt(normalized, restored)
      else setIssue(result.issue)
      return result.ok
    },
    clearStatistics: (): boolean => {
      const cleared = clearStatistics(snapshot())
      const result = repository.save(cleared)
      if (!result.ok) { setIssue(result.issue); return false }
      data.current = cleared
      setCompletedGames(cleared.completedGames)
      setIssue(null)
      return true
    },
  }
}
