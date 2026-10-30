/**
 * Positions de gammes sur le manche (MUSIC_DESIGN.md §3.3, §3.7) : 3 notes par corde, boxes, CAGED,
 * motifs symétriques, note de passage. Générique sur l'accordage et le nombre de cordes (sauf CAGED,
 * qui suppose les six cordes aiguës en accordage standard).
 *
 * Une position = un ensemble de (corde, case) ; l'ordre de `notes` est l'ordre de lecture en montée :
 * corde grave → aiguë, cases croissantes sur chaque corde. La descente est l'ordre inverse exact.
 */
import { Interval, Note } from 'tonal';
import { fmtNote } from './notation';
import { degreeIndexOf, degreeLabel, getScale, pitchClassOf, scaleNotes, type ScaleDef } from './scales';
import { systemsFor, type PositionSystem, type SystemAvailability } from './systems';
import { MAX_FRET_DEFAULT, pitchToMidi } from './fretboard';
import type { Tuning } from './tunings';
import type { DegreeLabel, NoteName, NoteNotation } from './types';

export type CagedShape = 'C' | 'A' | 'G' | 'E' | 'D';

export interface PositionNote {
  string: number;
  fret: number;
  midi: number;
  /** Nom orthographié de la gamme (anglo, sans octave). */
  note: NoteName;
  /** Degré relatif à la tonique de la gamme : "1", "b3", "#4"… */
  degree: DegreeLabel;
  /** Rang du degré dans la formule de la gamme (0 = tonique). */
  degreeIndex: number;
  /** Note ajoutée à la position de base : blue note, note de passage chromatique du bebop. */
  passing?: boolean;
}

export interface Position {
  id: string;
  system: PositionSystem;
  /** 0-based, dans l'ordre de `generatePositions`. */
  index: number;
  scaleId: string;
  tonic: NoteName;
  tuningId: string;
  fretMin: number;
  fretMax: number;
  notes: PositionNote[];
  /** 3NPS / boxes : degré (rang) de la note de départ sur la corde grave. */
  startDegree?: number;
  /**
   * Identité de la « forme » indépendante de la tonique et du mode (MUSIC_DESIGN.md §3.1) :
   * rang de départ dans la gamme PARENTE (3NPS d'un mode diatonique, harmonique ou mélodique).
   */
  formIndex?: number;
  shape?: CagedShape;
}

// ---------------------------------------------------------------------------
// Contexte de gamme
// ---------------------------------------------------------------------------

export interface ScaleContext {
  def: ScaleDef;
  tonic: NoteName;
  notes: NoteName[];
  degrees: DegreeLabel[];
  pcs: number[];
  /** Demi-tons depuis la tonique, strictement croissants. */
  semis: number[];
}

export function makeScaleContext(def: ScaleDef, tonic: NoteName): ScaleContext {
  const notes = scaleNotes(def, tonic);
  const semis = def.intervals.map((iv) => Interval.get(iv).semitones);
  return {
    def,
    tonic,
    notes,
    degrees: def.intervals.map(degreeLabel),
    pcs: notes.map(pitchClassOf),
    semis,
  };
}

