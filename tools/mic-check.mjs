/**
 * Vérification de l'entrée audio (phase 3) : **micro simulé par un fichier**.
 *
 * Chromium sait se faire passer pour un périphérique d'entrée (`--use-file-for-fake-audio-capture`) :
 * on lui donne un WAV de guitare — ici de **vrais échantillons** de la banque nylon, concaténés par
 * `tools/make-mic-fixtures.sh` — et il le rejoue en boucle comme s'il venait d'un micro.
 *
 * Ce que ça prouve : getUserMedia → AudioWorklet → `pitchy` → note stabilisée → case remplie →
 * tentative journalisée. Ce que ça ne prouve **pas** : la vraie guitare, le vrai micro, la vraie
 * latence, le bruit de la pièce (voir PROJECT.md §12 et MUSIC_DESIGN §14).
 *
 *   node tools/mic-check.mjs .shots/mic/strings2.wav
 *   node tools/mic-check.mjs .shots/mic/box.wav --hash '#/gammes/entrainement' --seconds 30
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
  console.error('usage : node tools/mic-check.mjs <fichier.wav> [--hash …] [--seconds 20] [--width 390]');
  process.exit(1);
}
const BASE = arg('base', 'http://127.0.0.1:5173');
const HASH = arg('hash', '#/gammes/entrainement');
const SECONDS = Number(arg('seconds', 20));
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

await page.goto(`${BASE}/${HASH}`, { waitUntil: 'networkidle' });
await page.waitForSelector('.shell', { timeout: 20000 });
await page.waitForTimeout(800);

const hooks = await page.evaluate(() => Boolean(window.__training));
if (!hooks) {
  console.error('crochet __training absent (page d’entraînement attendue)');
  await browser.close();
  process.exit(1);
}

const before = await page.evaluate(() => ({
  total: window.__training.total,
  done: window.__training.done,
  holes: window.__training.exercise.holes.map((h) => ({ key: h.key, string: h.string, fret: h.fret, fn: h.fn })),
}));
console.log('avant :', JSON.stringify(before));

// la bascule du micro est un vrai clic (elle doit rester dans le geste utilisateur)
const toggle = page.locator('button.switch', { hasText: 'Micro' }).first();
await toggle.click();
await page.waitForFunction(() => window.__training?.mic?.state?.() === 'listening', null, { timeout: 20000 }).catch(() => {});
const state = await page.evaluate(() => window.__training.mic.state());
console.log('état du micro :', state);
if (state !== 'listening') {
  const msg = await page.locator('.verdict').textContent().catch(() => null);
  console.log('message :', msg);
  await page.screenshot({ path: `${OUT}/mic-echec-${WIDTH}x${HEIGHT}.png`, fullPage: true });
  await browser.close();
  process.exit(2);
}

if (args.includes('--grid')) {
  // la grille démarre au clic (elle programme le métronome) : c'est le cas « tempo mesuré au jeu »
  await page.getByRole('button', { name: /Grille \(métronome\)/ }).click();
  console.log('grille lancée');
}

const seen = [];
for (let s = 0; s < SECONDS; s++) {
  await page.waitForTimeout(1000);
  const snap = await page.evaluate(() => ({
    done: window.__training.done,
    total: window.__training.total,
    marks: window.__training.marks,
    last: (() => {
      const f = window.__training.mic.last();
      return f ? { hz: Math.round(f.hz * 10) / 10, midi: f.midi, cents: Math.round(f.cents), stable: f.stable?.midi ?? null } : null;
    })(),
    feedback: document.querySelector('.verdict')?.textContent ?? null,
  }));
  seen.push(snap);
  console.log(`t+${s + 1}s`, JSON.stringify(snap));
  if (snap.done === snap.total && snap.total > 0) break;
}

const after = await page.evaluate(() => ({
  done: window.__training.done,
  total: window.__training.total,
  marks: window.__training.marks,
  result: window.__training.result,
  journalLength: window.__training.journalLength,
  attempt: (() => {
    try {
      const raw = JSON.parse(localStorage.getItem('fretwave.attempts.v1') ?? 'null');
      const list = Array.isArray(raw) ? raw : (raw?.attempts ?? []);
      return list[list.length - 1] ?? null;
    } catch {
      return null;
    }
  })(),
}));
console.log('après :', JSON.stringify(after));

const distinctHeard = new Set(seen.map((s) => s.last?.stable).filter((v) => v !== null && v !== undefined));
console.log('notes distinctes entendues :', [...distinctHeard].join(', '));

await page.screenshot({ path: `${OUT}/mic-${WIDTH}x${HEIGHT}.png`, fullPage: true });
await page.screenshot({ path: `${OUT}/mic-${WIDTH}x${HEIGHT}-fold.png` });
if (errors.length) {
  console.log('--- erreurs console ---');
  for (const e of [...new Set(errors)].slice(0, 10)) console.log(e);
}
await browser.close();
