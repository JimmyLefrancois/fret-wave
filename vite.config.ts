import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // PWA hors ligne complète, sons compris (D118). `prompt` : c'est `src/app/pwa.ts` qui décide quand recharger.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/',
        name: 'Fretwave',
        short_name: 'Fretwave',
        description: "Apprends la guitare : tablature en pixel art, écoute au micro et répétition espacée.",
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0D0221',
        theme_color: '#0D0221',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,flac,json,png}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Une navigation vers l'API doit atteindre le Worker, pas l'app en cache.
        navigateFallbackDenylist: [/^\/api\//],
        clientsClaim: true,
      },
    }),
  ],
  test: { include: ['tests/**/*.test.ts'] },
});
