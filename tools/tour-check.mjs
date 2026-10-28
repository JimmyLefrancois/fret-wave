/**
 * Tour complet des pages — outil de développement, jamais exécuté par les tests.
 * Suppose `npm run dev` déjà lancé.
 *
 *   node tools/tour-check.mjs              -> audit + captures dans .shots/tour
 *   node tools/tour-check.mjs --only gammes
 *
 * Ce que l'outil cherche, et qui ne se voit pas dans un test unitaire :
 *  - **largeur** : un bloc (tablature, barre de positions, bande d'exercice) plus étroit ou plus large
 *    que la colonne ou le panneau qui le contient — le défaut « la tablature ne fait pas la même
 *    largeur que le reste » ;
 *  - **alignement** : bords gauches qui ne coïncident pas dans une même colonne ;
 *  - **débordement** : page défilable horizontalement, ou élément hors fenêtre ;
 *  - **textes trop petits** (moins de 11 px) et **erreurs console**.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173';
const OUT = '.shots/tour';
mkdirSync(OUT, { recursive: true });

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

const ROUTES = [
  ['hub', '#/hub'],
  ['gammes', '#/gammes'],
  ['gammes-jouer', '#/gammes/jouer'],
  ['gammes-entrainement', '#/gammes/entrainement'],
  ['gammes-revision', '#/gammes/revision'],
  ['gammes-impro', '#/gammes/impro'],
  ['accords', '#/accords'],
  ['accords-qcm', '#/accords/qcm'],
  ['accordeur', '#/accordeur'],
  ['reglages', '#/reglages'],
  ['tab', '#/tab'],
  ['audio', '#/audio'],
  ['theorie', '#/theorie'],
];

/** Étapes de la leçon d'accord : chacune est une page à part entière. */
const CHORD_STEPS = ['01 Découvrir', '02 Construire', '03 Vérifier', '04 Plaquer', '05 Fixer', '06 Enchaîner', '07 Intégrer'];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mesure la géométrie : colonne, panneaux, blocs larges, alignements, tailles de texte. */
async function geometry(page) {
  return page.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left), w: Math.round(r.width), right: Math.round(r.right) };
    };
    const contentBox = (el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight);
      const bl = parseFloat(cs.borderLeftWidth), br = parseFloat(cs.borderRightWidth);
      return { x: Math.round(r.left + bl + pl), w: Math.round(r.width - bl - br - pl - pr) };
    };
    const shell = document.querySelector('main.shell, main.wide, main');
    const de = document.documentElement;
    const vw = window.innerWidth;

    // la colonne de référence : la boîte de contenu du shell
    const shellContent = shell ? contentBox(shell) : null;

    const panels = [...document.querySelectorAll('main.shell > .panel, main.wide > .card, main > .card')].map((p) => {
      const el = p.querySelector(':scope > *');
      return {
        label: (p.querySelector('.t-label')?.textContent ?? '').trim().slice(0, 28),
        box: box(p), content: contentBox(p), firstChildTag: el?.tagName ?? null,
        full: p.classList.contains('span-12') || !/span-\d/.test(p.className),
      };
    });

    // blocs « larges » qui doivent occuper la même largeur que leur contenant
    const wide = [];
    const WIDE_SEL = '.tabview, .pos-nav, .quiz-strip, .exercise-strip, .step-nav, .cta-block';
    const root = 'main.shell, main.wide, main';
    for (const el of [...document.querySelectorAll(WIDE_SEL)]) {
      if (!el.closest(root)) continue;
      const parent = el.parentElement.closest('.panel') ?? shell;
      const base = parent.classList.contains('panel')
        ? contentBox(parent)
        : (shell ? contentBox(shell) : null);
      // la cible réelle = boîte de contenu du parent, décalée par les marges négatives de l'élément
      // (une tablature déborde volontairement le padding du panneau sur téléphone : la portée occupe
      // le panneau, le texte garde sa marge — on mesure ce que la feuille de style demande vraiment)
      const ecs = getComputedStyle(el);
      let ml = parseFloat(ecs.marginLeft) || 0;
      let mr = parseFloat(ecs.marginRight) || 0;
      // Les marges négatives peuvent être portées par un **conteneur intermédiaire** et non par l'élément
      // lui-même (la tablature du QCM est dans `.quiz-tab`, qui prend la largeur du panneau). On additionne
      // donc celles de tous les ancêtres jusqu'au panneau : mesurer le seul élément le déclarait trop large.
      for (let anc = el.parentElement; anc && anc !== parent; anc = anc.parentElement) {
        const acs = getComputedStyle(anc);
        const al = parseFloat(acs.marginLeft) || 0;
        const ar = parseFloat(acs.marginRight) || 0;
        if (al < 0) ml += al;
        if (ar < 0) mr += ar;
      }
      const target = base ? { x: Math.round(base.x + ml), w: Math.round(base.w - ml - mr) } : null;
      if (!target) continue;
      const b = box(el);
      wide.push({
        cls: el.className.toString().split(' ')[0],
        box: b,
        target,
        delta: b.w - target.w,
        leftDelta: b.x - target.x,
        parent: parent.classList.contains('panel') ? `panel:${(parent.querySelector('.t-label')?.textContent ?? '').trim().slice(0, 20)}` : 'shell',
      });
    }

    // les canvas de tablature : largeur réelle du dessin dans son bloc
    const canvases = [...document.querySelectorAll('.tabview canvas')].map((c) => {
      const stage = c.parentElement;
      return { canvas: box(c), stage: stage ? box(stage) : null, cssW: c.style.width || null };
    });

    // alignements : bords gauches distincts parmi les panneaux et les blocs larges
    // seuls les blocs de PREMIER niveau comptent : dans une grille à deux colonnes, un panneau de
    // colonne droite n'a pas le même bord gauche, et c'est normal
    const lefts = new Map();
    for (const p of panels) {
      if (!p.full) continue;
      lefts.set(p.box.x, (lefts.get(p.box.x) ?? 0) + 1);
    }
    for (const w of wide) {
      if (w.parent !== 'shell') continue;
      lefts.set(w.box.x, (lefts.get(w.box.x) ?? 0) + 1);
    }

    // textes trop petits (hors tablature, qui est un canvas)
    const smallText = [];
    for (const el of document.querySelectorAll(`${root}, ${root} *`)) {
      if (!el.textContent || el.children.length > 0) continue;
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      if (cs.visibility === 'hidden' || cs.display === 'none' || size >= 11) continue;
      smallText.push({ tag: el.tagName.toLowerCase(), cls: el.className.toString().split(' ')[0], size, text: el.textContent.trim().slice(0, 24) });
    }

    // texte tronqué : un élément qui masque son débordement et dont le contenu dépasse
    const truncated = [];
    for (const el of document.querySelectorAll(`${root}, ${root} *`)) {
      const cs = getComputedStyle(el);
      if (cs.overflowX !== 'hidden' && cs.textOverflow !== 'ellipsis') continue;
      if (el.children.length > 0 || !el.textContent?.trim()) continue;
      if (el.scrollWidth > el.clientWidth + 1) truncated.push(`« ${el.textContent.trim().slice(0, 22)} » ${el.scrollWidth}>${el.clientWidth}`);
    }

    // en-tête : sous-titre sur plusieurs lignes (l'étiquette prend la place du texte)
    const headSub = document.querySelector('main .page-head .t-small');
    const headLines = headSub ? Math.round(headSub.getBoundingClientRect().height / (parseFloat(getComputedStyle(headSub).lineHeight) || 16)) : 0;

    const outOfViewport = [];
    for (const el of document.querySelectorAll(`${root}, ${root} *`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
        outOfViewport.push(`${el.tagName.toLowerCase()}.${el.className.toString().split(' ')[0]} [${Math.round(r.left)}..${Math.round(r.right)}]`);
      }
    }

    return {
      vw,
      shell: shell ? box(shell) : null,
      shellContent,
      panels,
      wide,
      canvases,
      leftEdges: [...lefts.keys()].sort((a, b) => a - b),
      smallText: smallText.slice(0, 12),
      smallTextCount: smallText.length,
      outOfViewport: [...new Set(outOfViewport)].slice(0, 8),
      truncated: [...new Set(truncated)].slice(0, 8),
      headLines,
      headSubLen: headSub?.textContent?.trim().length ?? 0,
      overflow: de.scrollWidth > de.clientWidth + 1,
      scrollWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
      docHeight: de.scrollHeight,
    };
  });
}

