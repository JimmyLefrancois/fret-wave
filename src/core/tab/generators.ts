/**
 * Générateurs théorie → TabScore : gamme, position, arpège, accord (plaqué / arpégé), progression.
 * Aucun rendu ici : le résultat est consommé à l'identique par le layout et par la lecture audio.
 */
import { interpretChord, CHORD_QUALITIES, type ChordInfo } from '../theory/chords';
import { fretToMidi } from '../theory/fretboard';
import { defaultSystem, generatePositions, type Position, type PositionNote } from '../theory/positions';
import { getScale } from '../theory/scales';
import type { Tuning } from '../theory/tunings';
import { TUNINGS } from '../theory/tunings';
import { voicingNotes, type Voicing } from '../theory/voicings';
import type { DegreeLabel, NoteName } from '../theory/types';
import { Interval } from 'tonal';
import {
  PPQ, measureTicksFor,
  type Measure, type MeasureLabel, type TabEvent, type TabNote, type TabScore,
} from './model';

const EIGHTH = PPQ / 2;

export type Direction = 'up' | 'down' | 'updown';

export interface BaseOptions {
  id?: string;
  tempo?: number;
  timeSig?: [number, number];
}

// ---------------------------------------------------------------------------
// Construction de mesures
// ---------------------------------------------------------------------------

interface Slot {
  durTick: number;
  notes: TabNote[];
  extra?: Partial<TabEvent>;
}

const REST_DURS = [PPQ * 4, PPQ * 2, PPQ, PPQ / 2, PPQ / 4] as const;

/** Silences de remplissage alignés sur les temps (le plus grand silence qui reste aligné et tient). */
function restSlots(from: number, to: number): Slot[] {
  const out: Slot[] = [];
  let pos = from;
  while (pos < to) {
    const d = REST_DURS.find((r) => r <= to - pos && pos % r === 0);
    if (d === undefined) throw new Error(`remplissage impossible entre ${from} et ${to}`);
    out.push({ durTick: d, notes: [] });
    pos += d;
  }
  return out;
}

/** Répartit des créneaux séquentiels en mesures (silences en fin de dernière mesure). */
function buildMeasures(slots: Slot[], timeSig: [number, number], labelFor?: (measureIndex: number) => MeasureLabel | undefined): Measure[] {
  const len = measureTicksFor(timeSig);
  const measures: Measure[] = [];
  let events: TabEvent[] = [];
  let pos = 0;
  const flush = () => {
    const label = labelFor?.(measures.length);
    measures.push(label ? { label, events } : { events });
    events = [];
    pos = 0;
  };
  const padWithRests = () => {
    for (const r of restSlots(pos, len)) {
      events.push(slotToEvent(r, pos));
      pos += r.durTick;
    }
  };
  for (const s of slots) {
    if (s.durTick > len - pos) {
      if (pos === 0) throw new Error(`créneau de ${s.durTick} ticks plus long que la mesure (${len})`);
      // le créneau ne tient pas : on complète par des silences puis on ouvre la mesure suivante
      padWithRests();
      flush();
    }
    events.push(slotToEvent(s, pos));
    pos += s.durTick;
    if (pos === len) flush();
  }
  if (pos > 0) {
    padWithRests();
    flush();
  }
  return measures;
}

function slotToEvent(s: Slot, startTick: number): TabEvent {
  return {
    startTick,
    durTick: s.durTick,
    kind: s.notes.length === 0 ? 'rest' : 'notes',
    notes: s.notes,
    ...s.extra,
  };
}

function orderDirection<T>(items: T[], dir: Direction): T[] {
  if (dir === 'up') return [...items];
  const rev = [...items].reverse();
  if (dir === 'down') return rev;
  return [...items, ...rev.slice(1)]; // la note du sommet n'est pas répétée
}

