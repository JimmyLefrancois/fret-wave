/**
 * Révision des accords (D139), en logique pure. Mêmes règles que les gammes : cartes Leitner rejouées depuis
 * le journal, plafonds 5 et 8, une forme déjà rappelée à froid aujourd'hui attend demain.
 *
 * Le micro entend une note à la fois : l'accord se vérifie **arpégé**, chaque corde jouée une fois, de mémoire.
 * Cela prouve la forme, pas le plaqué. Une carte naît au premier rappel ; une forme cochée sans carte est donc
 * due tout de suite. Décocher ne supprime rien : la carte dort, et reprend si on recoche.
 */
import { matchPitch, noteNameOf, targetsFor, type MatchOptions, type MatchVerdict, type Target } from '../../core/input/match';
import {
  cardsFrom, dayKey, DUE_CAP, isReviewable, newAttemptId, nodeIdOf, type Attempt, type Card, type ChordMarks,
} from '../../core/progress';
import { fretToMidi, TUNINGS } from '../../core/theory';
import type { Voicing } from '../../core/theory/voicings';
import { nextDay, REVIEW_MAX } from '../gammes/review';

export { REVIEW_MAX };

export interface ChordHole {
  key: string;
  columnIndex: number;
  /** Index de corde, 0 = la plus grave. */
  string: number;
  fret: number;
  note: Target['note'];
  fn: string;
}

export interface ChordTarget {
  voicing: Voicing;
  nodeId: string;
  /** « palier 3 sur 6 », ou « première vérification ». */
  reason: string;
}

export interface ChordReviewSummary {
  chords: ChordTarget[];
  /** Formes dues aujourd'hui (`DUE_CAP` au plus). */
  count: number;
  /** Prochaine échéance quand rien n'est dû ; `null` si aucune forme n'est suivie. */
  nextDue: number | null;
}

export const chordNodeId = (voicingId: string): string => nodeIdOf({ scaleId: '', system: 'accord', formIndex: 0, chordId: voicingId });

/** Les cordes à jouer, de la grave à l'aiguë : une note par corde, sans aller-retour (la descente ne prouverait rien). */
export function chordHoles(v: Voicing): ChordHole[] {
  const tuning = TUNINGS[v.tuningId];
  if (!tuning) return [];
  return v.frets.flatMap((fret, string): ChordHole[] => (fret === null || fret === undefined ? [] : [{
    key: `0:${string}`,
    columnIndex: 0,
    string,
    fret,
    note: noteNameOf(fretToMidi(tuning, string, fret)),
    fn: '',
  }]));
}

export type ChordVerdict = MatchVerdict | { kind: 'repeat' };

/**
 * Verdict d'une note : les cordes restent libres d'ordre. Rejouer une note déjà trouvée n'est jamais une
 * erreur (deux cordes voisines sont parfois à un demi-ton, le test de `matchPitch` y verrait une faute).
 */
export function judgeChordNote(
  v: Voicing,
  heardMidiFloat: number,
  found: ReadonlySet<string>,
  opts: MatchOptions,
): ChordVerdict {
  const tuning = TUNINGS[v.tuningId];
  if (!tuning) return { kind: 'empty' };
  const holes = chordHoles(v);
  const open = holes.filter((h) => !found.has(h.key));
  const verdict = matchPitch(heardMidiFloat, targetsFor(open, tuning), opts);
  if (verdict.kind === 'fill') return verdict;
  const again = targetsFor(holes.filter((h) => found.has(h.key)), tuning)
    .some((t) => Math.abs(heardMidiFloat - t.midi) * 100 <= Math.max(1, opts.centsTolerance));
  return again ? { kind: 'repeat' } : verdict;
}

/** Premier essai à froid d'une forme d'accord, aujourd'hui. */
function coldToday(attempts: readonly Attempt[], now: number): Set<string> {
  const key = dayKey(now);
  return new Set(attempts
    .filter((a) => a.module === 'accords' && a.kind === 'recall' && !a.afterReveal && a.correct !== null && dayKey(a.ts) === key)
    .map((a) => nodeIdOf(a)));
}

