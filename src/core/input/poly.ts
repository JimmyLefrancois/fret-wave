/**
 * Écoute **polyphonique** (phase 5) : entendre six cordes ensemble.
 *
 * Jusqu'ici l'app n'entendait qu'une hauteur à la fois (`pitch.ts`, autocorrélation) : elle pouvait
 * valider un arpège, jamais un accord plaqué. Ce module prend une **fenêtre d'échantillons** et rend,
 * pour chaque note attendue, une **confiance de 0 à 1** — jamais un verdict binaire.
 *
 * Trois étapes, dans cet ordre :
 *
 *  1. **Attaque.** Le flux spectral repère l'instant où les cordes partent (`onsetMs`). L'analyse ne
 *     regarde pas l'attaque elle-même mais la fenêtre **après** elle : à l'attaque, le bruit du médiator
 *     occupe tout le spectre et les amplitudes ne sont pas encore celles de la corde.
 *  2. **Spectre.** FFT 8 192 à 16 384 points sur une fenêtre de Hann. À 16 384 et 48 kHz, un bin vaut
 *     2,9 Hz : deux notes à 40 cents d'écart restent séparables (à 8 192, 5,9 Hz, soit ~20 cents à
 *     200 Hz — la limite honnête).
 *  3. **Somme harmonique avec soustraction itérative.** Les notes sont traitées **des graves vers les
 *     aiguës** : la corde de Mi grave met ses harmoniques partout, y compris sur la fondamentale du
 *     Sol aigu (5 × 82 Hz = 412 Hz ≈ Sol♯4, le piège documenté en `MUSIC_DESIGN` §6). Chaque note
 *     acceptée **retire** ses harmoniques du spectre résiduel avant que la suivante soit jugée.
 *
 * Le module ne connaît ni le micro ni le DOM : il prend des `Float32Array`, ce qui le rend testable sur
 * des signaux synthétiques dont on connaît la vérité (voir `tests/poly.test.ts`, qui publie sa matrice
 * de confusion).
 */

/** Note attendue : hauteur MIDI et corde qui la porte (1 = corde la plus grave, comme la tablature). */
export interface ChordTarget {
  midi: number;
  /** Numéro de corde tel que l'affiche la tablature (0 = corde la plus grave). */
  string: number;
}

export interface PolyOptions {
  sampleRate: number;
  /** Taille de FFT (puissance de deux). Défaut 16 384. */
  fftSize?: number;
  /** Nombre d'harmoniques prises en compte par note. Défaut 6. */
  harmonics?: number;
  /** La de référence (Hz). Défaut 440. */
  a4?: number;
  /** Confiance en dessous de laquelle une corde est « pas entendue ». Défaut 0,45. */
  minConfidence?: number;
  /** Niveau RMS en dessous duquel il n'y a rien à écouter (dBFS). Défaut −48. */
  silenceDb?: number;
}

export interface NoteEvidence {
  midi: number;
  string: number;
  /** Fréquence attendue (Hz), La de référence appliquée. */
  hz: number;
  /** Fréquence mesurée sur le pic le plus proche, `null` si aucun pic. */
  hzMeasured: number | null;
  /** Écart mesuré en cents, `null` si aucun pic. */
  cents: number | null;
  /** Confiance 0-1 : c'est elle qui décide, pas un seuil binaire. */
  confidence: number;
  /** Saillance brute (somme des harmoniques trouvées), pour le diagnostic. */
  salience: number;
}

export type ChordVerdict = 'ok' | 'partial' | 'wrong' | 'silent';

export interface ChordAnalysis {
  notes: NoteEvidence[];
  /** Confiance globale : moyenne des notes, pénalisée par les cordes muettes. */
  confidence: number;
  present: number[];
  missing: number[];
  verdict: ChordVerdict;
  /** Part de l'énergie du spectre expliquée par l'accord attendu (0-1). */
  explainedShare: number;
  /** Attaque mesurée dans la fenêtre (ms depuis son début), `null` si la fenêtre est continue. */
  onsetMs: number | null;
  /** Pics dominants non expliqués par l'accord : la matière du message « Sol♯ au lieu de Sol ». */
  extraNotes: { midi: number; hz: number; cents: number; salience: number }[];
  rmsDb: number;
  /** Nombre de cordes entendues. */
  heard: number;
  /**
   * Poids (0-1) des **fondamentales fortes que l'hypothèse n'explique pas**. C'est ce qui distingue
   * « Do » de « La mineur 7 » : les deux hypothèses voient Do, Mi, Sol ; seule celle qui contient le La
   * explique le La grave. Sans cette pénalité, un accord inclus dans un autre gagnait toujours, parce
   * que la confiance ne mesure que la présence de ses propres notes.
   */
  unexplainedWeight: number;
}

