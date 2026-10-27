/**
 * Vérification de la phase 4b — outil de développement, jamais exécuté par les tests.
 * Suppose `npm run dev` déjà lancé et les WAV construits par `tools/make-mic-fixtures.sh`.
 *
 *   node tools/phase4b-check.mjs            -> captures + mesures dans .shots/4b
 *   node tools/phase4b-check.mjs --mic      -> en plus : pose à froid et enchaînement au micro simulé
 *
 * Ce que l'outil prouve, et qu'aucun test unitaire ne peut prouver :
 *  - les **sept** étapes s'atteignent au clic, sans débordement, l'action principale au-dessus de la barre ;
 *  - le QCM fonctionne sans matériel : six questions, réponse, correction, écriture au journal ;
 *  - la progression « Intégrer » s'écrit comme une activité **déclarée** (aucun chiffre de justesse) ;
 *  - au micro simulé : la pose à froid mesure un temps réel et écrit `kind: 'cold'` avec sa limite,
 *    et l'enchaînement Em→Am compte de vrais changements entre deux basses.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173';
const OUT = '.shots/4b';
const WITH_MIC = process.argv.includes('--mic');
mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mesures de mise en page : débordement réel, et action principale par rapport à la barre du bas. */
async function layoutMetrics(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const vw = window.innerWidth;
    const wide = [];
    for (const el of document.querySelectorAll('main.shell *')) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) {
        wide.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').slice(0, 2).join('.')} [${Math.round(r.left)}..${Math.round(r.right)}]`);
      }
    }
    const nav = document.querySelector('.bottombar');
    const navRect = nav ? nav.getBoundingClientRect() : null;
    // la barre est en bas sur téléphone, en haut au-delà de 900 px : la comparaison n'a de sens qu'en bas
    const navBottom = navRect !== null && navRect.top > window.innerHeight / 2;
    const primary = document.querySelector('main.shell .btn-primary');
    const pr = primary ? primary.getBoundingClientRect() : null;
    const steps = [...document.querySelectorAll('.step-btn')].map((b) => b.textContent?.replace(/\s+/g, ' ').trim());
    return {
      scrollWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
      innerWidth: vw,
      overflow: de.scrollWidth > de.clientWidth + 1,
      outOfViewport: [...new Set(wide)].slice(0, 5),
      primaryButton: pr ? { label: primary.textContent?.trim(), top: Math.round(pr.top), bottom: Math.round(pr.bottom) } : null,
      navPosition: navRect ? (navBottom ? 'bottom' : 'top') : null,
      navTop: navRect === null ? null : Math.round(navRect.top),
      primaryAboveNav: navBottom && pr ? pr.bottom <= navRect.top + 1 : null,
      steps,
      stepRows: (() => {
        const tops = new Set(steps.map((_, i) => Math.round(document.querySelectorAll('.step-btn')[i].getBoundingClientRect().top)));
        return tops.size;
      })(),
    };
  });
}

async function readJournal(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('fretwave.attempts.v1');
    const attempts = raw ? JSON.parse(raw).attempts ?? [] : [];
    return attempts.map((a) => ({
      kind: a.kind, chordId: a.chordId, chordIdB: a.chordIdB, progressionId: a.progressionId,
      correct: a.correct, total: a.total, seconds: a.seconds, limitSec: a.limitSec, changeMs: a.changeMs,
    }));
  });
}

