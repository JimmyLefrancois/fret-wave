/**
 * Audit des **cartes** (panneaux) : tailles cohérentes sur toutes les pages, aux deux tailles d'écran.
 *
 * Deux règles, mesurées et non supposées :
 *
 *  - **téléphone** (`.shell` est une colonne flex) : toute carte occupe la largeur de la page. Une carte
 *    plus étroite laisse voir le décor sur le côté et se lit comme un bloc oublié ;
 *  - **bureau** (`.shell` est une grille de 12 colonnes, `gap: 20px`) : les cartes d'une même rangée
 *    doivent **remplir les 12 colonnes** (6+6, 7+5, 12…). Un trou en fin de rangée = une carte qui n'a
 *    pas reçu sa classe `span-N`, et ça se voit immédiatement à l'œil.
 *
 *   node tools/card-audit.mjs           # rapport lisible
 *   node tools/card-audit.mjs --json    # pour comparer avant/après
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const ROUTES = [
  ['hub', '#/hub'],
  ['gammes', '#/gammes'],
  ['gammes-jouer', '#/gammes/jouer'],
  ['gammes-entrainement', '#/gammes/entrainement'],
  ['gammes-revision', '#/gammes/revision'],
  ['gammes-impro', '#/gammes/impro'],
  ['accords', '#/accords'],
  ['accords-lecon', '#/accords/lecon'],
  ['accords-qcm', '#/accords/qcm'],
  ['accordeur', '#/accordeur'],
  ['reglages', '#/reglages'],
  ['tab', '#/tab'],
  ['audio', '#/audio'],
  ['theorie', '#/theorie'],
];

const JSON_OUT = process.argv.includes('--json');
const browser = await chromium.launch();
const report = {};

for (const [size, viewport] of [['phone', { width: 390, height: 844 }], ['desk', { width: 1440, height: 900 }]]) {
  report[size] = {};
  for (const [name, hash] of ROUTES) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'fr-FR' });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:5173/${hash}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    report[size][name] = await page.evaluate(() => {
      const main = document.querySelector('main.shell, main.wide, main');
      if (!main) return { error: 'pas de <main>' };
      const cs = getComputedStyle(main);
      const isGrid = cs.display.includes('grid');
      const contentW = main.clientWidth - Number.parseFloat(cs.paddingLeft) - Number.parseFloat(cs.paddingRight);
      const gap = Number.parseFloat(cs.columnGap || '0') || 0;
      // tous les panneaux de la page, sauf ceux imbriqués dans un autre panneau (une carte dans une
      // carte n'a pas à remplir la page) : c'est là que se cachent les cartes « à moitié largeur ».
      const all = [...main.querySelectorAll('.panel')].filter((p) => !p.parentElement?.closest('.panel'));
      const panels = all.map((p) => {
        const r = p.getBoundingClientRect();
        const cls = String(p.className).match(/span-\d+/)?.[0] ?? null;
        return {
          label: (p.querySelector('.t-label')?.textContent ?? p.querySelector('.panel-head')?.textContent ?? '').trim().slice(0, 26),
          cls,
          w: Math.round(r.width),
          x: Math.round(r.left),
          top: Math.round(r.top),
        };
      });
      // rangées du bureau : cartes qui partagent la même ligne
      const rows = [];
      for (const p of panels) {
        const row = rows.find((r) => Math.abs(r.top - p.top) < 4);
        if (row) row.items.push(p);
        else rows.push({ top: p.top, items: [p] });
      }
      const widths = panels.map((p) => p.w);
      return {
        grid: isGrid,
        contentW: Math.round(contentW),
        gap,
        panels,
        rows: rows.map((r) => ({ top: r.top, n: r.items.length, sum: r.items.reduce((s, p) => s + p.w, 0), cls: r.items.map((p) => p.cls ?? '—'), items: r.items })),
        distinctWidths: [...new Set(widths)].sort((a, b) => b - a),
      };
    });
    await ctx.close();
  }
}

await browser.close();
mkdirSync('.shots/audit', { recursive: true });
writeFileSync('.shots/audit/cards.json', JSON.stringify(report, null, 1));

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 1));
} else {
  let issues = 0;
  for (const size of ['phone', 'desk']) {
    console.log(`\n########## ${size}`);
    for (const [route, r] of Object.entries(report[size])) {
      if (r.error) {
        console.log(`\n=== ${route} : ${r.error}`);
        issues += 1;
        continue;
      }
      const problems = [];
      if (size === 'phone') {
        for (const p of r.panels) {
          if (Math.abs(p.w - r.contentW) > 2) problems.push(`carte ${p.w} au lieu de ${r.contentW} « ${p.label} »`);
        }
      } else if (r.grid) {
        for (const row of r.rows) {
          // une rangée pleine = les cartes + les gouttières entre elles ; on tolère l'arrondi (4 px)
          const total = row.sum + r.gap * (row.items.length - 1);
          if (Math.abs(total - r.contentW) > 4 && row.items.length > 0) {
            const names = row.items.map((p) => `« ${p.label} »`).join(' + ');
            problems.push(`rangée incomplète : ${total} / ${r.contentW} — ${row.cls.join(' + ')} ${names}`);
          }
        }
      }
      if (problems.length === 0) continue;
      issues += problems.length;
      console.log(`\n=== ${route} — ${problems.length}`);
      for (const p of problems) console.log(`  ${p}`);
    }
  }
  console.log(`\nTOTAL : ${issues}`);
}
process.exit(0);
