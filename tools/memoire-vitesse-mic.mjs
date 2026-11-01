/**
 * Lot « mémoire et vitesse » — chemins **au micro simulé** (Chromium rejoue un WAV comme un micro).
 * Outil de développement, hors `npm test`. Suppose `npm run dev` lancé et les fixtures construites :
 *
 *   node tools/make-memoire-fixtures.mjs .shots/mic
 *   node tools/memoire-vitesse-mic.mjs sequence .shots/mic/blind-box.wav --tempo 60
 *
 * Ce que ça ne prouve pas : la vraie guitare, le vrai micro, la latence réelle (son de synthèse).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const SCENARIO = args[0];
const WAV = args.find((a) => a.endsWith('.wav'));
if (!SCENARIO || !WAV) {
  console.error('usage : node tools/memoire-vitesse-mic.mjs sequence <fichier.wav> [--tempo 60] [--seconds 40]');
  process.exit(1);
}
const BASE = process.env.BASE ?? 'http://localhost:5173';
const SHOTS = process.env.SHOTS ?? '.shots/memoire-vitesse';
const TEMPO = Number(arg('tempo', 60));
const SECONDS = Number(arg('seconds', 40));
const WIDTH = Number(arg('width', 390));
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${WAV}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const context = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, locale: 'fr-FR', permissions: ['microphone'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// état de départ connu : journal vide, box 1 de La mineur pentatonique
await page.goto(`${BASE}/#/gammes`);
await page.evaluate((tempo) => {
  localStorage.clear();
  localStorage.setItem('fretwave.scale.v1', JSON.stringify({ scaleId: 'pentatonic-minor', tonic: 'A', tuningId: 'standard', system: 'boxes', positionIndex: 0 }));
}, TEMPO);
await page.reload(); // les réglages sont lus une fois au chargement : on recharge après les avoir écrits

const lastAttempt = () => page.evaluate(() => {
  const list = JSON.parse(localStorage.getItem('fretwave.attempts.v1') ?? '{"attempts":[]}').attempts ?? [];
  return list[list.length - 1] ?? null;
});

if (SCENARIO === 'sequence') {
  await page.goto(`${BASE}/#/gammes/sequences`);
  await page.waitForFunction(() => window.__sequence);
  await page.evaluate(() => window.__sequence.setPattern('thirds'));
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: /Ouvrir le micro/ }).click();
  await page.waitForFunction(() => window.__sequence.listening, null, { timeout: 20000 });
  const tListen = Date.now();
  const sq = () => page.evaluate(() => {
    const s = window.__sequence;
    return { phase: s.phase, bpm: s.ladder?.bpm ?? null, best: s.ladder?.best ?? null, passes: s.ladder?.passes ?? 0, consumed: s.consumed, total: s.total, last: s.lastPass };
  });
  const waitPhase = async (ph, ms = 60000) => {
    const t = Date.now();
    while (Date.now() - t < ms) {
      if ((await sq()).phase === ph) return true;
      await page.waitForTimeout(100);
    }
    return false;
  };
  // 1. une vraie passe au micro simulé : le fichier commence 7 s après l'ouverture du micro, le décompte
  //    dure 4 s à 60 BPM → on lance pour que la première note tombe sur le premier temps (± 0,3 s)
  await page.waitForTimeout(Math.max(0, tListen + 2800 - Date.now()));
  await page.getByRole('button', { name: /Commencer/ }).click();
  await waitPhase('pass');
  await page.screenshot({ path: `${SHOTS}/sequence-passe.png`, fullPage: true });
  await waitPhase('between', 40000);
  console.log('passe 1 (fichier) :', JSON.stringify(await sq()));
  // 2. la passe suivante n'entend que le silence de fin du fichier : échec attendu
  await waitPhase('pass');
  await waitPhase('between', 40000);
  console.log('passe 2 (silence) :', JSON.stringify(await sq()));
  // 3. règles du palier, passes injectées (même jugement, sans dépendre du fichier) :
  //    deux réussites → +4 ; deux passes qui traînent → −5, jamais sous le départ
  for (const [label, shift, stretch] of [['propre', 0.08, 1], ['propre', 0.08, 1], ['traîne', 0.05, 1.12], ['traîne', 0.05, 1.12]]) {
    await waitPhase('pass');
    await page.evaluate(([a, b]) => window.__sequence.feedPass(a, b), [shift, stretch]);
    await page.waitForTimeout(150);
    const st = await sq();
    console.log(`injectée (${label}) :`, JSON.stringify({ bpm: st.bpm, best: st.best, passes: st.passes, ok: st.last?.ok, inTime: st.last?.inTime, acc: st.last?.accuracy }));
  }
  await page.evaluate(() => window.__sequence.stop());
  await page.waitForTimeout(300);
  const a = await lastAttempt();
  console.log('tentative :', JSON.stringify({
    kind: a?.kind, pattern: a?.pattern, bpmStart: a?.bpmStart, bpmBest: a?.bpmBest ?? null, passes: a?.passes,
    correct: a?.correct, total: a?.total, mic: a?.mic ?? null, tempoOk: a?.tempoOk,
  }));
  console.log('enregistré :', JSON.stringify(await page.evaluate(() => window.__sequence.saved)));
  // la session suivante repart du tempo validé
  console.log('prochain départ :', await page.getByRole('button', { name: /Commencer/ }).textContent());
  await page.screenshot({ path: `${SHOTS}/sequence-fin.png`, fullPage: true });
}

console.log('erreurs console :', errors.length ? [...new Set(errors)].slice(0, 8) : 'aucune');
await browser.close();
