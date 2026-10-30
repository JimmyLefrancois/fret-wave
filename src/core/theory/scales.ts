/**
 * Catalogue des gammes : formules d'intervalles (format `tonal`), modes, symétries.
 * L'orthographe vient de la tonique + formule (une note par lettre pour les heptatoniques),
 * jamais de l'armure (MUSIC_DESIGN.md §1.3).
 */
import { Interval, Note, transpose } from 'tonal';
import type { DegreeLabel, IntervalName, NoteName, PitchClass } from './types';

export type ScaleFamily =
  | 'diatonic'
  | 'pentatonic'
  | 'blues'
  | 'harmonic-minor'
  | 'melodic-minor'
  | 'symmetric'
  | 'bebop';

export interface ScaleDef {
  id: string;
  nameFr: string;
  family: ScaleFamily;
  /** Intervalles depuis la tonique (format tonal). */
  intervals: IntervalName[];
  /** Pour un mode : gamme parente + rang (0 = ionien/1er degré). */
  parent?: { scaleId: string; rotation: number };
  /** Alias connus (ex. phrygien dominant = mixolydien ♭9 ♭13). */
  aliasesFr?: string[];
  /** Pour les modes du diatonique : degré(s) caractéristique(s). */
  characteristic?: DegreeLabel[];
}

/** Étiquette de degré à partir d'un intervalle tonal : "3m" → "b3", "4A" → "#4", "7d" → "bb7". */
export function degreeLabel(interval: IntervalName): DegreeLabel {
  const i = Interval.get(interval);
  if (i.empty) throw new Error(`intervalle invalide : ${interval}`);
  const num = i.num;
  const q = i.q;
  const perfectable = [1, 4, 5].includes(((num - 1) % 7) + 1);
  let alt = 0;
  if (perfectable) {
    alt = q === 'P' ? 0 : q === 'A' ? 1 : q === 'AA' ? 2 : q === 'd' ? -1 : q === 'dd' ? -2 : NaN;
  } else {
    alt = q === 'M' ? 0 : q === 'm' ? -1 : q === 'A' ? 1 : q === 'AA' ? 2 : q === 'd' ? -2 : q === 'dd' ? -3 : NaN;
  }
  if (Number.isNaN(alt)) throw new Error(`qualité inconnue : ${interval}`);
  const prefix = alt === 0 ? '' : alt > 0 ? '#'.repeat(alt) : 'b'.repeat(-alt);
  return `${prefix}${num}`;
}

/** Rotation d'une formule heptatonique : renvoie les intervalles relatifs à la nouvelle tonique. */
function rotate(intervals: IntervalName[], k: number): IntervalName[] {
  const base = intervals[k]!;
  return intervals.map((_, j) => {
    const target = intervals[(k + j) % intervals.length]!;
    let iv = Interval.subtract(target, base);
    if (!iv) throw new Error('rotation impossible');
    // Cible située avant la base dans la formule : on remonte d'une octave.
    if (Interval.get(iv).semitones < 0) {
      const up = Interval.add(iv, '8P');
      if (!up) throw new Error('rotation impossible');
      iv = up;
    }
    iv = Interval.simplify(iv);
    return iv === '8P' ? '1P' : iv;
  });
}

const MAJOR = ['1P', '2M', '3M', '4P', '5P', '6M', '7M'];
const HARMONIC_MINOR = ['1P', '2M', '3m', '4P', '5P', '6m', '7M'];
// Convention jazz : mélodique identique en montée ET en descente (1 2 b3 4 5 6 7).
const MELODIC_MINOR = ['1P', '2M', '3m', '4P', '5P', '6M', '7M'];

const defs: ScaleDef[] = [];
function add(d: ScaleDef) {
  defs.push(d);
}

