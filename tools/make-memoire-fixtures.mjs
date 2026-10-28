/**
 * Faux micro du lot « mémoire et vitesse » : des WAV **synthétiques** (corde pincée imitée : fondamentale
 * et harmoniques qui décroissent), écrits sans ffmpeg ni échantillons.
 *
 * Pourquoi pas les échantillons nylon de `make-mic-fixtures.sh` : la série à l'aveugle et les séquences
 * jugent le **tempo**, donc chaque note doit tomber à un instant connu après l'ouverture du micro (Chromium
 * rejoue le fichier en boucle dès l'ouverture). Un long silence d'entrée laisse passer le décompte, puis
 * les notes arrivent à intervalle fixe. Limite : c'est un timbre de synthèse, pas une guitare — ça
 * vérifie la chaîne et la notation, pas la détection sur un vrai instrument.
 *
 *   node tools/make-memoire-fixtures.mjs [dossier]      (défaut : .shots/mic)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] ?? '.shots/mic';
const SR = 48000;
mkdirSync(OUT, { recursive: true });

const NAMES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function midiOf(name) {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`note illisible : ${name}`);
  return NAMES[m[1]] + 12 * (Number(m[2]) + 1);
}

/** Une « corde pincée » : 4 harmoniques décroissantes, attaque de 4 ms, fondu de sortie. */
function pluck(midi, seconds) {
  const f = 440 * 2 ** ((midi - 69) / 12);
  const n = Math.round(seconds * SR);
  const out = new Float32Array(n);
  const harm = [[1, 1, 2.2], [2, 0.5, 3], [3, 0.3, 4], [4, 0.15, 5]];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (const [k, a, d] of harm) v += a * Math.sin(2 * Math.PI * f * k * t) * Math.exp(-d * t);
    const attack = Math.min(1, t / 0.004);
    const release = Math.min(1, (seconds - t) / 0.05);
    out[i] = 0.35 * v * attack * release;
  }
  return out;
}

/** Silence d'entrée, notes à pas fixe (durée de note + silence), silence de fin. */
function sequence(notes, { lead = 7, note = 0.5, gap = 0.25, tail = 25 } = {}) {
  const parts = [new Float32Array(Math.round(lead * SR))];
  for (const name of notes) {
    parts.push(pluck(midiOf(name), note));
    parts.push(new Float32Array(Math.round(gap * SR)));
  }
  parts.push(new Float32Array(Math.round(tail * SR)));
  const total = parts.reduce((s, p) => s + p.length, 0);
  const pcm = new Float32Array(total);
  let o = 0;
  for (const p of parts) {
    pcm.set(p, o);
    o += p.length;
  }
  return pcm;
}

function wav(path, pcm) {
  const data = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32767))), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([h, data]));
  console.log(`${path} : ${(pcm.length / SR).toFixed(1)} s`);
}

// La mineure pentatonique, box 1 (cases 5-8), en montée : la position entière de la série à l'aveugle
const BOX_UP = ['A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5'];
wav(join(OUT, 'blind-box.wav'), sequence(BOX_UP));
// la même, une note fausse (Fa3 au lieu de Mi3) et une oubliée (Do4) : le chemin d'erreur
wav(join(OUT, 'blind-box-faux.wav'), sequence(['A2', 'C3', 'D3', 'F3', 'G3', 'A3', 'D4', 'E4', 'G4', 'A4', 'C5']));
// la même, trois fois trop lente : justes, mais hors grille
wav(join(OUT, 'blind-box-lent.wav'), sequence(BOX_UP, { note: 1.6, gap: 0.65, tail: 10 }));

export { BOX_UP, midiOf, sequence, wav };
