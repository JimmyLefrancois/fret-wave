/**
 * Tournée visuelle du simulateur (Playwright) : pour chaque persona et chaque jour clé, charge le journal
 * simulé de ce jour-là, capture l'accueil et les écrans de gammes, puis assemble une planche contact HTML
 * avec la radiographie de chaque état. Outil de développement, hors `npm test`. Suppose `npm run dev` lancé.
 *
 *   node tools/sim-tour.mjs
 *   node tools/sim-tour.mjs --personas regulier,decrocheur --days 1,10,23 --pages hub --width 390 --height 844
 *
 * Contexte de navigateur neuf : ton vrai journal (celui de ton navigateur) n'est jamais touché.
 * Le « jour N » est la simulation des N premiers jours de la persona, arrêtée ce soir à 23 h 30 : le
 * simulateur est séquentiel, les N premiers jours sont les mêmes quelle que soit la durée totale.
 * Sortie : .shots/sim-tour/ (index-<largeur>.html + PNG : une planche par largeur).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const BASE = arg('base', 'http://127.0.0.1:5173');
const OUT = arg('out', '.shots/sim-tour');
const WIDTH = Number(arg('width', 1440));
const HEIGHT = Number(arg('height', 900));
const ONLY = arg('personas', null)?.split(',');
const DAYS = arg('days', null)?.split(',').map(Number);
const PAGES = [
  { id: 'hub', hash: '#/hub', label: 'Accueil' },
  { id: 'gammes', hash: '#/gammes', label: 'Gammes' },
  { id: 'entrainement', hash: '#/gammes/entrainement', label: 'Entraînement' },
  { id: 'revision', hash: '#/gammes/revision', label: 'Révision' },
].filter((p) => !arg('pages', null) || arg('pages').split(',').includes(p.id));

/** Jours clés par défaut : J1, J7, J14, J30 et le dernier jour de la persona. */
const keyDays = (total) => DAYS ?? [...new Set([1, 7, 14, 30, total].filter((d) => d <= total))];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
  isMobile: WIDTH < 700,
  hasTouch: WIDTH < 700,
  locale: 'fr-FR',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

/** L'app est prête quand le panneau DEV est monté (après l'écran de chargement du son). */
const ready = () => page.waitForSelector('.devpanel-toggle', { timeout: 30000 });

async function open(hash) {
  await page.goto(`${BASE}/${hash}`, { waitUntil: 'networkidle' });
  await ready();
  await page.waitForTimeout(500);
}

await open('#/hub');
// « ce soir 23 h 30 » : toutes les séries du jour simulé sont faites, rien n'est dans le futur
await page.evaluate(() => {
  const target = new Date();
  target.setHours(23, 30, 0, 0);
  localStorage.setItem('fretwave.dev.clockOffset', String(target.getTime() - Date.now()));
});
// un vrai rechargement : un `goto` qui ne change que le hash garde les modules (et l'ancien décalage)
await page.reload({ waitUntil: 'networkidle' });
await ready();
const personas = await page.evaluate(() => window.__sim.personas);
const totals = await page.evaluate(() => window.__sim.days);

const rows = [];
for (const id of personas) {
  if (ONLY && !ONLY.includes(id)) continue;
  for (const day of keyDays(totals[id])) {
    // load() recharge la page : on attend la nouvelle, sinon on lirait l'ancienne
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.evaluate(([p, d]) => window.__sim.load(p, d), [id, day]).catch(() => {}),
    ]);
    await ready();
    const x = await page.evaluate(() => window.__sim.xray());
    const shots = [];
    for (const p of PAGES) {
      await open(p.hash);
      const file = `${id}-J${day}-${p.id}-${WIDTH}.png`;
      await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
      shots.push({ page: p, file });
    }
    rows.push({ id, day, x, shots });
    console.log(`${id} J${day} · ${x.hero} · ${x.due.length} due(s) · série ${x.streak} j`);
  }
}
await browser.close();

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const forms = (x) => x.nodes.filter((n) => n.nodeId.startsWith('gam:lecture:'))
  .map((n) => `${n.nodeId.split(':').pop()}:${n.state}${n.speed ? '+v' : ''}`).join(' · ');
const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Tournée du simulateur</title>
<style>
  body { font: 14px/1.4 system-ui, sans-serif; margin: 16px; background: #111; color: #ddd; }
  h1 { font-size: 18px; } h2 { font-size: 15px; margin: 24px 0 4px; }
  .meta { color: #aaa; margin: 0 0 8px; }
  .row { display: grid; grid-template-columns: repeat(${PAGES.length}, minmax(0, 1fr)); gap: 8px; }
  figure { margin: 0; } figcaption { color: #aaa; font-size: 12px; }
  img { width: 100%; height: 420px; object-fit: cover; object-position: top; border: 1px solid #333; }
  a:hover img { border-color: #fc0; }
</style></head><body>
<h1>Tournée du simulateur — ${esc(new Date().toLocaleString('fr-FR'))} · ${WIDTH}×${HEIGHT}</h1>
<p class="meta">Clic sur une vignette : capture pleine page. Constats à reporter dans docs/SIM_CONSTATS.md.</p>
${errors.length ? `<p style="color:#f66">Erreurs console : ${esc(errors.slice(0, 5).join(' | '))}</p>` : ''}
${rows.map((r) => `<h2>${esc(r.id)} · J${r.day}</h2>
<p class="meta">Accueil : <b>${esc(r.x.hero)}</b> · ${r.x.due.length} révision(s) due(s) · série ${r.x.streak} j ·
XP ${r.x.xp.total} · ${r.x.attempts} tentatives<br>Formes : ${esc(forms(r.x)) || '—'}</p>
<div class="row">${r.shots.map((s) => `<figure><a href="${s.file}"><img src="${s.file}" alt="${esc(s.page.label)}" loading="lazy"></a><figcaption>${esc(s.page.label)}</figcaption></figure>`).join('')}</div>`).join('\n')}
</body></html>
`;
writeFileSync(`${OUT}/index-${WIDTH}.html`, html);
console.log(`planche : ${OUT}/index-${WIDTH}.html (${rows.length} états, ${errors.length} erreur(s) console)`);
