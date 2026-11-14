import { useEffect, useState, type ReactNode } from 'react'
import { disabledDigits, visibleErrorCount } from '../game/selectors'
import { elapsedTimeMs, formatElapsedTime, type GameAction, type GameSettings, type GameState } from '../game/state'
import { Board } from './Board'
import { Icon } from './Icon'
import { levelLabel } from './levels'
import { useGameLayout } from './useGameLayout'

export function Game({ game, settings, confirming, notice, onAction, onBack, onRestart }: {
  game: GameState; settings: GameSettings; confirming: boolean
  notice?: ReactNode
  onAction: (action: GameAction) => void; onBack: () => void; onRestart: () => void
}) {
  const [now, setNow] = useState(0)
  const layoutRef = useGameLayout()
  useEffect(() => {
    if (game.status !== 'playing') return
    const timer = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(timer)
  }, [game.status])
  const active = game.status === 'playing'
  const disabled = disabledDigits(game, settings)
  const errors = visibleErrorCount(game, settings)
  const editable = game.selectedCell !== null && game.puzzle.givens[game.selectedCell] === 0
  const time = formatElapsedTime(elapsedTimeMs(game, Math.max(now, game.activeSinceMs ?? 0)))
  return <section className="game" aria-label="PARTIDA" ref={layoutRef}>
    <div className="game-top">
    {notice}
    <header className="game-header">
      <button className="icon-button" aria-label="VOLVER AL INICIO" onClick={onBack}><Icon name="back" /></button>
      <button className="timer" onClick={() => onAction({ type: 'pause', now: performance.now() })}
        disabled={!active} aria-label={`PAUSAR PARTIDA, TIEMPO ${time}`}>
        <span>{time}</span><Icon name="pause" />
      </button>
    </header>
    <h1 className="game-level">{levelLabel(game.puzzle.level)}</h1>
    </div>
    <div className="board-frame">
      {active ? <Board game={game} settings={settings}
        onSelect={cell => onAction({ type: 'select', cell })}
        onDigit={digit => onAction({ type: 'insert', digit, now: performance.now() })}
        onErase={() => onAction({ type: 'erase' })} onUndo={() => onAction({ type: 'undo' })} />
        : <div className="hidden-board" aria-hidden="true" />}
      {!active && !confirming && game.status !== 'completed' && <div className="pause-overlay">
        <p>PARTIDA EN PAUSA</p>
        <button className="button primary" onClick={() => onAction({ type: 'resume', now: performance.now() })}>CONTINUAR</button>
      </div>}
    </div>
    <div className="board-actions">
      <button disabled={!active || game.history.length === 0} onClick={() => onAction({ type: 'undo' })}>
        <Icon name="undo" /><span>DESHACER</span>
      </button>
      <button disabled={!active || !editable || game.entries[game.selectedCell!] === 0} onClick={() => onAction({ type: 'erase' })}>
        <Icon name="erase" /><span>BORRAR</span>
      </button>
    </div>
    <div className="keypad" role="group" aria-label="NÚMEROS">
      {Array.from({ length: 9 }, (_, index) => index + 1).map(digit => <button key={digit}
        disabled={!active || disabled.includes(digit)} aria-label={`INTRODUCIR ${digit}`}
        onClick={() => onAction({ type: 'insert', digit, now: performance.now() })}>{digit}</button>)}
    </div>
    <footer className="game-footer">
      {errors !== null && <span>ERRORES: {errors}</span>}
      <button disabled={!active} onClick={onRestart}>REINICIAR</button>
    </footer>
  </section>
}
