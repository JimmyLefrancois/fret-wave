/**
 * Vérification de l'accordeur et de la calibration (phase 3), micro simulé par un WAV.
 *
 *   node tools/tuner-check.mjs .shots/mic/box.wav [--width 390]
 *
 * Ce qui est vérifié : ouverture du micro au clic, note affichée (nom + cents), corde reconnue,
 * mesure du plancher de bruit, mesure de latence (réponse honnête quand aucun clic ne revient,
 * ce qui est justement le cas d'un périphérique simulé).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const WAV = args.find((a) => a.endsWith('.wav'));
if (!WAV) {
  console.error('usage : node tools/tuner-check.mjs <fichier.wav> [--width 390]');
  process.exit(1);
}
const BASE = arg('base', 'http://127.0.0.1:5173');
const WIDTH = Number(arg('width', 390));
const HEIGHT = Number(arg('height', 844));
const OUT = arg('out', '.shots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${WAV}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: WIDTH < 700 ? 2 : 1,
  locale: 'fr-FR',
  permissions: ['microphone'],
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`${BASE}/#/accordeur`, { waitUntil: 'networkidle' });
await page.waitForSelector('.shell', { timeout: 20000 });
await page.waitForTimeout(600);

console.log('tags avant :', await page.locator('.page-head .tag').first().textContent());

await page.getByRole('button', { name: 'Activer l’écoute' }).click();
await page.waitForTimeout(2500);

const read = async () => page.evaluate(() => {
  const q = (s) => document.querySelector(s)?.textContent?.trim() ?? null;
  return {
    tag: q('.page-head .tag'),
    state: q('.mic-state'),
    db: q('.mic-db'),
    pill: q('.mic-pill'),
    cents: q('.mic-cents'),
    string: q('.mic-string'),
    active: q('.tuner-row.on .tuner-label'),
    status: q('.tuner-row.on .tuner-status'),
    message: q('.calib-msg'),
    devices: [...document.querySelectorAll('select option')].map((o) => o.textContent?.trim()),
  };
});
console.log('après ouverture :', JSON.stringify(await read()));

// plusieurs relevés : la boucle du WAV fait défiler des notes différentes
const samples = [];
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(700);
  const r = await read();
  samples.push(`${r.pill ?? '—'} ${r.cents ?? ''} ${r.active ? `(${r.active} ${r.status ?? ''})` : ''}`);
}
console.log('relevés :', samples.join(' | '));

await page.screenshot({ path: `${OUT}/accordeur-${WIDTH}x${HEIGHT}.png`, fullPage: true });

await page.getByRole('button', { name: /Mesurer le silence/ }).click();
await page.waitForTimeout(2600);
const noise = await page.locator('.field', { hasText: 'Seuil de détection' }).textContent();
console.log('bruit :', noise?.replace(/\s+/g, ' ').trim());

await page.getByRole('button', { name: /Mesurer \(5 clics\)/ }).click();
await page.waitForTimeout(7200);
const after = await read();
console.log('après latence :', JSON.stringify(after));
console.log('badge latence :', await page.locator('.panel', { hasText: 'Latence' }).locator('.badge').first().textContent());
await page.screenshot({ path: `${OUT}/accordeur-${WIDTH}x${HEIGHT}-apres.png`, fullPage: true });

if (errors.length) {
  console.log('--- erreurs console ---');
  for (const e of [...new Set(errors)].slice(0, 10)) console.log(e);
} else {
  console.log('aucune erreur console');
}
await browser.close();
