/**
 * Comparaisons sur la MÊME position (proposition pédagogique 5), deux questions différentes :
 *  - **un voisin** : même tonique, une seule note change (dorien ↔ éolien, naturelle ↔ harmonique ↔
 *    mélodique, pentatonique ↔ blues). C'est cette note qu'on met en évidence des deux côtés ;
 *  - **mêmes notes** : mêmes cases, la tonique se déplace (Do majeur ↔ La mineure, Ré dorien → Do majeur).
 *    On met en évidence, de chaque côté, la note qui est la fondamentale de l'autre lecture.
 */
import {
  MAJOR_KEYS, degreeIndexOf, degreeLabel, generatePositions, getScale, pitchClassOf, relativeScale, systemsFor,
  type NoteName, type Position, type ScaleDef,
} from '../../core/theory';
import type { TabScore } from '../../core/tab';
import { degreesOf, fmtDegree, toAsciiDegree } from './resolve';

/** Gammes voisines d'une seule note, la plus utile d'abord. */
const NEIGHBOURS: Readonly<Record<string, readonly string[]>> = {
  ionian: ['lydian'],
  lydian: ['ionian'],
  dorian: ['aeolian'],
  aeolian: ['dorian', 'harmonic-minor'],
  phrygian: ['aeolian'],
  mixolydian: ['ionian'],
  locrian: ['phrygian'],
  'harmonic-minor': ['aeolian', 'melodic-minor'],
  'melodic-minor': ['harmonic-minor'],
  'pentatonic-minor': ['blues-minor'],
  'blues-minor': ['pentatonic-minor'],
  'pentatonic-major': ['blues-major'],
  'blues-major': ['pentatonic-major'],
};

/** Nom court, pour tenir dans un segment à 390 px. */
const SHORT_NAME: Readonly<Record<string, string>> = {
  ionian: 'majeure',
  lydian: 'lydien',
  dorian: 'dorien',
  aeolian: 'naturelle',
  phrygian: 'phrygien',
  'harmonic-minor': 'harmonique',
  'melodic-minor': 'mélodique',
  'pentatonic-minor': 'pentatonique',
  'pentatonic-major': 'pentatonique',
  'blues-minor': 'blues',
  'blues-major': 'blues',
};

export function neighbourMode(scaleId: string): string | null {
  return NEIGHBOURS[scaleId]?.[0] ?? null;
}

export interface CompareChoice {
  /** Clé stable du segment. */
  id: string;
  kind: 'neighbour' | 'relative';
  def: ScaleDef;
  tonic: NoteName;
  /** Libellé du segment. */
  short: string;
  /** Ce qui change, en une phrase : « 6 devient ♭6 », « mêmes notes, autre tonique ». */
  difference: string;
}

/** Degrés présents dans une gamme et pas dans l'autre (les notes qui changent), en glyphes. */
export function differingDegrees(a: ScaleDef, b: ScaleDef): { onlyA: string[]; onlyB: string[] } {
  const da = new Set(degreesOf(a).map(fmtDegree));
  const db = new Set(degreesOf(b).map(fmtDegree));
  return { onlyA: [...da].filter((d) => !db.has(d)), onlyB: [...db].filter((d) => !da.has(d)) };
}

/** Ce qui change quand on passe de `a` à `b` : calculé, pour ne jamais dire autre chose que les tablatures. */
export function differenceText(a: ScaleDef, b: ScaleDef): string {
  const { onlyA, onlyB } = differingDegrees(a, b);
  if (onlyA.length === 0) return `la ${onlyB.join(' et la ')} en plus`;
  if (onlyB.length === 0) return `sans la ${onlyA.join(' ni la ')}`;
  return `${onlyA.join(' et ')} devient ${onlyB.join(' et ')}`;
}

const hasSystem = (scaleId: string, system: Position['system']) =>
  systemsFor(scaleId).some((s) => s.system === system && s.available);

