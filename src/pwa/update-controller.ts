import type { RegisterSWOptions } from 'vite-plugin-pwa/types'

interface UpdateDependencies {
  register: (options: RegisterSWOptions) => () => Promise<void>
  reload: () => void
}

/** Never let another tab's activation reload this tab without its own safe user action. */
export function createUpdateController({ register, reload }: UpdateDependencies) {
  const listeners = new Set<(ready: boolean) => void>()
  let started = false
  let ready = false
  let allowed = false
  let activated = false
  let authorized = false
  let save: () => boolean = () => false
  let update: (() => Promise<void>) | undefined
  const notify = () => { ready = true; listeners.forEach(listener => listener(true)) }
  return {
    start: () => {
      if (started) return
      started = true
      update = register({
        immediate: true,
        onNeedRefresh: notify,
        onNeedReload: () => {
          activated = true
          if (authorized && allowed && save()) { authorized = false; reload() }
          else { authorized = false; notify() }
        },
      })
    },
    subscribe: (listener: (ready: boolean) => void) => {
      listeners.add(listener)
      listener(ready)
      return () => { listeners.delete(listener) }
    },
    setAllowed: (value: boolean) => { allowed = value },
    apply: async (beforeReload: () => boolean): Promise<void> => {
      if (!ready || !allowed || !beforeReload()) return
      save = beforeReload
      authorized = true
      try {
        if (activated) { authorized = false; if (allowed && save()) reload() }
        else await update?.()
      } catch (error) { authorized = false; throw error }
    },
  }
}
