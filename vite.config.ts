import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * `base` : l'app est servie à la racine en développement et sous `/fret-wave/` sur GitHub Pages
 * (page de projet). Tout ce qui construit une URL d'asset passe par `import.meta.env.BASE_URL` —
 * notamment `sampleBaseUrl` pour les échantillons audio — donc ce seul réglage suffit.
 *
 * Le drapeau `GITHUB_PAGES=1` est posé par le workflow `.github/workflows/deploy.yml`; en local,
 * `npm run build` garde `base = '/'`.
 */
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/fret-wave/' : '/',
  plugins: [react()],
  test: { include: ['tests/**/*.test.ts'] },
});