/** Ce qu'on peut comparer à cette gamme dans ce système : ses voisines, puis la lecture « mêmes notes ». */
export function compareChoices(def: ScaleDef, tonic: NoteName, system: Position['system']): CompareChoice[] {
  const out: CompareChoice[] = (NEIGHBOURS[def.id] ?? []).filter((id) => hasSystem(id, system)).map((id) => {
    const other = getScale(id);
    return { id, kind: 'neighbour', def: other, tonic, short: SHORT_NAME[id] ?? id, difference: differenceText(def, other) };
  });
  const rel = relativeScale(def, tonic);
  if (rel && hasSystem(rel.scaleId, system) && (rel.scaleId !== 'ionian' || MAJOR_KEYS.includes(rel.tonic))) {
    const other = getScale(rel.scaleId);
    out.push({
      id: 'relative', kind: 'relative', def: other, tonic: rel.tonic, short: 'mêmes notes',
      difference: 'mêmes notes, autre tonique',
    });
  }
  return out;
}

/** Lecture « mêmes notes » : de chaque côté, le degré qui est la fondamentale de l'autre gamme, en glyphes. */
export function relativeDegrees(a: ScaleDef, tonicA: NoteName, b: ScaleDef, tonicB: NoteName): { onlyA: string[]; onlyB: string[] } {
  const degree = (def: ScaleDef, tonic: NoteName, other: NoteName) => {
    const index = degreeIndexOf(def, tonic, pitchClassOf(other));
    return index === null ? [] : [fmtDegree(degreeLabel(def.intervals[index]!))];
  };
  return { onlyA: degree(a, tonicA, tonicB), onlyB: degree(b, tonicB, tonicA) };
}

/**
 * Position équivalente dans une autre gamme : même forme (CAGED), même `formIndex` (3NPS / boxes),
 * sinon même rang. Entre deux familles, `formIndex` compte depuis des gammes parentes différentes
 * (Am naturelle, forme 0 : cases 5-10 ; harmonique, forme 0 : cases 1-7) : on prend alors la position
 * qui partage le plus de cases. Renvoie null si l'autre gamme n'a pas de position comparable.
 */
export function counterpartPosition(other: readonly Position[], ref: Position): Position | null {
  if (ref.system === 'caged' && ref.shape) return other.find((p) => p.shape === ref.shape) ?? null;
  if (other[0] && getScale(other[0].scaleId).family !== getScale(ref.scaleId).family) {
    const places = new Set(ref.notes.map((n) => `${n.string}:${n.fret}`));
    const shared = (p: Position) => p.notes.filter((n) => places.has(`${n.string}:${n.fret}`)).length;
    return other.reduce((best, p) => (shared(p) > shared(best) ? p : best));
  }
  if (ref.formIndex !== undefined) {
    const same = other.find((p) => p.formIndex === ref.formIndex);
    if (same) return same;
  }
  return other.find((p) => p.index === ref.index) ?? null;
}

const placeKey = (p: Position) => p.notes.map((n) => `${n.string}:${n.fret}`).sort().join(' ');

/** Rang de la position qui occupe exactement les mêmes cases (0 si aucune) : pour ouvrir la relative au même endroit. */
export function samePlaceIndex(other: readonly Position[], ref: Position): number {
  const key = placeKey(ref);
  return Math.max(0, other.findIndex((p) => placeKey(p) === key));
}

/**
 * Met en évidence les notes de ces degrés (glow), et elles seules : la note caractéristique d'une gamme
 * n'est pas forcément celle qui la sépare de sa voisine. Les degrés arrivent en glyphes, le modèle est en ASCII.
 */
export function markDegrees(score: TabScore, degrees: readonly string[]): TabScore {
  const want = new Set(degrees.map(toAsciiDegree));
  if (want.size === 0) return score;
  return {
    ...score,
    measures: score.measures.map((m) => ({
      ...m,
      events: m.events.map((e) => ({
        ...e,
        notes: e.notes.map(({ characteristic: _, ...n }) => (want.has(n.fn) ? { ...n, characteristic: true } : n)),
      })),
    })),
  };
}

/** Positions de la gamme voisine, mêmes tonique, accordage et système. */
export function neighbourPositions(
  scaleId: string, tonic: string, tuning: Parameters<typeof generatePositions>[2], system: Position['system'],
): Position[] {
  try {
    return generatePositions(scaleId as never, tonic as never, tuning, system);
  } catch {
    return [];
  }
}
