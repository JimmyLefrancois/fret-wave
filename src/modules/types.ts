/**
 * Contrat minimal d'un module d'apprentissage (BRIEF.md « Architecture multi-modules »).
 * Un module déclare son identité et son écran d'entrée ; l'arbre de compétences, le modèle de maîtrise,
 * les types d'exercices et `validate()` arrivent en phase 2 (progression) et 4 (accords).
 * Ajouter un module = ajouter un dossier + une entrée dans `registry.ts` : le cœur ne change pas.
 */
import type { Accent, IconName } from '../app/ui';
import type { RouteName } from '../app/router';

export type ModuleId = 'gammes' | 'accords' | 'rythmique' | 'fondations';

export type ModuleStatus = 'available' | 'planned';

export interface LearningModule {
  id: ModuleId;
  title: string;
  tagline: string;
  icon: IconName;
  accent: Accent;
  status: ModuleStatus;
  /** Ce qui manque, dit franchement, quand le module n'est pas encore jouable. */
  statusLabel: string;
  /** Route d'entrée quand le module est disponible. */
  route?: RouteName;
  /** Chiffres ou faits affichés sur la carte du hub (jamais inventés). */
  facts?: string[];
}
