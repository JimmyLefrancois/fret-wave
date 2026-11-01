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
  { id: 'aug', suffix: 'aug', nameFr: 'augmenté', intervals: ['1P', '3M', '5A'] },
  { id: '7sus4', suffix: '7sus4', nameFr: 'septième sus4', intervals: ['1P', '4P', '5P', '7m'] },
  { id: 'sus2sus4', suffix: 'sus2sus4', nameFr: 'sus2 et sus4', intervals: ['1P', '2M', '4P', '5P'] },
  { id: 'flat5', suffix: '-5', nameFr: 'quinte diminuée', intervals: ['1P', '3M', '5d'] },
  { id: '6', suffix: '6', nameFr: 'sixte', intervals: ['1P', '3M', '5P', '6M'] },
  { id: '6add9', suffix: '6add9', nameFr: 'sixte et neuvième', intervals: ['1P', '3M', '5P', '6M', '9M'] },
  { id: 'm6', suffix: 'm6', nameFr: 'mineur sixte', intervals: ['1P', '3m', '5P', '6M'] },
  { id: 'm6add9', suffix: 'm6add9', nameFr: 'mineur sixte et neuvième', intervals: ['1P', '3m', '5P', '6M', '9M'] },
  { id: 'madd9', suffix: 'm(add9)', nameFr: 'mineur add9', intervals: ['1P', '3m', '5P', '9M'] },
  { id: 'mmaj7', suffix: 'mmaj7', nameFr: 'mineur septième majeure', intervals: ['1P', '3m', '5P', '7M'] },
  { id: 'mmaj9', suffix: 'mmaj9', nameFr: 'mineur neuvième majeure', intervals: ['1P', '3m', '5P', '7M', '9M'] },
  { id: 'm7s5', suffix: 'm7#5', nameFr: 'mineur septième quinte augmentée', intervals: ['1P', '3m', '5A', '7m'] },
  { id: 'maj7b5', suffix: 'maj7(b5)', nameFr: 'septième majeure quinte diminuée', intervals: ['1P', '3M', '5d', '7M'] },
  { id: 'maj7s5', suffix: 'maj7(#5)', nameFr: 'septième majeure quinte augmentée', intervals: ['1P', '3M', '5A', '7M'] },
  { id: '7b5', suffix: '7b5', nameFr: 'septième quinte diminuée', intervals: ['1P', '3M', '5d', '7m'] },
  { id: '7s5', suffix: '7#5', nameFr: 'septième quinte augmentée', intervals: ['1P', '3M', '5A', '7m'] },
  { id: '7b9', suffix: '7b9', nameFr: 'septième neuvième mineure', intervals: ['1P', '3M', '5P', '7m', '9m'] },
  { id: '7s9', suffix: '7#9', nameFr: 'septième neuvième augmentée', intervals: ['1P', '3M', '5P', '7m', '9A'] },
  { id: '7b5b9', suffix: '7(b5,b9)', nameFr: 'septième altérée', intervals: ['1P', '3M', '5d', '7m', '9m'] },
  { id: '7b5s9', suffix: '7(b5,#9)', nameFr: 'septième altérée', intervals: ['1P', '3M', '5d', '7m', '9A'] },
  { id: '7s5b9', suffix: '7(#5,b9)', nameFr: 'septième altérée', intervals: ['1P', '3M', '5A', '7m', '9m'] },
  { id: '7s5s9', suffix: '7(#5,#9)', nameFr: 'septième altérée', intervals: ['1P', '3M', '5A', '7m', '9A'] },
  { id: '9', suffix: '9', nameFr: 'neuvième', intervals: ['1P', '3M', '5P', '7m', '9M'] },
  { id: '9b5', suffix: '9b5', nameFr: 'neuvième quinte diminuée', intervals: ['1P', '3M', '5d', '7m', '9M'] },
  { id: '9s5', suffix: '9#5', nameFr: 'neuvième quinte augmentée', intervals: ['1P', '3M', '5A', '7m', '9M'] },
  { id: 'm9', suffix: 'm9', nameFr: 'mineur neuvième', intervals: ['1P', '3m', '5P', '7m', '9M'] },
  { id: 'maj9', suffix: 'maj9', nameFr: 'neuvième majeure', intervals: ['1P', '3M', '5P', '7M', '9M'] },
  { id: 'maj9s11', suffix: 'maj9(#11)', nameFr: 'neuvième majeure onzième augmentée', intervals: ['1P', '3M', '5P', '7M', '9M', '11A'] },
  { id: '11', suffix: '11', nameFr: 'onzième', intervals: ['1P', '3M', '5P', '7m', '9M', '11P'] },
  { id: '11b9', suffix: '11b9', nameFr: 'onzième neuvième mineure', intervals: ['1P', '3M', '5P', '7m', '9m', '11P'] },
  { id: 'm11', suffix: 'm11', nameFr: 'mineur onzième', intervals: ['1P', '3m', '5P', '7m', '9M', '11P'] },
  { id: 'maj11', suffix: 'maj11', nameFr: 'onzième majeure', intervals: ['1P', '3M', '5P', '7M', '9M', '11P'] },
  { id: '13', suffix: '13', nameFr: 'treizième', intervals: ['1P', '3M', '5P', '7m', '9M', '13M'] },
  { id: '13b9', suffix: '13b9', nameFr: 'treizième neuvième mineure', intervals: ['1P', '3M', '5P', '7m', '9m', '13M'] },
  { id: '13s11', suffix: '13#11', nameFr: 'treizième onzième augmentée', intervals: ['1P', '3M', '5P', '7m', '9M', '11A', '13M'] },
  { id: 'm13', suffix: 'm13', nameFr: 'mineur treizième', intervals: ['1P', '3m', '5P', '7m', '9M', '13M'] },
  { id: 'maj13', suffix: 'maj13', nameFr: 'treizième majeure', intervals: ['1P', '3M', '5P', '7M', '9M', '13M'] },
  { id: 'maj13s11', suffix: 'maj13(#11)', nameFr: 'treizième majeure onzième augmentée', intervals: ['1P', '3M', '5P', '7M', '9M', '11A', '13M'] },
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
