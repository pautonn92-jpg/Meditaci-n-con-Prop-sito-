import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// La app se instala en el celular desde el navegador ("Agregar a pantalla de inicio").
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Meditación con propósito',
        short_name: 'Meditación',
        lang: 'es-AR',
        start_url: '/',
        display: 'standalone',
        background_color: '#EEF1F0',
        theme_color: '#3E6B66',
        icons: [
          { src: '/icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      // Los audios no se guardan en caché: son privados y pesados.
      workbox: { navigateFallbackDenylist: [/^\/functions/] },
    }),
  ],
})
