/**
 * Vérification de la page Métronome (D112) dans un vrai navigateur.
 *
 *   node tools/metronome-check.mjs [--base http://127.0.0.1:5173] [--out .shots]
 *
 * Ce qui est vérifié : heures audio réelles des clics (via OscillatorNode.start), pause et reprise,
 * automation, mesures silencieuses, arrêt en quittant la page, mise en page à 390 px dans les deux thèmes.
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
mkdirSync(OUT, { recursive: true });

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${name}${detail ? ` : ${detail}` : ''}`);
};

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => {
  window.__clicks = [];
  const start = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (when) {
    window.__clicks.push(when);
    return start.call(this, when);
  };
});

const setMetro = (config) => page.evaluate((c) => {
  localStorage.setItem('fretwave.metronome.v1', JSON.stringify({ config: c, slots: [] }));
}, config);
const open = async () => {
  await page.goto(`${BASE}/#/metronome`);
  await page.reload();
  await page.getByRole('button', { name: '▶ Démarrer' }).waitFor({ timeout: 60000 });
};
const clicks = () => page.evaluate(() => window.__clicks.slice());
const resetClicks = () => page.evaluate(() => { window.__clicks.length = 0; });
const gaps = (t) => t.slice(1).map((v, i) => v - t[i]);
const start = () => page.getByRole('button', { name: '▶ Démarrer' }).click();
const stop = () => page.getByRole('button', { name: 'Arrêter' }).click();

await page.goto(`${BASE}/#/metronome`);

// tempo régulier
await setMetro({ bpm: 120, beats: 4 });
await open();
await resetClicks();
await start();
await page.waitForTimeout(3000);
await stop();
let t = await clicks();
let g = gaps(t);
check('120 BPM : environ 6 clics en 3 s', t.length >= 5 && t.length <= 8, `${t.length} clics`);
check('120 BPM : 0,5 s entre les clics', g.every((d) => Math.abs(d - 0.5) < 0.002), g.map((d) => d.toFixed(4)).join(' '));
await page.waitForTimeout(600);
const after = (await clicks()).length;
check('arrêter coupe les clics', after === t.length, `${t.length} → ${after}`);

// changement de tempo en direct
await resetClicks();
await start();
await page.waitForTimeout(1200);
await page.getByRole('button', { name: 'Tempo +5' }).click();
for (let i = 0; i < 11; i++) await page.getByRole('button', { name: 'Tempo +5' }).click();
await page.waitForTimeout(1500);
await stop();
g = gaps(await clicks());
check('tempo en direct : l’écart passe de 0,5 à 1/3 s', Math.abs(g.at(-1) - 1 / 3) < 0.002, g.map((d) => d.toFixed(3)).join(' '));

// automation, pause et reprise
await setMetro({ bpm: 120, beats: 1, ramp: { on: true, from: 120, to: 240, step: 120, every: 3, unit: 'bars', loop: false } });
await open();
await resetClicks();
await start();
await page.waitForTimeout(1200);
await page.keyboard.press('Space');
await page.waitForTimeout(200);
const paused = (await clicks()).length;
await page.waitForTimeout(800);
check('pause à l’espace', (await clicks()).length === paused, `${paused} clics`);
await page.keyboard.press('Space');
await page.waitForTimeout(2200);
await page.keyboard.press('Enter');
g = gaps(await clicks());
// 3 mesures à 120 puis 240 : la pause ne relance pas l'automation, le palier tombe au 4e clic
const expected = [0.5, 0.5, null, 0.25, 0.25, 0.25, 0.25];
check('automation : le palier survit à la pause', expected.every((e, i) => e === null || Math.abs(g[i] - e) < 0.002), g.map((d) => d.toFixed(3)).join(' '));
check('reprise après pause : pas de clic doublé', g.every((d) => d > 0.2), `écart mini ${Math.min(...g).toFixed(3)}`);

// mesures silencieuses
await setMetro({ bpm: 240, beats: 1, silence: { on: true, audible: 1, silent: 1, random: false } });
await open();
await resetClicks();
await start();
await page.waitForTimeout(2200);
const total = Number(await page.getByTestId('metro-total').textContent());
await stop();
g = gaps(await clicks());
check('silence : un clic sur deux, le compteur court', g.every((d) => Math.abs(d - 0.5) < 0.002) && total >= 6, `${(await clicks()).length} clics pour ${total} temps`);

// quitter la page
await setMetro({ bpm: 120, beats: 4 });
await open();
await start();
await page.waitForTimeout(500);
await page.locator('.navbtn').first().click();
await page.waitForTimeout(300);
await resetClicks();
await page.waitForTimeout(1000);
check('quitter la page coupe le clic', (await clicks()).length === 0);

// mise en page
for (const theme of ['synthwave', 'dawn']) {
  await page.evaluate((id) => {
    const key = 'fretwave.settings.v1';
    localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key) ?? '{}'), theme: id }));
  }, theme);
  await page.goto(`${BASE}/#/metronome`);
  await page.reload();
  await page.getByRole('button', { name: '▶ Démarrer' }).waitFor({ timeout: 60000 });
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    clipped: [...document.querySelectorAll('.navbtn span')].filter((s) => s.scrollWidth > s.clientWidth).map((s) => s.textContent),
  }));
  check(`${theme} : pas de défilement horizontal`, layout.overflow <= 0, `${layout.overflow} px`);
  check(`${theme} : libellés de navigation entiers`, layout.clipped.length === 0, layout.clipped.join(', '));
  const fits = () => page.evaluate(() => {
    const nav = document.querySelector('.bottombar').getBoundingClientRect().top;
    return { go: document.querySelector('.metro-go').getBoundingClientRect().bottom <= nav, tabs: document.querySelector('.metro-settings').getBoundingClientRect().bottom <= nav };
  });
  const atRest = await fits();
  check(`${theme} : Démarrer et tous les réglages visibles sans défiler`, atRest.go && atRest.tabs, JSON.stringify(atRest));
  const free = await page.evaluate(() => document.querySelector('.bottombar').getBoundingClientRect().top - document.querySelector('.metro').getBoundingClientRect().bottom);
  check(`${theme} : le panneau remplit l’écran`, free >= 0 && free <= 40, `${free} px libres`);
  await page.screenshot({ path: `${OUT}/metronome-${theme}.png` });
  const extra = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  check(`${theme} : la page ne défile pas au repos`, extra <= 0, `${extra} px`);
  const goTop = () => page.evaluate(() => document.querySelector('.metro-go').getBoundingClientRect().top);
  const restTop = await goTop();
  await start();
  await page.waitForTimeout(300);
  const play = await page.evaluate(() => ({ settings: getComputedStyle(document.querySelector('.metro-settings')).display, lights: document.querySelector('.metro-beats').getBoundingClientRect().height }));
  check(`${theme} : en jeu, les temps prennent la place`, play.settings === 'none' && play.lights > 300, JSON.stringify(play));
  const playTop = await goTop();
  check(`${theme} : le bouton ne bouge pas au démarrage`, Math.abs(playTop - restTop) < 1, `${restTop} → ${playTop}`);
  await page.screenshot({ path: `${OUT}/metronome-${theme}-jeu.png` });
  await stop();
  const ramp = page.getByRole('switch', { name: 'Paliers de tempo' });
  if ((await ramp.getAttribute('aria-checked')) !== 'true') await ramp.click();
  const target = page.getByRole('status', { name: 'Cible' });
  const before = Number(await target.textContent());
  await page.getByRole('button', { name: 'Cible : plus 1' }).hover();
  await page.mouse.down();
  await page.waitForTimeout(1000);
  await page.mouse.up();
  await page.waitForTimeout(200);
  const held = Number(await target.textContent());
  check(`${theme} : maintenir + fait défiler la valeur`, held - before >= 5, `${before} → ${held}`);
  await page.screenshot({ path: `${OUT}/metronome-${theme}-paliers.png`, fullPage: true });
  await ramp.click();
}
await setMetro({ bpm: 120, beats: 12 });
await open();
const spill = await page.evaluate(() => [...document.querySelectorAll('.metro-beat')].filter((b) => {
  const box = b.getBoundingClientRect();
  const digit = b.firstElementChild.getBoundingClientRect();
  return digit.left < box.left || digit.right > box.right || digit.top < box.top || digit.bottom > box.bottom;
}).length);
check('12 temps : les chiffres tiennent dans leurs blocs', spill === 0, `${spill} débordent`);
await page.setViewportSize({ width: 1280, height: 800 });
await page.screenshot({ path: `${OUT}/metronome-desktop.png`, fullPage: true });
const columns = () => page.evaluate(() => {
  const bottom = (s) => document.querySelector(s).getBoundingClientRect().bottom;
  return bottom('.metro-go') - bottom('.metro-slot-actions');
});
const rowEdges = () => page.evaluate(() => [...document.querySelectorAll('.metro-row')].map((r) => {
  const c = r.lastElementChild.getBoundingClientRect();
  return `${Math.round(c.left)}-${Math.round(c.right)}`;
}));
const sameEdges = (e) => e.length === 3 && new Set(e).size === 1;
check('bureau : mêmes bas à gauche et à droite', Math.abs(await columns()) <= 1, `${await columns()} px`);
const desktopEdges = await rowEdges();
check('bureau : contrôles alignés', sameEdges(desktopEdges), desktopEdges.join(' '));
await page.getByRole('switch', { name: 'Paliers de tempo' }).click();
check('bureau, paliers ouverts : mêmes bas à gauche et à droite', Math.abs(await columns()) <= 1, `${await columns()} px`);
await page.screenshot({ path: `${OUT}/metronome-desktop-paliers.png`, fullPage: true });
await page.getByRole('switch', { name: 'Paliers de tempo' }).click();
await page.setViewportSize({ width: 390, height: 844 });
const phoneEdges = await rowEdges();
check('390 px : contrôles alignés', sameEdges(phoneEdges), phoneEdges.join(' '));
await page.setViewportSize({ width: 360, height: 780 });
const narrowEdges = await rowEdges();
const segClip = await page.evaluate(() => [...document.querySelectorAll('.metro-row .seg')].filter((s) => s.scrollWidth > s.clientWidth).map((s) => s.textContent));
check('360 px : contrôles alignés, libellés entiers', sameEdges(narrowEdges) && segClip.length === 0, `${narrowEdges.join(' ')} ${segClip.join(', ')}`);
const clipped360 = await page.evaluate(() => [...document.querySelectorAll('.navbtn span')].filter((s) => s.scrollWidth > s.clientWidth).map((s) => s.textContent));
check('360 px : libellés de navigation entiers', clipped360.length === 0, clipped360.join(', '));

check('aucune erreur de page', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(failed ? 1 : 0);