/** Un rapport lisible : ce qui ne va pas, en une ligne par défaut. */
function problems(name, g) {
  const out = [];
  if (g.overflow) out.push(`débordement horizontal : ${g.scrollWidth} > ${g.clientWidth}`);
  if (g.outOfViewport.length) out.push(`hors fenêtre : ${g.outOfViewport.join(' | ')}`);
  if (g.truncated?.length) out.push(`texte tronqué : ${g.truncated.join(' | ')}`);
  if ((g.headLines ?? 0) > 1 && (g.headSubLen ?? 0) <= 60) out.push(`sous-titre d'en-tête sur ${g.headLines} lignes`);
  for (const w of g.wide) {
    if (Math.abs(w.delta) > 2) out.push(`${w.cls} (${w.parent}) largeur ${w.box.w} au lieu de ${w.target.w} (${w.delta > 0 ? '+' : ''}${w.delta})`);
    else if (Math.abs(w.leftDelta) > 2) out.push(`${w.cls} (${w.parent}) bord gauche ${w.box.x} au lieu de ${w.target.x}`);
  }
  if (g.leftEdges.length > 2) out.push(`bords gauches incohérents : ${g.leftEdges.join(', ')}`);
  if (g.smallTextCount > 0) out.push(`${g.smallTextCount} texte(s) sous 11 px : ${g.smallText.map((s) => `${s.size}px « ${s.text} »`).slice(0, 4).join(', ')}`);
  return out;
}

