/**
 * Mesures de mise en page et de lisibilité (Playwright) — outil de développement.
 *
 *   node tools/layout-check.mjs                      -> pages de l'app à 390×844 et 1440×900
 *   node tools/layout-check.mjs --hash '#/accordeur'
 *
 * Ce qui est mesuré, et pas estimé :
 *  - **débordement horizontal** (une page qui glisse latéralement sur téléphone est un défaut) ;
 *  - **contraste réel** de chaque texte, couleur composée sur le fond effectif (alpha inclus) ;
 *  - **taille des cibles tactiles** des boutons visibles.
 *
 * Suppose `npm run dev` lancé.
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = arg('base', 'http://127.0.0.1:5173');
const ONLY = arg('hash', null);
const PAGES = ONLY ? [ONLY] : ['#/hub', '#/gammes', '#/gammes/jouer', '#/gammes/entrainement', '#/accordeur', '#/reglages'];
const SIZES = [
  { w: 390, h: 844, dpr: 3 },
  { w: 1440, h: 900, dpr: 1 },
];

const browser = await chromium.launch();

const MEASURE = () => {
  const lum = ([r, g, b]) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return null;
    const p = m[1].split(',').map((v) => parseFloat(v));
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const bgOf = (el) => {
    let node = el;
    let acc = null;
    while (node && node !== document.documentElement) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0) {
        acc = acc === null ? c : over(acc, c);
        if (c.a >= 1) return acc;
      }
      node = node.parentElement;
    }
    const body = parse(getComputedStyle(document.body).backgroundColor) ?? { r: 13, g: 2, b: 33, a: 1 };
    return acc === null ? body : over(acc, body);
  };
  const contrast = (a, b) => {
    const l1 = lum([a.r, a.g, a.b]);
    const l2 = lum([b.r, b.g, b.b]);
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  };

  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = (n.nodeValue ?? '').trim();
    if (t.length < 2) continue;
    const el = n.parentElement;
    if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.5) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    const fgOn = fg.a < 1 ? over(fg, bgOf(el)) : fg;
    texts.push({
      text: t.slice(0, 42),
      ratio: Math.round(contrast(fgOn, bgOf(el)) * 10) / 10,
      size: parseFloat(cs.fontSize),
      tag: el.tagName.toLowerCase(),
    });
  }
  const small = texts.filter((t) => t.size < 18 && t.ratio < 4.5).sort((a, b) => a.ratio - b.ratio);
  const min = texts.reduce((m, t) => (t.ratio < m.ratio ? t : m), texts[0] ?? { ratio: 99, text: '' });

  const buttons = [...document.querySelectorAll('button, a, input[type=range], select')]
    .filter((el) => el.offsetParent !== null)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { label: (el.textContent ?? el.getAttribute('aria-label') ?? el.tagName).trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) };
    });

  return {
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    scrollH: document.documentElement.scrollHeight,
    textCount: texts.length,
    min,
    violations: small.slice(0, 6),
    smallestTargets: buttons.sort((a, b) => Math.min(a.w, a.h) - Math.min(b.w, b.h)).slice(0, 5),
  };
};

for (const size of SIZES) {
  const context = await browser.newContext({
    viewport: { width: size.w, height: size.h },
    deviceScaleFactor: size.dpr,
    isMobile: size.w < 700,
    hasTouch: size.w < 700,
    locale: 'fr-FR',
  });
  const page = await context.newPage();
  for (const hash of PAGES) {
    await page.goto(`${BASE}/${hash}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.shell', { timeout: 20000 });
    await page.waitForTimeout(500);
    const m = await page.evaluate(MEASURE);
    console.log(
      `${size.w}×${size.h} ${hash.padEnd(26)} débordement ${String(m.overflowX).padStart(4)} px · `
      + `${m.textCount} textes · contraste min ${m.min.ratio}:1 (« ${m.min.text} ») · `
      + `violations ${m.violations.length} · cible min ${m.smallestTargets[0] ? `${m.smallestTargets[0].w}×${m.smallestTargets[0].h}` : '—'}`,
    );
    for (const v of m.violations) console.log(`      ⚠ ${v.ratio}:1 ${v.size}px "${v.text}"`);
    const bad = m.smallestTargets.filter((t) => Math.min(t.w, t.h) < 32);
    if (bad.length) console.log('      petites cibles :', bad.map((t) => `${t.label} ${t.w}×${t.h}`).join(' | '));
  }
  await context.close();
}

await browser.close();
