import { useRef } from 'react'
import { Icon } from './Icon'

export function Settings({ detectErrors, reading, error, recovery, hasStatistics, onBack, onDetectErrors, onExport, onRead, onClear }: {
  detectErrors: boolean; reading: boolean; error: string | null; recovery: boolean
  hasStatistics: boolean; onClear: () => void
  onBack: () => void; onDetectErrors: (enabled: boolean) => void
  onExport: (recovery?: boolean) => void; onRead: (file: File) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  return <section aria-label="AJUSTES">
    <header className="page-header">
      <button className="icon-button" aria-label="VOLVER AL INICIO" onClick={onBack}><Icon name="back" /></button>
      <h1>AJUSTES</h1>
    </header>
    <div className="settings-actions">
      <label className="setting-toggle"><span>DETECTAR ERRORES</span>
        <input type="checkbox" role="switch" checked={detectErrors} onChange={event => onDetectErrors(event.target.checked)} />
      </label>
      <button className="button outline" onClick={() => onExport()}>EXPORTAR COPIA</button>
      <button className="button outline" disabled={reading} onClick={() => input.current?.click()}>IMPORTAR COPIA</button>
      <input ref={input} className="file-input" type="file" accept="application/json,.json" aria-label="SELECCIONAR COPIA"
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onRead(file) }} />
      {recovery && <button className="button outline" onClick={() => onExport(true)}>EXPORTAR DATOS GUARDADOS</button>}
      <button className="plain" disabled={!hasStatistics} onClick={onClear}>BORRAR ESTADÍSTICAS</button>
      {reading && <p role="status">COMPROBANDO COPIA…</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  </section>
}