function makeScore(
  kind: TabScore['kind'], tuning: Tuning, o: BaseOptions, slots: Slot[], meta: TabScore['meta'],
  labelFor?: (i: number) => MeasureLabel | undefined,
): TabScore {
  const timeSig = o.timeSig ?? [4, 4];
  return {
    id: o.id ?? `${kind}:${meta?.positionId ?? meta?.chord ?? meta?.scaleId ?? 'score'}`,
    kind,
    tuning,
    stringCount: tuning.strings.length,
    ppq: PPQ,
    tempo: o.tempo ?? 80,
    timeSig,
    measures: buildMeasures(slots, timeSig, labelFor),
    meta,
  };
}

// ---------------------------------------------------------------------------
// Gamme et position
// ---------------------------------------------------------------------------

function tabNoteFromPosition(pn: PositionNote, characteristic: ReadonlySet<DegreeLabel>): TabNote {
  const n: TabNote = { string: pn.string, fret: pn.fret, midi: pn.midi, note: pn.note, fn: pn.degree };
  if (characteristic.has(pn.degree)) n.characteristic = true;
  if (pn.passing) n.passing = true;
  return n;
}

export interface PositionScoreOptions extends BaseOptions {
  direction?: Direction;
  /** Durée de chaque note en ticks (croche par défaut). */
  noteTicks?: number;
  /** Accord affiché au-dessus de la première mesure. */
  chord?: string;
  /** Étiquette de la position affichée (« cases 5–8 »). */
  labelText?: string;
}

/** Position de gamme → tablature, en montée et/ou en descente, une note par temps de croche. */
export function positionToScore(pos: Position, tuning: Tuning, opts: PositionScoreOptions = {}): TabScore {
  const def = getScale(pos.scaleId);
  const chars = new Set(def.characteristic ?? []);
  const notes = orderDirection(pos.notes, opts.direction ?? 'up').map((n) => tabNoteFromPosition(n, chars));
  const dur = opts.noteTicks ?? EIGHTH;
  const text = opts.labelText ?? (pos.fretMin === pos.fretMax ? `case ${pos.fretMin}` : `cases ${pos.fretMin}–${pos.fretMax}`);
  return makeScore(
    'position', tuning, opts,
    notes.map((n) => ({ durTick: dur, notes: [n] })),
    { scaleId: pos.scaleId, tonic: pos.tonic, positionId: pos.id, system: pos.system },
    (i) => (i === 0 ? { ...(opts.chord ? { chord: opts.chord } : {}), text } : undefined),
  );
}

export interface ScaleScoreOptions extends PositionScoreOptions {
  /** Système de positions ; défaut : celui que recommande `defaultSystem`. */
  system?: Position['system'];
  /** Rang de la position (0 = tonique sur la corde grave). */
  positionIndex?: number;
}

/**
 * Gamme → tablature : la position qui part de la fondamentale sur la corde grave, montée et/ou descente,
 * avec l'accord dérivé de la gamme au-dessus de la première mesure.
 */
export function scaleToScore(scaleId: string, tonic: NoteName, tuning: Tuning, opts: ScaleScoreOptions = {}): TabScore {
  const system = opts.system ?? defaultSystem(scaleId, tuning);
  if (!system) throw new Error(`aucun système de positions pour ${scaleId} sur ${tuning.id}`);
  const positions = generatePositions(scaleId, tonic, tuning, system);
  const pos = positions[opts.positionIndex ?? 0];
  if (!pos) throw new Error(`position ${opts.positionIndex ?? 0} introuvable (${scaleId} ${tonic} ${system})`);
  const chord = opts.chord ?? defaultChordForScale(scaleId, tonic) ?? undefined;
  const score = positionToScore(pos, tuning, { ...opts, ...(chord ? { chord } : {}) });
  return { ...score, kind: 'scale', id: opts.id ?? `scale:${scaleId}@${tonic}:${system}:${pos.index}` };
}

