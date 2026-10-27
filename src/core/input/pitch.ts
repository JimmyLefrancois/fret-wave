/**
 * Détection de hauteur monophonique (phase 3) : `pitchy` (méthode de McLeod, MPM) + deux couches
 * maison qui font toute la différence pédagogique :
 *
 *  1. `PitchTracker` — une mesure brute sur une fenêtre (fréquence, clarté, note, cents) ;
 *  2. `NoteStabilizer` — **retenue de la note** : une note n'est « reconnue » qu'après N fenêtres
 *     consécutives dans la même demi-teinte. Sans elle, une corde qui s'éteint produit des sauts
 *     d'une demi-teinte et remplirait des cases au hasard.
 *
 * Convention de hauteur : son réel (E2 = 82,41 Hz), La 440 par défaut, réglable (MUSIC_DESIGN §1.1).
 * Le tableau des notes n'est PAS ici : `match.ts` décide, ce module mesure.
 */
import { PitchDetector } from 'pitchy';
import { A4_DEFAULT } from '../theory/fretboard';

export interface PitchReading {
  hz: number;
  /** 0-1 (McLeod) : netteté de la période détectée. */
  clarity: number;
  /** Hauteur en demi-tons flottants (MIDI). */
  midiFloat: number;
  /** Demi-ton entier le plus proche. */
  midi: number;
  /** Écart signé à la note tempérée, en cents (−50…+50). */
  cents: number;
}

export function midiFloatOf(hz: number, a4 = A4_DEFAULT): number {
  return 69 + 12 * Math.log2(hz / a4);
}

export function centsBetween(hz: number, targetHz: number): number {
  return 1200 * Math.log2(hz / targetHz);
}

/** Construit une lecture à partir d'une fréquence ; `null` si la mesure est inutilisable. */
export function readingFrom(hz: number, clarity: number, a4 = A4_DEFAULT): PitchReading | null {
  if (!Number.isFinite(hz) || hz <= 0 || !Number.isFinite(clarity) || clarity <= 0) return null;
  const midiFloat = midiFloatOf(hz, a4);
  const midi = Math.round(midiFloat);
  return { hz, clarity, midiFloat, midi, cents: (midiFloat - midi) * 100 };
}

export interface PitchTrackerOptions {
  windowSize: number;
  sampleRate: number;
  a4?: number;
  /** Seuil RMS de détection (dBFS) : en dessous, il n'y a pas de note à analyser. */
  minVolumeDb?: number;
  /** Constante k de MPM (0,8-1) : sélection du maximum de NSDF. */
  clarityThreshold?: number;
  /** Clarté minimale **acceptée** : en dessous, on ne rend pas de lecture (bruit, note floue). */
  minClarity?: number;
}

/**
 * Enveloppe `pitchy` pour une fenêtre de taille fixe (voir `pitchWindowSize` dans `theory/fretboard` :
 * 2048 à 48 kHz pour un Mi grave, 4096 pour un Si1 de 7 cordes).
 *
 * Attention à une subtilité de `pitchy` : son `minVolumeDecibels` est exprimé en **amplitude au
 * carré** (`10^(db/10)` comparé à un RMS), pas en dBFS (`20·log10`). Un seuil de −40 dBFS (ce que
 * lit l'utilisateur, et ce que mesure la page Audio) doit donc lui être passé comme −20 ; sans cette
 * conversion, le seuil réel serait 100 fois plus bas que celui affiché.
 */
export class PitchTracker {
  readonly windowSize: number;
  readonly sampleRate: number;
  private readonly detector: PitchDetector<Float32Array>;
  private a4: number;
  private minClarity: number;

  constructor(opts: PitchTrackerOptions) {
    this.windowSize = opts.windowSize;
    this.sampleRate = opts.sampleRate;
    this.a4 = opts.a4 ?? A4_DEFAULT;
    this.minClarity = opts.minClarity ?? 0.9;
    this.detector = PitchDetector.forFloat32Array(opts.windowSize);
    this.detector.clarityThreshold = opts.clarityThreshold ?? 0.9;
    this.detector.minVolumeDecibels = dbfsToPitchy(opts.minVolumeDb ?? -60);
  }

  setA4(a4: number): void {
    this.a4 = a4;
  }

