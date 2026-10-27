/**
 * Modèle `TabScore` : indépendant du rendu, consommé à l'identique par le layout/rendu et par la lecture
 * audio (MUSIC_DESIGN.md §2, PROJECT.md §4.4).
 *  - temps en ticks ENTIERS (PPQ 480) : aucune dérive de flottants ;
 *  - `startTick` d'un événement est RELATIF au début de sa mesure ;
 *  - corde 0 = corde grave (la tab affiche la corde aiguë en haut) ;
 *  - hauteurs = son réel (MIDI) ; `note` = nom orthographié sans octave (anglo) ; jamais de solfège ici.
 */
import { pitchClassOf } from '../theory/scales';
import { fretToMidi } from '../theory/fretboard';
import type { Tuning } from '../theory/tunings';
import type { DegreeLabel, NoteName } from '../theory/types';

export const PPQ = 480 as const;

export type TabTechnique = 'h' | 'p' | '/' | '\\' | 'b' | '~';
export type FingerMark = 0 | 1 | 2 | 3 | 4 | 'T';

export interface Tuplet {
  /** 3 pour un triolet… */
  actual: number;
  /** …joué à la place de 2. */
  normal: number;
}

export interface TabNote {
  string: number;
  fret: number;
  /** Hauteur MIDI sonore (E2 = 40). Pour une note étouffée (`muted`), valeur indicative non jouée. */
  midi: number;
  /** Nom orthographié de la note (anglo, sans octave) : "Bb", "F#". */
  note: NoteName;
  /** Fonction d'intervalle relative à la fondamentale du contexte (gamme ou accord) : "1", "b3", "#4", "9". */
  fn: DegreeLabel;
  /** Note étouffée frappée (x sur la ligne, sans hauteur). */
  muted?: boolean;
  technique?: TabTechnique;
  finger?: FingerMark;
  /** Niveau 2 « mémorisation » : emplacement vide à compléter. */
  hidden?: boolean;
  /** Note caractéristique du mode (glow / pulsation). */
  characteristic?: boolean;
  /** Note ajoutée (blue note, passage chromatique). */
  passing?: boolean;
}

export interface StrumMark {
  /** D = vers le bas (grave → aigu), U = vers le haut (aigu → grave). */
  dir: 'D' | 'U';
  /** Décalage entre cordes (8-25 ms réalistes). */
  spreadMs?: number;
}

export interface BarreMark {
  fret: number;
  fromString: number;
  toString: number;
  finger: FingerMark;
}

export interface TabEvent {
  /** Début relatif à la mesure, en ticks. */
  startTick: number;
  durTick: number;
  tuplet?: Tuplet;
  kind: 'notes' | 'rest';
  notes: TabNote[];
  /** Symbole d'accord du modèle (anglo) : "Am7", "G/B". */
  chord?: string;
  strum?: StrumMark;
  /** Cordes non jouées dans une pile d'accord (écrites X). */
  unplayed?: number[];
  barre?: BarreMark;
}

export interface MeasureLabel {
  chord?: string;
  /** Chiffrage romain : "ii7", "V7", "Imaj7". */
  roman?: string;
  /** Texte libre (« cases 5–8 »), formaté par le générateur. */
  text?: string;
}

export interface Measure {
  /** Si absent : signature du score. */
  timeSig?: [number, number];
  tempo?: number;
  label?: MeasureLabel;
  events: TabEvent[];
}

export interface TabScore {
  id: string;
  kind: 'scale' | 'position' | 'arpeggio' | 'chord' | 'progression' | 'exercise';
  tuning: Tuning;
  stringCount: number;
  ppq: typeof PPQ;
  tempo: number;
  timeSig: [number, number];
  measures: Measure[];
  /** Données de contexte pour l'UI (jamais de texte contenant des noms de notes). */
  meta?: {
    scaleId?: string;
    tonic?: NoteName;
    positionId?: string;
    system?: string;
    chord?: string;
  };
}

// ---------------------------------------------------------------------------
// Temps
// ---------------------------------------------------------------------------

