/** Vérifie toutes les routes et les deux thèmes de l'atelier. Serveur Vite déjà lancé. */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = '.impeccable/review/workspace';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
const issues = [];
page.on('pageerror', error => issues.push({ error: error.message }));
const routes = ['gammes', 'gammes/jouer', 'gammes/sequences', 'gammes/impro', 'gammes/revision', 'accords', 'accordeur', 'metronome', 'reglages', 'tab', 'audio', 'theorie'];
await page.goto('http://localhost:5173');
await page.waitForSelector('.bottombar');
if (process.argv.includes('--diagnose')) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173/#/tab');
  await page.waitForSelector('main');
  console.log(await page.locator('main').evaluate(main => [...main.querySelectorAll('*')].map(e => ({ tag: e.tagName, cls: e.className, right: e.getBoundingClientRect().right, width: e.getBoundingClientRect().width })).filter(e => e.right > innerWidth)));
  await page.goto('http://localhost:5173/#/accords');
  await page.waitForSelector('.chord-fold');
  console.log(await page.locator('.panel-head').first().evaluate(e => { const b = e.getBoundingClientRect(); return { box: b.toJSON(), hit: document.elementFromPoint(b.x + 60, b.y + b.height / 2)?.outerHTML, button: e.querySelector('button')?.getBoundingClientRect().toJSON() }; }));
  await browser.close();
  process.exit(0);
}
for (const theme of ['synthwave', 'dawn']) {
  await page.evaluate(theme => {
    const key = 'fretwave.settings.v1';
    const settings = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...settings, theme, reduceMotion: true }));
  }, theme);
  await page.reload();
  await page.waitForSelector('.bottombar');
  for (const width of [320, 360, 390, 768, 900, 1100, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 900 ? 844 : 900 });
    for (const route of routes) {
      await page.goto(`http://localhost:5173/#/${route}`);
      await page.waitForSelector('.bottombar');
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(100);
      const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
      if (overflow.width > overflow.viewport) issues.push({ theme, width, route, overflow });
      const title = await page.locator('main h1').count();
      if (!title) issues.push({ theme, width, route, error: 'Titre absent' });
      if ([390, 1440].includes(width)) await page.screenshot({ path: `${out}/${theme}-${width}-${route.replaceAll('/', '-')}.png`, fullPage: true });
    }
  }
}
// Des contrôles réels : nouvelle sélection, position, détails et navigation mobile.
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:5173/#/gammes/sequences');
await page.waitForSelector('.practice-selectors');
await page.getByRole('combobox', { name: 'Tonique', exact: true }).selectOption('D');
await page.getByRole('button', { name: 'Position 2', exact: true }).click();
if (await page.locator('.position-rail [aria-current]').innerText() !== '02') issues.push({ error: 'Sélection position non appliquée' });
await page.getByRole('button', { name: /Détails de la séquence/ }).click();
await page.screenshot({ path: `${out}/details.png`, fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole('button', { name: 'Réglages', exact: true }).click();
await page.waitForURL('**/#/reglages');
if (await page.locator('.bottombar .navbtn').count() !== 4) issues.push({ error: 'Navigation mobile incorrecte' });
await page.goto('http://localhost:5173/#/accordeur');
await page.getByRole('button', { name: 'Réglages d’entrée' }).click();
await page.screenshot({ path: `${out}/tuner-dialog.png`, fullPage: true });
await browser.close();
writeFileSync(`${out}/report.json`, JSON.stringify(issues, null, 2));
console.log(JSON.stringify({ checked: routes.length * 8 * 2, issues }, null, 2));
process.exitCode = issues.length ? 1 : 0;
