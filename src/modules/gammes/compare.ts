/**
 * Comparaison de deux modes voisins sur la MÊME position (proposition pédagogique 5).
 * Dorien ↔ éolien, ionien ↔ lydien, mixolydien ↔ ionien, phrygien ↔ éolien, locrien ↔ phrygien :
 * une seule note change, c'est celle qu'on met en évidence des deux côtés.
 */
import { generatePositions, getScale, type Position, type ScaleDef } from '../../core/theory';
import type { TabScore } from '../../core/tab';
import { degreesOf, fmtDegree } from './resolve';

/** Mode voisin qui ne diffère que d'une note (null : pas de comparaison utile). */
const NEIGHBOUR: Readonly<Record<string, string>> = {
  ionian: 'lydian',
  lydian: 'ionian',
  dorian: 'aeolian',
  aeolian: 'dorian',
  phrygian: 'aeolian',
  mixolydian: 'ionian',
  locrian: 'phrygian',
  'pentatonic-minor': 'blues-minor',
  'blues-minor': 'pentatonic-minor',
};

/** Ce qui change, en une phrase — lu par le prof, affiché tel quel. */
export const COMPARISON_LABEL: Readonly<Record<string, string>> = {
  lydian: '♯4 du lydien',
  ionian: '7 de la majeure',
  aeolian: '♭6 de l’éolien',
  dorian: '6 du dorien',
  phrygian: '♭2 du phrygien',
  'blues-minor': '♭5 (blue note)',
  'pentatonic-minor': 'sans la ♭5',
};

export function neighbourMode(scaleId: string): string | null {
  return NEIGHBOUR[scaleId] ?? null;
}

export function neighbourDef(scaleId: string): ScaleDef | null {
  try {
    return getScale(scaleId);
  } catch {
    return null;
  }
}

/** Degrés présents dans une gamme et pas dans l'autre (les notes qui changent), en glyphes. */
export function differingDegrees(a: ScaleDef, b: ScaleDef): { onlyA: string[]; onlyB: string[] } {
  const da = new Set(degreesOf(a).map(fmtDegree));
  const db = new Set(degreesOf(b).map(fmtDegree));
  return { onlyA: [...da].filter((d) => !db.has(d)), onlyB: [...db].filter((d) => !da.has(d)) };
}

/**
 * Position équivalente dans une autre gamme : même forme (CAGED), même `formIndex` (3NPS / boxes),
 * sinon même rang. Renvoie null si l'autre gamme n'a pas de position comparable.
 */
export function counterpartPosition(other: readonly Position[], ref: Position): Position | null {
  if (ref.system === 'caged' && ref.shape) return other.find((p) => p.shape === ref.shape) ?? null;
  if (ref.formIndex !== undefined) {
    const same = other.find((p) => p.formIndex === ref.formIndex);
    if (same) return same;
  }
  return other.find((p) => p.index === ref.index) ?? null;
}

/** Met en évidence les notes d'un degré donné (glow) : la note qui distingue les deux modes. */
export function markDegrees(score: TabScore, degrees: readonly string[]): TabScore {
  const want = new Set(degrees);
  if (want.size === 0) return score;
  return {
    ...score,
    measures: score.measures.map((m) => ({
      ...m,
      events: m.events.map((e) => ({
        ...e,
        notes: e.notes.map((n) => (want.has(n.fn) ? { ...n, characteristic: true } : n)),
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
