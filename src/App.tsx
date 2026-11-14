import { formatElapsedTime } from './game/state'
import { Dialog } from './ui/Dialog'
import { Difficulty } from './ui/Difficulty'
import { Game } from './ui/Game'
import { Home } from './ui/Home'
import { Icon } from './ui/Icon'
import { levelLabel } from './ui/levels'
import { useSudoku } from './ui/useSudoku'
import { Settings } from './ui/Settings'
import { History, Statistics } from './ui/Statistics'
import { UpdateNotice } from './pwa/UpdateNotice'
import './styles.css'

function App() {
  const app = useSudoku()
  const completed = app.screen === 'game' && app.game?.status === 'completed' ? app.game : null
  if (!app.loaded) return <main className="app-shell"><p role="status">RECUPERANDO DATOS…</p></main>
  const storageNotice = app.storageIssue && <aside className="storage-issue" role="alert">
      <p>{app.storageIssue === 'write' ? 'NO SE HAN PODIDO GUARDAR LOS CAMBIOS. PUEDES EXPORTAR UNA COPIA DESDE AJUSTES.'
        : 'NO SE HAN PODIDO RECUPERAR LOS DATOS GUARDADOS O HAN CAMBIADO EN OTRA PESTAÑA. SE CONSERVAN SIN MODIFICAR.'}</p>
      <button className="plain" onClick={app.retryStorage}>REINTENTAR</button>
    </aside>
  return <main className={`app-shell${app.screen === 'game' && app.game ? ' app-shell-game' : ''}`}>
    <UpdateNotice allowed={app.screen === 'home' && !app.game && !app.storageIssue && !app.confirmation}
      onSave={app.prepareUpdate} />
    {app.screen !== 'game' && storageNotice}
    {app.screen === 'home' && <Home canContinue={!!app.game && app.game.status !== 'completed'}
      onContinue={app.continueGame} onNewGame={app.newGame} onSettings={app.openSettings} onStatistics={app.openStatistics} />}
    {app.screen === 'settings' && <Settings detectErrors={app.settings.detectErrors} reading={app.readingBackup}
      error={app.backupError} recovery={app.storageIssue !== null && app.canExportRecovery}
      hasStatistics={app.completedGames.length > 0} onClear={app.askClearStatistics}
      onBack={app.home} onDetectErrors={app.setDetectErrors} onExport={app.exportBackup} onRead={file => { void app.readBackup(file) }} />}
    {app.screen === 'stats' && <Statistics records={app.completedGames} onBack={app.home} onHistory={app.openHistory} />}
    {app.screen === 'history' && <History records={app.completedGames} onBack={app.openStatistics} />}
    {app.screen === 'levels' && <Difficulty generation={app.generation} onBack={app.home}
      onChoose={app.chooseLevel} onCancel={app.cancelGeneration} onRetry={app.retry} />}
    {app.screen === 'game' && app.game && <Game game={app.game} settings={app.settings}
      notice={storageNotice}
      confirming={app.confirmation !== null} onAction={app.dispatch} onBack={app.home} onRestart={app.askRestart} />}
    {app.confirmation && <Dialog title={app.confirmation.type === 'restart' ? '¿REINICIAR PARTIDA?'
      : app.confirmation.type === 'recover' ? '¿RECUPERAR DATOS GUARDADOS?'
        : app.confirmation.type === 'clear-stats' ? '¿BORRAR ESTADÍSTICAS?' : '¿NUEVA PARTIDA?'}
      onCancel={() => app.closeConfirmation(false)}>
      <p>{app.confirmation.type === 'restart' ? 'SE BORRARÁN LOS NÚMEROS INTRODUCIDOS, EL TIEMPO Y LOS ERRORES.'
        : app.confirmation.type === 'recover' ? 'SE REEMPLAZARÁN LOS CAMBIOS DE ESTA SESIÓN SI LOS DATOS GUARDADOS SON VÁLIDOS.'
          : app.confirmation.type === 'clear-stats' ? 'SE BORRARÁN TODAS LAS ESTADÍSTICAS Y EL HISTORIAL. LA PARTIDA Y LOS AJUSTES SE CONSERVARÁN.'
            : 'LA PARTIDA ACTUAL SE REEMPLAZARÁ CUANDO ESTÉ LISTA LA NUEVA.'}</p>
      {app.clearError && <p role="alert">{app.clearError}</p>}
      <div className="dialog-actions">
        <button className="button outline" autoFocus onClick={() => app.closeConfirmation(false)}>CANCELAR</button>
        <button className="button primary" onClick={() => app.closeConfirmation(true)}>
          {app.confirmation.type === 'restart' ? 'REINICIAR' : app.confirmation.type === 'recover' ? 'RECUPERAR'
            : app.confirmation.type === 'clear-stats' ? 'BORRAR' : 'NUEVA PARTIDA'}
        </button>
      </div>
    </Dialog>}
    {app.importCandidate && <Dialog title="¿IMPORTAR COPIA?" onCancel={() => app.closeImport(false)}>
      <p>SE REEMPLAZARÁN LA PARTIDA, LOS AJUSTES Y EL HISTORIAL GUARDADOS.</p>
      {app.backupError && <p role="alert">{app.backupError}</p>}
      <div className="dialog-actions">
        <button className="button outline" autoFocus onClick={() => app.closeImport(false)}>CANCELAR</button>
        <button className="button primary" onClick={() => app.closeImport(true)}>IMPORTAR</button>
      </div>
    </Dialog>}
    {completed && <Dialog title="¡ENHORABUENA!" onCancel={app.home}>
      <div className="completion-check"><Icon name="check" /></div>
      <p>SUDOKU COMPLETADO</p>
      <p>{levelLabel(completed.puzzle.level)}</p>
      <p className="completion-time">{formatElapsedTime(completed.elapsedMs)}</p>
      <p>ERRORES: {completed.errors}</p>
      <div className="dialog-actions">
        <button className="button primary" onClick={app.newGame}>NUEVA PARTIDA</button>
        <button className="button outline" onClick={app.home}>VOLVER AL INICIO</button>
        <button className="plain" onClick={app.openStatistics}>ESTADÍSTICAS</button>
      </div>
    </Dialog>}
  </main>
}

export default App
