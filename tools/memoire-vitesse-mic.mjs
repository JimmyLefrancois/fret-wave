/**
 * Lot « mémoire et vitesse » — chemins **au micro simulé** (Chromium rejoue un WAV comme un micro).
 * Outil de développement, hors `npm test`. Suppose `npm run dev` lancé et les fixtures construites :
 *
 *   node tools/make-memoire-fixtures.mjs .shots/mic
 *   node tools/memoire-vitesse-mic.mjs blind .shots/mic/blind-box.wav --tempo 60
 *   node tools/memoire-vitesse-mic.mjs blind .shots/mic/blind-box-lent.wav --tempo 60
 *
 * `blind` : N3 de la box 1 (position entière), micro ouvert, série à l'aveugle lancée. Pendant la série,
 * on vérifie qu'**aucun canvas de tablature n'est monté** ; à la fin, la tentative du journal (`mic`,
 * `blind`, `gridNpm`, `tempoOk`, justes / total, cordes fautives).
 *
 * Ce que ça ne prouve pas : la vraie guitare, le vrai micro, la latence réelle (son de synthèse).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const SCENARIO = args[0];
const WAV = args.find((a) => a.endsWith('.wav'));
if (!SCENARIO || !WAV) {
  console.error('usage : node tools/memoire-vitesse-mic.mjs <blind|sequence> <fichier.wav> [--tempo 60] [--seconds 40]');
  process.exit(1);
}
const BASE = process.env.BASE ?? 'http://localhost:5173';
const SHOTS = process.env.SHOTS ?? '.shots/memoire-vitesse';
const TEMPO = Number(arg('tempo', 60));
const SECONDS = Number(arg('seconds', 40));
const WIDTH = Number(arg('width', 390));
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${WAV}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const context = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, locale: 'fr-FR', permissions: ['microphone'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// état de départ connu : journal vide, box 1 de La mineur pentatonique, grille en noires
await page.goto(`${BASE}/#/hub`);
await page.evaluate((tempo) => {
  localStorage.clear();
  localStorage.setItem('fretwave.scale.v1', JSON.stringify({ scaleId: 'pentatonic-minor', tonic: 'A', tuningId: 'standard', system: 'boxes', positionIndex: 0 }));
  const s = JSON.parse(localStorage.getItem('fretwave.settings.v1') ?? '{}');
  localStorage.setItem('fretwave.settings.v1', JSON.stringify({ ...s, trainingTempo: tempo, gridSubdivision: 1 }));
}, TEMPO);
await page.reload(); // les réglages sont lus une fois au chargement : on recharge après les avoir écrits

const lastAttempt = () => page.evaluate(() => {
  const list = JSON.parse(localStorage.getItem('fretwave.attempts.v1') ?? '{"attempts":[]}').attempts ?? [];
  return list[list.length - 1] ?? null;
});

if (SCENARIO === 'blind') {
  await page.goto(`${BASE}/#/gammes/entrainement`);
  await page.waitForFunction(() => window.__training?.exercise);
  await page.getByRole('button', { name: 'N3 · rappel' }).click();
  // position entière : le découpage « montée » est dans les réglages de la série
  await page.locator('details.adv-settings > summary').click();
  await page.getByRole('button', { name: /^montée/ }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: /Ouvrir le micro/ }).click();
  await page.waitForFunction(() => window.__training?.mic?.state?.() === 'listening', null, { timeout: 20000 });
  const sw = page.getByRole('switch', { name: /À l’aveugle/ });
  console.log('interrupteur actif :', await sw.isEnabled());
  await sw.click();
  await page.getByRole('button', { name: /Lancer à l’aveugle/ }).click();
  const t0 = Date.now();
  let checkedTab = false;
  while (Date.now() - t0 < SECONDS * 1000) {
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => ({
      phase: window.__training.blind.phase,
      heard: window.__training.blind.heard(),
      canvases: document.querySelectorAll('main canvas').length,
      count: document.querySelector('.blind-count')?.textContent ?? null,
      result: window.__training.result,
    }));
    if (!checkedTab && st.phase !== 'idle') {
      console.log('pendant la série : canvas montés =', st.canvases, '· décompte =', st.count);
      await page.screenshot({ path: `${SHOTS}/blind-pendant.png`, fullPage: true });
      checkedTab = true;
    }
    if (st.result) break;
  }
  // un élève qui s'arrête : « Terminer »
  if (!(await page.evaluate(() => window.__training.result))) {
    console.log('fin du temps d’écoute : Terminer');
    await page.evaluate(() => window.__training.blind.finish());
    await page.waitForTimeout(300);
  }
  const res = await page.evaluate(() => ({ result: window.__training.result, canvases: document.querySelectorAll('main canvas').length }));
  console.log('résultat :', JSON.stringify(res.result), '· canvas après =', res.canvases);
  const a = await lastAttempt();
  console.log('tentative :', JSON.stringify({
    kind: a?.kind, level: a?.level, correct: a?.correct, total: a?.total, mic: a?.mic ?? null, blind: a?.blind ?? null,
    fullPosition: a?.fullPosition ?? null, gridNpm: a?.gridNpm ?? null, tempoOk: a?.tempoOk, missedStrings: a?.missedStrings,
  }));
  const log = await page.evaluate(() => window.__training.blind.log());
  console.log('entendues :', log.heard.map((h) => `${Math.round(h.midi)}@${h.t.toFixed(2)}`).join(' '));
  console.log('masquées (clic) :', log.masked.map((h) => `${h.midi}@${h.t.toFixed(2)}`).join(' ') || 'aucune');
  await page.screenshot({ path: `${SHOTS}/blind-fin.png`, fullPage: true });
}

console.log('erreurs console :', errors.length ? [...new Set(errors)].slice(0, 8) : 'aucune');
await browser.close();
