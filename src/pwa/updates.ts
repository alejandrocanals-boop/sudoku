import { registerSW } from 'virtual:pwa-register'
import { createUpdateController } from './update-controller'

export const pwaUpdates = createUpdateController({ register: registerSW, reload: () => window.location.reload() })
