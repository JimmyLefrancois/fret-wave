/** Correspondance hauteur ↔ corde/case, générique sur l'accordage (MUSIC_DESIGN.md §1.1). */
import { Note } from 'tonal';
import type { PitchName } from './types';
import type { Tuning } from './tunings';

export const A4_DEFAULT = 440;
export const MAX_FRET_DEFAULT = 24;

export function pitchToMidi(pitch: PitchName): number {
  const m = Note.get(pitch).midi;
  if (m === null || m === undefined) throw new Error(`hauteur invalide : ${pitch}`);
  return m;
}

export function midiToFreq(midi: number, a4 = A4_DEFAULT): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidiFloat(freq: number, a4 = A4_DEFAULT): number {
  return 69 + 12 * Math.log2(freq / a4);
}

export function openStringMidi(tuning: Tuning, string: number): number {
  const p = tuning.strings[string];
  if (p === undefined) throw new RangeError(`corde ${string} absente de l'accordage ${tuning.id}`);
  return pitchToMidi(p);
}

/** Hauteur MIDI sonore d'une corde à une case donnée (0 = à vide). */
export function fretToMidi(tuning: Tuning, string: number, fret: number): number {
  return openStringMidi(tuning, string) + fret;
}

export interface StringFret {
  string: number;
  fret: number;
}

/** Tous les emplacements (corde, case) produisant exactement cette hauteur. */
export function midiToCandidates(tuning: Tuning, midi: number, maxFret = MAX_FRET_DEFAULT): StringFret[] {
  const out: StringFret[] = [];
  tuning.strings.forEach((_, string) => {
    const fret = midi - openStringMidi(tuning, string);
    if (fret >= 0 && fret <= maxFret) out.push({ string, fret });
  });
  return out;
}

export interface FreqCandidate extends StringFret {
  midi: number;
  /** Écart signé en cents entre la fréquence mesurée et la note exacte. */
  cents: number;
}

/**
 * Candidats (corde, case) pour une fréquence mesurée : note la plus proche, puis tous ses
 * emplacements. Renvoie [] si la fréquence est hors de la plage jouable de l'accordage.
 */
export function freqToCandidates(
  tuning: Tuning,
  freq: number,
  opts: { a4?: number; maxFret?: number; maxCents?: number } = {},
): FreqCandidate[] {
  const a4 = opts.a4 ?? A4_DEFAULT;
  const maxFret = opts.maxFret ?? MAX_FRET_DEFAULT;
  const maxCents = opts.maxCents ?? 50;
  const mf = freqToMidiFloat(freq, a4);
  const midi = Math.round(mf);
  const cents = (mf - midi) * 100;
  if (Math.abs(cents) > maxCents) return [];
  return midiToCandidates(tuning, midi, maxFret).map((c) => ({ ...c, midi, cents }));
}

/** Plage de fréquences jouables déduite de l'accordage (pas codée en dur). */
export function playableFreqRange(tuning: Tuning, maxFret = MAX_FRET_DEFAULT, a4 = A4_DEFAULT) {
  const lows = tuning.strings.map((_, s) => openStringMidi(tuning, s));
  const lowest = Math.min(...lows);
  const highest = Math.max(...lows) + maxFret;
  return { minHz: midiToFreq(lowest, a4), maxHz: midiToFreq(highest, a4), minMidi: lowest, maxMidi: highest };
}

/**
 * Taille de fenêtre (puissance de 2) pour la détection mono : ≥ 3 périodes de la note la plus
 * grave (MPM). 82 Hz → 2048 ; 62 Hz → 4096 à 48 kHz.
 */
export function pitchWindowSize(tuning: Tuning, sampleRate = 48000): number {
  const { minHz } = playableFreqRange(tuning);
  const needed = (3 * sampleRate) / minHz;
  let n = 1024;
  while (n < needed) n *= 2;
  return n;
}
