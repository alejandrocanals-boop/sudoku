import { newestFirst, summarizeStatistics } from '../game/statistics'
import { formatElapsedTime } from '../game/state'
import type { CompletedGame } from '../storage/schema'
import { Icon } from './Icon'
import { levelLabel } from './levels'

const duration = (milliseconds: number | null): string => milliseconds === null ? '—' : formatElapsedTime(milliseconds)

export function Statistics({ records, onBack, onHistory }: {
  records: readonly CompletedGame[]; onBack: () => void; onHistory: () => void
}) {
  const stats = summarizeStatistics(records)
  return <section aria-label="ESTADÍSTICAS">
    <header className="page-header">
      <button className="icon-button" aria-label="VOLVER AL INICIO" onClick={onBack}><Icon name="back" /></button>
      <h1>ESTADÍSTICAS</h1>
    </header>
    <div className="stats-summary">
      <div><strong>{stats.count}</strong><span>RESUELTOS</span></div>
      <div><strong>{formatElapsedTime(stats.totalMs)}</strong><span>TIEMPO TOTAL</span></div>
    </div>
    <div className="stats-levels">{stats.byLevel.map(level => <article className="stat-level" key={level.level} aria-label={levelLabel(level.level)}>
      <div className="stat-heading"><h2>{levelLabel(level.level)}</h2><span>{level.count}</span></div>
      <div className="stat-bar" aria-hidden="true"><span style={{ width: `${stats.maxLevelCount ? level.count / stats.maxLevelCount * 100 : 0}%` }} /></div>
      <div className="stat-times"><span>RÉCORD <strong>{duration(level.bestMs)}</strong></span><span>MEDIA <strong>{duration(level.averageMs)}</strong></span></div>
    </article>)}</div>
    <button className="button outline" onClick={onHistory}>HISTORIAL</button>
  </section>
}

const dates = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' })
export function History({ records, onBack }: { records: readonly CompletedGame[]; onBack: () => void }) {
  return <section aria-label="HISTORIAL">
    <header className="page-header">
      <button className="icon-button" aria-label="VOLVER A ESTADÍSTICAS" onClick={onBack}><Icon name="back" /></button>
      <h1>HISTORIAL</h1>
    </header>
    {records.length === 0 ? <p className="history-empty">NO HAY PARTIDAS COMPLETADAS.</p>
      : <ol className="history-list">{newestFirst(records).map(record => <li key={record.attemptId}>
        <div className="history-heading"><span>{levelLabel(record.level)}</span><time dateTime={record.completedAt}>{dates.format(new Date(record.completedAt)).toLocaleUpperCase('es-ES')}</time></div>
        <div className="history-result"><span>TIEMPO {formatElapsedTime(record.elapsedMs)}</span><span>ERRORES: {record.errors}</span></div>
      </li>)}</ol>}
  </section>
}
