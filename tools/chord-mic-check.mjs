/**
 * Vérification du module Accords **au micro simulé** (phase 4a) — outil de développement, jamais exécuté
 * par les tests. Suppose `npm run dev` déjà lancé et le fichier WAV construit par
 * `tools/make-mic-fixtures.sh` (ou à la main : E2 B2 E3 G3 B3 E4, l'arpège de Mi mineur).
 *
 *   node tools/chord-mic-check.mjs .shots/mic/em.wav
 *
 * Ce que ça prouve : la leçon écoute vraiment — le micro simulé joue les six cordes de Mi mineur dans
 * l'ordre, la liste de vérification se remplit, la tentative part au journal en `arpeggio` **vérifié**,
 * avec un score de 6/6. Ce que ça ne prouve pas : une vraie guitare, un vrai micro, une vraie pièce.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const WAV = process.argv[2];
if (!WAV) {
  console.error('usage : node tools/chord-mic-check.mjs <fichier.wav> [--hash #/accords/lecon] [--seconds 25]');
  process.exit(1);
}
const BASE = 'http://127.0.0.1:5173';
const HASH = process.argv.includes('--hash') ? process.argv[process.argv.indexOf('--hash') + 1] : '#/accords/lecon';
const SECONDS = Number(process.argv.includes('--seconds') ? process.argv[process.argv.indexOf('--seconds') + 1] : 25);
const OUT = '.shots/mic';
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
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'fr-FR',
  permissions: ['microphone'],
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`${BASE}/${HASH}`, { waitUntil: 'networkidle' });
await page.waitForSelector('.shell', { timeout: 20000 });
await page.evaluate(() => localStorage.removeItem('fretwave.attempts.v1'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.shell');

// étape Vérifier
await page.getByRole('button', { name: /03 Vérifier/ }).first().click();
await page.waitForTimeout(200);
// micro : clic réel (geste utilisateur exigé par le navigateur)
await page.getByRole('switch', { name: /^Micro/ }).first().click();

const started = Date.now();
let rows = [];
const messages = new Set();
while ((Date.now() - started) / 1000 < SECONDS) {
  await page.waitForTimeout(400);
  // tous les conseils affichés (cause + action) : c'est la sortie pédagogique du diagnostic
  for (const m of await page.locator('p.t-small.ok, p.t-small.ko').allTextContents()) messages.add(m.trim());
  rows = await page.evaluate(() => [...document.querySelectorAll('.check-row')].map((r) => ({
    text: r.querySelector('.check-body')?.textContent?.trim().slice(0, 40),
    state: r.className.replace('check-row', '').trim(),
    tag: r.querySelector('.tag')?.textContent?.trim(),
  })));
  const done = await page.evaluate(() => Boolean(document.querySelector('.stat-line')?.textContent?.includes('/')));
  if (done && rows.every((r) => r.state !== 'now' && r.tag && r.tag !== 'à jouer')) break;
}

await page.screenshot({ path: `${OUT}/chord-verifier.png`, fullPage: true });

const result = await page.evaluate(() => {
  const stat = document.querySelector('.stat-line')?.textContent?.trim() ?? '';
  const raw = localStorage.getItem('fretwave.attempts.v1');
  const attempts = raw ? (JSON.parse(raw).attempts ?? []) : [];
  return {
    stat,
    last: attempts[attempts.length - 1] ?? null,
    count: attempts.length,
  };
});

console.log(JSON.stringify({ rows, messages: [...messages], result, errors }, null, 2));
await browser.close();
