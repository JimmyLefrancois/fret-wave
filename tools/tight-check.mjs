/**
 * Audit des **textes collés** : deux blocs empilés (paragraphe, rangée de boutons, liste, grille…) sans
 * écart vertical entre eux. `p { margin: 0 }` est global : un panneau n'a d'air entre ses enfants que si
 * une règle locale en ajoute, et ce qui a été oublié se voit à l'œil (« le texte touche les boutons »).
 *
 * Pour chaque page, à 390 et 1440 px, on parcourt tous les conteneurs de `<main>` et l'on mesure, entre
 * deux enfants **visibles, dans le flux, empilés** (l'un sous l'autre, qui se chevauchent en largeur),
 * l'écart entre le bas du premier et le haut du second. Sous 4 px (`--gap-tight`), c'est collé.
 * Complète `spacing-check.mjs`, qui ne regarde que le rythme entre grands blocs.
 *
 *   node tools/tight-check.mjs              # tableau lisible
 *   node tools/tight-check.mjs --json       # pour comparer avant / après
 *   node tools/tight-check.mjs --persona regulier --day 14   # accueil et gammes avec un journal simulé
 *
 * Suppose `npm run dev` lancé. Contexte de navigateur neuf : ton vrai journal n'est jamais touché.
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = arg('base', 'http://127.0.0.1:5173');
const JSON_OUT = args.includes('--json');
const PERSONA = arg('persona', null);
const DAY = Number(arg('day', 14));
const MIN_GAP = Number(arg('min', 4));

const ROUTES = [
  'hub', 'gammes', 'gammes/jouer', 'gammes/entrainement', 'gammes/revision', 'gammes/sequences', 'gammes/impro',
  'accords', 'accords/lecon', 'accords/qcm', 'accordeur', 'reglages',
];

const browser = await chromium.launch();
const report = {};

for (const [tag, width, height] of [['phone', 390, 844], ['desk', 1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'fr-FR' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/#/hub`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  if (PERSONA) {
    await page.evaluate(() => {
      const target = new Date();
      target.setHours(23, 30, 0, 0);
      localStorage.setItem('fretwave.dev.clockOffset', String(target.getTime() - Date.now()));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__sim);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.evaluate(([p, d]) => window.__sim.load(p, d), [PERSONA, DAY]).catch(() => {}),
    ]);
    await page.waitForTimeout(600);
  }

  for (const route of ROUTES) {
    await page.evaluate((r) => { location.hash = `#/${r}`; }, route);
    await page.waitForTimeout(650);
    // les replis (« et 3 autres », détails) sont ouverts : leur contenu compte aussi
    await page.evaluate(() => { for (const d of document.querySelectorAll('main details')) d.open = true; });
    await page.waitForTimeout(100);
    const found = await page.evaluate((minGap) => {
      const out = [];
      const main = document.querySelector('main');
      if (!main) return out;
      const INLINE = new Set(['inline', 'contents', 'none']);
      const inFlow = (el) => {
        const cs = getComputedStyle(el);
        if (INLINE.has(cs.display) || cs.visibility === 'hidden') return false;
        if (cs.position === 'absolute' || cs.position === 'fixed') return false;
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.width > 0;
      };
      const hasContent = (el) => el.matches('button, input, select, canvas, svg, img') || (el.textContent ?? '').trim().length > 0;
      const name = (el) => {
        const cls = [...el.classList].filter((c) => !/^(on|done|current|span-\d+)$/.test(c)).slice(0, 2).join('.');
        return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`;
      };
      const path = (el) => {
        const parts = [];
        for (let e = el; e && e !== main && parts.length < 3; e = e.parentElement) parts.unshift(name(e));
        return parts.join(' > ');
      };
      const snip = (el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
      for (const parent of main.querySelectorAll('*')) {
        if (parent.closest('svg, canvas')) continue;
        const pcs = getComputedStyle(parent);
        // une rangée flex/grille horizontale : ses enfants sont côte à côte, pas empilés
        if (pcs.display.includes('flex') && !pcs.flexDirection.startsWith('column') && pcs.flexWrap === 'nowrap') continue;
        const kids = [...parent.children].filter((k) => inFlow(k) && hasContent(k));
        for (let i = 1; i < kids.length; i += 1) {
          const a = kids[i - 1].getBoundingClientRect();
          const b = kids[i].getBoundingClientRect();
          const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          if (overlapX <= 0) continue;
          const gap = Math.round(b.top - a.bottom);
          if (gap < -1 || gap >= minGap) continue; // -1 : arrondi ; plus négatif = chevauchement voulu (grille)
          out.push({ gap, parent: path(parent), a: name(kids[i - 1]), b: name(kids[i]), text: `${snip(kids[i - 1])} ⟶ ${snip(kids[i])}` });
        }
      }
      return out;
    }, MIN_GAP);
    report[`${tag} ${route}`] = found;
  }
  await ctx.close();
}
await browser.close();

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  let total = 0;
  for (const [key, list] of Object.entries(report)) {
    if (list.length === 0) continue;
    total += list.length;
    console.log(`\n${key} (${list.length})`);
    for (const f of list) console.log(`  ${String(f.gap).padStart(2)} px  ${f.parent}  [${f.a} → ${f.b}]\n         ${f.text}`);
  }
  console.log(`\n${total} paire(s) collée(s) sous ${MIN_GAP} px`);
}
