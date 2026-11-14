import { useEffect, useLayoutEffect, useState } from 'react'
import { pwaUpdates } from './updates'

export function UpdateNotice({ allowed, onSave }: { allowed: boolean; onSave: () => boolean }) {
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  useLayoutEffect(() => {
    pwaUpdates.setAllowed(allowed)
    return () => pwaUpdates.setAllowed(false)
  }, [allowed])
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    const unsubscribe = pwaUpdates.subscribe(setReady)
    pwaUpdates.start()
    return unsubscribe
  }, [])
  if (!allowed || !ready) return null
  return <aside className="update-notice" role="status">
    <p>{failed ? 'NO SE HA PODIDO ACTUALIZAR. VUELVE A INTENTARLO.' : 'ACTUALIZACIÓN DISPONIBLE.'}</p>
    <button className="button outline" onClick={() => {
      setFailed(false)
      void pwaUpdates.apply(onSave).catch(() => setFailed(true))
    }}>ACTUALIZAR</button>
  </aside>
}