export function measureTicksFor(timeSig: readonly [number, number]): number {
  const t = (timeSig[0] * PPQ * 4) / timeSig[1];
  if (!Number.isInteger(t)) throw new RangeError(`signature non représentable en ticks entiers : ${timeSig.join('/')}`);
  return t;
}

export function timeSigOf(score: TabScore, measureIndex: number): [number, number] {
  return score.measures[measureIndex]?.timeSig ?? score.timeSig;
}

export function measureLength(score: TabScore, measureIndex: number): number {
  return measureTicksFor(timeSigOf(score, measureIndex));
}

/** Tick absolu du début de chaque mesure. */
export function measureStarts(score: TabScore): number[] {
  const out: number[] = [];
  let t = 0;
  score.measures.forEach((_, i) => {
    out.push(t);
    t += measureLength(score, i);
  });
  return out;
}

export function totalTicks(score: TabScore): number {
  return score.measures.reduce((sum, _, i) => sum + measureLength(score, i), 0);
}

/** Durée d'un temps pour le regroupement des ligatures : noire, ou noire pointée en mesure composée. */
export function beatTicksFor(timeSig: readonly [number, number]): number {
  const [n, d] = timeSig;
  if (d === 8 && n % 3 === 0 && n >= 6) return (PPQ * 3) / 2;
  return (PPQ * 4) / d;
}

// ---------------------------------------------------------------------------
// Valeurs de notes (durée en ticks → figure de rythme)
// ---------------------------------------------------------------------------

export type NoteBase = 'w' | 'h' | 'q' | 'e' | 's' | 't';
const BASE_TICKS: Readonly<Record<NoteBase, number>> = { w: PPQ * 4, h: PPQ * 2, q: PPQ, e: PPQ / 2, s: PPQ / 4, t: PPQ / 8 };

export interface NoteValue {
  base: NoteBase;
  dots: 0 | 1 | 2;
  tuplet?: Tuplet;
}

/** Figure de rythme d'une durée (noire pointée = 720, croche de triolet = 160…), ou null si non notable. */
export function noteValue(durTick: number, tuplet?: Tuplet): NoteValue | null {
  const scale = tuplet ? tuplet.normal / tuplet.actual : 1;
  for (const base of ['w', 'h', 'q', 'e', 's', 't'] as NoteBase[]) {
    for (const dots of [0, 1, 2] as const) {
      const ticks = BASE_TICKS[base] * (2 - 2 ** -dots) * scale;
      if (Math.abs(ticks - durTick) < 1e-9) return tuplet ? { base, dots, tuplet } : { base, dots };
    }
  }
  return null;
}

/** Nombre de crochets / ligatures d'une figure : croche 1, double croche 2, triple croche 3. */
export function beamCount(base: NoteBase): number {
  return base === 'e' ? 1 : base === 's' ? 2 : base === 't' ? 3 : 0;
}

// ---------------------------------------------------------------------------
// Fonctions d'intervalle
// ---------------------------------------------------------------------------

