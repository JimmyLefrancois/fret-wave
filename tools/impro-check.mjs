/**
 * Vérification de l'improvisation (phase 7) au navigateur : accompagnement + micro simulé.
 *
 *   node tools/impro-check.mjs .shots/mic/strings2.wav
 *
 * Ce que ça prouve : `Démarrer` lance la boucle (la mesure avance, l'accord courant s'allume), le micro
 * ouvre, chaque note entendue est **classée** et **allumée sur la position**, et `Arrêter` produit un
 * bilan (score + conseil). Ce que ça ne prouve pas : le son entendu (aucun test audio ici), la justesse
 * musicale de la phrase, ni une vraie guitare.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const WAV = args.find((a) => a.endsWith('.wav'));
if (!WAV) {
  console.error('usage : node tools/impro-check.mjs <fichier.wav> [--out .shots/impro]');
  process.exit(1);
}
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : '.shots/impro';
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
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

const report = { wav: WAV, steps: [] };
const step = (name, data = {}) => report.steps.push({ name, ...data });

await page.goto('http://127.0.0.1:5173/#/gammes/impro', { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForSelector('.impro-chord');
step('grille', await page.$$eval('.impro-chord', (els) => els.map((e) => e.textContent?.trim())));

// 1. micro, puis démarrer
await page.getByRole('switch').first().click(); // le micro est un commutateur (role switch)
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /Démarrer/i }).click();
await page.waitForTimeout(2500);
const playing = await page.evaluate(() => ({
  stop: !!document.querySelector('button') && [...document.querySelectorAll('button')].some((b) => /Arrêter/.test(b.textContent ?? '')),
  on: document.querySelectorAll('.impro-chord.on').length,
}));
step('transport', playing);

// 2. laisser tourner : les notes du faux micro doivent s'inscrire
await page.waitForTimeout(9000);
const live = await page.evaluate(() => ({
  notes: [...document.querySelectorAll('.impro-note')].map((n) => n.textContent?.trim()),
  roles: [...new Set([...document.querySelectorAll('.impro-note')].map((n) => (n.className.match(/impro-role-\w+/) ?? [''])[0]))],
  stats: [...document.querySelectorAll('.impro-stats span')].map((s) => s.textContent?.trim()),
  flash: !!document.querySelector('.pluck-report') || undefined,
}));
step('notes', live);
await page.screenshot({ path: `${OUT}/en-cours.png` });

// 3. arrêter : bilan
await page.getByRole('button', { name: /Arrêter/i }).click();
await page.waitForTimeout(800);
const summary = await page.evaluate(() => {
  const box = document.querySelector('.impro-summary');
  return box ? [...box.querySelectorAll('p')].map((p) => p.textContent?.trim()) : null;
});
step('bilan', summary);
await page.screenshot({ path: `${OUT}/bilan.png` });

const saved = await page.evaluate(() => {
  const out = [];
  for (const k of Object.keys(localStorage).filter((x) => /attempts|progress/i.test(x))) {
    try {
      const data = JSON.parse(localStorage.getItem(k) ?? 'null');
      const list = Array.isArray(data) ? data : (data?.attempts ?? []);
      if (Array.isArray(list)) out.push(...list.filter((a) => a.kind === 'impro'));
    } catch { /* pas du JSON */ }
  }
  return out.map((a) => ({ correct: a.correct, total: a.total, level: a.level, seconds: a.seconds }));
});
step('journal', saved);

report.errors = errors;
console.log(JSON.stringify(report, null, 1));
await browser.close();
process.exit(errors.length === 0 && playing.on > 0 && (live.notes?.length ?? 0) > 0 ? 0 : 1);
