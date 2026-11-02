/**
 * Captures pleine page d'une route, à plusieurs largeurs et dans les deux thèmes, avec les mesures utiles.
 * Suppose `npm run dev` déjà lancé.
 *
 *   node .claude/skills/refonte-page/scripts/capture.mjs <dossier> <tag> <route> [largeurs]
 *   node .claude/skills/refonte-page/scripts/capture.mjs ./shots avant gammes/jouer 1920,1440,1100,900,390
 *
 * Les fichiers sont nommés <tag>-<largeur>[-dawn].png.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const [, , out, tag, route, widths = '1920,1440,1100,900,390'] = process.argv;
if (!out || !tag || !route) {
  console.error('usage : capture.mjs <dossier> <tag> <route> [largeurs]');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
for (const width of widths.split(',').map(Number)) {
  for (const theme of ['', 'dawn']) {
    const context = await browser.newContext({ viewport: { width, height: width >= 900 ? 900 : 844 } });
    if (theme) {
      await context.addInitScript((t) => {
        const key = 'fretwave.settings.v1';
        const settings = JSON.parse(localStorage.getItem(key) || '{}');
        settings.theme = t;
        localStorage.setItem(key, JSON.stringify(settings));
      }, theme);
    }
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:5173/#/${route}`);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/${tag}-${width}${theme ? `-${theme}` : ''}.png`, fullPage: true });
    const size = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
    console.log(width, theme || 'synthwave', size, size.scrollWidth > width ? 'DÉBORDE' : 'ok', errors);
    await context.close();
  }
}
await browser.close();