const FN_RE = /^(#{0,2}|b{0,3})(\d{1,2})$/;

export interface ParsedFn {
  /** Altération : −2…+2. */
  alt: number;
  /** Numéro de degré tel qu'écrit (1…13). */
  num: number;
  /** Famille de degré 1…7 (9 → 2, 11 → 4, 13 → 6). */
  family: number;
}

export function parseFn(fn: DegreeLabel): ParsedFn | null {
  const m = FN_RE.exec(fn);
  if (!m) return null;
  const sign = m[1]!;
  const alt = sign.startsWith('#') ? sign.length : -sign.length;
  const num = Number(m[2]);
  if (num < 1 || num > 13) return null;
  return { alt, num, family: ((num - 1) % 7) + 1 };
}

/** Fonction d'intervalle → nom d'intervalle (format `tonal`) : « b3 » → « m3 », « #4 » → « A4 », « 5 » → « P5 ». */
export function fnToInterval(fn: DegreeLabel): string | null {
  const p = parseFn(fn);
  if (!p) return null;
  const perfect = p.family === 1 || p.family === 4 || p.family === 5;
  const q = perfect
    ? ({ 0: 'P', 1: 'A', 2: 'AA', '-1': 'd', '-2': 'dd' } as Record<string, string>)[String(p.alt)]
    : ({ 0: 'M', '-1': 'm', 1: 'A', 2: 'AA', '-2': 'd', '-3': 'dd' } as Record<string, string>)[String(p.alt)];
  return q ? `${q}${p.num}` : null;
}

// ---------------------------------------------------------------------------
// Validation (invariants testés)
// ---------------------------------------------------------------------------

/** Liste des violations d'invariants (vide = score valide). */
export function validateScore(score: TabScore): string[] {
  const errs: string[] = [];
  const tag = `score ${score.id}`;
  if (score.ppq !== PPQ) errs.push(`${tag} : ppq ${score.ppq} ≠ ${PPQ}`);
  if (score.stringCount !== score.tuning.strings.length) {
    errs.push(`${tag} : stringCount ${score.stringCount} ≠ ${score.tuning.strings.length} cordes de l'accordage`);
  }
  if (!(score.tempo > 0)) errs.push(`${tag} : tempo invalide`);
  if (score.measures.length === 0) errs.push(`${tag} : aucune mesure`);

  score.measures.forEach((m, mi) => {
    let len: number;
    try {
      len = measureLength(score, mi);
    } catch (e) {
      errs.push(`${tag} m${mi + 1} : ${(e as Error).message}`);
      return;
    }
    let cursor = 0;
    m.events.forEach((ev, ei) => {
      const at = `${tag} m${mi + 1} é${ei + 1}`;
      if (!Number.isInteger(ev.startTick) || !Number.isInteger(ev.durTick)) errs.push(`${at} : ticks non entiers`);
      if (ev.durTick <= 0) errs.push(`${at} : durée ≤ 0`);
      if (ev.startTick !== cursor) errs.push(`${at} : début ${ev.startTick} ≠ ${cursor} (trou ou chevauchement)`);
      cursor = ev.startTick + ev.durTick;
      if (noteValue(ev.durTick, ev.tuplet) === null) errs.push(`${at} : durée ${ev.durTick} non notable`);
      if (ev.kind === 'rest' && ev.notes.length > 0) errs.push(`${at} : un silence porte des notes`);
      if (ev.kind === 'notes' && ev.notes.length === 0) errs.push(`${at} : événement sans note`);
      const strings = new Set<number>();
      for (const n of ev.notes) {
        if (!Number.isInteger(n.string) || n.string < 0 || n.string >= score.stringCount) {
          errs.push(`${at} : corde ${n.string} hors de 0…${score.stringCount - 1}`);
          continue;
        }
        if (strings.has(n.string)) errs.push(`${at} : deux notes sur la corde ${n.string}`);
        strings.add(n.string);
        if (!Number.isInteger(n.fret) || n.fret < 0 || n.fret > 24) errs.push(`${at} : case ${n.fret} hors 0…24`);
        if (!n.muted) {
          if (n.midi !== fretToMidi(score.tuning, n.string, n.fret)) {
            errs.push(`${at} : hauteur ${n.midi} ≠ accordage + case (${fretToMidi(score.tuning, n.string, n.fret)})`);
          }
          try {
            if (pitchClassOf(n.note) !== ((n.midi % 12) + 12) % 12) errs.push(`${at} : nom ${n.note} incohérent avec la hauteur ${n.midi}`);
          } catch {
            errs.push(`${at} : nom de note invalide ${n.note}`);
          }
        }
        if (parseFn(n.fn) === null) errs.push(`${at} : fonction d'intervalle invalide « ${n.fn} »`);
      }
      for (const u of ev.unplayed ?? []) {
        if (u < 0 || u >= score.stringCount) errs.push(`${at} : corde non jouée ${u} hors plage`);
        if (strings.has(u)) errs.push(`${at} : la corde ${u} est à la fois jouée et non jouée`);
      }
      if (ev.strum && ev.notes.length < 2) errs.push(`${at} : flèche de strum sur moins de 2 notes`);
    });
    // la somme des durées (notes + silences) = la signature
    if (cursor !== len) errs.push(`${tag} m${mi + 1} : durées = ${cursor} ticks ≠ ${len} (signature ${timeSigOf(score, mi).join('/')})`);
  });
  return errs;
}