export interface Spectrum {
  /** Amplitudes (une sinusoïde d'amplitude A donne A au bin de sa fréquence). */
  mag: Float64Array;
  binHz: number;
  sampleRate: number;
  fftSize: number;
  /** Médiane des amplitudes dans la bande de guitare : le plancher de bruit, mesuré et non supposé. */
  noise: number;
  rmsDb: number;
  onsetMs: number | null;
}

export const DEFAULT_POLY: Required<Omit<PolyOptions, 'sampleRate'>> = {
  fftSize: 16384,
  harmonics: 6,
  a4: 440,
  minConfidence: 0.45,
  silenceDb: -48,
};

/** Bande utile d'une guitare en accordage standard : Mi grave 82 Hz → case 15 du Mi aigu ~1 175 Hz. */
const BAND_LO = 70;
const BAND_HI = 2000;

// --- FFT ---------------------------------------------------------------------------------------

/** FFT radix-2 en place (Cooley-Tukey). Taille = puissance de deux. */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n <= 1) return;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let start = 0; start < n; start += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k += 1) {
        const ar = re[start + k]!;
        const ai = im[start + k]!;
        const br = re[start + k + half]!;
        const bi = im[start + k + half]!;
        const vr = br * cr - bi * ci;
        const vi = br * ci + bi * cr;
        re[start + k] = ar + vr;
        im[start + k] = ai + vi;
        re[start + k + half] = ar - vr;
        im[start + k + half] = ai - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/** Amplitude par bin (fenêtre de Hann, échelle cohérente : une sinusoïde d'amplitude A donne A). */
export function magnitudeSpectrum(samples: Float32Array, fftSize: number): Float64Array {
  const n = Math.min(fftSize, samples.length);
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const offset = samples.length - n; // la fin de la fenêtre : le régime stable, pas l'attaque
  let sumSq = 0;
  for (let i = 0; i < n; i += 1) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)); // Hann
    re[i] = samples[offset + i]! * w;
    sumSq += samples[offset + i]! ** 2;
  }
  fftInPlace(re, im);
  const half = fftSize >> 1;
  const mag = new Float64Array(half);
  const scale = 2 / (n * 0.5); // ×2 : énergie sur les fréquences négatives ; 0,5 : gain de Hann
  for (let k = 0; k < half; k += 1) mag[k] = Math.hypot(re[k]!, im[k]!) * scale;
  void sumSq;
  return mag;
}

// --- attaque -----------------------------------------------------------------------------------

export interface OnsetHit {
  /** Indice de l'échantillon où le flux dépasse le seuil. */
  at: number;
  /** Instant en ms depuis le début de la fenêtre. */
  ms: number;
  /** Hauteur du saut de flux (relatif). */
  strength: number;
}

/**
 * Attaque par **flux spectral** : on découpe en trames de 512 échantillons (10,7 ms à 48 kHz), on somme
 * la croissance d'amplitude des bins entre deux trames, et on retient la première trame dont le saut
 * dépasse plusieurs fois la moyenne courante. C'est la définition classique (Dixon 2006) et elle suffit
 * ici : on ne cherche pas à suivre un tempo, seulement à savoir **quand** les cordes partent.
 */