  /** Réglages à chaud (seuil, clarté) : `pitchy` les applique à la mesure suivante. */
  setGates(opts: { minVolumeDb?: number; clarityThreshold?: number; minClarity?: number; a4?: number }): void {
    if (opts.minVolumeDb !== undefined) this.detector.minVolumeDecibels = dbfsToPitchy(opts.minVolumeDb);
    if (opts.clarityThreshold !== undefined) this.detector.clarityThreshold = opts.clarityThreshold;
    if (opts.minClarity !== undefined) this.minClarity = opts.minClarity;
    if (opts.a4 !== undefined) this.a4 = opts.a4;
  }

  /** Lecture utilisable, ou `null` : trop silencieux, ou trop flou pour être jugé. */
  detect(frame: Float32Array): PitchReading | null {
    if (frame.length !== this.windowSize) return null;
    const [hz, clarity] = this.detector.findPitch(frame, this.sampleRate);
    if (clarity < this.minClarity) return null;
    return readingFrom(hz, clarity, this.a4);
  }
}

/** dBFS (20·log10 d'un RMS) → convention de `pitchy` (10^(x/10) comparé au même RMS). */
export function dbfsToPitchy(dbFs: number): number {
  return Math.max(-80, Math.min(0, dbFs)) / 2;
}

export interface StableNote {
  midi: number;
  hz: number;
  /** Médiane des écarts (cents) des fenêtres retenues : la justesse affichée est stable. */
  cents: number;
  /** Nombre de fenêtres qui ont confirmé la note. */
  frames: number;
}

export interface StableStep {
  note: StableNote | null;
  /** `true` la première fenêtre où la note devient stable (une seule fois par note jouée). */
  isNew: boolean;
}

/**
 * Retenue de note : N fenêtres consécutives dans la même demi-teinte, écartées de moins de
 * `maxSpreadCents`. Un silence (`null`) casse la retenue — rejouer la même note redéclenche.
 */
export class NoteStabilizer {
  private buffer: PitchReading[] = [];
  private confirmed: number | null = null;
  private readonly frames: number;
  private readonly maxSpreadCents: number;

  constructor(opts: { frames?: number; maxSpreadCents?: number } = {}) {
    this.frames = Math.max(1, opts.frames ?? 3);
    this.maxSpreadCents = opts.maxSpreadCents ?? 40;
  }

  /** Note actuellement tenue (même entre deux fenêtres), sans effet de bord. */
  get current(): StableNote | null {
    if (this.confirmed === null) return null;
    return summarise(this.buffer, this.confirmed, this.maxSpreadCents);
  }

  push(reading: PitchReading | null): StableStep {
    if (!reading) {
      this.buffer = [];
      this.confirmed = null;
      return { note: null, isNew: false };
    }
    // une fenêtre qui change de demi-teinte repart de zéro (pas de moyenne entre deux notes)
    const last = this.buffer[this.buffer.length - 1];
    if (last && last.midi !== reading.midi) this.buffer = [];
    this.buffer.push(reading);
    if (this.buffer.length > this.frames) this.buffer.shift();

    if (this.buffer.length < this.frames) return { note: null, isNew: false };
    const note = summarise(this.buffer, reading.midi, this.maxSpreadCents);
    if (!note) {
      // étalement trop grand : le doigt n'est pas posé, ou la corde s'éteint
      this.confirmed = null;
      return { note: null, isNew: false };
    }
    const isNew = this.confirmed !== note.midi;
    this.confirmed = note.midi;
    return { note, isNew };
  }

  reset(): void {
    this.buffer = [];
    this.confirmed = null;
  }
}

function summarise(buffer: readonly PitchReading[], midi: number, maxSpreadCents: number): StableNote | null {
  if (buffer.length === 0) return null;
  const centsValues = buffer.filter((r) => r.midi === midi).map((r) => r.cents);
  if (centsValues.length === 0) return null;
  const spread = Math.max(...centsValues) - Math.min(...centsValues);
  if (spread > maxSpreadCents) return null;
  const sorted = [...centsValues].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const hzMedian = [...buffer].filter((r) => r.midi === midi).map((r) => r.hz).sort((a, b) => a - b);
  return { midi, cents: median, hz: hzMedian[Math.floor(hzMedian.length / 2)]!, frames: centsValues.length };
}
