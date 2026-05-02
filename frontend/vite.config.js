import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'WorkSync Pro',
        short_name: 'WorkSync',
        description: 'Daily Work Login and Report Manager',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'https://via.placeholder.com/192/6366f1/ffffff?text=W',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://via.placeholder.com/512/6366f1/ffffff?text=W',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