// --- 7 modes diatoniques
const DIATONIC: Array<{ id: string; fr: string; chars: DegreeLabel[]; aliases?: string[] }> = [
  { id: 'ionian', fr: 'Ionien (majeure)', chars: [], aliases: ['Majeure'] },
  { id: 'dorian', fr: 'Dorien', chars: ['6'] },
  { id: 'phrygian', fr: 'Phrygien', chars: ['b2'] },
  { id: 'lydian', fr: 'Lydien', chars: ['#4'] },
  { id: 'mixolydian', fr: 'Mixolydien', chars: ['b7'] },
  { id: 'aeolian', fr: 'Éolien (mineure naturelle)', chars: ['b6'], aliases: ['Mineure naturelle'] },
  { id: 'locrian', fr: 'Locrien', chars: ['b2', 'b5'] },
];
DIATONIC.forEach((m, k) => {
  add({
    id: m.id,
    nameFr: m.fr,
    family: 'diatonic',
    intervals: rotate(MAJOR, k),
    parent: k === 0 ? undefined : { scaleId: 'ionian', rotation: k },
    aliasesFr: m.aliases,
    characteristic: m.chars,
  });
});

// --- Pentatoniques et blues
add({ id: 'pentatonic-minor', nameFr: 'Pentatonique mineure', family: 'pentatonic', intervals: ['1P', '3m', '4P', '5P', '7m'] });
add({ id: 'pentatonic-major', nameFr: 'Pentatonique majeure', family: 'pentatonic', intervals: ['1P', '2M', '3M', '5P', '6M'] });
add({ id: 'blues-minor', nameFr: 'Blues mineur', family: 'blues', intervals: ['1P', '3m', '4P', '5d', '5P', '7m'], characteristic: ['b5'] });
add({ id: 'blues-major', nameFr: 'Blues majeur', family: 'blues', intervals: ['1P', '2M', '3m', '3M', '5P', '6M'], characteristic: ['b3'] });

// --- Harmonique et ses modes
const HM_MODES: Array<[string, string, string[]?]> = [
  ['harmonic-minor', 'Mineure harmonique'],
  ['locrian-natural6', 'Locrien ♮6'],
  ['ionian-augmented', 'Ionien ♯5'],
  ['dorian-sharp4', 'Dorien ♯4'],
  ['phrygian-dominant', 'Phrygien dominant', ['Mixolydien ♭9 ♭13']],
  ['lydian-sharp2', 'Lydien ♯2'],
  ['altered-diminished', 'Super-locrien 𝄫7'],
];
HM_MODES.forEach(([id, fr, al], k) => {
  add({
    id, nameFr: fr, family: 'harmonic-minor', intervals: rotate(HARMONIC_MINOR, k),
    parent: k === 0 ? undefined : { scaleId: 'harmonic-minor', rotation: k }, aliasesFr: al,
  });
});

// --- Mélodique (jazz) et ses modes
const MM_MODES: Array<[string, string, string[]?]> = [
  ['melodic-minor', 'Mineure mélodique (jazz)'],
  ['dorian-b2', 'Dorien ♭2'],
  ['lydian-augmented', 'Lydien ♯5'],
  ['lydian-dominant', 'Lydien dominant'],
  ['mixolydian-b6', 'Mixolydien ♭6'],
  ['locrian-natural2', 'Locrien ♮2', ['Demi-diminué']],
  ['altered', 'Altérée', ['Super-locrien']],
];
MM_MODES.forEach(([id, fr, al], k) => {
  add({
    id, nameFr: fr, family: 'melodic-minor', intervals: rotate(MELODIC_MINOR, k),
    parent: k === 0 ? undefined : { scaleId: 'melodic-minor', rotation: k }, aliasesFr: al,
  });
});

