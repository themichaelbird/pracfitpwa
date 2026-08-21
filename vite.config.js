import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Week 11 (PRD 7/9.1): service worker precaches the built app shell so the
// PWA can boot with no network at all -- separate from the app's own
// IndexedDB-backed offline data layer (src/lib/offlineQueue.js), which
// handles session-logging reads/writes once the app is already running.
// generateSW (the default strategy) is sufficient since there's no custom
// runtime caching need beyond precaching -- Supabase calls are handled by
// the app's own online/offline logic, not by the service worker.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Practical Fitness Coach Platform',
        short_name: 'PF Coach',
        description: 'Internal coach platform for Practical Fitness sessions',
        theme_color: '#7e14ff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
