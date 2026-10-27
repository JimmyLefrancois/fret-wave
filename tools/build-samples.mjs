#!/usr/bin/env node
/**
 * Reconstruit `public/samples/<instrument>/` à partir des sources d'origine (phase 1c).
 *
 *   node tools/build-samples.mjs [nylon|electric|all] [--work DIR]
 *
 * Prérequis : `ffmpeg`, `7z` et `curl` dans le PATH, accès réseau. Ce script n'est PAS exécuté par `npm test` :
 * les échantillons sont versionnés dans le dépôt ; ce script documente leur provenance exacte et permet de les
 * regénérer. Chaque instrument produit :
 *   - les fichiers audio (FLAC) ;
 *   - LICENSE.txt (texte légal fourni par la source), SOURCE-README.txt (lisez-moi de la source) ;
 *   - manifest.json : source, licence, modifications, et pour chaque échantillon : note (MIDI), fichier, octets,
 *     SHA-256, durée, ÉCART DE HAUTEUR MESURÉ (cents) et GAIN de nivellement (dB). Le moteur applique les deux :
 *     la note jouée sort donc à la hauteur nominale, et toutes les notes ont le même niveau moyen.
 *
 * Mesures : f0 par autocorrélation normalisée (interpolation parabolique) sur 0,12-0,72 s après le début ;
 * niveau = RMS sur 0,05-0,50 s. Précision de la mesure de hauteur : ≈ ±2 cents (non étalonnée sur un diapason).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'samples');
const args = process.argv.slice(2);
const workIdx = args.indexOf('--work');
const WORK = workIdx >= 0 ? resolve(args[workIdx + 1]) : join(process.env.TMPDIR ?? homedir(), 'fretwave-samples-work');
const which = args.filter((a, i) => !a.startsWith('--') && (workIdx < 0 || i !== workIdx + 1))[0] ?? 'all';

/**
 * Niveau relatif des banques (dB) : même partition, même chaîne master → l'électrique sortait ≈ 6-7 dB plus bas que le
 * nylon (RMS actif d'une progression : −22,5 dBFS contre −16,1, rendu hors ligne dans le navigateur, voir
 * MUSIC_DESIGN.md §11.4). Changer d'instrument ne doit pas changer le volume ; valeur à REMESURER si un banque change.
 */
const BANK_TRIM_DB = { nylon: 0, electric: 7 };

const CC0_URL = 'https://creativecommons.org/publicdomain/zero/1.0/';
const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

// ---------------------------------------------------------------------------------------------------------------
/** Vide un dossier SANS le supprimer : un serveur Vite qui tourne perd sinon le dossier public/ (servi en HTML). */
function emptyDir(dir) {
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) rmSync(join(dir, f), { recursive: true, force: true });
}

const sh = (cmd, a, o = {}) => execFileSync(cmd, a, { maxBuffer: 1 << 30, ...o });
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const sr = 44100;