// --- Symétriques et bebop
add({ id: 'whole-tone', nameFr: 'Tons entiers', family: 'symmetric', intervals: ['1P', '2M', '3M', '4A', '5A', '7m'] });
add({ id: 'diminished-wh', nameFr: 'Diminuée ton–demi-ton', family: 'symmetric', intervals: ['1P', '2M', '3m', '4P', '5d', '6m', '6M', '7M'] });
add({ id: 'diminished-hw', nameFr: 'Diminuée demi-ton–ton', family: 'symmetric', intervals: ['1P', '2m', '3m', '3M', '4A', '5P', '6M', '7m'] });
add({ id: 'augmented', nameFr: 'Augmentée', family: 'symmetric', intervals: ['1P', '2A', '3M', '5P', '5A', '7M'] });
add({ id: 'bebop-dominant', nameFr: 'Bebop dominante', family: 'bebop', intervals: ['1P', '2M', '3M', '4P', '5P', '6M', '7m', '7M'] });
add({ id: 'bebop-major', nameFr: 'Bebop majeure', family: 'bebop', intervals: ['1P', '2M', '3M', '4P', '5P', '5A', '6M', '7M'] });

export const SCALES: readonly ScaleDef[] = defs;
const BY_ID = new Map(defs.map((d) => [d.id, d]));

export function getScale(id: string): ScaleDef {
  const d = BY_ID.get(id);
  if (!d) throw new Error(`gamme inconnue : ${id}`);
  return d;
}

export function degreeLabels(def: ScaleDef): DegreeLabel[] {
  return def.intervals.map(degreeLabel);
}

/** Notes (orthographe par tonique + formule). */
export function scaleNotes(def: ScaleDef, tonic: NoteName): NoteName[] {
  return def.intervals.map((iv) => {
    const n = transpose(tonic, iv);
    if (!n) throw new Error(`transposition impossible : ${tonic} + ${iv}`);
    return n;
  });
}

export function pitchClassOf(note: NoteName): PitchClass {
  const c = Note.get(note).chroma;
  if (c === undefined || Number.isNaN(c)) throw new Error(`note invalide : ${note}`);
  return c;
}

export function scalePitchClasses(def: ScaleDef, tonic: NoteName): PitchClass[] {
  return scaleNotes(def, tonic).map(pitchClassOf);
}

