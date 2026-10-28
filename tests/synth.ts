/**
 * Générateur de signaux pour les tests d'écoute polyphonique (phase 5).
 *
 * On ne peut pas prouver qu'un analyseur d'accords fonctionne sur une vraie guitare dans un test
 * unitaire ; on peut prouver qu'il **retrouve ce qu'on lui a donné**, et publier les chiffres. Ce
 * générateur fabrique une superposition d'harmoniques dont on connaît tout : hauteurs, désaccordage,
 * niveau de chaque corde (une corde étouffée = une amplitude faible et des harmoniques hautes mortes),
 * strum étalé dans le temps, bruit de fond à un rapport signal/bruit choisi.
 *
 * Ce qu'il **ne** simule pas : le timbre réel d'une corde de guitare (caisse, médiator, micro), les
 * résonances de la caisse, la réponse du téléphone. Les chiffres obtenus sont donc un **plafond**
 * optimiste, et les docs le disent.
 */

export interface SynthOptions {
  sampleRate?: number;
  seconds?: number;
  /** Nombre d'harmoniques par corde. */
  harmonics?: number;
  /** Amplitude du harmonique h+1 par rapport au h (0,65 = décroissance douce). */
  decay?: number;
  /** Inharmonicité : f_h = h·f0·√(1 + B·h²). Une corde réelle est entre 1e-4 et 1e-3. */
  inharmonicity?: number;
  /** Désaccordage par corde, en cents (nombre ou tableau de même longueur que `midis`). */
  detuneCents?: number | number[];
  /** Étirement du strum : la corde i part i × `strumMs` après la première. */
  strumMs?: number;
  /** Bruit blanc ajouté, au rapport signal/bruit demandé (dB). `null` = pas de bruit. */
  snrDb?: number | null;
  /** Indices des cordes étouffées : amplitude faible et harmoniques hautes coupées. */
  muted?: number[];
  a4?: number;
  /** Graine du bruit, pour des tests reproductibles. */
  seed?: number;
}

export const synthHz = (midi: number, a4 = 440): number => a4 * 2 ** ((midi - 69) / 12);

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Superposition d'harmoniques d'un accord plaqué (voir l'en-tête pour ce qui est simulé). */
export function synthChord(midis: number[], options: SynthOptions = {}): Float32Array {
  const sampleRate = options.sampleRate ?? 48000;
  const seconds = options.seconds ?? 0.45;
  const harmonics = options.harmonics ?? 6;
  const decay = options.decay ?? 0.65;
  const inharm = options.inharmonicity ?? 2e-4;
  const strumMs = options.strumMs ?? 0;
  const muted = new Set(options.muted ?? []);
  const a4 = options.a4 ?? 440;
  const n = Math.round(sampleRate * seconds);
  const out = new Float32Array(n);

  const detune = (i: number): number =>
    (Array.isArray(options.detuneCents) ? (options.detuneCents[i] ?? 0) : (options.detuneCents ?? 0));

  midis.forEach((midi, i) => {
    const cents = detune(i);
    const f0 = synthHz(midi, a4) * 2 ** (cents / 1200);
    const start = Math.round((i * strumMs * sampleRate) / 1000);
    const isMuted = muted.has(i);
    const gain = isMuted ? 0.12 : 1;
    const hMax = isMuted ? 2 : harmonics; // une corde étouffée perd ses harmoniques hautes
    for (let h = 1; h <= hMax; h += 1) {
      const f = f0 * h * Math.sqrt(1 + inharm * h * h);
      if (f > sampleRate / 2 - 200) break;
      const amp = gain * decay ** (h - 1) * (0.55 / Math.sqrt(h));
      for (let s = start; s < n; s += 1) {
        const t = (s - start) / sampleRate;
        // attaque de 4 ms puis décroissance : une corde pincée, pas un sinus qui démarre net
        const env = Math.min(1, t / 0.004) * Math.exp(-t / 1.6);
        out[s]! += amp * env * Math.sin(2 * Math.PI * f * t);
      }
    }
  });

  if (options.snrDb !== null && options.snrDb !== undefined) {
    let sumSq = 0;
    for (let s = 0; s < n; s += 1) sumSq += out[s]! ** 2;
    const rms = Math.sqrt(sumSq / n);
    const noiseRms = rms / 10 ** (options.snrDb / 20);
    const rand = mulberry32(options.seed ?? 12345);
    for (let s = 0; s < n; s += 1) {
      // bruit gaussien approché (somme de deux uniformes), centré
      const u = rand() + rand() - 1;
      out[s]! += noiseRms * u * 1.7;
    }
  }
  return out;
}

/** Voicings réels utilisés par les tests (cordes à vide et cases basses, module Accords). */
export interface Voicing { label: string; midis: number[] }

const V = (label: string, midis: number[]): Voicing => ({ label, midis });

/** Voicings réels utilisés par les tests (cordes à vide et cases basses, module Accords). */
export const VOICINGS = {
  Em: V('Em', [40, 47, 52, 55, 59, 64]),
  E: V('E', [40, 47, 52, 56, 59, 64]),
  Am: V('Am', [45, 52, 57, 60, 64]),
  C: V('C', [48, 52, 55, 60, 64]),
  G: V('G', [43, 47, 50, 55, 59, 67]),
  'G/B': V('G/B', [47, 47, 50, 55, 59, 67]),
  D: V('D', [50, 57, 62, 66]),
  Dsus2: V('Dsus2', [50, 57, 62, 64]),
  Dsus4: V('Dsus4', [50, 57, 62, 67]),
  Cmaj7: V('Cmaj7', [48, 52, 55, 59, 64]),
  Am7: V('Am7', [45, 52, 55, 60, 64]),
};

/** Ajoute du silence au début (pour tester la détection d'attaque à un instant connu). */
export function padStart(signal: Float32Array, ms: number, sampleRate = 48000): Float32Array {
  const pad = Math.round((ms * sampleRate) / 1000);
  const out = new Float32Array(signal.length + pad);
  out.set(signal, pad);
  return out;
}
