/**
 * Accords par formule d'intervalles, orthographe correcte par lettres (MUSIC_DESIGN.md §1.6).
 * Le modèle utilise des symboles anglo ("Cmaj7", "F#m7b5", "C/G") ; l'affichage passe par notation.ts.
 */
import { transpose } from 'tonal';
import { degreeLabel, pitchClassOf } from './scales';
import { parseChordSymbol } from './notation';
import type { DegreeLabel, IntervalName, NoteName, PitchClass } from './types';

export interface ChordQuality {
  id: string;
  /** Suffixe du modèle ("" = majeur). */
  suffix: string;
  nameFr: string;
  intervals: IntervalName[];
}

export const CHORD_QUALITIES: readonly ChordQuality[] = [
  { id: 'maj', suffix: '', nameFr: 'majeur', intervals: ['1P', '3M', '5P'] },
  { id: 'min', suffix: 'm', nameFr: 'mineur', intervals: ['1P', '3m', '5P'] },
  { id: 'dom7', suffix: '7', nameFr: 'septième de dominante', intervals: ['1P', '3M', '5P', '7m'] },
  { id: 'maj7', suffix: 'maj7', nameFr: 'septième majeure', intervals: ['1P', '3M', '5P', '7M'] },
  { id: 'min7', suffix: 'm7', nameFr: 'mineur septième', intervals: ['1P', '3m', '5P', '7m'] },
  { id: 'sus2', suffix: 'sus2', nameFr: 'sus2', intervals: ['1P', '2M', '5P'] },
  { id: 'sus4', suffix: 'sus4', nameFr: 'sus4', intervals: ['1P', '4P', '5P'] },
  { id: 'add9', suffix: 'add9', nameFr: 'add9', intervals: ['1P', '3M', '5P', '9M'] },
  { id: 'm7b5', suffix: 'm7b5', nameFr: 'demi-diminué', intervals: ['1P', '3m', '5d', '7m'] },
  { id: 'dim', suffix: 'dim', nameFr: 'diminué (triade)', intervals: ['1P', '3m', '5d'] },
  { id: 'dim7', suffix: 'dim7', nameFr: 'diminué septième', intervals: ['1P', '3m', '5d', '7d'] },
  { id: 'power', suffix: '5', nameFr: 'power chord (1-5)', intervals: ['1P', '5P'] },
];

const BY_SUFFIX = new Map(CHORD_QUALITIES.map((q) => [q.suffix, q]));

export interface ChordInfo {
  symbol: string;
  root: NoteName;
  quality: ChordQuality;
  bass: NoteName | null;
  /** Notes de l'accord, fondamentale en premier, orthographe par lettres. */
  notes: NoteName[];
  degrees: DegreeLabel[];
  pitchClasses: PitchClass[];
}

export function interpretChord(symbol: string): ChordInfo {
  const p = parseChordSymbol(symbol);
  if (!p) throw new Error(`symbole d'accord invalide : "${symbol}"`);
  const quality = BY_SUFFIX.get(p.suffix);
  if (!quality) throw new Error(`qualité d'accord inconnue : "${p.suffix}" dans "${symbol}"`);
  const notes = quality.intervals.map((iv) => {
    const n = transpose(p.root, iv);
    if (!n) throw new Error(`transposition impossible : ${p.root} + ${iv}`);
    return n;
  });
  return {
    symbol,
    root: p.root,
    quality,
    bass: p.bass,
    notes,
    degrees: quality.intervals.map(degreeLabel),
    pitchClasses: notes.map(pitchClassOf),
  };
}

/** Note qui doit sonner le plus grave : la basse déclarée, sinon la fondamentale. */
export function expectedBassPitchClass(info: ChordInfo): PitchClass {
  return pitchClassOf(info.bass ?? info.root);
}