/** Nombre d'altérations (|♯|+|♭|, double = 2) de la gamme : base du « coût d'orthographe ». */
export function spellingCost(def: ScaleDef, tonic: NoteName): number {
  let cost = 0;
  for (const n of scaleNotes(def, tonic)) {
    const alt = Math.abs(Note.get(n).alt);
    cost += alt;
    if (alt >= 2) cost += 3; // pénalité : double altération
  }
  return cost;
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

/** Orthographes simples (0 ou 1 altération) d'une classe de hauteur. */
export function simpleSpellings(pc: PitchClass): NoteName[] {
  const out: NoteName[] = [];
  LETTERS.forEach((l, i) => {
    const d = (((pc - LETTER_PC[i]!) % 12) + 12) % 12;
    if (d === 0) out.push(l);
    else if (d === 1) out.push(`${l}#`);
    else if (d === 11) out.push(`${l}b`);
  });
  return out;
}

/**
 * Choix des orthographes de tonique proposées pour une classe de hauteur : celles dont le coût
 * est minimal ou à un point du minimum (Fa♯ / Sol♭ : 6 altérations chacun → les deux).
 * Renvoie 1 ou 2 noms, du moins coûteux au plus coûteux.
 */
export function tonicSpellings(def: ScaleDef, pc: PitchClass): NoteName[] {
  const scored = simpleSpellings(pc)
    .map((n) => ({ n, cost: spellingCost(def, n) }))
    .sort((a, b) => a.cost - b.cost || a.n.localeCompare(b.n));
  const min = scored[0]!.cost;
  return scored.filter((s) => s.cost - min <= 0).map((s) => s.n);
}

/** Pour un mode diatonique : tonique de la gamme majeure parente. "D dorian" → "C". */
export function parentMajorTonic(def: ScaleDef, tonic: NoteName): NoteName | null {
  if (def.family !== 'diatonic') return null;
  const k = def.parent?.rotation ?? 0;
  if (k === 0) return tonic;
  const parent = transpose(tonic, `-${MAJOR[k]!}`);
  return parent || null;
}

/** Demi-tons de chaque note depuis la tonique, dans l'ordre de la formule (0 = tonique). */
export function semitonesOf(def: ScaleDef): number[] {
  return def.intervals.map((iv) => Interval.semitones(iv) ?? 0);
}

/**
 * Écarts successifs en demi-tons, jusqu'à l'octave : la formule qui reconstruit la gamme depuis n'importe
 * quelle tonique, et aussi le nombre de cases à franchir sur une corde. Majeure : 2-2-1-2-2-2-1.
 */
export function stepFormula(def: ScaleDef): number[] {
  const s = semitonesOf(def);
  return s.map((v, i) => (s[i + 1] ?? 12) - v);
}

/** Rang dans la formule d'une classe de hauteur, `null` si la note n'est pas dans la gamme. */
export function degreeIndexOf(def: ScaleDef, tonic: NoteName, pc: PitchClass): number | null {
  const offset = ((pc - pitchClassOf(tonic)) % 12 + 12) % 12;
  const index = semitonesOf(def).indexOf(offset);
  return index < 0 ? null : index;
}

/** Relative mineure / majeure d'une gamme de cinq ou six notes (mêmes notes, autre tonique). */
const RELATIVE: Readonly<Record<string, { scaleId: string; interval: IntervalName }>> = {
  ionian: { scaleId: 'aeolian', interval: '6M' },
  'pentatonic-major': { scaleId: 'pentatonic-minor', interval: '6M' },
  'pentatonic-minor': { scaleId: 'pentatonic-major', interval: '3m' },
  'blues-major': { scaleId: 'blues-minor', interval: '6M' },
  'blues-minor': { scaleId: 'blues-major', interval: '3m' },
};

/**
 * La gamme aux mêmes notes, tonique déplacée : la relative (Do majeur ↔ La mineure naturelle), ou la majeure
 * parente pour un mode (Ré dorien → Do majeur). `null` si elle n'existe pas ou n'a pas d'orthographe jouable.
 */
export function relativeScale(def: ScaleDef, tonic: NoteName): { scaleId: string; tonic: NoteName } | null {
  const rel = RELATIVE[def.id];
  if (rel) return { scaleId: rel.scaleId, tonic: transpose(tonic, rel.interval) };
  const parent = parentMajorTonic(def, tonic);
  return parent ? { scaleId: 'ionian', tonic: parent } : null;
}

// ---------------------------------------------------------------------------
// Symétries et identité de révision
// ---------------------------------------------------------------------------

/** Ensemble de hauteurs trié, sous forme de clé : identité d'une collection (même notes = même clé). */
export function collectionKey(def: ScaleDef, tonic: NoteName): string {
  return [...new Set(scalePitchClasses(def, tonic))].sort((a, b) => a - b).join('-');
}

/** Nombre de transpositions distinctes (12 pour la plupart ; 2 tons entiers ; 3 diminuée ; 4 augmentée). */
export function distinctTranspositions(def: ScaleDef): number {
  const keys = new Set<string>();
  for (let pc = 0; pc < 12; pc++) {
    const tonic = simpleSpellings(pc)[0]!;
    keys.add(collectionKey(def, tonic));
  }
  return keys.size;
}

/** Nombre de modes distincts = rotations distinctes du motif de pas. */
export function distinctModes(def: ScaleDef): number {
  const pcs = [...new Set(def.intervals.map((iv) => Interval.get(iv).chroma))].sort((a, b) => a - b);
  const steps = pcs.map((p, i) => (((pcs[(i + 1) % pcs.length]! - p) % 12) + 12) % 12);
  const rots = new Set<string>();
  for (let k = 0; k < steps.length; k++) rots.add([...steps.slice(k), ...steps.slice(0, k)].join(','));
  return rots.size;
}

/** Une gamme heptatonique doit avoir exactement une note par lettre. */
export function hasOneNotePerLetter(notes: NoteName[]): boolean {
  const letters = notes.map((n) => n[0]);
  return new Set(letters).size === letters.length;
}