export function detectOnsetMs(samples: Float32Array, sampleRate: number, opts?: { frame?: number; hops?: number }): OnsetHit | null {
  const frame = opts?.frame ?? 512;
  const hops = opts?.hops ?? 3;
  if (samples.length < frame * (hops + 1)) return null;
  const windowSize = 512;
  const prev = new Float64Array(windowSize >> 1);
  let best: OnsetHit | null = null;
  let fluxSum = 0;
  let fluxCount = 0;
  for (let start = 0; start + frame <= samples.length; start += frame) {
    const mag = magnitudeSpectrum(samples.subarray(start, start + frame), windowSize);
    let flux = 0;
    for (let k = 0; k < mag.length; k += 1) {
      const d = mag[k]! - prev[k]!;
      if (d > 0) flux += d;
      prev[k] = mag[k]!;
    }
    const local = fluxCount > 0 ? fluxSum / fluxCount : 0;
    if (flux > 2.5 * local && flux > 0.02 && best === null) {
      best = { at: start, ms: (start / sampleRate) * 1000, strength: local > 0 ? flux / local : flux };
      if (start > frame * hops) break; // la première attaque franche suffit
    }
    fluxSum += flux;
    fluxCount += 1;
  }
  return best;
}

// --- utilitaires de spectre ---------------------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1]!;
}

/** Indice de bin et fréquence interpolée du maximum local autour de `hz` (±tolHz). */
function peakNear(mag: Float64Array, binHz: number, hz: number, tolHz: number): { amp: number; hz: number; bin: number } | null {
  const lo = Math.max(1, Math.round((hz - tolHz) / binHz));
  const hi = Math.min(mag.length - 2, Math.round((hz + tolHz) / binHz));
  if (hi <= lo) return null;
  let bestBin = -1;
  let best = 0;
  for (let k = lo; k <= hi; k += 1) {
    const a = mag[k]!;
    // un maximum local seulement : une pente n'est pas un pic
    if (a > best && a >= mag[k - 1]! && a >= mag[k + 1]!) {
      best = a;
      bestBin = k;
    }
  }
  if (bestBin < 0) return null;
  const a = mag[bestBin - 1]!;
  const b = mag[bestBin]!;
  const c = mag[bestBin + 1]!;
  const denom = a - 2 * b + c;
  const delta = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
  return { amp: b, hz: (bestBin + delta) * binHz, bin: bestBin };
}

/** Maximum local le plus **proche** de `hz` (±tolHz) : sert à dire « tu es à −12 cents », pas « voici le
 *  pic le plus fort du voisinage », qui peut être l'harmonique d'une autre corde. */
function nearestPeak(mag: Float64Array, binHz: number, hz: number, tolHz: number): { amp: number; hz: number } | null {
  const lo = Math.max(1, Math.round((hz - tolHz) / binHz));
  const hi = Math.min(mag.length - 2, Math.round((hz + tolHz) / binHz));
  if (hi <= lo) return null;
  let bestBin = -1;
  let bestDist = Infinity;
  for (let k = lo; k <= hi; k += 1) {
    const a = mag[k]!;
    if (!(a >= mag[k - 1]! && a >= mag[k + 1]!)) continue;
    const d = Math.abs(k * binHz - hz);
    if (d < bestDist) {
      bestDist = d;
      bestBin = k;
    }
  }
  if (bestBin < 0) return null;
  const a = mag[bestBin - 1]!;
  const b = mag[bestBin]!;
  const c = mag[bestBin + 1]!;
  const denom = a - 2 * b + c;
  const delta = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
  return { amp: b, hz: (bestBin + delta) * binHz };
}

const hzOfMidi = (midi: number, a4: number): number => a4 * 2 ** ((midi - 69) / 12);
const centsBetween = (a: number, b: number): number => 1200 * Math.log2(a / b);
const midiOfHz = (hz: number, a4: number): number => 69 + 12 * Math.log2(hz / a4);

/** Poids des harmoniques : la fondamentale porte, mais l'oreille reconnaît un accord sur les 3 premières. */
const harmonicWeight = (h: number): number => 1 / h ** 0.8;

// --- analyse -----------------------------------------------------------------------------------

/**
 * Confiance d'une note sur un spectre **résiduel** (les harmoniques déjà expliquées ont été retirées).
 *
 * La saillance est comparée au **plancher de bruit mesuré** (médiane du spectre dans la bande) et non à
 * une constante : un micro bruyant, une interface silencieuse, un téléphone dans une pièce calme
 * n'ont pas le même plancher, et une valeur absolue aurait obligé à recalibrer l'app à chaque matériel.
 * L'échelle est logarithmique : trois fois le plancher vaut 0, quarante fois vaut 1.
 */