const browser = await chromium.launch();
const report = {};

/** Ouvre l'app une fois : le chargement du son ne doit pas être refait à chaque page. */
async function boot(page) {
  await page.goto(`${BASE}/#/hub`, { waitUntil: 'networkidle' });
  try {
    await page.waitForSelector('main.shell, main.wide, main', { timeout: 25000 });
  } catch {
    // écran de chargement : on continue sans le son (les pages se mesurent pareil)
    const skip = page.getByRole('button', { name: /Continuer sans le son|Réessayer/ });
    if (await skip.count()) await skip.first().click();
    await page.waitForSelector('main.shell, main.wide, main', { timeout: 15000 });
  }
}

async function go(page, hash) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await wait(500);
  await page.waitForSelector('main.shell, main.wide, main', { timeout: 15000 });
  await wait(350);
}

async function visit(page, name, hash, width, tag) {
  await go(page, hash);
  await page.screenshot({ path: `${OUT}/${tag}-${name}.png`, fullPage: true });
  const g = await geometry(page);
  report[tag] ??= {};
  report[tag][name] = { problems: problems(name, g), ...g };
}

for (const [w, h, tag] of [[390, 844, 'phone'], [1440, 900, 'desktop']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 700 ? 2 : 1, locale: 'fr-FR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await boot(page);

  for (const [name, hash] of ROUTES) {
    if (only && !name.includes(only)) continue;
    await visit(page, name, hash, w, tag);
  }

  // la leçon d'accord : une page par étape
  if (!only || 'accords-lecon'.includes(only)) {
    await go(page, '#/accords/lecon');
    await page.waitForSelector('.step-nav');
    await page.evaluate(() => localStorage.setItem('fretwave.chord.v1', JSON.stringify({ voicingId: 'Em-022000', palier: 'P1' })));
    await go(page, '#/hub');
    await go(page, '#/accords/lecon');
    await page.waitForSelector('.step-nav');
    for (const step of CHORD_STEPS) {
      await page.getByRole('button', { name: new RegExp(step) }).first().click();
      await wait(400);
      const name = `lecon-${step.slice(0, 2)}`;
      await page.screenshot({ path: `${OUT}/${tag}-${name}.png`, fullPage: true });
      const g = await geometry(page);
      report[tag][name] = { step, problems: problems(name, g), ...g };
    }
  }

  report[tag]._errors = errors;
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 1));
