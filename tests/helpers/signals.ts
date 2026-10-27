/**
 * Signaux de test pour l'entrée audio (phase 3) : on n'a pas de guitare dans le test, on a une
 * description de guitare. Une corde pincée = fondamentale + harmoniques décroissantes, attaque
 * rapide, décroissance exponentielle, bruit de fond.
 *
 * Ces signaux servent à vérifier la **détection** (justesse, octave, silence) avant tout essai sur
 * une vraie guitare — la même discipline que la phase 5 s'impose pour la polyphonie.
 */

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ToneOptions {
  freq: number;
  sampleRate?: number;
  seconds?: number;
  /** Amplitudes relatives des harmoniques (index 0 = fondamentale). */
  harmonics?: readonly number[];
  /** Décroissance (1/s) : une corde s'éteint, une sinusoïde de test non. */
  decay?: number;
  /** Attaque (s) : évite un clic en début de fenêtre. */
  attackS?: number;
  /** Bruit de fond ajouté (dBFS RMS), 0 = aucun. */
  noiseDb?: number;
  /** Désaccord (cents) : une guitare à −20 cents doit rester identifiable. */
  cents?: number;
  seed?: number;
}

export function tone(o: ToneOptions): Float32Array {
  const sampleRate = o.sampleRate ?? 48000;
  const seconds = o.seconds ?? 1;
  const n = Math.round(sampleRate * seconds);
  const out = new Float32Array(n);
  const harmonics = o.harmonics ?? [1];
  const attack = Math.max(0.0005, o.attackS ?? 0.005);
  const f0 = o.freq * Math.pow(2, (o.cents ?? 0) / 1200);
  const decay = o.decay ?? 0;
  // normalisation : la somme des harmoniques ne doit pas dépasser 1
  const total = harmonics.reduce((s, h) => s + Math.abs(h), 0) || 1;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let v = 0;
    for (let h = 0; h < harmonics.length; h++) {
      const a = harmonics[h]!;
      if (a === 0) continue;
      v += a * Math.sin(2 * Math.PI * f0 * (h + 1) * t);
    }
    v /= total;
    const env = (t < attack ? t / attack : 1) * Math.exp(-decay * t);
    out[i] = v * env;
  }
  if (o.noiseDb !== undefined && o.noiseDb !== 0) {
    const rng = mulberry(o.seed ?? 12345);
    const rms = Math.pow(10, o.noiseDb / 20);
    for (let i = 0; i < n; i++) out[i] = out[i]! + (rng() * 2 - 1) * rms * Math.sqrt(3);
  }
  return out;
}

/** Corde pincée crédible : harmoniques 1/n, décroissance, attaque courte. */
export function plucked(freq: number, o: Partial<ToneOptions> = {}): Float32Array {
  return tone({
    freq,
    harmonics: [1, 0.55, 0.36, 0.26, 0.19, 0.14, 0.1, 0.08],
    decay: 1.2,
    attackS: 0.004,
    ...o,
  });
}

export function silence(n = 2048): Float32Array {
  return new Float32Array(n);
}

/** Bruit seul (souffle de la pièce) : ne doit jamais être interprété comme une note. */
export function noise(n = 2048, rms = 0.01, seed = 7): Float32Array {
  const rng = mulberry(seed);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (rng() * 2 - 1) * rms * Math.sqrt(3);
  return out;
}

/** Fréquence tempérée (La 440) d'une hauteur MIDI. */
export function hzOf(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}