function confidenceFrom(salience: number, floor: number, harmonics: number): number {
  if (salience <= 0) return 0;
  const reference = floor * harmonics;
  if (reference <= 0) return salience > 0 ? 1 : 0;
  const r = salience / reference;
  const lo = Math.log10(3);
  const hi = Math.log10(40);
  const v = (Math.log10(Math.max(r, 1e-6)) - lo) / (hi - lo);
  return Math.max(0, Math.min(1, v));
}

interface ScoredNote {
  target: ChordTarget;
  hz: number;
  salience: number;
  confidence: number;
  hzMeasured: number | null;
  cents: number | null;
}

/**
 * Notes acceptées, des graves vers les aiguës, avec retrait de leurs harmoniques du résidu.
 *
 * **Ce qui est retiré n'est pas le pic observé, mais la part que cette corde explique.** La différence
 * n'est pas cosmétique : sur un accord de Mi mineur, la fondamentale du Si aigu (247 Hz) tombe
 * *exactement* sur le 3ᵉ harmonique du Mi grave et sur le 2ᵉ du Si médium. Retirer le pic entier
 * effaçait la note qu'on cherchait à entendre ; retirer la part du modèle laisse le reste, qui est
 * précisément l'apport de la corde aiguë. Le modèle ne retire que **85 %** de sa prévision : mieux
 * vaut sous-soustraire (une corde muette reste un peu visible) que sur-soustraire (une corde jouée
 * devient invisible).
 */
function scoreNotes(
  residual: Float64Array,
  original: Float64Array,
  binHz: number,
  floor: number,
  targets: ChordTarget[],
  opts: Required<Omit<PolyOptions, 'sampleRate'>>,
): ScoredNote[] {
  const ordered = [...targets].sort((a, b) => a.midi - b.midi);
  const out: ScoredNote[] = [];
  const subtractFactor = 0.85;
  for (const target of ordered) {
    const hz = hzOfMidi(target.midi, opts.a4);
    let salience = 0;
    let fundamentalAmp = 0;
    for (let h = 1; h <= opts.harmonics; h += 1) {
      const expected = hz * h;
      if (expected > BAND_HI * 2) break;
      // ±35 cents (2^35/1200 − 1 ≈ 2,04 %) : couvre l'inharmonicité d'une corde réelle, un désaccord de
      // 30 cents — une guitare qui sort du magasin est rarement mieux — et un La de référence décalé
      // (432 Hz = −31,8 cents). Deux demi-tons restent à 100 cents : la marge de sécurité est de 30.
      const tol = Math.max(expected * 0.0204, binHz * 1.5);
      const peak = peakNear(residual, binHz, expected, tol);
      if (!peak) continue;
      salience += peak.amp * harmonicWeight(h);
      if (h === 1) fundamentalAmp = peak.amp;
    }
    const confidence = confidenceFrom(salience, floor, opts.harmonics);
    // Les cents se lisent sur le spectre **d'origine** : après soustraction, ce qui reste à cette
    // fréquence peut être un résidu d'une autre corde.
    const near = nearestPeak(original, binHz, hz, hz * 0.02);
    const cents = near ? centsBetween(near.hz, hz) : null;
    out.push({ target, hz, salience, confidence, hzMeasured: near?.hz ?? null, cents });
    // Soustraction : ce que cette corde explique ne doit pas servir à justifier la suivante.
    if (confidence >= opts.minConfidence * 0.6 && fundamentalAmp > 0) {
      for (let h = 1; h <= opts.harmonics; h += 1) {
        const expected = hz * h;
        if (expected > BAND_HI * 2) break;
        const predicted = fundamentalAmp * (harmonicWeight(h) / harmonicWeight(1)) * subtractFactor;
        const bin = Math.round(expected / binHz);
        const width = Math.max(2, Math.round((expected * 0.0204) / binHz));
        for (let k = Math.max(1, bin - width); k <= Math.min(residual.length - 1, bin + width); k += 1) {
          // on retire la part modélisée, jamais plus que ce qui est là, et jamais sous le plancher
          residual[k] = Math.max(floor * 0.5, residual[k]! - predicted);
        }
      }
    }
  }
  return out;
}

