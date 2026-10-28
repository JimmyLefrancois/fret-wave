/**
 * Audit « rien de transparent sur le décor » — boutons, pastilles et textes posés sur la scène.
 *
 * La scène (soleil, grille, étoiles) est un canvas **derrière** l'application : tout ce qui n'a pas de
 * fond propre se lit par-dessus, avec un contraste imprévisible. Cet outil parcourt chaque route et
 * signale :
 *
 *  - les éléments **interactifs** (bouton, lien, commutateur, résumé de `<details>`) dont le fond est
 *    transparent — un bouton doit se voir comme un bouton, même au repos ;
 *  - les blocs de **texte** dont aucun ancêtre (sous `<main>`) n'a de fond opaque.
 *
 *   node tools/contrast-audit.mjs            # rapport lisible
 *   node tools/contrast-audit.mjs --json     # pour comparer avant/après
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
];

const JSON_OUT = process.argv.includes('--json');
const browser = await chromium.launch();
const report = {};

for (const [name, hash] of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-FR' });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:5173/${hash}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  report[name] = await page.evaluate(() => {
    const alphaOf = (color) => {
      const m = /rgba?\(([^)]+)\)/.exec(color || '');
      if (!m) return 0;
      const parts = m[1].split(',').map((s) => Number.parseFloat(s));
      return parts.length > 3 ? parts[3] : 1;
    };
    /** Fond effectif : l'élément lui-même, puis ses ancêtres (sous `<main>`) jusqu'à un fond opaque. */
    const backing = (el) => {
      const own = getComputedStyle(el).backgroundColor;
      if (alphaOf(own) > 0.6) return el;
      let n = el.parentElement;
      while (n && n.tagName !== 'MAIN' && n.tagName !== 'BODY') {
        const cs = getComputedStyle(n);
        if (alphaOf(cs.backgroundColor) > 0.6) return n;
        // une image de fond peinte compte comme fond (dégradé compris : l'affiche d'accueil est opaque
        // en bas, là où le titre se pose) — l'outil ne mesure pas le contraste, il vérifie qu'il y a
        // quelque chose de peint.
        if (cs.backgroundImage !== 'none') return n;
        n = n.parentElement;
      }
      return null;
    };
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
    };
    const label = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 42);
    const describe = (el) => `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(' ')[0]}` : ''}`;

    const interactive = [];
    const texts = [];

    const interSel = 'button, a[href], [role="switch"], [role="tab"], summary, input[type="checkbox"], select';
    for (const el of document.querySelectorAll(interSel)) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      const own = alphaOf(cs.backgroundColor);
      if (own <= 0.6 && !backing(el)) {
        interactive.push({ sel: describe(el), text: label(el), bg: cs.backgroundColor });
      }
      void cs;
    }

    // blocs de texte : paragraphes, titres, libellés, listes
    for (const el of document.querySelectorAll('p, h1, h2, h3, li, .t-small, .t-body, .t-label, .tag')) {
      if (!visible(el)) continue;
      if (!(el.textContent || '').trim()) continue;
      // on ne garde que le porteur du texte (pas un parent dont l'enfant porte déjà un fond)
      if (el.querySelector('p, li')) continue;
      if (!backing(el)) texts.push({ sel: describe(el), text: label(el) });
    }

    const seen = new Set();
    const uniq = (arr) => arr.filter((x) => {
      const k = `${x.sel}|${x.text}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { interactive: uniq(interactive), texts: uniq(texts) };
  });
  await ctx.close();
}

await browser.close();
mkdirSync('.shots/audit', { recursive: true });
writeFileSync('.shots/audit/contrast.json', JSON.stringify(report, null, 1));

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 1));
} else {
  let total = 0;
  for (const [route, r] of Object.entries(report)) {
    const n = r.interactive.length + r.texts.length;
    total += n;
    console.log(`\n=== ${route} — ${n} élément(s) sans fond`);
    for (const x of r.interactive) console.log(`  [bouton] ${x.sel} « ${x.text} » (${x.bg})`);
    for (const x of r.texts) console.log(`  [texte]  ${x.sel} « ${x.text} »`);
  }
  console.log(`\nTOTAL : ${total}`);
}
process.exit(0);
