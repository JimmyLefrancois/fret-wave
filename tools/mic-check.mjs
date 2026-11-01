/**
 * Vérification de l'entrée audio : **micro simulé par un fichier**, sur la séance de révision.
 *
 * Chromium sait se faire passer pour un périphérique d'entrée (`--use-file-for-fake-audio-capture`) :
 * on lui donne un WAV de guitare — ici de **vrais échantillons** de la banque nylon, concaténés par
 * `tools/make-mic-fixtures.sh` — et il le rejoue en boucle comme s'il venait d'un micro.
 *
 * Ce que ça prouve : getUserMedia → AudioWorklet → `pitchy` → note stabilisée → case remplie → tentative
 * journalisée → carte Leitner déplacée. Ce que ça ne prouve **pas** : la vraie guitare, le vrai micro,
 * la vraie latence, le bruit de la pièce (voir PROJECT.md §12 et MUSIC_DESIGN §14).
 *
 *   tools/make-mic-fixtures.sh
 *   node tools/mic-check.mjs "$(pwd)/.shots/mic/box.wav" --seconds 90
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const WAV = args.find((a) => a.endsWith('.wav'));
if (!WAV) {
  console.error('usage : node tools/mic-check.mjs <fichier.wav> [--seconds 90] [--width 1440]');
  process.exit(1);
}
const BASE = arg('base', 'http://127.0.0.1:5173');
const SECONDS = Number(arg('seconds', 90));
const WIDTH = Number(arg('width', 1440));

const browser = await chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${WAV}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const context = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, locale: 'fr-FR', permissions: ['microphone'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// une forme due : box 1 de La mineur pentatonique, réussie il y a dix jours
await page.goto(`${BASE}/#/gammes`, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const ts = Date.now() - 10 * 86_400_000;
  const attempt = {
    id: 'mic-check', ts, kind: 'recall', scaleId: 'pentatonic-minor', tonic: 'A', tuningId: 'standard', system: 'boxes',
    positionId: 'boxes:0', formIndex: 0, level: 3, strings: 6, correct: 23, total: 23, seconds: 60, fretMin: 5,
    missedStrings: [], tempoOk: false, fullPosition: true,
  };
  localStorage.setItem('fretwave.attempts.v1', JSON.stringify({ v: 1, attempts: [attempt] }));
  localStorage.setItem('fretwave.scale.v1', JSON.stringify({ scaleId: 'pentatonic-minor', tonic: 'A', tuningId: 'standard', system: 'boxes', positionIndex: 0 }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Réviser cette forme/ }).click();
await page.waitForFunction(() => window.__review?.total > 0);
await page.evaluate(() => window.__review.mic.set(true));
await page.waitForFunction(() => window.__review.mic.state() === 'listening', null, { timeout: 20000 });
console.log(`micro ouvert, ${await page.evaluate(() => window.__review.total)} notes à jouer`);

const end = Date.now() + SECONDS * 1000;
let last = -1;
while (Date.now() < end) {
  const s = await page.evaluate(() => ({ done: window.__review.done, total: window.__review.total, result: window.__review.result }));
  if (s.done !== last) {
    console.log(`  ${s.done} / ${s.total}`);
    last = s.done;
  }
  if (s.result) break;
  await page.waitForTimeout(500);
}
const out = await page.evaluate(() => {
  const list = JSON.parse(localStorage.getItem('fretwave.attempts.v1')).attempts;
  return { result: window.__review.result, marks: Object.values(window.__review.marks), attempts: list.length, last: list[list.length - 1] };
});
console.log('résultat :', JSON.stringify(out.result));
console.log('tentative :', JSON.stringify(out.last));
console.log('erreurs console :', errors.length ? errors : 'aucune');
await browser.close();
process.exit(out.result && out.last.mic === true && errors.length === 0 ? 0 : 1);
