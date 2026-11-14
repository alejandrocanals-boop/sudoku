import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolveBasePath } from './config/base-path.ts'

const base = resolveBasePath(process.env.VITE_BASE_PATH)
export default defineConfig({
  base,
  plugins: [react(), VitePWA({
    registerType: 'prompt', injectRegister: false,
    scope: base,
    includeAssets: ['icons/*.png', 'icons/sudoku.svg'],
    manifest: {
      id: base, name: 'SUDOKU', short_name: 'SUDOKU', lang: 'es',
      description: 'SUDOKU EN ESPAÑOL. CUATRO NIVELES PARA JUGAR SIN CONEXIÓN.',
      start_url: base, scope: base, display: 'standalone', orientation: 'portrait',
      theme_color: '#F3F6FB', background_color: '#F3F6FB',
      icons: [
        { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{html,js,css}'],
      navigateFallback: `${base}index.html`,
      cleanupOutdatedCaches: true, skipWaiting: false, clientsClaim: true,
      sourcemap: true,
    },
    devOptions: { enabled: false },
  })],
})