/** Prépare un spectre analysable depuis une fenêtre d'échantillons. */
export function prepareSpectrum(samples: Float32Array, options: PolyOptions): Spectrum {
  const opts = { ...DEFAULT_POLY, ...options };
  const fftSize = Math.min(opts.fftSize, 1 << Math.floor(Math.log2(Math.max(1024, samples.length))));
  const mag = magnitudeSpectrum(samples, fftSize);
  const binHz = opts.sampleRate / fftSize;
  const band: number[] = [];
  let bandMax = 0;
  for (let k = Math.max(1, Math.floor(BAND_LO / binHz)); k < Math.min(mag.length, Math.ceil(BAND_HI / binHz)); k += 1) {
    band.push(mag[k]!);
    if (mag[k]! > bandMax) bandMax = mag[k]!;
  }
  let sumSq = 0;
  for (let i = 0; i < samples.length; i += 1) sumSq += samples[i]! ** 2;
  const rms = Math.sqrt(sumSq / Math.max(1, samples.length));
  const onset = detectOnsetMs(samples, opts.sampleRate);
  return {
    mag,
    binHz,
    sampleRate: opts.sampleRate,
    fftSize,
    // Plancher = médiane du spectre, **mais jamais moins de 0,4 % du pic le plus fort** : sans ce
    // plancher relatif, les fuites d'une corde grave (des harmoniques à −60 dB) passaient pour une
    // preuve et toutes les notes saturaient à 1,00 — mesuré sur G contre G/B, deux hypothèses
    // indistinguables au score.
    noise: Math.max(median(band), bandMax * 0.004, 1e-9),
    rmsDb: rms > 0 ? 20 * Math.log10(rms) : -Infinity,
    onsetMs: onset?.ms ?? null,
  };
}

