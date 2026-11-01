/**
 * Parcours de l'app d'outils (D128) au navigateur : ouverture, À réviser, séance complète, Réviser cette
 * forme, onglets de Gammes, liste d'accords, anciennes URLs. Hors `npm test`. Suppose `npm run dev` lancé.
 *
 *   node tools/outils-check.mjs [--shots dossier]
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = arg('base', 'http://127.0.0.1:5173');
const SHOTS = arg('shots', '.shots/outils');
mkdirSync(SHOTS, { recursive: true });

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok ' : 'KO '} ${name}${detail ? ` : ${detail}` : ''}`);
};

const DAY = 86_400_000;
const recall = (i, daysAgo, patch = {}) => ({
  id: `check-${i}`, ts: Date.now() - daysAgo * DAY, kind: 'recall', scaleId: 'pentatonic-minor', tonic: 'A', tuningId: 'standard',
  system: 'boxes', positionId: `boxes:${i}`, formIndex: i, level: 3, strings: 6, correct: 23, total: 23, seconds: 60, fretMin: 5,
  missedStrings: [], tempoOk: false, fullPosition: true, ...patch,
});

const browser = await chromium.launch();

for (const [tag, width, height, mobile] of [['bureau', 1440, 900, false], ['telephone', 390, 844, true]]) {
  console.log(`\n--- ${tag}`);
  const context = await browser.newContext({ viewport: { width, height }, locale: 'fr-FR', isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|\/api\//.test(m.text())) errors.push(m.text()); });
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${tag}-${name}.png`, fullPage: true });
  const goto = async (hash) => { await page.goto(`${BASE}/${hash}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(250); };
  const text = () => page.locator('.app-content').innerText();

  // journal : deux formes dues, une forme pas due
  await goto('#/gammes');
  await page.evaluate((list) => {
    localStorage.clear();
    localStorage.setItem('fretwave.attempts.v1', JSON.stringify({ v: 1, attempts: list }));
  }, [recall(0, 10), recall(1, 10), recall(2, 0.01)]);

  // ouverture
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.bottombar');
  check('l’app s’ouvre sur Gammes', (await page.evaluate(() => location.hash)) === '#/gammes');
  const tabs = await page.locator('.navbtn').allInnerTexts();
  check('navigation des outils, sans Accueil', tabs.length === (mobile ? 4 : 5) && !tabs.includes('Accueil'), tabs.join(', '));
  const home = await text();
  check('le bloc À réviser annonce 2 formes', /À réviser/i.test(home) && /ces 2 formes/i.test(home));
  await shot('gammes');

  // séance complète : une forme juste, une forme ratée puis passée
  await page.getByRole('button', { name: /Réviser ces 2 formes/ }).click();
  await page.waitForFunction(() => window.__review?.total > 0 && window.__review.queue.length === 2);
  check('séance de 2 formes, à froid', await page.evaluate(() => window.__review.coldStep === 'cold'));
  if (mobile) {
    await page.getByRole('button', { name: '▶ Jouer' }).first().click();
    await page.waitForTimeout(300);
    await shot('revision-paysage');
    const before = await page.evaluate(() => window.__review.journalLength);
    for (const ok of [true, false, true]) {
      await page.evaluate((v) => window.__review.answer(v), ok);
      await page.waitForTimeout(30);
    }
    check('la série avance en paysage', await page.evaluate(() => window.__review.done > 0));
    await page.locator('.tab-full').getByRole('button', { name: 'Fermer' }).click();
    await page.waitForTimeout(200);
    check('fermer le jeu remet la série à zéro', await page.evaluate(() => window.__review.done === 0 && Object.keys(window.__review.errors).length === 0 && !window.__review.result));
    check('fermer le jeu n’écrit rien au journal', await page.evaluate((n) => window.__review.journalLength === n, before));
  } else {
    await shot('revision');
  }
  const answerAll = async (ok) => {
    for (let i = 0; i < 200; i++) {
      const finished = await page.evaluate((v) => {
        if (window.__review.result) return true;
        window.__review.answer(v);
        return false;
      }, ok);
      if (finished) return;
      await page.waitForTimeout(15);
    }
  };
  await answerAll(true);
  await page.waitForFunction(() => window.__review.result);
  const first = await page.evaluate(() => window.__review.result);
  check('première forme : 100 %, enregistrée', first.accuracy === 1 && first.proof);
  check('une révision annonce sa prochaine échéance', /révision dans/.test(await text()));
  check('aucune mention d’XP ou d’étoiles au résultat', !/\bXP\b|★/.test(await text()));
  await shot('resultat');
  await page.getByRole('button', { name: /^Suivant/ }).click();
  await page.waitForFunction(() => window.__review.qIndex === 1 && !window.__review.result);
  await answerAll(false);
  await page.waitForFunction(() => window.__review.result);
  check('forme ratée : sous 80 %, « Regarde la forme »', await page.evaluate(() => window.__review.coldStep === 'look'));
  await page.getByRole('button', { name: /Regarde la forme/ }).click();
  await page.waitForTimeout(200);
  await shot('regarde');
  await page.getByRole('button', { name: /J’ai vu, masquer/ }).click();
  await page.waitForFunction(() => window.__review.coldStep === 'retry' && !window.__review.result);
  await answerAll(true);
  await page.waitForFunction(() => window.__review.result);
  check('le rattrapage ne compte pas', await page.evaluate(() => window.__review.result.proof === false));
  await page.getByRole('button', { name: /Terminer la session/ }).click();
  await page.waitForFunction(() => window.__review.sessionDone);
  const bilan = await text();
  // la forme ratée à froid compte (0 %), son rattrapage non : la moyenne reste à 50 %
  check('bilan : deux formes à 50 %, un rattrapage à part', /2\s+formes/.test(bilan) && /50 %/.test(bilan) && /1 rattrapage/.test(bilan));
  await shot('bilan');
  await page.getByRole('button', { name: 'Gammes', exact: true }).first().click();
  await page.waitForTimeout(300);
  check('retour sur Gammes, rien à réviser', /Rien à réviser pour l’instant/.test(await text()));

  // une position : deux gestes, plus d'exercice
  const acts = await page.locator('.pos-item').first().locator('.pos-act').allInnerTexts();
  check('une position propose Découvrir et Séquences', acts.join() === 'Découvrir,Séquences', acts.join());

  // Découvrir
  await page.locator('.pos-item').first().getByRole('button', { name: 'Découvrir' }).click();
  await page.waitForFunction(() => location.hash === '#/gammes/jouer');
  await page.waitForTimeout(300);
  const disc = await text();
  const levels = await page.locator('.levels .level-t').allInnerTexts();
  check('trois onglets de gamme', levels.join() === 'Découvrir,Séquences,Improviser', levels.join());
  check('plus de « Niv » à l’écran', !/Niv\d/.test(disc));
  await shot('decouvrir');
  await page.getByRole('button', { name: 'Réviser cette forme' }).click();
  await page.waitForFunction(() => window.__review?.queue?.length === 1 && window.__review.total > 0);
  check('Réviser cette forme : une seule forme, à la demande', await page.evaluate(() => window.__review.queue[0].asked === true));
  await page.getByRole('button', { name: /Retour à Gammes/ }).click();
  await page.waitForTimeout(250);

  // Séquences et Improviser
  await goto('#/gammes/sequences');
  check('Séquences s’affiche sans XP ni niveau', !/\bXP\b|Niv\d/.test(await text()));
  await shot('sequences');
  await goto('#/gammes/impro');
  check('Improviser s’affiche sans XP ni niveau', !/\bXP\b|Niv\d/.test(await text()));
  await shot('impro');

  // Accords
  await goto('#/accords');
  const rows = await page.locator('.chord-row').count();
  check('40 formes d’accords', rows === 40, String(rows));
  const heads = await page.locator('.chord-surface .panel-head h2').allInnerTexts();
  check('six groupes', heads.length === 6, heads.join(', '));
  const chords = await text();
  check('aucune trace du parcours', !/Apprendre|appris|palier|QCM|sept étapes/i.test(chords));
  await shot('accords');
  await page.getByRole('button', { name: 'Écouter E plaqué' }).first().click();
  await page.waitForTimeout(400);
  check('l’écoute plaquée démarre', (await page.locator('.chord-row .chip.on').count()) === 1);
  await page.getByRole('button', { name: 'Écouter Am arpégé' }).first().click();
  await page.waitForTimeout(400);
  check('une seule écoute à la fois', (await page.locator('.chord-row .chip.on').count()) === 1);

  const head = page.locator('.chord-surface .panel-head').first();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
  const box = await head.boundingBox();
  await page.mouse.click(box.x + 60, box.y + box.height / 2);
  await page.waitForTimeout(100);
  check('toucher le titre replie la catégorie', (await page.locator('.chord-row').count()) === 32);
  check('compte écrit en accords', /8 accords/i.test(await head.innerText()));

  await page.getByRole('button', { name: 'Replier tout' }).click();
  check('Replier tout', (await page.locator('.chord-row').count()) === 0);
  await page.getByRole('button', { name: 'Déplier tout' }).click();
  check('Déplier tout', (await page.locator('.chord-row').count()) === 40);

  await page.getByRole('button', { name: 'Dictionnaire' }).click();
  const dict = page.locator('.dict');
  await dict.getByRole('button', { name: 'Fa♯', exact: true }).click();
  await dict.getByRole('button', { name: 'Mineur' }).click();
  check('dictionnaire : Fa♯m et ses variantes', /F♯m/.test(await dict.locator('.chord-name').innerText()) && (await dict.getByRole('button', { name: /^Variante/ }).count()) >= 3);

  // Réglages
  await goto('#/reglages');
  const set = await text();
  check('Réglages : plus de trous, de grille ni de vitesse', !/Trous au niveau|Grille rythmique|Tempo cible|Boîte d’accord/.test(set));
  await shot('reglages');

  // anciennes URLs
  for (const [hash, want] of [['#/hub', 'Gammes'], ['#/gammes/entrainement', 'Gammes'], ['#/accords/lecon', 'Accords'], ['#/accords/qcm', 'Accords']]) {
    await goto(hash);
    const on = await page.locator('.navbtn.on').innerText();
    check(`${hash} mène à ${want}`, on === want, on);
  }

  // révision vide
  await page.evaluate(() => localStorage.removeItem('fretwave.attempts.v1'));
  await goto('#/gammes');
  check('journal vide : pas de bloc À réviser', !/À réviser/i.test(await text()));
  await goto('#/gammes/revision');
  await page.waitForTimeout(200);
  check('journal vide : la révision le dit', /Aucune forme à réviser/.test(await text()));

  check('aucune erreur console', errors.length === 0, errors.slice(0, 3).join(' / ').slice(0, 300));
  await context.close();
}

await browser.close();
console.log(failed ? `\n${failed} contrôle(s) en échec` : '\ntous les contrôles passent');
process.exit(failed ? 1 : 0);
