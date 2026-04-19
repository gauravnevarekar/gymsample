import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Gym Management',
        short_name: 'GymPWA',
        description: 'Manage Gym Member subcriptions, payments, and expenses',
        theme_color: '#fd8b00',
        background_color: '#0e0e0f',
        display: 'standalone',
        icons: [
          {
            src: 'https://raw.githubusercontent.com/vitejs/vite/main/docs/images/vite.svg', // generic placeholder
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'https://raw.githubusercontent.com/vitejs/vite/main/docs/images/vite.svg', // generic placeholder
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ]
})
