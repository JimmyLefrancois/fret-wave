// Contrôle de la PWA (D118) : installation, hors ligne, mise à jour à l'ouverture.
// Prérequis : `npm run build`, puis `npx wrangler dev` sur :8787. Modifie dist/ le temps du test et le restaure.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const URL_APP = process.env.PWA_URL ?? 'http://localhost:8787/';
const MARKER = 'fw-pwa-check';
let failures = 0;

function check(label, ok, detail = '') {
  console.log(`${ok ? 'OK ' : 'KO '} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(URL_APP);
const cached = await page.evaluate(async () => {
  await navigator.serviceWorker.ready;
  for (let i = 0; i < 300 && !navigator.serviceWorker.controller; i++) await new Promise((r) => setTimeout(r, 100));
  const names = await caches.keys();
  let urls = [];
  for (const n of names) urls = urls.concat((await (await caches.open(n)).keys()).map((r) => r.url));
  return { controlled: !!navigator.serviceWorker.controller, urls };
});
check('service worker actif et maître de la page', cached.controlled);
check('tous les fichiers sont en cache', cached.urls.length >= 150, `${cached.urls.length} fichiers`);
const flacOnDisk = readdirSync('dist/samples', { recursive: true }).filter((f) => String(f).endsWith('.flac')).length;
const flacCached = cached.urls.filter((u) => u.includes('.flac')).length;
check('sons en cache', flacCached === flacOnDisk, `${flacCached}/${flacOnDisk}`);

const manifest = await (await page.request.get(new URL('manifest.webmanifest', URL_APP).href)).json();
check('manifeste servi', manifest.name === 'Fretwave' && manifest.icons.length === 4);
for (const icon of manifest.icons) {
  const res = await page.request.get(new URL(icon.src, URL_APP).href);
  check(`icône ${icon.src}`, res.ok());
}

await context.setOffline(true);
await page.reload();
await page.waitForSelector('#root > *', { timeout: 5000 });
const offline = await page.evaluate(async () => {
  const flac = await fetch('/samples/nylon/A2.flac');
  const size = (await flac.arrayBuffer()).byteLength;
  const manifest = await fetch('/samples/nylon/manifest.json');
  const worklet = await fetch('/worklets/fretwave-input.js');
  return { size, manifest: manifest.ok, worklet: worklet.ok };
});
check('hors ligne : app, son, manifeste et worklet', offline.size > 0 && offline.manifest && offline.worklet);
const fallback = await context.newPage();
const hub = await fallback.goto(new URL('/#/hub', URL_APP).href).catch(() => null);
check('hors ligne : ouverture directe du hub', hub?.ok() ?? false);
const api = await fallback.goto(new URL('/api/health-check-pwa', URL_APP).href).then(
  (r) => r?.url(),
  () => null,
);
check("hors ligne : /api n'est pas remplacé par l'app", api === null);
await fallback.close();
await context.setOffline(false);
await page.close();

await new Promise((r) => setTimeout(r, 8000)); // laisse passer la vérification que Chrome programme après chaque navigation

// Publication simulée : nouvelle page et nouvelle révision dans le service worker.
const htmlPath = 'dist/index.html';
const swPath = 'dist/sw.js';
const html = readFileSync(htmlPath, 'utf8');
const sw = readFileSync(swPath, 'utf8');
const nextSw = sw.replace(/(url:"index\.html",revision:")[^"]+/, `$1${Date.now()}`);
check('révision de index.html trouvée', nextSw !== sw);
try {
  writeFileSync(htmlPath, html.replace('</head>', `<meta name="${MARKER}" content="1"></head>`));
  writeFileSync(swPath, nextSw);
  await new Promise((r) => setTimeout(r, 3000)); // wrangler dev relit dist/

  const reopened = await context.newPage();
  const navigations = [];
  reopened.on('response', (r) => { if (r.request().isNavigationRequest()) navigations.push(`${r.status()}:${r.fromServiceWorker() ? 'sw' : 'réseau'}`); });
  const started = Date.now();
  await reopened.goto(URL_APP);
  const updated = await reopened
    .waitForFunction((m) => document.querySelector(`meta[name="${m}"]`), MARKER, { timeout: 15000 })
    .then(() => true, () => false);
  check('mise à jour appliquée seule à la réouverture', updated, `${Date.now() - started} ms, navigations ${navigations.join(' puis ')}`);
  check('la réouverture part bien du cache puis recharge', navigations.length >= 2 && navigations[0].endsWith('sw'));
} finally {
  writeFileSync(htmlPath, html);
  writeFileSync(swPath, sw);
}

check('aucune erreur JS', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(failures ? `${failures} échec(s)` : 'Tout est bon.');
process.exit(failures ? 1 : 0);
