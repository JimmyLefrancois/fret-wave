/**
 * Révision espacée : **Leitner à 6 boîtes** derrière l'interface `Scheduler` (MUSIC_DESIGN §5).
 *
 * Trois propriétés tenues par construction :
 *  1. **rejouable** — les cartes ne sont pas stockées, elles se recalculent en rejouant le journal
 *     (même journal → mêmes cartes, mêmes échéances) ;
 *  2. **bornée** — un plafond de cartes dues par session (8) évite la « dette de révision » qui
 *     démotiverait après une absence ;
 *  3. **déterministe** — la gigue ±15 % est dérivée d'un hachage du nœud, pas de `Math.random` :
 *     deux calculs successifs donnent la même échéance (sans quoi un test ne peut rien affirmer).
 */
import { hash32, isProof, nodeIdOf, scoreOf, type Attempt, type AttemptLevel } from './journal';

const MIN = 60_000;
export const DAY = 86_400_000;

/** Intervalles des boîtes 1 à 6 : 10 min (le même jour), 1 j, 3 j, 7 j, 16 j, 35 j. */
export const BOX_INTERVALS_MS: readonly number[] = [10 * MIN, DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY];

export const MAX_BOX = 6;
/** Plafond de cartes dues proposées par session (MUSIC_DESIGN §5). */
export const DUE_CAP = 8;

export type Outcome = 'clean' | 'slow' | 'fail';

export interface Card {
  nodeId: string;
  /** 1 à 6. */
  box: number;
  /** Échéance (ms epoch) à laquelle la carte redevient due. */
  due: number;
  lastTs: number;
  /** Nombre d'échecs depuis la dernière réussite (diagnostic, pas une punition). */
  lapses: number;
  /** Nombre de tentatives vérifiées prises en compte. */
  reps: number;
  /** Niveau du dernier exercice réussi — sert à proposer le bon écran. */
  lastLevel: AttemptLevel;
  lastScore: number;
}

export interface Scheduler {
  readonly id: string;
  /** Carte après un résultat ; `now` = instant de la tentative. */
  next(card: Card | null, nodeId: string, outcome: Outcome, now: number, level: AttemptLevel, score: number): Card;
}

/** Réussite nette, réussite lente/avec aide, échec (MUSIC_DESIGN §5). */
export function outcomeFor(score: number): Outcome {
  if (score >= 0.95) return 'clean';
  if (score >= 0.8) return 'slow';
  return 'fail';
}

function jiggle(nodeId: string, reps: number, base: number): number {
  // ±15 %, déterministe : deux appels avec les mêmes entrées donnent la même échéance
  const t = (hash32(`${nodeId}:${reps}`) % 3001) / 3000; // 0…1
  return Math.round(base * (0.85 + 0.3 * t));
}

export const leitner: Scheduler = {
  id: 'leitner-6',
  next(card, nodeId, outcome, now, level, score) {
    const prev = card ?? { nodeId, box: 1, due: now, lastTs: now, lapses: 0, reps: 0, lastLevel: level, lastScore: score };
    const reps = prev.reps + 1;
    let box = prev.box;
    let lapses = prev.lapses;
    if (outcome === 'clean') box = Math.min(MAX_BOX, box + 1);
    else if (outcome === 'slow') box = Math.max(1, box);
    else {
      box = Math.max(1, box - 2);
      lapses += 1;
    }
    // première rencontre : une réussite nette démarre en boîte 2, sinon boîte 1
    if (!card) box = outcome === 'clean' ? 2 : 1;
    const interval = BOX_INTERVALS_MS[box - 1] ?? BOX_INTERVALS_MS[0]!;
    return {
      nodeId,
      box,
      due: now + jiggle(nodeId, reps, interval),
      lastTs: now,
      lapses,
      reps,
      lastLevel: level,
      lastScore: score,
    };
  },
};

/** Rejoue le journal : une carte par nœud, dans l'état où les tentatives vérifiées l'ont laissé. */
export function cardsFrom(attempts: readonly Attempt[], scheduler: Scheduler = leitner): Card[] {
  const cards = new Map<string, Card>();
  for (const a of [...attempts].sort((x, y) => x.ts - y.ts)) {
    const score = scoreOf(a);
    if (!isProof(a) || score === null) continue;
    // une séquence (tablature visible) n'a rien à réviser de mémoire : pas de carte
    if (a.kind === 'sequence') continue;
    const nodeId = nodeIdOf(a);
    const card = cards.get(nodeId) ?? null;
    cards.set(nodeId, scheduler.next(card, nodeId, outcomeFor(score), a.ts, a.level, score));
  }
  return [...cards.values()].sort((x, y) => x.due - y.due);
}

/** Cartes dues (échéance atteinte), la plus ancienne d'abord. */
export function dueCards(cards: readonly Card[], now: number): Card[] {
  return cards.filter((c) => c.due <= now).sort((x, y) => x.due - y.due);
}

export function dueNow(attempts: readonly Attempt[], now: number, cap = DUE_CAP): Card[] {
  return dueCards(cardsFrom(attempts), now).slice(0, cap);
}

/** Prochaine échéance d'un nœud, ou `null` s'il n'a jamais été tenté. */
export function cardOf(cards: readonly Card[], nodeId: string): Card | null {
  return cards.find((c) => c.nodeId === nodeId) ?? null;
}