/** Analyse d'un spectre préparé : chaque note attendue reçoit sa confiance. */
export function analyzeSpectrum(spectrum: Spectrum, targets: ChordTarget[], options: PolyOptions): ChordAnalysis {
  const opts = { ...DEFAULT_POLY, ...options };
  const residual = Float64Array.from(spectrum.mag);
  const scored = scoreNotes(residual, spectrum.mag, spectrum.binHz, spectrum.noise, targets, opts);

  const notes: NoteEvidence[] = scored.map((s) => ({
    midi: s.target.midi,
    string: s.target.string,
    hz: s.hz,
    hzMeasured: s.hzMeasured,
    cents: s.cents,
    confidence: s.confidence,
    salience: s.salience,
  }));

  const present = notes.map((n, i) => (n.confidence >= opts.minConfidence ? i : -1)).filter((i) => i >= 0);
  const missing = notes.map((n, i) => (n.confidence < opts.minConfidence ? i : -1)).filter((i) => i >= 0);

  // Énergie expliquée : part du spectre de bande que les harmoniques retenues recouvrent.
  let total = 0;
  for (let k = Math.floor(BAND_LO / spectrum.binHz); k < Math.min(spectrum.mag.length, Math.ceil(BAND_HI / spectrum.binHz)); k += 1) {
    total += spectrum.mag[k]!;
  }
  let leftover = 0;
  for (let k = Math.floor(BAND_LO / spectrum.binHz); k < Math.min(residual.length, Math.ceil(BAND_HI / spectrum.binHz)); k += 1) {
    leftover += residual[k]!;
  }
  const explainedShare = total > 0 ? Math.max(0, Math.min(1, 1 - (leftover - spectrum.noise * 20) / total)) : 0;

  // Pics forts que personne n'explique : la matière du message « Sol♯ au lieu de Sol ».
  const extraNotes: ChordAnalysis['extraNotes'] = [];
  const covered: { hz: number; bin: number }[] = [];
  for (const s of scored) {
    for (let h = 1; h <= opts.harmonics; h += 1) {
      const expected = s.hz * h;
      if (expected > BAND_HI) break;
      covered.push({ hz: expected, bin: Math.round(expected / spectrum.binHz) });
    }
  }
  const minAmp = spectrum.noise * 12;
  for (let k = Math.max(2, Math.floor(BAND_LO / spectrum.binHz)); k < Math.min(spectrum.mag.length - 2, Math.ceil(BAND_HI / spectrum.binHz)); k += 1) {
    const amp = spectrum.mag[k]!;
    if (amp < minAmp || amp < spectrum.mag[k - 1]! || amp < spectrum.mag[k + 1]!) continue;
    const hz = k * spectrum.binHz;
    const explained = covered.some((c) => Math.abs(c.bin - k) <= Math.max(2, Math.round(c.hz * 0.0204 / spectrum.binHz)));
    if (explained) continue;
    const midi = Math.round(midiOfHz(hz, opts.a4));
    if (midi < 36 || midi > 96) continue;
    extraNotes.push({ midi, hz, cents: centsBetween(hz, hzOfMidi(midi, opts.a4)), salience: amp / spectrum.noise });
  }
  extraNotes.sort((a, b) => b.salience - a.salience);

  const meanConfidence = notes.length > 0 ? notes.reduce((sum, n) => sum + n.confidence, 0) / notes.length : 0;
  const heard = present.length;
  const allHeard = missing.length === 0;
  const silent = spectrum.rmsDb < opts.silenceDb;
  const verdict: ChordVerdict = silent ? 'silent'
    : allHeard ? 'ok'
      : heard >= Math.ceil(notes.length * 0.6) ? 'partial'
        : 'wrong';
  // La confiance globale suit la corde la plus faible : un accord plaqué est un tout.
  const weakest = notes.length > 0 ? Math.min(...notes.map((n) => n.confidence)) : 0;
  const confidence = silent ? 0 : meanConfidence * 0.4 + weakest * 0.6;

  // Fondamentales fortes que personne n'explique, dans le registre où une guitare pose ses basses.
  let maxPeak = 0;
  for (let k = Math.floor(BAND_LO / spectrum.binHz); k < Math.min(spectrum.mag.length, Math.ceil(700 / spectrum.binHz)); k += 1) {
    if (spectrum.mag[k]! > maxPeak) maxPeak = spectrum.mag[k]!;
  }
  let unexplainedWeight = 0;
  if (maxPeak > 0) {
    for (let k = Math.max(2, Math.floor(BAND_LO / spectrum.binHz)); k < Math.min(spectrum.mag.length - 2, Math.ceil(700 / spectrum.binHz)); k += 1) {
      const amp = spectrum.mag[k]!;
      if (amp < maxPeak * 0.12) continue;
      if (amp < spectrum.mag[k - 1]! || amp < spectrum.mag[k + 1]!) continue;
      const hz = k * spectrum.binHz;
      const midi = Math.round(midiOfHz(hz, opts.a4));
      if (Math.abs(centsBetween(hz, hzOfMidi(midi, opts.a4))) > 45) continue; // pas une note de la gamme
      const explained = covered.some((c) => Math.abs(c.bin - k) <= Math.max(2, Math.round(c.hz * 0.0204 / spectrum.binHz)));
      if (explained) continue;
      unexplainedWeight += amp / maxPeak;
    }
  }
  unexplainedWeight = Math.min(1, unexplainedWeight);

  return {
    notes,
    confidence,
    present,
    missing,
    verdict,
    explainedShare,
    onsetMs: spectrum.onsetMs,
    extraNotes: extraNotes.slice(0, 4),
    rmsDb: spectrum.rmsDb,
    heard,
    unexplainedWeight,
  };
}

/** Analyse complète : fenêtre d'échantillons → confiance par corde. */
export function analyzeChord(samples: Float32Array, targets: ChordTarget[], options: PolyOptions): ChordAnalysis {
  return analyzeSpectrum(prepareSpectrum(samples, options), targets, options);
}

/**
 * Score d'une hypothèse, indépendamment des autres : sert à comparer des accords voisins.
 *
 * Confiance **moins la pénalité d'inexpliqué** : un accord dont toutes les notes sont là mais qui
 * laisse une basse forte sans explication n'est pas la bonne réponse (c'est le cas de « Do » sur un
 * « La mineur 7 »). Le coefficient 0,45 est réglé sur la matrice de confusion (`tests/poly-matrix.test.ts`).
 */
export function scoreHypothesis(spectrum: Spectrum, targets: ChordTarget[], options: PolyOptions): number {
  const a = analyzeSpectrum(spectrum, targets, options);
  return a.confidence - 0.45 * a.unexplainedWeight;
}
