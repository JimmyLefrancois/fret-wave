/**
 * Coches de la liste d'accords (D139) : « Je connais cet accord » et « Ne pas réviser ».
 *
 * Ce sont des **déclarations** : elles disent quoi proposer, jamais ce qui est su. Elles vivent donc hors du
 * journal, sans score. Seul un rappel au micro crée ou déplace une carte de révision.
 *
 * Avec un compte, elles vont en base (D140). Une coche change, contrairement à une tentative : `stamps` garde la
 * date de chaque forme, décochage compris, et la modification la plus récente gagne.
 */
import type { KeyValueStore } from '../audio/mixer';

export const CHORD_MARKS_KEY = 'fretwave.chords.v1';
/** Une coche vient de changer sur cet appareil : la synchro s'en sert. */
export const CHORD_MARKS_CHANGED = 'fretwave:chord-marks';

export interface ChordMarks {
  known: readonly string[];
  noReview: readonly string[];
  /** Dernière modification de chaque forme (ms epoch). Absente : coche d'avant la synchro. */
  stamps: Readonly<Record<string, number>>;
}

/** Une forme telle que l'API l'échange. */
export interface ChordMarkRow {
  chordId: string;
  known: boolean;
  noReview: boolean;
  ts: number;
}

export type ChordMarkKind = 'known' | 'noReview';

export const NO_MARKS: ChordMarks = { known: [], noReview: [], stamps: {} };

const ids = (v: unknown): string[] => (Array.isArray(v)
  ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0))]
  : []);

function stampsOf(v: unknown): Record<string, number> {
  if (typeof v !== 'object' || v === null) return {};
  return Object.fromEntries(Object.entries(v).filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1])));
}

export function readChordMarks(store: KeyValueStore | null): ChordMarks {
  if (!store) return NO_MARKS;
  try {
    const raw = store.getItem(CHORD_MARKS_KEY);
    if (!raw) return NO_MARKS;
    const o = JSON.parse(raw) as Partial<ChordMarks> | null;
    return { known: ids(o?.known), noReview: ids(o?.noReview), stamps: stampsOf(o?.stamps) };
  } catch {
    return NO_MARKS;
  }
}

export function writeChordMarks(store: KeyValueStore | null, marks: ChordMarks): void {
  try {
    store?.setItem(CHORD_MARKS_KEY, JSON.stringify({ v: 1, ...marks }));
  } catch {
    // quota ou navigation privée : la coche vaut pour cette visite
  }
}

/** Inverse une coche ; rend les coches à jour, même si le stockage est indisponible. */
export function toggleChordMark(store: KeyValueStore | null, kind: ChordMarkKind, voicingId: string, now: number): ChordMarks {
  const marks = readChordMarks(store);
  const list = marks[kind];
  const next: ChordMarks = {
    known: marks.known,
    noReview: marks.noReview,
    [kind]: list.includes(voicingId) ? list.filter((id) => id !== voicingId) : [...list, voicingId],
    stamps: { ...marks.stamps, [voicingId]: now },
  };
  writeChordMarks(store, next);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHORD_MARKS_CHANGED));
  return next;
}

/** Toutes les formes touchées, décochées comprises : un décochage doit voyager lui aussi. */
export function chordMarkRows(marks: ChordMarks): ChordMarkRow[] {
  const ids = new Set([...marks.known, ...marks.noReview, ...Object.keys(marks.stamps)]);
  return [...ids].map((chordId) => ({
    chordId,
    known: marks.known.includes(chordId),
    noReview: marks.noReview.includes(chordId),
    ts: marks.stamps[chordId] ?? 0,
  }));
}

/** Fusion forme par forme : la ligne distante ne gagne que si elle est strictement plus récente. */
export function mergeChordMarks(local: ChordMarks, remote: readonly ChordMarkRow[]): ChordMarks {
  const byId = new Map(chordMarkRows(local).map((r) => [r.chordId, r] as const));
  for (const r of remote) {
    const mine = byId.get(r.chordId);
    if (!mine || r.ts > mine.ts) byId.set(r.chordId, r);
  }
  const rows = [...byId.values()];
  return {
    known: rows.filter((r) => r.known).map((r) => r.chordId),
    noReview: rows.filter((r) => r.noReview).map((r) => r.chordId),
    stamps: Object.fromEntries(rows.filter((r) => r.ts > 0).map((r) => [r.chordId, r.ts])),
  };
}

/** Une forme se révise si elle est déclarée connue et que la révision n'est pas refusée. */
export function isReviewable(marks: ChordMarks, voicingId: string): boolean {
  return marks.known.includes(voicingId) && !marks.noReview.includes(voicingId);
}
