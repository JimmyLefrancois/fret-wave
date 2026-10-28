/**
 * Vérification de l'écoute **polyphonique** (phase 5) au navigateur, micro simulé par un fichier.
 *
 * Chromium rejoue un WAV comme s'il venait d'un micro (`--use-file-for-fake-audio-capture`). Les
 * fixtures sont des accords plaqués construits avec les **vrais échantillons** de la banque
 * (`tools/make-chord-fixtures.sh`), pas des sinus : le timbre est celui que l'app joue.
 *
 *   node tools/make-chord-fixtures.sh
 *   node tools/chord-poly-check.mjs .shots/mic/em-strum.wav
 *   node tools/chord-poly-check.mjs .shots/mic/e-major-strum.wav --expect partial
 *
 * Ce que ça prouve : micro → AudioWorklet → tampon → analyse → écran (verdict, confiance par corde,
 * message ciblé), et l'écriture au journal. Ce que ça ne prouve pas : une vraie guitare, un vrai micro,
 * une vraie pièce — c'est écrit dans PROJECT.md §12.
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
  console.error('usage : node tools/chord-poly-check.mjs <fichier.wav> [--expect ok|partial|wrong] [--out .shots/poly]');
  process.exit(1);
}
const BASE = arg('base', 'http://127.0.0.1:5173');
const EXPECT = arg('expect', 'ok');
const OUT = arg('out', '.shots/poly');
const WIDTH = Number(arg('width', 390));
const HEIGHT = Number(arg('height', 844));
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
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

const report = { wav: WAV, expect: EXPECT, steps: [] };
const step = (name, data = {}) => { report.steps.push({ name, ...data }); };

await page.goto(`${BASE}/#/accords/lecon`, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForSelector('.step-btn');
await page.getByRole('button', { name: /Plaquer/i }).first().click();
// 1. ouvrir le micro (le clic est le geste utilisateur exigé par le navigateur)
await page.getByRole('button', { name: /Ouvrir le micro/i }).first().click();
const listenBtn = page.getByRole('button', { name: /Écouter mon accord/i }).first();
await listenBtn.waitFor({ state: 'visible', timeout: 20000 });
await page.waitForTimeout(1500); // le Worklet et le tampon ont besoin d'un peu de son
step('micro ouvert', { bouton: true });

// 2. armer puis attendre le résultat (l'app attend la vraie attaque)
await listenBtn.click();
await page.waitForSelector('.pluck-report', { timeout: 25000 });
await page.waitForTimeout(300);

// 3. lire ce que l'écran dit
const ui = await page.evaluate(() => {
  const report = document.querySelector('.pluck-report');
  const verdict = report?.querySelector('p')?.textContent?.trim() ?? '';
  const strings = [...(report?.querySelectorAll('.pluck-strings li') ?? [])].map((li) => ({
    texte: li.querySelector('.pluck-string')?.textContent?.trim() ?? '',
    pct: li.querySelector('.pluck-pct')?.textContent?.trim() ?? '',
    manquante: li.classList.contains('missing'),
  }));
  const advice = [...(report?.querySelectorAll('p') ?? [])].map((p) => p.textContent?.trim() ?? '').slice(1).join(' | ');
  return { verdict, strings, advice };
});
step('résultat', ui);
await page.screenshot({ path: `${OUT}/${EXPECT}-pluck.png`, fullPage: false });

// 4. ce que le journal a retenu
const saved = await page.evaluate(() => {
  const keys = Object.keys(localStorage).filter((k) => /progress|journal|fretwave/i.test(k));
  const out = [];
  for (const k of keys) {
    try {
      const data = JSON.parse(localStorage.getItem(k) ?? 'null');
      const list = Array.isArray(data) ? data : (data?.attempts ?? []);
      if (Array.isArray(list)) out.push(...list.filter((a) => a.kind === 'pluck').map((a) => ({ correct: a.correct, total: a.total, confidence: a.confidence })));
    } catch { /* clé non JSON */ }
  }
  return { cles: keys, plucks: out.slice(-3) };
});
step('journal', saved);

const kind = /rien entendu/i.test(ui.verdict) ? 'silent'
  : /C’est écouté|C'est écouté/i.test(ui.verdict) ? 'ok'
    : 'partial';
const ok = kind === EXPECT && errors.length === 0;
report.kind = kind;
report.errors = errors;
console.log(JSON.stringify(report, null, 1));
await browser.close();
process.exit(ok ? 0 : 1);
