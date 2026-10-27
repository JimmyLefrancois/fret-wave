/**
 * Captures de vérification (Playwright). Outil de développement, comme tools/build-samples.mjs :
 * jamais exécuté par les tests. Suppose `npm run dev` déjà lancé.
 *
 *   node tools/screenshot.mjs                     -> toutes les pages, 1440×900 et 390×844
 *   node tools/screenshot.mjs --only n1 --width 1440 --height 900
 *
 * Les images vont dans .shots/ (ignoré par git).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const BASE = arg('base', 'http://127.0.0.1:5173');
const OUT = arg('out', '.shots');
const ONLY = arg('only', null);
const WIDTH = Number(arg('width', 1440));
const HEIGHT = Number(arg('height', 900));

const PAGES = [
  { id: 'hub', hash: '#/hub' },
  { id: 'gammes', hash: '#/gammes' },
  { id: 'n1', hash: '#/gammes/jouer' },
  { id: 'reglages', hash: '#/reglages' },
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: WIDTH < 700 ? 2 : 1,
  isMobile: WIDTH < 700,
  hasTouch: WIDTH < 700,
  locale: 'fr-FR',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

for (const p of PAGES) {
  if (ONLY && p.id !== ONLY) continue;
  await page.goto(`${BASE}/${p.hash}`, { waitUntil: 'networkidle' });
  // le préchargement audio passe par un écran de chargement : on attend l'UI
  await page.waitForSelector('.shell', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  const label = `${p.id}-${WIDTH}x${HEIGHT}`;
  await page.screenshot({ path: `${OUT}/${label}.png` });
  await page.screenshot({ path: `${OUT}/${label}-full.png`, fullPage: true });
  console.log('shot', label);
}

if (errors.length) {
  console.log('--- erreurs page ---');
  for (const e of [...new Set(errors)].slice(0, 10)) console.log(e);
} else {
  console.log('aucune erreur console');
}

await browser.close();
