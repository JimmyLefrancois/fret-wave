/**
 * Ouvre une étape de la séance du jour (D98) : la bonne gamme, la bonne position, le bon niveau. Une
 * écoute (N1) ouvre l'écran de la gamme ; un exercice, l'écran d'entraînement au niveau demandé.
 */
import { navigate } from './router';
import { setScaleSelection, setTrainingStart, type ScaleSelection } from './scaleSession';
import type { Segment } from '../modules/gammes/exercise';

export function openStep(step: { route: 'review' | 'tuner' | 'scale' | 'training'; selection?: ScaleSelection; level?: 1 | 2 | 3; segment?: Segment }): void {
  if (step.selection) setScaleSelection(step.selection);
  if (step.route === 'training' && step.level && step.level > 1) setTrainingStart({ level: step.level as 2 | 3, segment: step.segment ?? 'updown' });
  navigate(step.route);
}
