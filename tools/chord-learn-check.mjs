/** Vérification navigateur de la découverte et des deux blocs du hub. Vite sur :5173. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const out = '/tmp/fretwave-chord-learn';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const theme of ['synthwave', 'dawn']) for (const width of [1440, 1100, 900, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(theme => {
      localStorage.setItem('fretwave.settings.v1', JSON.stringify({ theme }));
      localStorage.setItem('fretwave.attempts.v1', JSON.stringify({ v: 1, attempts: [{
        id: 'learn-check', ts: Date.now()-864000000, kind: 'recall', scaleId: 'pentatonic-minor', tonic: 'A', tuningId: 'standard',
        system: 'boxes', positionId: 'boxes:0', formIndex: 0, level: 3, strings: 6, correct: 23, total: 23, seconds: 60,
        fretMin: 5, missedStrings: [], tempoOk: false, fullPosition: true,
      }] }));
    }, theme);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto('http://127.0.0.1:5173/#/accueil');
    await page.getByRole('button', { name: 'Apprendre un nouvel accord' }).waitFor();
    const scale = await page.locator('.hub-scale-review').boundingBox();
    const chord = await page.locator('.hub-chord-review').boundingBox();
    assert.equal(scale.width, chord.width);
    assert.equal(await page.locator('.hub-surface h1').innerText(), width >= 900 ? 'Fretwave' : 'Accueil');
    if (width >= 900) assert.ok(Math.abs(scale.y - 900 * 0.34) < 3, `horizon : ${scale.y}`);
    if (width >= 900) { assert.equal(scale.y, chord.y); assert.equal(scale.height, chord.height); assert.ok(chord.x > scale.x); }
    else assert.ok(chord.y > scale.y);
    if (width >= 900) {
      const reviewButton = await page.locator('.hub-scale-review > .btn').boundingBox();
      const learnButton = await page.locator('.hub-chord-learn > .btn').boundingBox();
      assert.ok(Math.abs(reviewButton.y - learnButton.y) < 1, 'boutons alignés verticalement');
    }
    const animation = await page.locator('.hub-scale-review .mic-spark').evaluate(el => getComputedStyle(el, '::before').animationName);
    assert.equal(animation, 'mic-spark-turn');
    await page.screenshot({ path: `${out}/hub-${theme}-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Apprendre un nouvel accord' }).click();
    await page.waitForURL('**/#/accords/apprendre');
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    assert.equal(await dialog.locator('h2').innerText(), 'Découvrir Em');
    assert.equal(await page.evaluate(() => localStorage.getItem('fretwave.chords.v1')), null);
    const attempts = await page.evaluate(() => localStorage.getItem('fretwave.attempts.v1'));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${out}/popup-${theme}-${width}.png`, fullPage: false });
    if (width === 1440) {
      await dialog.getByRole('button', { name: 'Écouter plaqué', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.chord-learn-dialog .chip.on'));
      assert.equal(await dialog.getByRole('alert').count(), 0);
    }
    const overflow = await dialog.evaluate(el => el.scrollWidth > el.clientWidth);
    assert.equal(overflow, false);
    await page.keyboard.press('Tab');
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
    await dialog.getByRole('button', { name: 'Un autre accord' }).click();
    assert.notEqual(await dialog.locator('h2').innerText(), 'Découvrir Em');
    await page.keyboard.press('Escape');
    await page.waitForURL('**/#/accords');
    assert.equal(await page.evaluate(() => localStorage.getItem('fretwave.chords.v1')), null);
    await page.goto('http://127.0.0.1:5173/#/accords/apprendre');
    await page.getByRole('button', { name: 'Je connais maintenant cet accord' }).click();
    await page.waitForURL('**/#/accords');
    assert.equal(await page.getByRole('checkbox', { name: 'Je connais Em', exact: true }).isChecked(), true);
    assert.equal(await page.evaluate(() => localStorage.getItem('fretwave.attempts.v1')), attempts);
    await page.goto('http://127.0.0.1:5173/#/accueil');
    await page.getByRole('button', { name: '▶ Réviser cet accord', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Apprendre un nouvel accord' }).click();
    assert.notEqual(await page.getByRole('dialog').locator('h2').innerText(), 'Découvrir Em');
    if (width === 1440) {
      await page.evaluate(async () => {
        const { VOICINGS } = await import('/src/data/voicings.ts');
        localStorage.setItem('fretwave.chords.v1', JSON.stringify({ v: 1, known: VOICINGS.map(v => v.id), noReview: [], stamps: {} }));
      });
      await page.reload();
      await page.getByText('Aucun nouvel accord à proposer parmi les formes disponibles pour ton répertoire.').waitFor();
      assert.equal(await page.getByRole('button', { name: 'Je connais maintenant cet accord' }).count(), 0);
    }
    assert.deepEqual(errors, []);
    console.log(`ok ${theme} ${width}px : disposition, popup, alternatives, fermeture, coches et journal`);
    await context.close();
  }
} finally { await browser.close(); }
