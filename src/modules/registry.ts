/**
 * Registre des modules. L'ordre est l'ordre d'affichage du hub.
 * `Gammes` est jouable en niveau 1 ; les autres sont déclarés (pas d'écran mort : le hub explique pourquoi).
 */
import type { LearningModule } from './types';

export const MODULES: readonly LearningModule[] = [
  {
    id: 'gammes',
    title: 'Gammes',
    tagline: 'Formes, positions, couleurs d’intervalles',
    icon: 'scales',
    accent: 'magenta',
    status: 'available',
    statusLabel: 'Niveau 1 ouvert',
    route: 'gammes',
    facts: ['31 gammes · 5 systèmes', 'Niv1 Découverte · niveaux 2-4 en phase 2'],
  },
  {
    id: 'accords',
    title: 'Accords',
    tagline: 'De zéro : formes ouvertes, doigt par doigt',
    icon: 'chords',
    accent: 'cyan',
    status: 'available',
    statusLabel: 'Phase 4a — 4 étapes',
    route: 'accords',
    facts: ['13 accords ouverts · 5 paliers', 'Doigtés saisis et relus · arpège validé au micro'],
  },
  {
    id: 'rythmique',
    title: 'Rythme',
    tagline: 'Strumming, tempo ladder, motifs',
    icon: 'rhythm',
    accent: 'yellow',
    status: 'planned',
    statusLabel: 'Déclaré',
    facts: ['Métronome et motifs déjà dans le moteur audio'],
  },
  {
    id: 'fondations',
    title: 'Fondations',
    tagline: 'Cordes, tablature, accordeur, posture',
    icon: 'ear',
    accent: 'violet',
    status: 'planned',
    statusLabel: 'Phase 3',
    facts: ['Entrée audio et accordeur : phase 3'],
  },
];

export function moduleById(id: string): LearningModule | undefined {
  return MODULES.find((m) => m.id === id);
}