async function openLesson(page) {
  await page.goto(`${BASE}/#/accords/lecon`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.step-nav');
  // un accord connu et simple, sans état résiduel
  await page.evaluate(() => localStorage.setItem('fretwave.chord.v1', JSON.stringify({ voicingId: 'Em-022000', palier: 'P1' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.step-nav');
}

async function clickStep(page, label) {
  await page.getByRole('button', { name: new RegExp(label) }).first().click();
  await wait(200);
}

// ---------------------------------------------------------------------------
// A. mise en page, QCM, progression déclarée — sans micro
// ---------------------------------------------------------------------------

async function sessionNoMic(width, height, name) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: width < 700 ? 2 : 1, locale: 'fr-FR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`${BASE}/#/accords`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.removeItem('fretwave.attempts.v1'); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/${name}-00-parcours.png`, fullPage: true });
  const parcours = await layoutMetrics(page);

  await openLesson(page);
  const steps = [];
  for (const [label, file] of [['Découvrir', '01'], ['Construire', '02'], ['Vérifier', '03'], ['Plaquer', '04'], ['Fixer', '05'], ['Enchaîner', '06'], ['Intégrer', '07']]) {
    await clickStep(page, label);
    const m = await layoutMetrics(page);
    await page.screenshot({ path: `${OUT}/${name}-${file}-${label.toLowerCase()}.png`, fullPage: true });
    steps.push({ label, ...m });
  }
  // la leçon entière, en une capture : c'est ainsi qu'on voit une superposition
  await page.screenshot({ path: `${OUT}/${name}-lecon-full.png`, fullPage: true });
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);

  // messages sans micro : Fixer et Enchaîner doivent refuser de mesurer, et le dire
  await clickStep(page, 'Fixer');
  const fixerNoMic = await page.evaluate(() => [...document.querySelectorAll('p.ko')].map((p) => p.textContent?.trim()));
  await clickStep(page, 'Enchaîner');
  const enchainerNoMic = await page.evaluate(() => ({
    messages: [...document.querySelectorAll('p.ko')].map((p) => p.textContent?.trim()),
    chips: [...document.querySelectorAll('.pair-list .chip')].map((c) => c.textContent?.trim()),
  }));

  // Intégrer : déclaration d'une progression
  await clickStep(page, 'Intégrer');
  const progressions = await page.evaluate(() => [...document.querySelectorAll('.pair-list .chip')].map((c) => c.textContent?.trim()));
  await page.getByRole('button', { name: 'Je l’ai jouée' }).first().click();
  await wait(300);
  await page.screenshot({ path: `${OUT}/${name}-07-integrer-declare.png`, fullPage: true });
  const afterProg = await readJournal(page);

  // QCM : six questions répondues à la suite
  await page.goto(`${BASE}/#/accords/qcm`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.quiz-option');
  await page.screenshot({ path: `${OUT}/${name}-08-qcm.png`, fullPage: true });
  const quizMetrics = await layoutMetrics(page);
  const prompts = [];
  for (let i = 0; i < 6; i++) {
    prompts.push((await page.locator('.quiz-head p.t-body').first().innerText()).trim());
    await page.locator('.quiz-option').first().click();
    await wait(120);
    if (i === 0) await page.screenshot({ path: `${OUT}/${name}-08-qcm-repondu.png`, fullPage: true });
    const next = page.getByRole('button', { name: /Suivante|Voir le résultat/ });
    await next.first().click();
    await wait(200);
  }
  await page.screenshot({ path: `${OUT}/${name}-08-qcm-resultat.png`, fullPage: true });
  const quizResult = (await page.locator('.stat-line').first().innerText()).trim();
  const journal = await readJournal(page);

  await ctx.close();
  return {
    parcours,
    steps,
    pageHeight,
    fixerNoMic,
    enchainerNoMic,
    progressions,
    afterProg,
    quizMetrics,
    prompts,
    quizResult,
    journal,
    errors,
  };
}

// ---------------------------------------------------------------------------
// B. micro simulé : pose à froid et enchaînement
// ---------------------------------------------------------------------------

async function micSession() {
  const results = {};

  // B1. Enchaîner Em → Am : le fichier joue E2, A2, E2, A2… en boucle
  {
    const browserMic = await chromium.launch({
      args: [
        '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${process.cwd()}/.shots/mic/basses-em-am.wav`,
        '--autoplay-policy=no-user-gesture-required',
      ],
    });
    const ctx = await browserMic.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-FR', permissions: ['microphone'] });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/#/accords`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.removeItem('fretwave.attempts.v1'));
    await openLesson(page);
    await clickStep(page, 'Enchaîner');
    await page.getByRole('switch', { name: /^Micro/ }).first().click();
    await wait(1500);
    // la paire Em → Am (elle existe dans le parcours)
    // la paire Em → Am : deux basses différentes (Mi grave puis La), c'est le cas de référence
    const chip = page.getByRole('button', { name: /Em\s*→\s*Am/ });
    if (await chip.count()) await chip.first().click();
    await page.getByRole('button', { name: /Démarrer · 30 s/ }).click();
    await wait(14_000);
    await page.getByRole('button', { name: 'Arrêter' }).first().click();
    await wait(600);
    await page.screenshot({ path: `${OUT}/mic-enchainer.png`, fullPage: true });
    const screen = await page.evaluate(() => {
      const box = document.querySelector('.drill-result');
      return box ? box.innerText.replace(/\s+/g, ' ').trim() : null;
    });
    const journal = await readJournal(page);
    results.enchainer = { screen, journal: journal.slice(-2), errors };
    await ctx.close();
    await browserMic.close();
  }

  // B2. Fixer : le fichier joue l'arpège de Mi mineur (E2 B2 E3 G3 B3 E4) en boucle
  {
    const browserMic = await chromium.launch({
      args: [
        '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${process.cwd()}/.shots/mic/em.wav`,
        '--autoplay-policy=no-user-gesture-required',
      ],
    });
    const ctx = await browserMic.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-FR', permissions: ['microphone'] });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/#/accords`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.removeItem('fretwave.attempts.v1'));
    await openLesson(page);
    await clickStep(page, 'Fixer');
    await page.getByRole('switch', { name: /^Micro/ }).first().click();
    await wait(1500);
    await page.getByRole('button', { name: /Démarrer · \d+ s/ }).click();
    // l'arpège complet prend ~10 s (six notes de 1,75 s)
    let done = false;
    for (let i = 0; i < 40 && !done; i++) {
      await wait(700);
      done = (await page.locator('.stat-line').count()) > 0;
    }
    await page.screenshot({ path: `${OUT}/mic-fixer.png`, fullPage: true });
    const screen = await page.evaluate(() => {
      const stat = document.querySelector('.stat-line')?.textContent?.trim() ?? null;
      const detail = document.querySelector('.stat-line')?.nextElementSibling?.textContent?.trim() ?? null;
      const chrono = document.querySelector('.cold-chrono')?.textContent?.trim() ?? null;
      return { stat, detail, chrono, rows: [...document.querySelectorAll('.check-row .tag')].map((t) => t.textContent?.trim()) };
    });
    const journal = await readJournal(page);
    results.fixer = { screen, journal: journal.slice(-2), errors };
    await ctx.close();
    await browserMic.close();
  }

  // B3. Accordage guidé : le fichier joue les six cordes à vide dans l'ordre (6 → 1)
  {
    const browserMic = await chromium.launch({
      args: [
        '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${process.cwd()}/.shots/mic/accordage.wav`,
        '--autoplay-policy=no-user-gesture-required',
      ],
    });
    const ctx = await browserMic.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-FR', permissions: ['microphone'] });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/#/accordeur`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.removeItem('fretwave.tuning.v1'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Activer l’écoute' }).click();
    await wait(2000);
    await page.screenshot({ path: `${OUT}/mic-accordeur.png`, fullPage: true });
    await page.getByRole('button', { name: /Commencer par la corde/ }).click();
    let state = null;
    for (let i = 0; i < 40; i++) {
      await wait(700);
      state = await page.evaluate(() => {
        const guide = document.querySelector('.guide');
        return guide ? guide.innerText.replace(/\s+/g, ' ').trim() : null;
      });
      if (state && /accordée/.test(state)) break;
    }
    await page.screenshot({ path: `${OUT}/mic-accordage-guide.png`, fullPage: true });
    const record = await page.evaluate(() => localStorage.getItem('fretwave.tuning.v1'));
    results.accordage = { screen: state, record, errors };
    await ctx.close();
    await browserMic.close();
  }

  return results;
}

const browser = await chromium.launch();
const phone = await sessionNoMic(390, 844, 'phone');
const desktop = await sessionNoMic(1440, 900, 'desktop');
await browser.close();

const mic = WITH_MIC ? await micSession() : null;
console.log(JSON.stringify({ phone, desktop, mic }, null, 2));