/** Accord « de la gamme » : le plus riche (7e puis triade) dont toutes les notes sont dans la gamme, sur la tonique. */
export function defaultChordForScale(scaleId: string, tonic: NoteName): string | null {
  const def = getScale(scaleId);
  const chroma = new Set(def.intervals.map((iv) => Interval.get(iv).chroma));
  const order = ['maj7', 'm7', '7', 'm7b5', 'dim7', '', 'm', 'dim'];
  for (const suffix of order) {
    const q = CHORD_QUALITIES.find((c) => c.suffix === suffix)!;
    if (q.intervals.every((iv) => chroma.has(Interval.get(iv).chroma))) return `${tonic}${suffix}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Arpège dans une position
// ---------------------------------------------------------------------------

function chordFnByPc(info: ChordInfo): Map<number, { fn: DegreeLabel; note: NoteName }> {
  return new Map(info.pitchClasses.map((pc, i) => [pc, { fn: info.degrees[i]!, note: info.notes[i]! }]));
}

/**
 * Arpège : les notes de l'accord (1-3-5-7) qui se trouvent DANS la position, en montée / descente.
 * Étiquetées par fonction dans l'accord (fondamentale, tierce, quinte, septième).
 */
export function arpeggioToScore(pos: Position, chordSymbol: string, tuning: Tuning, opts: PositionScoreOptions = {}): TabScore {
  const info = interpretChord(chordSymbol);
  const byPc = chordFnByPc(info);
  const notes: TabNote[] = [];
  for (const pn of pos.notes) {
    const c = byPc.get(((pn.midi % 12) + 12) % 12);
    if (c) notes.push({ string: pn.string, fret: pn.fret, midi: pn.midi, note: c.note, fn: c.fn });
  }
  if (new Set(notes.map((n) => n.fn)).size < 2) throw new Error(`l'arpège ${chordSymbol} n'a pas 2 notes dans ${pos.id}`);
  const ordered = orderDirection(notes, opts.direction ?? 'up');
  const dur = opts.noteTicks ?? EIGHTH;
  return makeScore(
    'arpeggio', tuning, opts,
    ordered.map((n) => ({ durTick: dur, notes: [n] })),
    { scaleId: pos.scaleId, tonic: pos.tonic, positionId: pos.id, system: pos.system, chord: chordSymbol },
    (i) => (i === 0 ? { chord: chordSymbol, text: opts.labelText ?? `arpège · cases ${pos.fretMin}–${pos.fretMax}` } : undefined),
  );
}

// ---------------------------------------------------------------------------
// Accords
// ---------------------------------------------------------------------------

/** Motifs de strum 4/4, en croches : [direction, durée en croches] — la durée court jusqu'à la frappe suivante. */
export type StrumHit = readonly ['D' | 'U', number];
export const STRUM_PATTERNS = {
  /** ↓ sur chaque temps (60 BPM, premiers accords). */
  quarters: [['D', 2], ['D', 2], ['D', 2], ['D', 2]],
  /** ↓↑ en croches. */
  eighths: [['D', 1], ['U', 1], ['D', 1], ['U', 1], ['D', 1], ['U', 1], ['D', 1], ['U', 1]],
  /** « motif universel » ↓ · ↓ ↑ · ↑ ↓ ↑ (MUSIC_DESIGN.md §4.2). */
  universal: [['D', 2], ['D', 1], ['U', 2], ['U', 1], ['D', 1], ['U', 1]],
} as const satisfies Record<string, readonly StrumHit[]>;
export type StrumPatternId = keyof typeof STRUM_PATTERNS;

/** Notes d'un voicing → TabNote (fonction d'intervalle relative à la fondamentale de l'accord). */
export function voicingTabNotes(v: Voicing, tuning: Tuning = TUNINGS[v.tuningId]!): { notes: TabNote[]; unplayed: number[] } {
  const info = interpretChord(v.chord);
  const byPc = chordFnByPc(info);
  const names = voicingNotes(v, tuning);
  const notes: TabNote[] = [];
  const unplayed: number[] = [];
  let k = 0;
  v.frets.forEach((fret, string) => {
    if (fret === null) {
      unplayed.push(string);
      return;
    }
    const midi = fretToMidi(tuning, string, fret);
    const c = byPc.get(((midi % 12) + 12) % 12)!;
    const n: TabNote = { string, fret, midi, note: names[k++]!, fn: c.fn };
    const finger = v.fingers?.[string];
    if (finger !== null && finger !== undefined) n.finger = finger;
    notes.push(n);
  });
  return { notes, unplayed };
}

export interface ChordScoreOptions extends BaseOptions {
  /** `strum` = plaqué ; `arpeggio` = corde par corde grave → aiguë ; `both` = plaqué puis arpégé. */
  style?: 'strum' | 'arpeggio' | 'both';
  pattern?: StrumPatternId;
  /** Durée de chaque note de l'arpège (croche par défaut). */
  noteTicks?: number;
}

function strumSlots(v: Voicing, tuning: Tuning, pattern: readonly StrumHit[]): Slot[] {
  const { notes, unplayed } = voicingTabNotes(v, tuning);
  return pattern.map(([dir, units]) => ({
    durTick: units * EIGHTH,
    notes: notes.map((n) => ({ ...n })),
    extra: {
      chord: v.chord,
      strum: { dir },
      ...(unplayed.length ? { unplayed: [...unplayed] } : {}),
      ...(v.barre ? { barre: { ...v.barre } } : {}),
    },
  }));
}

function arpeggioSlots(v: Voicing, tuning: Tuning, noteTicks: number): Slot[] {
  const { notes, unplayed } = voicingTabNotes(v, tuning);
  return notes.map((n) => ({
    durTick: noteTicks,
    notes: [n],
    extra: { chord: v.chord, ...(unplayed.length ? { unplayed: [...unplayed] } : {}) },
  }));
}

/** Accord → tablature : pile verticale plaquée (flèches ↓ ↑) et/ou arpégée, avec la MÊME forme que celle jouée par l'audio. */
export function chordToScore(v: Voicing, opts: ChordScoreOptions = {}): TabScore {
  const tuning = TUNINGS[v.tuningId];
  if (!tuning) throw new Error(`accordage inconnu : ${v.tuningId}`);
  const style = opts.style ?? 'both';
  const pattern = STRUM_PATTERNS[opts.pattern ?? 'quarters'];
  const noteTicks = opts.noteTicks ?? EIGHTH;
  const timeSig: [number, number] = [4, 4];
  const len = measureTicksFor(timeSig);
  const slots: Slot[] = [];
  const labels: Array<MeasureLabel | undefined> = [];
  if (style !== 'arpeggio') {
    slots.push(...strumSlots(v, tuning, pattern));
    labels.push({ chord: v.chord, text: 'plaqué' });
  }
  if (style !== 'strum') {
    const arp = arpeggioSlots(v, tuning, noteTicks);
    // l'arpège commence toujours sur une mesure neuve : on complète la précédente si besoin
    const used = slots.reduce((s, x) => s + x.durTick, 0);
    if (used % len !== 0) slots.push(...restSlots(used % len, len));
    slots.push(...arp);
    labels.push({ chord: v.chord, text: 'arpégé' });
  }
  return makeScore('chord', tuning, { ...opts, timeSig }, slots, { chord: v.chord }, (i) => labels[i]);
}

export interface ProgressionScoreOptions extends BaseOptions {
  pattern?: StrumPatternId;
  /** Chiffrage romain affiché au-dessus de chaque accord. */
  romans?: string[];
}

/** Suite d'accords (une mesure par accord, motif de strum au choix). */
export function progressionToScore(voicings: readonly Voicing[], opts: ProgressionScoreOptions = {}): TabScore {
  if (voicings.length === 0) throw new Error('progression vide');
  const tuning = TUNINGS[voicings[0]!.tuningId]!;
  for (const v of voicings) if (v.tuningId !== tuning.id) throw new Error('accordages différents dans la progression');
  const pattern = STRUM_PATTERNS[opts.pattern ?? 'quarters'];
  const slots = voicings.flatMap((v) => strumSlots(v, tuning, pattern));
  return makeScore(
    'progression', tuning, { ...opts, timeSig: [4, 4] }, slots,
    { chord: voicings.map((v) => v.chord).join(' ') },
    (i) => ({ chord: voicings[i]?.chord, ...(opts.romans?.[i] ? { roman: opts.romans[i] } : {}) }),
  );
}
