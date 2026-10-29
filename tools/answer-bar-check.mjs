/**
 * Contrôle du constat 19 (Playwright, téléphone 390 × 844) : sur la page Révision, la case active de la
 * tablature n'est jamais cachée sous la barre de réponse fixe (`.answer-bar`). Outil de développement,
 * hors `npm test`. Suppose `npm run dev` lancé.
 *
 *   node tools/answer-bar-check.mjs
 *   node tools/answer-bar-check.mjs --persona regulier --day 14 --width 390 --height 844
 *
 * La persona est chargée « ce soir 23 h 30 », puis l'horloge passe au lendemain 17 h (des formes sont dues).
 * Pour chaque case, on mesure le bas de la case active et le haut de la barre, puis on passe à la suivante
 * (flèche →). Code de sortie 1 si une case est cachée. Contexte neuf : ton vrai journal n'est pas touché.
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = arg('base', 'http://127.0.0.1:5173');
const PERSONA = arg('persona', 'regulier');
const DAY = Number(arg('day', 14));
const WIDTH = Number(arg('width', 390));
const HEIGHT = Number(arg('height', 844));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const ready = () => page.waitForSelector('.devpanel-toggle', { timeout: 30000 });
const setClock = (hoursFromMidnight, dayOffset) => page.evaluate(([h, d]) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  t.setHours(h, 0, 0, 0);
  localStorage.setItem('fretwave.dev.clockOffset', String(t.getTime() - Date.now()));
}, [hoursFromMidnight, dayOffset]);

await page.goto(`${BASE}/#/hub`, { waitUntil: 'networkidle' });
await ready();
await setClock(23.5, 0);
await page.reload({ waitUntil: 'networkidle' });
await ready();
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle' }),
  page.evaluate(([p, d]) => window.__sim.load(p, d), [PERSONA, DAY]).catch(() => {}),
]);
await ready();
// le lendemain à 17 h : la séance du jour a des formes dues, rappelées à froid
await setClock(17, 1);
await page.goto(`${BASE}/#/gammes/revision`, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await ready();
await page.waitForTimeout(800);

const count = await page.evaluate(() => window.__trainingTab?.hiddenCount() ?? 0);
if (!count) {
  console.log('aucune case : pas de séance de révision à cet instant');
  await browser.close();
  process.exit(2);
}

const hidden = [];
for (let i = 0; i < count; i++) {
  const m = await page.evaluate(() => {
    const t = window.__trainingTab;
    const ci = t.layout.columns.findIndex((c) => c.pills.some((p) => p.active));
    if (ci < 0) return null;
    const pill = t.layout.columns[ci].pills.find((p) => p.active);
    const c = t.centerOf(ci, pill.string);
    const bar = document.querySelector('.answer-bar');
    // la barre est fixe (offsetParent toujours nul) : on regarde si elle est affichée
    const barTop = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect().top : window.innerHeight;
    return { bottom: c.y + (pill.h / 2) * t.cssPerLogical, barTop, scrollY: window.scrollY };
  });
  if (!m) { console.log(`case ${i + 1} : aucune case active`); break; }
  const ok = m.bottom <= m.barTop;
  if (!ok) hidden.push(i + 1);
  console.log(`case ${String(i + 1).padStart(2)} / ${count} · bas ${Math.round(m.bottom)} · barre ${Math.round(m.barTop)} · défilement ${Math.round(m.scrollY)} · ${ok ? 'visible' : 'CACHÉE'}`);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(700);
}
await browser.close();
console.log(hidden.length ? `ÉCHEC : ${hidden.length} case(s) sous la barre (${hidden.join(', ')})` : `OK : ${count} cases, aucune sous la barre`);
if (errors.length) console.log(`${errors.length} erreur(s) console : ${errors[0]}`);
process.exit(hidden.length ? 1 : 0);
