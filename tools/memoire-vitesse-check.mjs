/**
 * Lot « mémoire et vitesse » — vérification au navigateur (outil de développement, hors `npm test`).
 * Suppose `npm run dev` déjà lancé (BASE, défaut http://localhost:5173). Captures dans SHOTS.
 *
 *   node tools/memoire-vitesse-check.mjs
 *
 * Chemin 1 — rappel à froid : une carte due s'ouvre en N3 position entière ; tout faux → « Regarde la
 * forme » → rattrapage juste, écrit `afterReveal: true`, 0 XP, aucune fête.
 * Chemin 2 — règles durcies : deux réussites N2 au pavé sur deux jours → le hub annonce une forme
 * « repassée en apprentissage », l'écran d'exercice dit ce qui manque.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:5173';
const SHOTS = process.env.SHOTS ?? '.shots/memoire-vitesse';
mkdirSync(SHOTS, { recursive: true });
const DAY = 86400000;
const now = Date.now();
const mk = (i, daysAgo, correct, total, extra = {}) => ({
  id: `seed-${i}`, ts: now - daysAgo * DAY, kind: 'holes', scaleId: 'pentatonic-minor', tonic: 'A', tuningId: 'standard',
  system: 'boxes', positionId: 'boxes:0', formIndex: 0, level: 2, strings: 2, correct, total, seconds: 20, fretMin: 5,
  missedStrings: [], tempoOk: false, ...extra,
});
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${BASE}/#/hub`);
await page.evaluate((list) => { localStorage.clear(); localStorage.setItem('fretwave.attempts.v1', JSON.stringify({ v: 1, attempts: list })); }, [mk(0, 3, 5, 5)]);
await page.goto(`${BASE}/#/gammes/revision`);
await page.waitForFunction(() => window.__training?.exercise);
const st = () => page.evaluate(() => { const t = window.__training; return { level: t.level, segment: t.segment, total: t.total, cold: t.cold.step, result: t.result, mixed: t.mixed, q: t.queue.map((x) => x.mode + ':' + x.segment) }; });
console.log('start', await st());
console.log('tag', await page.textContent('.page-head .tag'));
// tout faux : deux mauvaises réponses par case (révélée)
const tick = () => page.waitForTimeout(40);
/** Une réponse au pavé : désigner la case, taper, valider — un rendu entre chaque geste. */
async function answer(key, fret) {
  await page.evaluate((k) => window.__training.select(k), key); await tick();
  for (const c of String(fret)) { await page.evaluate((d) => window.__training.press(d), c); await tick(); }
  await page.evaluate(() => window.__training.validate()); await tick();
}
const holes = await page.evaluate(() => window.__training.exercise.holes.map((h) => ({ key: h.key, fret: h.fret })));
for (const h of holes) {
  for (let k = 0; k < 2; k++) await answer(h.key, (h.fret + 1) % 24);
}
console.log('after cold fail', await st());
await page.screenshot({ path: `${SHOTS}/cold-fail.png`, fullPage: true });
await page.getByRole('button', { name: /Regarde la forme/ }).click();
await page.waitForTimeout(600);
console.log('look', (await page.textContent('body')).match(/se masque dans \d+ s/)?.[0]);
await page.getByRole('button', { name: /J’ai vu, masquer/ }).click();
await page.waitForTimeout(300);
console.log('retry', await st());
const holes2 = await page.evaluate(() => window.__training.exercise.holes.map((h) => ({ key: h.key, fret: h.fret })));
for (const h of holes2) await answer(h.key, h.fret);
console.log('after retry', await st());
const j = await page.evaluate(() => JSON.parse(localStorage.getItem('fretwave.attempts.v1')).attempts.map((a) => ({ level: a.level, strings: a.strings, c: a.correct, t: a.total, ar: a.afterReveal ?? null })));
console.log('journal', j);
console.log('celebration?', await page.locator('.celebration, [role=dialog]').count());

// --- chemin 2 : règles durcies
await page.evaluate((list) => localStorage.setItem('fretwave.attempts.v1', JSON.stringify({ v: 1, attempts: list })), [mk(10, 2, 5, 5), mk(11, 1, 5, 5)]);
await page.goto(`${BASE}/#/hub`);
await page.waitForTimeout(800);
const hubText = await page.textContent('body');
console.log('hub notice', hubText.match(/\d+ formes? repassées? en apprentissage[^.]*\./)?.[0] ?? 'ABSENTE');
await page.screenshot({ path: `${SHOTS}/hub-regressed.png`, fullPage: true });
await page.goto(`${BASE}/#/gammes/entrainement`);
await page.waitForFunction(() => window.__training?.exercise);
console.log('state line', (await page.textContent('body')).match(/Cette forme : [^.]*\./)?.[0] ?? 'ABSENTE');

console.log('errors', errors);
await browser.close();
