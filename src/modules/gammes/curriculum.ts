/**
 * Parcours des gammes (docs/PLAN_CONSTATS.md, lot 2a) : ce qui manque à une forme, et bientôt l'étape
 * suivante. Logique pure : l'écran d'entraînement et la file de révision lisent la même phrase.
 */
import { learnedGaps, type LearnedGap, type NodeStats } from '../../core/progress';

/** Ce qui manque pour « apprise », en mots d'élève (une phrase, pas une liste de codes). */
export const GAP_TEXT: Readonly<Record<LearnedGap, string>> = {
  successes: 'encore une réussite (≥ 80 %)',
  days: 'une réussite un autre jour',
  strong: 'une réussite sur la position entière, de mémoire (N3) ou au micro',
};

/** « encore une réussite (≥ 80 %) et une réussite un autre jour » ; vide si rien ne manque. */
export function missingText(n: Pick<NodeStats, 'successes' | 'successDays' | 'strongSuccesses'>): string {
  return learnedGaps(n).map((g) => GAP_TEXT[g]).join(' et ');
}
