import type { AnnotationKind } from '../../core/tab';

/** Choix d'annotation de la tablature, partagés par Découvrir et Improviser. */
export const ANNOTATIONS: { value: AnnotationKind; label: string }[] = [
  { value: 'note', label: 'Notes' },
  { value: 'degree', label: 'Degrés' },
  { value: 'interval', label: 'Intervalles' },
  { value: 'finger', label: 'Doigtés' },
];
