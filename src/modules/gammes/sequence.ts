/**
 * Séquences avec **palier automatique de tempo** (lot « mémoire et vitesse », MUSIC_DESIGN §3.5) —
 * logique pure : jugement d'une passe, règles du palier, tempo de reprise, rappel de pause.
 *
 * C'est un exercice de **technique** : la tablature est visible. Il ne prouve donc pas qu'on sait la
 * forme (« apprise »), il prouve qu'on la **joue à tempo** — l'axe vitesse de « maîtrisée ».
 *
 * Règles du palier (demandées, pas inventées) :
 *  - départ au dernier tempo validé pour cette forme et ce motif, sinon 60 BPM (croches) ;
 *  - **+4 BPM** après **2 passes consécutives** à ≥ 95 % avec le tempo tenu (ce tempo est alors « validé ») ;
 *  - **−5 BPM** après **2 échecs consécutifs**, sans jamais descendre sous le tempo de départ ;
 *  - bornes 40-200 BPM.
 */
import type { Target } from '../../core/input/match';
import type { Attempt } from '../../core/progress';
import type { SequencePattern } from '../../core/tab';
import { scoreBlind, type HeardNote } from './blind';

export const LADDER_START = 60;
export const LADDER_MIN = 40;
export const LADDER_MAX = 200;
export const LADDER_UP = 4;
export const LADDER_DOWN = 5;
/** Précision exigée pour une passe réussie (le seuil « propre » de l'app). */
export const PASS_CLEAN = 0.95;
/** Part des notes justes qui doivent tomber en place pour que le tempo soit « tenu ». */
export const IN_TIME_SHARE = 0.9;
/** Écart toléré à la place de la note, en fraction de croche (après retrait du décalage constant). */
export const IN_TIME_WINDOW = 0.5;
/** Rappel doux de pause : au-delà, la précision baisse et la tension monte. */
export const PAUSE_AFTER_MS = 10 * 60_000;

export interface PassResult {
  correct: number;
  total: number;
  accuracy: number;
  /** Les notes justes sont-elles en place, à ce tempo ? */
  inTime: boolean;
  missedStrings: number[];
  /** Passe réussie : propre (≥ 95 %) **et** en place. */
  ok: boolean;
}

/**
 * Juge une passe. `heard[].t` = secondes depuis le premier temps de la passe (après le décompte).
 * La mise en place se juge note à note : chaque attaque juste est comparée à sa place (rang × croche),
 * **après retrait de l'écart médian** — un décalage constant est la latence de la chaîne ou un départ un
 * peu tardif, pas un défaut de tempo ; ce qui compte, c'est de ne pas traîner ni presser.
 */
export function judgePass(
  targets: readonly Target[], heard: readonly HeardNote[], bpm: number, opts: { centsTolerance: number },
): PassResult {
  const eighth = 30 / Math.max(1, bpm);
  // à tempo rapide, une même note revient vite : le rebond se juge à l'échelle de la croche
  const sc = scoreBlind(targets, heard, { centsTolerance: opts.centsTolerance, finished: true, dedupeSeconds: Math.min(0.4, eighth * 0.6) });
  const offsets = targets.flatMap((t, i) => (sc.times[t.key] === undefined ? [] : [sc.times[t.key]! - i * eighth]));
  let inTime = false;
  if (offsets.length >= 2) {
    const sorted = [...offsets].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1]!;
    const placed = offsets.filter((o) => Math.abs(o - median) <= IN_TIME_WINDOW * eighth).length;
    inTime = placed / offsets.length >= IN_TIME_SHARE;
  }
  const accuracy = sc.total > 0 ? sc.correct / sc.total : 0;
  return { correct: sc.correct, total: sc.total, accuracy, inTime, missedStrings: sc.missedStrings, ok: accuracy >= PASS_CLEAN && inTime };
}

export interface LadderState {
  bpm: number;
  /** Tempo de départ de la session : plancher du palier. */
  start: number;
  okStreak: number;
  failStreak: number;
  /** Meilleur tempo validé (deux passes réussies d'affilée), `null` si aucun. */
  best: number | null;
  passes: number;
}

const clamp = (v: number) => Math.max(LADDER_MIN, Math.min(LADDER_MAX, Math.round(v)));

export function ladderStart(bpm: number): LadderState {
  const b = clamp(bpm);
  return { bpm: b, start: b, okStreak: 0, failStreak: 0, best: null, passes: 0 };
}

/** Palier après une passe. */
export function ladderStep(s: LadderState, ok: boolean): LadderState {
  const passes = s.passes + 1;
  if (ok) {
    const okStreak = s.okStreak + 1;
    if (okStreak >= 2) {
      // deux passes propres d'affilée : ce tempo est validé, on monte
      return { ...s, passes, okStreak: 0, failStreak: 0, best: Math.max(s.best ?? 0, s.bpm), bpm: clamp(s.bpm + LADDER_UP) };
    }
    return { ...s, passes, okStreak, failStreak: 0 };
  }
  const failStreak = s.failStreak + 1;
  if (failStreak >= 2) {
    // deux échecs : on redescend, jamais sous le départ de la session
    return { ...s, passes, okStreak: 0, failStreak: 0, bpm: Math.max(s.start, clamp(s.bpm - LADDER_DOWN)) };
  }
  return { ...s, passes, okStreak: 0, failStreak };
}

/** Tempo de reprise : le dernier tempo validé **au micro** pour cette forme et ce motif, sinon 60. */
export function startTempo(
  journal: readonly Attempt[],
  form: { scaleId: string; system: string; formIndex: number },
  pattern: SequencePattern,
): number {
  let best: { ts: number; bpm: number } | null = null;
  for (const a of journal) {
    if (a.kind !== 'sequence' || a.pattern !== pattern || a.mic !== true || typeof a.bpmBest !== 'number') continue;
    if (a.scaleId !== form.scaleId || a.system !== form.system || a.formIndex !== form.formIndex) continue;
    if (!best || a.ts > best.ts) best = { ts: a.ts, bpm: a.bpmBest };
  }
  return clamp(best?.bpm ?? LADDER_START);
}

export function pauseDue(elapsedMs: number): boolean {
  return elapsedMs >= PAUSE_AFTER_MS;
}
