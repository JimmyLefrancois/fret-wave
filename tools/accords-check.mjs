/**
 * Vérification de la phase 4a (module Accords) — outil de développement, jamais exécuté par les tests.
 * Suppose `npm run dev` déjà lancé.
 *
 *   node tools/accords-check.mjs            -> captures + mesures dans .shots/accords
 *
 * Ce que l'outil vérifie, et qui ne se voit pas dans un test unitaire :
 *  - aucun débordement horizontal à 390 px et à 1 440 px ;
 *  - les quatre étapes de la leçon s'atteignent au clic (vrai clic souris, pas un appel de fonction) ;
 *  - la boîte d'accord est réellement dessinée (canvas non vide) et suit l'étape « Construire » ;
 *  - le parcours liste les accords avec leur état, et la recommandation s'affiche ;
 *  - aucune erreur console.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173';
const OUT = '.shots/accords';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function session(width, height, name) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: width < 700 ? 2 : 1,
    isMobile: width < 700,
    hasTouch: width < 700,
    locale: 'fr-FR',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // débordement réel = la page peut se déplacer horizontalement, ou un élément dépasse la fenêtre
  const overflow = () => page.evaluate(() => {
    const de = document.documentElement;
    const vw = window.innerWidth;
    const wide = [];
    for (const el of document.querySelectorAll('main.shell *')) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) {
        wide.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').slice(0, 2).join('.')} [${Math.round(r.left)}..${Math.round(r.right)}] vw=${vw}`);
      }
    }
    return { doc: { sw: de.scrollWidth, cw: de.clientWidth, vw }, outOfViewport: [...new Set(wide)].slice(0, 6) };
  });

  const metrics = {};

  await page.goto(`${BASE}/#/accords`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/${name}-accords.png`, fullPage: true });
  metrics.accords = await overflow();
  metrics.cards = await page.locator('.chord-row').count();
  metrics.recommendation = (await page.locator('main.shell h3.card-title').first().innerText()).trim();

  await page.goto(`${BASE}/#/accords/lecon`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/${name}-01-decouvrir.png`, fullPage: true });
  metrics.decouvrir = await overflow();
  metrics.boxDrawn = await page.evaluate(() => {
    const c = document.querySelector('.chordbox canvas');
    if (!c) return null;
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let colored = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) colored++;
    return { w: c.width, h: c.height, coloredPixels: colored };
  });

  // construire : vrai clic
  await page.getByRole('button', { name: /Construire/ }).first().click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/${name}-02-construire.png`, fullPage: true });
  metrics.construire = await overflow();
  metrics.fingerSteps = await page.locator('.finger-step').count();
  metrics.pendingDots = await page.evaluate(() => {
    const c = document.querySelector('.chordbox canvas');
    return c ? { w: c.width, h: c.height } : null;
  });

  // vérifier sans micro : on déclare les cordes une par une
  await page.getByRole('button', { name: 'Doigt posé' }).first().click();
  await page.getByRole('button', { name: 'Doigt posé' }).first().click();
  await page.getByRole('button', { name: /Vérifier →/ }).first().click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/${name}-03-verifier.png`, fullPage: true });
  metrics.verifier = await overflow();
  metrics.checkRows = await page.locator('.check-row').count();
  const sonne = page.getByRole('button', { name: 'Elle sonne' });
  for (let i = 0; i < 6; i++) {
    if (await sonne.count() === 0) break;
    await sonne.first().click();
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/${name}-04-verifier-fini.png`, fullPage: true });
  metrics.checkDoneText = (await page.locator('.stat-line').last().innerText()).trim();

  await page.getByRole('button', { name: /Plaquer →/ }).first().click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/${name}-05-plaquer.png`, fullPage: true });
  metrics.plaquer = await overflow();

  metrics.journal = await page.evaluate(() => {
    const raw = localStorage.getItem('fretwave.attempts.v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed.attempts ?? []).slice(-3).map((a) => ({ kind: a.kind, chordId: a.chordId, correct: a.correct, total: a.total }));
  });

  metrics.errors = errors;
  await ctx.close();
  return metrics;
}

const phone = await session(390, 844, 'phone');
const desktop = await session(1440, 900, 'desktop');

console.log(JSON.stringify({ phone, desktop }, null, 2));
await browser.close();