function decode(file, ss, t) {
  const buf = sh('ffmpeg', ['-v', 'error', '-ss', String(ss), '-t', String(t), '-i', file, '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-']);
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

function f0(x, fmin, fmax) {
  const lo = Math.floor(sr / fmax), hi = Math.ceil(sr / fmin);
  const n = x.length - hi - 1;
  const r = new Float64Array(hi + 2);
  let e0 = 0;
  for (let i = 0; i < n; i++) e0 += x[i] * x[i];
  for (let l = lo - 1; l <= hi + 1; l++) {
    let s = 0, e1 = 0;
    for (let i = 0; i < n; i++) { s += x[i] * x[i + l]; e1 += x[i + l] * x[i + l]; }
    r[l] = s / Math.sqrt(e0 * e1 + 1e-12);
  }
  let best = lo;
  for (let l = lo; l <= hi; l++) if (r[l] > r[best]) best = l;
  let pick = best;
  for (let l = lo; l <= hi; l++) if (r[l] > 0.93 * r[best] && r[l] >= r[l - 1] && r[l] >= r[l + 1]) { pick = l; break; }
  const a = r[pick - 1], b = r[pick], c = r[pick + 1];
  const d = (a - c) / (2 * (a - 2 * b + c));
  return { f: sr / (pick + d), clarity: b };
}

function measure(file, midi) {
  const x = decode(file, 0.12, 0.6);
  const { f, clarity } = f0(x, midiHz(midi) / 1.45, midiHz(midi) * 1.45);
  const cents = 1200 * Math.log2(f / midiHz(midi));
  const y = decode(file, 0.05, 0.45);
  let e = 0;
  for (const v of y) e += v * v;
  const rmsDb = 10 * Math.log10(e / y.length + 1e-20);
  const dur = decode(file, 0, 30).length / sr;
  return { cents, clarity, rmsDb, durationS: dur };
}

function median(a) {
  const s = [...a].sort((p, q) => p - q);
  return s[Math.floor(s.length / 2)];
}

function finish(dir, meta, rows) {
  // Nivellement : le niveau cible est la médiane des RMS de la couche de référence (mf, variante 1) ; chaque note reçoit
  // le même gain sur TOUTES ses couches / variantes, pour conserver les différences de dynamique entre couches.
  const ref = rows.filter((r) => r.layer === 'mf' && r.variant === 1);
  const target = median(ref.map((r) => r.rmsDb));
  const refDb = new Map(ref.map((r) => [r.midi, r.rmsDb]));
  const samples = rows
    .sort((a, b) => a.midi - b.midi || ['p', 'mf', 'f'].indexOf(a.layer) - ['p', 'mf', 'f'].indexOf(b.layer) || a.variant - b.variant)
    .map((r) => ({
      midi: r.midi,
      layer: r.layer,
      variant: r.variant,
      file: r.file,
      sourceFile: r.sourceFile,
      bytes: statSync(join(dir, r.file)).size,
      sha256: sha256(join(dir, r.file)),
      durationS: Number(r.durationS.toFixed(3)),
      measuredCents: Number(r.cents.toFixed(1)),
      pitchClarity: Number(r.clarity.toFixed(3)),
      gainDb: Number(Math.max(-9, Math.min(9, target - refDb.get(r.midi))).toFixed(2)),
    }));
  const manifest = { ...meta, sampleRate: sr, samples, totalBytes: samples.reduce((s, x) => s + x.bytes, 0) };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${meta.id}: ${samples.length} échantillons, ${(manifest.totalBytes / 1e6).toFixed(2)} Mo, cents mesurés [${Math.min(...samples.map((s) => s.measuredCents))} ; ${Math.max(...samples.map((s) => s.measuredCents))}]`);
}

function parseNoteName(name) {
  const m = /^([A-Ga-g])([#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`nom de note illisible : ${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + NAMES[m[1].toUpperCase()] + acc;
}

// ---------------------------------------------------------------------------------------------------------------
// Guitare classique à cordes nylon — FreePats « Spanish Classical Guitar » 2019-06-18 (CC0)
function buildNylon() {
  const id = 'nylon';
  const dir = join(OUT, id);
  const src = join(WORK, id);
  const archive = '7z';
  const url = 'https://freepats.zenvoid.org/Guitar/SpanishClassicalGuitar/SpanishClassicalGuitar-SFZ+FLAC-20190618.7z';
  emptyDir(dir);
  mkdirSync(src, { recursive: true });
  const arc = join(src, 'bank.7z');
  if (!existsSync(arc)) sh('curl', ['-sfL', '-o', arc, url]);
  const archiveSha = sha256(arc);
  sh(archive, ['x', '-y', `-o${src}`, arc], { stdio: 'ignore' });
  const base = join(src, 'SpanishClassicalGuitar-SFZ+FLAC-20190618');
  const sfz = readFileSync(join(base, 'SpanishClassicalGuitar-20190618.sfz'), 'utf8');
  // régions SFZ : on vérifie que chaque fichier est mappé sur sa propre note (pitch_keycenter == nom du fichier)
  const regions = [];
  let cur = null;
  for (const line of sfz.split('\n')) {
    const l = line.trim();
    if (l.startsWith('<region>')) { cur = {}; regions.push(cur); continue; }
    if (!cur) continue;
    for (const kv of l.split(/\s+/)) {
      const m = /^(\w+)=(.+)$/.exec(kv);
      if (m) cur[m[1]] = m[2];
    }
  }
  const rows = [];
  for (const r of regions) {
    const name = /samples\/(.+)\.flac$/.exec(r.sample)[1];
    const midi = parseNoteName(name);
    const center = Number(r.pitch_keycenter ?? r.key);
    if (center !== midi) throw new Error(`SFZ incohérent : ${name} (${midi}) ≠ keycenter ${center}`);
    const file = `${name.replace('#', 's')}.flac`;
    copyFileSync(join(base, 'samples', `${name}.flac`), join(dir, file)); // octets inchangés
    rows.push({ midi, layer: 'mf', variant: 1, file, sourceFile: `samples/${name}.flac`, ...measure(join(dir, file), midi) });
  }
  copyFileSync(join(base, 'cc0.txt'), join(dir, 'LICENSE.txt'));
  copyFileSync(join(base, 'readme.txt'), join(dir, 'SOURCE-README.txt'));
  finish(dir, {
    id,
    nameFr: 'Guitare classique (cordes nylon)',
    format: 'flac',
    maxShiftSemitones: 4,
    releaseS: 0.35,
    trimDb: BANK_TRIM_DB.nylon,
    license: { spdx: 'CC0-1.0', url: CC0_URL, file: 'LICENSE.txt', attributionRequired: false },
    source: {
      title: 'Spanish Classical Guitar (FreePats)',
      author: 'roberto@zenvoid.org, projet FreePats',
      url: 'https://freepats.zenvoid.org/Guitar/acoustic-guitar.html',
      download: url,
      version: '2019-06-18',
      archiveSha256: archiveSha,
      recording: 'Guitare classique espagnole enregistrée en 2008, micro AKG Perception 120, filtrée et nettoyée par l\'auteur (cf. SOURCE-README.txt).',
    },
    modifications: [
      'Aucune modification du signal : fichiers FLAC copiés tels quels (octets identiques à l\'archive), seulement renommés (# → s).',
      'Correction de hauteur et de niveau appliquée À LA LECTURE (measuredCents, gainDb), pas dans les fichiers.',
    ],
  }, rows);
}

// ---------------------------------------------------------------------------------------------------------------
// Guitare électrique (son direct, cordes filets plats) — Karoryfer Samples « Emilyguitar » (CC0)
function buildElectric() {
  const id = 'electric';
  const dir = join(OUT, id);
  const src = join(WORK, id);
  const commit = 'b4920dc662fd9cad6dcaccdeecffdd91c8725d8c';
  const raw = `https://raw.githubusercontent.com/sfzinstruments/karoryfer.emilyguitar/${commit}`;
  const notes = ['db2', 'e2', 'gb2', 'a2', 'c3', 'eb3', 'gb3', 'a3', 'c4', 'eb4', 'gb4', 'a4', 'c5', 'eb5', 'gb5', 'a5', 'c6', 'd6'];
  emptyDir(dir);
  mkdirSync(src, { recursive: true });
  const rows = [];
  const sets = [['p', [1]], ['mf', [1, 2, 3]], ['f', [1]]];
  for (const n of notes) {
    const midi = parseNoteName(n[0].toUpperCase() + n.slice(1));
    const name = n[0].toUpperCase() + (n[1] === 'b' ? 'f' : '') + n.slice(-1); // Db2 → Df2 (pas de confusion avec la lettre B)
    for (const [layer, variants] of sets) {
      for (const variant of variants) {
        const srcName = `${n}_${layer}_rr${variant}.wav`;
        const wav = join(src, srcName);
        if (!existsSync(wav)) sh('curl', ['-sfL', '-o', wav, `${raw}/notes/${srcName}`]);
        const file = `${name}_${layer}${variant}.flac`;
        // 24 bits → 16 bits (dither triangulaire), fondu de sortie de 80 ms (évite un clic en fin de fichier)
        sh('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-af', 'afade=t=out:st=4.14:d=0.08,aresample=osf=s16:dither_method=triangular', '-c:a', 'flac', '-compression_level', '8', join(dir, file)]);
        rows.push({ midi, layer, variant, file, sourceFile: `notes/${srcName}`, ...measure(join(dir, file), midi) });
      }
    }
  }
  const lic = join(src, 'LICENSE');
  const rd = join(src, 'readme.txt');
  if (!existsSync(lic)) sh('curl', ['-sfL', '-o', lic, `${raw}/LICENSE`]);
  if (!existsSync(rd)) sh('curl', ['-sfL', '-o', rd, `${raw}/readme.txt`]);
  copyFileSync(lic, join(dir, 'LICENSE.txt'));
  copyFileSync(rd, join(dir, 'SOURCE-README.txt'));
  finish(dir, {
    id,
    nameFr: 'Guitare électrique (son direct)',
    format: 'flac',
    maxShiftSemitones: 3,
    releaseS: 0.3,
    trimDb: BANK_TRIM_DB.electric,
    license: { spdx: 'CC0-1.0', url: CC0_URL, file: 'LICENSE.txt', attributionRequired: false },
    source: {
      title: 'Emilyguitar (Epiphone Emily the Strange, cordes filets plats, enregistrement direct)',
      author: 'D. Smolken — Karoryfer Samples',
      url: 'https://github.com/sfzinstruments/karoryfer.emilyguitar',
      download: raw,
      version: `commit ${commit} (2022-11-04)`,
      recording: 'Enregistrement direct, deux micros de guitare, potards à fond (cf. SOURCE-README.txt). Trois des quatre couches de vélocité (p, mf, f) ; mf en trois répétitions (round-robin), p et f en une.',
    },
    modifications: [
      'Couches p (rr1), mf (rr1-rr3) et f (rr1) conservées ; couche mp et répétitions rr2-rr3 de p/f écartées pour limiter le poids.',
      'WAV 24 bits → FLAC 16 bits (dither triangulaire) ; fondu de sortie de 80 ms sur les 4,22 s ; aucun autre traitement.',
      'Correction de hauteur et de niveau appliquée À LA LECTURE (measuredCents, gainDb), pas dans les fichiers.',
    ],
  }, rows);
}

// ---------------------------------------------------------------------------------------------------------------
mkdirSync(OUT, { recursive: true });
if (which === 'nylon' || which === 'all') buildNylon();
if (which === 'electric' || which === 'all') buildElectric();
console.log('dossier de travail :', WORK, '· sorties :', OUT, readdirSync(OUT).join(', '));
