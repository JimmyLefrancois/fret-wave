/**
 * Rappel à froid d'une carte due (lot « mémoire et vitesse », MUSIC_DESIGN §5) — la suite des écrans,
 * en logique pure :
 *
 *   cold ──(≥ 80 %)──────────────────────────────► next
 *     └──(< 80 %)──► look (« Regarde la forme », N s) ──► retry (N3, `afterReveal`) ──► next
 *
 * Principe de prof : **un essai fait juste après avoir vu la réponse ne prouve rien**. Seul le premier
 * essai, à froid, compte pour Leitner, la maîtrise et l'XP ; le rattrapage est journalisé (c'est de la
 * pratique réelle) avec `afterReveal: true`, et exclu de toute preuve.
 *
 * « Passer » existe à chaque étape : jamais de blocage.
 */
import { PASS } from '../../core/progress';

export type ColdStep = 'cold' | 'look' | 'retry' | 'next';

/** Temps d'observation proposés (s) : trois crans, pas un curseur. */
export type LookSeconds = 10 | 20 | 30;
export const LOOK_SECONDS: readonly LookSeconds[] = [10, 20, 30];
export const DEFAULT_LOOK_SECONDS: LookSeconds = 20;

export type ColdEvent =
  /** Série terminée (précision au premier essai). */
  | { type: 'finished'; accuracy: number }
  /** Fin de l'observation : temps écoulé, ou « J'ai vu, masquer ». */
  | { type: 'lookOver' }
  /** « Passer » : forme suivante, quelle que soit l'étape. */
  | { type: 'skip' };

/** Étape suivante. Une étape `next` est terminale : la session passe à la forme suivante. */
export function coldNext(step: ColdStep, ev: ColdEvent): ColdStep {
  if (step === 'next' || ev.type === 'skip') return 'next';
  switch (step) {
    case 'cold':
      return ev.type === 'finished' ? (ev.accuracy >= PASS ? 'next' : 'look') : step;
    case 'look':
      return ev.type === 'lookOver' ? 'retry' : step;
    case 'retry':
      return ev.type === 'finished' ? 'next' : step;
  }
}

/** La tentative de cette étape vaut-elle preuve ? (sinon elle est écrite `afterReveal: true`) */
export function countsAsProof(step: ColdStep): boolean {
  return step === 'cold';
}

/** Secondes restantes d'observation (jamais négatif). */
export function lookRemaining(startedAt: number, now: number, seconds: LookSeconds): number {
  return Math.max(0, Math.ceil(seconds - (now - startedAt) / 1000));
}

/**
 * Ligne du bilan de séance sur les rattrapages (constat 5) : ils comptent pour la journée (série, objectif)
 * mais pas pour la mémoire (Leitner, maîtrise, XP) ; rien à dire sans rattrapage.
 */
export function retryLine(n: number): string | null {
  if (n <= 0) return null;
  const s = n > 1 ? 's' : '';
  return `${n} rattrapage${s} après « Regarde la forme » : compté${s} pour la journée, pas pour la mémoire.`;
}
