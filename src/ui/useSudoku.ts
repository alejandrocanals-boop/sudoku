import { useCallback, useEffect, useRef, useState } from 'react'
import { requestPuzzle } from '../engine/generation-client'
import { GENERATION_RETRY_MESSAGE } from '../engine/generator'
import type { LogicalLevel } from '../engine/solver'
import { createGame, reduceGame, type GameState } from '../game/state'
import { downloadBackup, readBackup } from '../storage/backup'
import { serializeSavedData, type SavedData } from '../storage/schema'
import { useSavedSession } from './useSavedSession'
import { requestPersistentStorage } from '../pwa/persistence'

type Screen = 'home' | 'levels' | 'game' | 'settings' | 'stats' | 'history'
type Generation = { status: 'idle' } | { status: 'loading'; level: LogicalLevel }
  | { status: 'error'; level: LogicalLevel; message: string }
type Confirmation = { type: 'replace'; level: LogicalLevel }
  | { type: 'restart'; resumeOnClose: boolean } | { type: 'recover' | 'clear-stats' } | null

export function useSudoku() {
  const [screen, setScreen] = useState<Screen>('home')
  const onRestore = useCallback((game: GameState | null) => setScreen(game?.status === 'completed' ? 'game' : 'home'), [])
  const session = useSavedSession(onRestore)
  const { game, current, usedIds, update, dispatch } = session
  const [generation, setGeneration] = useState<Generation>({ status: 'idle' })
  const [confirmation, setConfirmation] = useState<Confirmation>(null)
  const pending = useRef<AbortController | null>(null)
  const [importCandidate, setImportCandidate] = useState<SavedData | null>(null)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [clearError, setClearError] = useState<string | null>(null)
  const [readingBackup, setReadingBackup] = useState(false)
  const fileRead = useRef(0)
  const cancelGeneration = useCallback(() => {
    pending.current?.abort()
    pending.current = null
    setGeneration({ status: 'idle' })
  }, [])

  useEffect(() => {
    return () => {
      pending.current?.abort()
      pending.current = null
    }
  }, [])

  const generate = async (level: LogicalLevel) => {
    if (pending.current) return
    void requestPersistentStorage()
    const controller = new AbortController()
    pending.current = controller
    setGeneration({ status: 'loading', level })
    try {
      const result = await requestPuzzle(level, { signal: controller.signal, usedPuzzleIds: usedIds.current })
      if (controller.signal.aborted || pending.current !== controller) return
      if (result.status !== 'success') {
        setGeneration({ status: 'error', level, message: GENERATION_RETRY_MESSAGE })
        return
      }
      const fresh = createGame(result.puzzle, crypto.randomUUID())
      session.rememberId(result.puzzle.id)
      update(() => document.hidden ? fresh : reduceGame(fresh, { type: 'resume', now: performance.now() }))
      setScreen('game')
      setGeneration({ status: 'idle' })
    } catch (error) {
      if (controller.signal.aborted || pending.current !== controller) return
      setGeneration({ status: 'error', level, message: error instanceof DOMException && error.name === 'TimeoutError'
        ? GENERATION_RETRY_MESSAGE : 'NO SE HA PODIDO GENERAR EL SUDOKU. VUELVE A INTENTARLO.' })
    } finally {
      if (pending.current === controller) pending.current = null
    }
  }

  const home = () => {
    cancelGeneration()
    setConfirmation(null)
    fileRead.current++
    setImportCandidate(null)
    setReadingBackup(false)
    setBackupError(null)
    update(value => value?.status === 'completed' ? null
      : value ? reduceGame(value, { type: 'leave', now: performance.now() }) : null)
    setScreen('home')
  }
  const chooseLevel = (level: LogicalLevel) => {
    if (current.current && current.current.status !== 'completed') setConfirmation({ type: 'replace', level })
    else void generate(level)
  }
  const askRestart = () => {
    const resumeOnClose = current.current?.status === 'playing'
    dispatch({ type: 'pause', now: performance.now() })
    setConfirmation({ type: 'restart', resumeOnClose })
  }
  const closeConfirmation = (confirmed: boolean) => {
    const dialog = confirmation
    if (dialog?.type === 'clear-stats' && confirmed && !session.clearStatistics()) {
      setClearError('NO SE HAN PODIDO BORRAR LAS ESTADÍSTICAS. LOS DATOS SE CONSERVAN.')
      return
    }
    setClearError(null)
    setConfirmation(null)
    if (dialog?.type === 'replace' && confirmed) void generate(dialog.level)
    if (dialog?.type === 'recover' && confirmed) {
      cancelGeneration()
      session.reload()
    }
    if (dialog?.type === 'restart') {
      if (confirmed) dispatch({ type: 'restart', attemptId: crypto.randomUUID(), now: performance.now() })
      if (dialog.resumeOnClose && !document.hidden) dispatch({ type: 'resume', now: performance.now() })
    }
  }

  return {
    screen, game, generation, confirmation, dispatch, home, chooseLevel, askRestart, closeConfirmation,
    loaded: session.loaded, settings: session.settings, storageIssue: session.issue,
    prepareUpdate: session.persist,
    completedGames: session.completedGames, clearError,
    openStatistics: () => {
      update(value => value?.status === 'completed' ? null
        : value ? reduceGame(value, { type: 'leave', now: performance.now() }) : null)
      setScreen('stats')
    },
    openHistory: () => setScreen('history'),
    askClearStatistics: () => { setClearError(null); setConfirmation({ type: 'clear-stats' }) },
    openSettings: () => { setBackupError(null); setScreen('settings') },
    setDetectErrors: session.setDetectErrors,
    retryStorage: () => {
      fileRead.current++
      setReadingBackup(false)
      setImportCandidate(null)
      if (session.issue === 'write') session.persist()
      else setConfirmation({ type: 'recover' })
    },
    importCandidate, backupError, readingBackup,
    readBackup: async (file: File) => {
      const token = ++fileRead.current
      setReadingBackup(true)
      setBackupError(null)
      try {
        const saved = await readBackup(file)
        if (token === fileRead.current) setImportCandidate(saved)
      } catch {
        if (token === fileRead.current) setBackupError('COPIA NO VÁLIDA O INCOMPATIBLE. TUS DATOS NO SE HAN MODIFICADO.')
      } finally {
        if (token === fileRead.current) setReadingBackup(false)
      }
    },
    closeImport: (confirmed: boolean) => {
      if (!confirmed) { setImportCandidate(null); setBackupError(null); return }
      if (importCandidate && session.importData(importCandidate)) {
        cancelGeneration()
        setImportCandidate(null)
        setBackupError(null)
      } else setBackupError('NO SE HA PODIDO IMPORTAR LA COPIA. LOS DATOS ANTERIORES SE CONSERVAN.')
    },
    canExportRecovery: session.recoveryText() !== null,
    exportBackup: (recovery = false) => {
      try {
        const text = recovery ? session.recoveryText() : serializeSavedData(session.snapshot())
        if (text === null) throw new Error('No readable stored data')
        downloadBackup(text, recovery ? 'sudoku-recuperacion.json' : 'sudoku-copia.json')
        setBackupError(null)
      } catch { setBackupError('NO SE HA PODIDO EXPORTAR LA COPIA. VUELVE A INTENTARLO.') }
    },
    cancelGeneration, retry: () => { if (generation.status === 'error') void generate(generation.level) },
    newGame: () => {
      cancelGeneration()
      update(value => value?.status === 'completed' ? null
        : value ? reduceGame(value, { type: 'leave', now: performance.now() }) : null)
      setScreen('levels')
    },
    continueGame: () => {
      if (!current.current || document.hidden) return
      dispatch({ type: 'resume', now: performance.now() })
      setScreen('game')
    },
  }
}
