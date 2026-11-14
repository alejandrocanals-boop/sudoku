export function Home({ canContinue, onContinue, onNewGame, onSettings, onStatistics }: {
  canContinue: boolean; onContinue: () => void; onNewGame: () => void; onSettings: () => void; onStatistics: () => void
}) {
  return <section className="home" aria-label="INICIO">
    <h1>SUDOKU</h1>
    <div className="home-grid" aria-hidden="true">
      {[5, '', 3, '', 2, '', '', '', 9].map((digit, index) => <span key={index}>{digit}</span>)}
    </div>
    <div className="home-actions">
      {canContinue && <button className="button primary" onClick={onContinue}>CONTINUAR</button>}
      <button className={`button ${canContinue ? 'outline' : 'primary'}`} onClick={onNewGame}>NUEVA PARTIDA</button>
      <button className="plain" onClick={onStatistics}>ESTADÍSTICAS</button>
      <button className="plain" onClick={onSettings}>AJUSTES</button>
    </div>
  </section>
}