function targetOf(voicing: Voicing, card: Card | null): ChordTarget {
  return {
    voicing,
    nodeId: chordNodeId(voicing.id),
    reason: card ? `palier ${card.box} sur 6` : 'première vérification',
  };
}

/** Formes dues aujourd'hui : les cartes échues, la plus ancienne d'abord, puis les formes cochées sans carte. */
export function dueChords(
  voicings: readonly Voicing[],
  attempts: readonly Attempt[],
  marks: ChordMarks,
  now: number,
): ChordTarget[] {
  const cards = new Map(cardsFrom(attempts).map((c) => [c.nodeId, c] as const));
  const cold = coldToday(attempts, now);
  const followed = voicings.filter((v) => isReviewable(marks, v.id));
  const withCard = followed
    .map((v) => ({ v, card: cards.get(chordNodeId(v.id)) ?? null }))
    .filter((x): x is { v: Voicing; card: Card } => x.card !== null && x.card.due <= now && !cold.has(x.card.nodeId))
    .sort((a, b) => a.card.due - b.card.due)
    .map(({ v, card }) => targetOf(v, card));
  const fresh = followed.filter((v) => !cards.has(chordNodeId(v.id))).map((v) => targetOf(v, null));
  return [...withCard, ...fresh];
}

export function buildChordQueue(
  voicings: readonly Voicing[],
  attempts: readonly Attempt[],
  marks: ChordMarks,
  now: number,
  max = REVIEW_MAX,
): ChordTarget[] {
  return dueChords(voicings, attempts, marks, now).slice(0, max);
}

/** Ce que le bilan propose encore : les dues restantes, sans dépasser `DUE_CAP` rappels à froid dans la journée. */
export function moreChordsDue(
  voicings: readonly Voicing[],
  attempts: readonly Attempt[],
  marks: ChordMarks,
  now: number,
): number {
  return Math.max(0, Math.min(dueChords(voicings, attempts, marks, now).length, DUE_CAP - coldToday(attempts, now).size));
}

/** Ce que l'accueil affiche. */
export function chordReviewSummary(
  voicings: readonly Voicing[],
  attempts: readonly Attempt[],
  marks: ChordMarks,
  now: number,
): ChordReviewSummary {
  const due = dueChords(voicings, attempts, marks, now);
  const chords = due.slice(0, REVIEW_MAX);
  const cards = new Map(cardsFrom(attempts).map((c) => [c.nodeId, c] as const));
  const cold = coldToday(attempts, now);
  const waiting = voicings.flatMap((v) => {
    const card = isReviewable(marks, v.id) ? cards.get(chordNodeId(v.id)) : undefined;
    if (!card) return [];
    return [cold.has(card.nodeId) ? Math.max(card.due, nextDay(now)) : Math.max(card.due, now)];
  });
  return {
    chords,
    count: Math.min(due.length, DUE_CAP),
    nextDue: chords.length === 0 && waiting.length > 0 ? Math.min(...waiting) : null,
  };
}

export function chordAttempt(
  v: Voicing,
  args: { now: number; seq: number; correct: number; total: number; seconds: number; missedStrings: number[]; afterReveal: boolean; mic: boolean },
): Attempt {
  const frets = v.frets.filter((f): f is number => typeof f === 'number');
  return {
    id: newAttemptId(args.now, chordNodeId(v.id), args.seq),
    ts: args.now,
    kind: 'recall',
    module: 'accords',
    chordId: v.id,
    scaleId: '',
    tonic: '',
    tuningId: v.tuningId,
    system: 'accord',
    positionId: v.id,
    formIndex: 0,
    level: 3,
    strings: args.total,
    correct: args.correct,
    total: args.total,
    seconds: args.seconds,
    fretMin: Math.min(...frets),
    missedStrings: args.missedStrings,
    tempoOk: false,
    fullPosition: true,
    ...(args.afterReveal ? { afterReveal: true as const } : {}),
    ...(args.mic ? { mic: true as const } : {}),
  };
}
