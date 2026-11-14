import { useRef, type KeyboardEvent } from 'react'
import { cellHighlights, isCellError } from '../game/selectors'
import type { GameSettings, GameState } from '../game/state'

export function Board({ game, settings, onSelect, onDigit, onErase, onUndo }: {
  game: GameState; settings: GameSettings; onSelect: (cell: number) => void
  onDigit: (digit: number) => void; onErase: () => void; onUndo: () => void
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const highlights = cellHighlights(game)
  const keyDown = (event: KeyboardEvent, cell: number) => {
    const row = Math.floor(cell / 9)
    const column = cell % 9
    const targets: Record<string, number> = {
      ArrowLeft: row * 9 + Math.max(0, column - 1), ArrowRight: row * 9 + Math.min(8, column + 1),
      ArrowUp: Math.max(0, row - 1) * 9 + column, ArrowDown: Math.min(8, row + 1) * 9 + column,
      Home: row * 9, End: row * 9 + 8,
    }
    if (event.key in targets) {
      event.preventDefault()
      buttons.current[targets[event.key]!]!.focus()
    } else if (/^[1-9]$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      onDigit(Number(event.key))
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      onErase()
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault()
      onUndo()
    }
  }
  return <div className="board" role="grid" aria-label="SUDOKU" aria-rowcount={9} aria-colcount={9}>
    {Array.from({ length: 9 }, (_, row) => <div className="board-row" role="row" key={row}>
      {Array.from({ length: 9 }, (_, column) => {
        const cell = row * 9 + column
        const digit = game.entries[cell]!
        const given = game.puzzle.givens[cell] !== 0
        const wrong = isCellError(game, cell, settings)
        const selected = highlights.selected === cell
        const className = ['cell', given ? 'cell-given' : 'cell-entry',
          highlights.peers.includes(cell) ? 'cell-peer' : '', highlights.matching.includes(cell) ? 'cell-equal' : '',
          selected ? 'cell-selected' : '', wrong ? 'cell-error' : ''].join(' ')
        return <button role="gridcell" key={cell} className={className}
          ref={element => { buttons.current[cell] = element }}
          aria-rowindex={row + 1} aria-colindex={column + 1} aria-selected={selected} aria-readonly={given}
          aria-invalid={wrong || undefined}
          aria-label={`FILA ${row + 1}, COLUMNA ${column + 1}, ${digit || 'VACÍA'}${given ? ', ORIGINAL' : ''}${wrong ? ', INCORRECTO' : ''}`}
          tabIndex={selected || (highlights.selected === null && cell === 0) ? 0 : -1}
          onClick={() => onSelect(cell)} onFocus={() => onSelect(cell)} onKeyDown={event => keyDown(event, cell)}>
          {digit || ''}
        </button>
      })}
    </div>)}
  </div>
}