function pcOf(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

function makeNote(ctx: ScaleContext, idx: number, string: number, fret: number, midi: number, passing?: boolean): PositionNote {
  const n: PositionNote = { string, fret, midi, note: ctx.notes[idx]!, degree: ctx.degrees[idx]!, degreeIndex: idx };
  if (passing) n.passing = true;
  return n;
}

function openMidis(tuning: Tuning): number[] {
  return tuning.strings.map(pitchToMidi);
}

function finish(
  ctx: ScaleContext, tuning: Tuning, system: PositionSystem, index: number, notes: PositionNote[],
  extra: Partial<Position> = {},
): Position {
  const frets = notes.map((n) => n.fret);
  return {
    id: `${ctx.def.id}@${ctx.tonic}:${system}:${index}`,
    system, index,
    scaleId: ctx.def.id, tonic: ctx.tonic, tuningId: tuning.id,
    fretMin: Math.min(...frets), fretMax: Math.max(...frets),
    notes, ...extra,
  };
}

// ---------------------------------------------------------------------------
// Chaînes de notes consécutives (3NPS, boxes)
// ---------------------------------------------------------------------------

/** Écart en demi-tons entre le degré i et le suivant (le dernier retourne à la tonique). */
function gaps(ctx: ScaleContext): number[] {
  return ctx.semis.map((s, i) => (i === ctx.semis.length - 1 ? 12 : ctx.semis[i + 1]!) - s);
}

/**
 * `perString` notes de gamme consécutives par corde, en enchaînant d'une corde à la suivante.
 * La note de départ est celle du degré `startIdx` sur la corde grave, à l'octave la plus basse
 * qui garde toutes les cases dans [0, maxFret].
 */
function chain(ctx: ScaleContext, tuning: Tuning, perString: number, startIdx: number, maxFret: number, register = 0): PositionNote[] | null {
  const open = openMidis(tuning);
  const g = gaps(ctx);
  const n = ctx.pcs.length;
  const base = open[0]! + ((((ctx.pcs[startIdx]! - pcOf(open[0]!)) % 12) + 12) % 12);
  for (let octave = register; octave < register + 3; octave++) {
    const notes: PositionNote[] = [];
    let p = base + 12 * octave;
    let idx = startIdx;
    let ok = true;
    for (let s = 0; s < open.length && ok; s++) {
      for (let j = 0; j < perString; j++) {
        const fret = p - open[s]!;
        if (fret < 0 || fret > maxFret) { ok = false; break; }
        notes.push(makeNote(ctx, idx, s, fret, p));
        p += g[idx]!;
        idx = (idx + 1) % n;
      }
    }
    if (ok) return notes;
  }
  return null;
}

function chainPositions(ctx: ScaleContext, tuning: Tuning, perString: number, system: PositionSystem, maxFret: number, register = 0): Position[] {
  const out: Position[] = [];
  const rotation = ctx.def.parent?.rotation ?? 0;
  const n = ctx.pcs.length;
  for (let k = 0; k < n; k++) {
    const notes = chain(ctx, tuning, perString, k, maxFret, register);
    if (!notes) continue;
    out.push(finish(ctx, tuning, system, out.length, notes, { startDegree: k, formIndex: (k + rotation) % n }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fenêtres de cases (CAGED, symétriques, notes ajoutées)
// ---------------------------------------------------------------------------

/** Toutes les notes de la gamme dans les cases [lo, hi] de chaque corde. */
function windowNotes(ctx: ScaleContext, tuning: Tuning, lo: number, hi: number, maxFret: number, passingPcs?: ReadonlySet<number>): PositionNote[] {
  const open = openMidis(tuning);
  const byPc = new Map(ctx.pcs.map((pc, i) => [pc, i]));
  const out: PositionNote[] = [];
  open.forEach((o, s) => {
    for (let f = Math.max(0, lo); f <= Math.min(hi, maxFret); f++) {
      const midi = o + f;
      const idx = byPc.get(pcOf(midi));
      if (idx !== undefined) out.push(makeNote(ctx, idx, s, f, midi, passingPcs?.has(pcOf(midi))));
    }
  });
  return out;
}

/** Formes d'accord CAGED : corde de la fondamentale (depuis les 6 cordes aiguës) et fenêtre de 5 cases autour de l'accord. */
export const CAGED_SHAPES: Readonly<Record<CagedShape, { rootString: number; lo: number; hi: number }>> = {
  // accord = cases r…r+2 (forme de Mi / La), r…r+3 (Ré), r-3…r (Do / Sol) ; fenêtre = accord ± 1 case, bornée à 5 cases.
  E: { rootString: 0, lo: -1, hi: 3 },
  A: { rootString: 1, lo: -1, hi: 3 },
  D: { rootString: 2, lo: -1, hi: 3 },
  G: { rootString: 0, lo: -3, hi: 1 },
  C: { rootString: 1, lo: -3, hi: 1 },
};

const STANDARD_HIGH6 = ['E', 'A', 'D', 'G', 'B', 'E'];

/** CAGED suppose les six cordes aiguës en accordage standard (Mi La Ré Sol Si mi). */
export function supportsCaged(tuning: Tuning): boolean {
  if (tuning.strings.length < 6) return false;
  const high6 = tuning.strings.slice(-6).map((p) => Note.get(p).pc);
  return high6.every((pc, i) => pc === STANDARD_HIGH6[i]);
}

const MAJOR_SEMIS = [0, 2, 4, 5, 7, 9, 11];

/** Classe de hauteur de la tonique majeure dont la gamme est (un mode / un sous-ensemble). null si CAGED non applicable. */
export function cagedParentPc(def: ScaleDef, tonic: NoteName): number | null {
  const pc = pitchClassOf(tonic);
  if (def.family === 'diatonic') return (pc - MAJOR_SEMIS[def.parent?.rotation ?? 0]! + 12) % 12;
  if (def.id === 'pentatonic-major') return pc;
  if (def.id === 'pentatonic-minor') return (pc + 3) % 12;
  return null;
}

function cagedPositions(ctx: ScaleContext, tuning: Tuning, maxFret: number, register = 0): Position[] {
  const parentPc = cagedParentPc(ctx.def, ctx.tonic);
  if (parentPc === null || !supportsCaged(tuning)) return [];
  const open = openMidis(tuning);
  const offset = open.length - 6;
  const wins: Array<{ shape: CagedShape; lo: number; hi: number }> = [];
  for (const shape of Object.keys(CAGED_SHAPES) as CagedShape[]) {
    const def = CAGED_SHAPES[shape];
    const s = def.rootString + offset;
    const r0 = (((parentPc - pcOf(open[s]!)) % 12) + 12) % 12;
    // plus petite fondamentale dont la fenêtre ne descend pas sous la case −1 (puis bornée à 0)
    let r = r0 + 12 * register;
    while (r + def.lo < -1) r += 12;
    const lo = Math.max(0, r + def.lo);
    const hi = r + def.hi;
    if (hi <= maxFret) wins.push({ shape, lo, hi });
  }
  wins.sort((a, b) => a.lo - b.lo || a.hi - b.hi);
  return wins.map((w, i) => finish(ctx, tuning, 'caged', i, windowNotes(ctx, tuning, w.lo, w.hi, maxFret), { shape: w.shape }));
}

/** Période (en cases) du motif d'une gamme symétrique : 2 tons entiers, 3 diminuée, 4 augmentée. */
export function symmetricPeriod(def: ScaleDef): number {
  const set = new Set(def.intervals.map((iv) => Interval.get(iv).chroma));
  for (let p = 1; p < 12; p++) {
    if ([...set].every((c) => set.has((c + p) % 12))) return p;
  }
  return 12;
}

function symmetricPositions(ctx: ScaleContext, tuning: Tuning, maxFret: number, register = 0): Position[] {
  const open = openMidis(tuning);
  const period = symmetricPeriod(ctx.def);
  // case de la tonique sur la corde grave, ramenée dans la première période du manche
  const rho = ((((ctx.pcs[0]! - pcOf(open[0]!)) % 12) + 12) % 12) % period;
  const out: Position[] = [];
  for (let j = 0; j < period; j++) {
    const lo = rho + j + 12 * register;
    const notes = windowNotes(ctx, tuning, lo, lo + 4, maxFret);
    if (notes.length) out.push(finish(ctx, tuning, 'symmetric', j, notes));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Blues et bebop : position de base + notes ajoutées
// ---------------------------------------------------------------------------

/** Gamme de base et notes ajoutées pour les gammes « pentatonique + note » et « heptatonique + passage ». */
const BASE_OF: Readonly<Record<string, string>> = {
  'blues-minor': 'pentatonic-minor',
  'blues-major': 'pentatonic-major',
  'bebop-dominant': 'mixolydian',
  'bebop-major': 'ionian',
};

function withExtras(ctx: ScaleContext, tuning: Tuning, base: Position[], system: PositionSystem, maxFret: number): Position[] {
  const baseCtx = makeScaleContext(getScale(BASE_OF[ctx.def.id]!), ctx.tonic);
  const basePcs = new Set(baseCtx.pcs);
  const extraPcs = new Set(ctx.pcs.filter((pc) => !basePcs.has(pc)));
  return base.map((b, i) => {
    const kept = new Set(b.notes.map((n) => `${n.string}:${n.fret}`));
    const added = windowNotes(ctx, tuning, b.fretMin, b.fretMax, maxFret, extraPcs)
      .filter((n) => n.passing && !kept.has(`${n.string}:${n.fret}`));
    const byPc = new Map(ctx.pcs.map((pc, k) => [pc, k]));
    // on réétiquette les notes de base avec les degrés de la gamme finale (blues / bebop)
    const relabeled = b.notes.map((n) => makeNote(ctx, byPc.get(pcOf(n.midi))!, n.string, n.fret, n.midi));
    const notes = [...relabeled, ...added].sort((x, y) => x.string - y.string || x.fret - y.fret);
    return finish(ctx, tuning, system, i, notes, { startDegree: b.startDegree, formIndex: b.formIndex });
  });
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** Disponibilité des systèmes pour une gamme ET un accordage (affine `systemsFor`). */
export function positionSupport(scaleId: string, tuning: Tuning): SystemAvailability[] {
  return systemsFor(scaleId).map((s) => {
    if (s.system === 'caged' && s.available && !supportsCaged(tuning)) {
      return { ...s, available: false, note: 'CAGED suppose les six cordes aiguës en accordage standard (Mi La Ré Sol Si mi)' };
    }
    return s;
  });
}

/**
 * Positions d'une gamme pour un système. Renvoie [] si le système n'est pas disponible (voir `positionSupport`).
 * `register` (0 par défaut) = nombre d'octaves (12 cases) au-dessus de l'instance la plus basse du manche.
 */
export function generatePositions(
  scaleId: string, tonic: NoteName, tuning: Tuning, system: PositionSystem,
  opts: { maxFret?: number; register?: number } = {},
): Position[] {
  const maxFret = opts.maxFret ?? MAX_FRET_DEFAULT;
  const register = opts.register ?? 0;
  const def = getScale(scaleId);
  const avail = positionSupport(scaleId, tuning).find((s) => s.system === system);
  if (!avail?.available) return [];
  const ctx = makeScaleContext(def, tonic);
  switch (system) {
    case '3nps': return chainPositions(ctx, tuning, 3, '3nps', maxFret, register);
    case 'boxes': {
      if (BASE_OF[def.id]) {
        const baseCtx = makeScaleContext(getScale(BASE_OF[def.id]!), tonic);
        return withExtras(ctx, tuning, chainPositions(baseCtx, tuning, 2, 'boxes', maxFret, register), 'boxes', maxFret);
      }
      return chainPositions(ctx, tuning, 2, 'boxes', maxFret, register);
    }
    case 'caged': return cagedPositions(ctx, tuning, maxFret, register);
    case 'symmetric': return symmetricPositions(ctx, tuning, maxFret, register);
    case 'passing-note': {
      const baseCtx = makeScaleContext(getScale(BASE_OF[def.id]!), tonic);
      return withExtras(ctx, tuning, chainPositions(baseCtx, tuning, 3, '3nps', maxFret, register), 'passing-note', maxFret);
    }
  }
}

/** Système proposé par défaut pour une gamme (le premier disponible dans l'ordre pédagogique). */
export function defaultSystem(scaleId: string, tuning: Tuning): PositionSystem | null {
  const order: PositionSystem[] = ['boxes', '3nps', 'passing-note', 'symmetric', 'caged'];
  const av = positionSupport(scaleId, tuning);
  return order.find((s) => av.find((a) => a.system === s)?.available) ?? null;
}

/** Étiquette lisible : « Position 3 · cases 7–10 », « Forme de Mi · CAGED · cases 12–15 ». */
export function fmtPositionLabel(p: Position, notation: NoteNotation = 'fr'): string {
  const cases = p.fretMin === p.fretMax ? `case ${p.fretMin}` : `cases ${p.fretMin}–${p.fretMax}`;
  // numéro = rang du degré de départ (stable même si une position dépasse la case 24 et disparaît)
  const num = (p.startDegree ?? p.index) + 1;
  switch (p.system) {
    case '3nps': return `Position ${num} · ${cases}`;
    // « Position », comme en 3 notes par corde : « Box 2 » côtoyait « boîte 1 sur 6 » en révision
    case 'boxes': return `Position ${num} · ${cases}`;
    case 'caged': return `Forme de ${fmtNote(p.shape!, notation)} · CAGED · ${cases}`;
    case 'symmetric': return `Motif ${p.index + 1} · ${cases}`;
    case 'passing-note': return `Position ${num} + note de passage · ${cases}`;
  }
}

/**
 * Sous-ensemble d'une position (mêmes cordes, mêmes cases, notes filtrées) : sert au mode
 * « fondamentales d'abord » et au découpage par nombre de cordes (MUSIC_DESIGN §12).
 * Les notes restent dans l'ordre de lecture ; `fretMin`/`fretMax` sont recalculés.
 */
export function filterPosition(pos: Position, keep: (n: PositionNote) => boolean): Position {
  const notes = pos.notes.filter(keep);
  if (notes.length === 0) return { ...pos, notes: [], fretMin: 0, fretMax: 0 };
  const frets = notes.map((n) => n.fret);
  return { ...pos, notes, fretMin: Math.min(...frets), fretMax: Math.max(...frets), id: `${pos.id}:sub` };
}

/**
 * La même position lue depuis une autre gamme aux mêmes notes (relative, majeure parente) : les cordes,
 * les cases et les noms ne bougent pas, seuls les degrés sont recalculés depuis la nouvelle tonique.
 */
export function relabelPosition(pos: Position, scaleId: string, tonic: NoteName): Position {
  const def = getScale(scaleId);
  const notes = pos.notes.map((n) => {
    const degreeIndex = degreeIndexOf(def, tonic, ((n.midi % 12) + 12) % 12);
    if (degreeIndex === null) throw new Error(`${n.note} n'est pas dans ${scaleId} sur ${tonic}`);
    return { ...n, degree: degreeLabel(def.intervals[degreeIndex]!), degreeIndex };
  });
  return { ...pos, notes, scaleId, tonic, id: `${pos.id}:${scaleId}-${tonic}` };
}

/** Nombre maximal de notes d'une même corde dans la position. */
export function maxNotesPerString(p: Position): number {
  const c = new Map<number, number>();
  p.notes.forEach((n) => c.set(n.string, (c.get(n.string) ?? 0) + 1));
  return Math.max(...c.values());
}
