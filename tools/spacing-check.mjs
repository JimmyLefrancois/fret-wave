/**
 * Audit des **rythmes verticaux** : la marge entre deux blocs doit être la même partout.
 *
 * Le dépôt a deux régimes : au bureau `.shell` est une grille (`gap: 20px`), sur téléphone les blocs
 * s'empilent et chacun porte ses propres marges — d'où des écarts de 4, 6, 8, 10, 12, 18 px qui se
 * voient à l'œil sans qu'on sache dire pourquoi.
 *
 * Ce script mesure, pour chaque page, l'écart vertical entre les blocs de premier niveau de `<main>`,
 * puis entre les enfants directs d'un panneau, et rend un **histogramme** : peu de valeurs = cohérent.
 *
 *   node tools/spacing-check.mjs            # tableau lisible
 *   node tools/spacing-check.mjs --json     # pour comparer avant / après
 */
import { chromium } from 'playwright';

const ROUTES = [
  'hub', 'gammes', 'gammes/jouer', 'gammes/entrainement', 'gammes/revision',
  'accords', 'accords/lecon', 'accords/qcm', 'accordeur', 'reglages',
];
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173';
const JSON_OUT = process.argv.includes('--json');

const browser = await chromium.launch();
const report = {};

for (const [tag, width, height] of [['phone', 390, 844], ['desk', 1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'fr-FR' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/#/hub`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  for (const route of ROUTES) {
    await page.evaluate((r) => { location.hash = `#/${r}`; }, route);
    await page.waitForTimeout(650);
    const gaps = await page.evaluate(() => {
      const out = [];
      const rect = (el) => el.getBoundingClientRect();
      const visible = (el) => {
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && rect(el).height > 0;
      };
      // blocs de premier niveau de la page
      const main = document.querySelector('main');
      if (!main) return out;
      const kids = [...main.children].filter(visible);
      // Au bureau, la page est une grille : l'écart réel est le `gap`, le reste est du remplissage de
      // rangée (une carte plus haute que sa voisine). Mesurer les rects y produirait de faux écarts.
      const shell = document.querySelector('main.shell');
      const isGrid = shell && getComputedStyle(shell).display.includes('grid');
      if (isGrid) out.push({ where: 'page', gap: Math.round(parseFloat(getComputedStyle(shell).rowGap) || 0), from: 'grille', to: 'rowGap' });
      for (let i = 1; i < kids.length && !isGrid; i += 1) {
        const a = rect(kids[i - 1]);
        const b = rect(kids[i]);
        const gap = Math.round(b.top - a.bottom);
        if (gap >= 0) out.push({ where: 'page', gap, from: kids[i - 1].className || kids[i - 1].tagName, to: kids[i].className || kids[i].tagName });
      }
      // enfants directs des panneaux (ligne, légende, détails…)
      for (const panel of main.querySelectorAll('.panel')) {
        const p = [...panel.children].filter(visible);
        for (let i = 1; i < p.length; i += 1) {
          const a = rect(p[i - 1]);
          const b = rect(p[i]);
          const gap = Math.round(b.top - a.bottom);
          if (gap >= 0) out.push({ where: 'panel', gap, from: p[i - 1].className || p[i - 1].tagName, to: p[i].className || p[i].tagName });
        }
      }
      return out;
    });

    const hist = new Map();
    for (const g of gaps) hist.set(g.gap, (hist.get(g.gap) ?? 0) + 1);
    report[`${tag}:${route}`] = { gaps: [...hist.entries()].sort((a, b) => a[0] - b[0]), details: gaps };
  }
  await ctx.close();
}
await browser.close();

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 1));
} else {
  const global = new Map();
  for (const [key, { gaps }] of Object.entries(report)) {
    const line = gaps.map(([g, n]) => `${g}px×${n}`).join(' ');
    console.log(key.padEnd(28), line || '—');
    for (const [g, n] of gaps) global.set(g, (global.get(g) ?? 0) + n);
  }
  console.log('\n=== toutes les pages :');
  for (const [g, n] of [...global.entries()].sort((a, b) => a[0] - b[0])) console.log(`  ${String(g).padStart(3)} px   ${n}`);
  const odd = [...global.keys()].filter((g) => ![0, 4, 8, 12, 16, 20].includes(g));
  console.log(`\nValeurs hors échelle (0/4/8/12/16/20) : ${odd.length ? odd.join(', ') + ' px' : 'aucune'}`);
}
