import type { LogicalLevel } from '../engine/solver'
import { Icon } from './Icon'
import { LEVELS } from './levels'

export function Difficulty({ generation, onBack, onChoose, onCancel, onRetry }: {
  generation: { status: 'idle' } | { status: 'loading'; level: LogicalLevel }
    | { status: 'error'; level: LogicalLevel; message: string }
  onBack: () => void; onChoose: (level: LogicalLevel) => void; onCancel: () => void; onRetry: () => void
}) {
  return <section aria-label="NUEVA PARTIDA">
    <header className="page-header">
      <button className="icon-button" aria-label="VOLVER AL INICIO" onClick={onBack}><Icon name="back" /></button>
      <h1>NUEVA PARTIDA</h1>
    </header>
    {generation.status === 'idle' ? <>
      <p className="difficulty-prompt">ELIGE LA DIFICULTAD</p>
      <div className="level-list">{LEVELS.map((level, index) =>
        <button className="level-button" key={level.value} onClick={() => onChoose(level.value)}>
          <span>{level.label}</span><span className="difficulty-bars" aria-hidden="true">
            {Array.from({ length: index + 1 }, (_, bar) => <i key={bar} style={{ height: `${7 + bar * 6}px` }} />)}
          </span>
        </button>)}
      </div>
    </> : <div className="generation-panel">
      <p role={generation.status === 'error' ? 'alert' : 'status'}>
        {generation.status === 'loading' ? 'GENERANDO SUDOKU…' : generation.message}
      </p>
      {generation.status === 'error' && <button className="button primary" onClick={onRetry}>REINTENTAR</button>}
      <button className="button outline" onClick={onCancel}>CANCELAR</button>
    </div>}
  </section>
}
