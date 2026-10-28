/**
 * Ce que l'accueil propose en premier : une seule action, choisie depuis le journal (rien d'inventé).
 *
 * Ordre : une révision due passe avant tout (c'est la répétition espacée qui fait progresser), puis on
 * reprend le dernier module touché (gamme ou accord), et un journal vide donne « Commencer ».
 */
import type { Attempt, Card } from '../core/progress';

export type HubResume =
  | { kind: 'start' }
  | { kind: 'scale' }
  | { kind: 'chord'; voicingId: string };

export interface HubPlan {
  /** Révision de gammes due, ou `null` : le héros devient « À réviser » seulement si quelque chose est dû. */
  review: { count: number; first: Card } | null;
  /** Ce qu'on reprend : en héros sans révision, en ligne secondaire sinon. */
  resume: HubResume;
}

/**
 * `due` : cartes de gammes dues (déjà filtrées). `learnedChords` et `nextChordId` viennent du module
 * Accords : un accord déjà appris ne se « reprend » pas, on passe au suivant du parcours.
 */
export function hubPlan(
  journal: readonly Attempt[],
  due: readonly Card[],
  learnedChords: ReadonlySet<string>,
  nextChordId: string | null,
): HubPlan {
  const review = due.length > 0 ? { count: due.length, first: due[0]! } : null;
  let last: Attempt | null = null;
  for (const a of journal) if (!last || a.ts >= last.ts) last = a;
  if (!last) return { review, resume: { kind: 'start' } };
  if (last.module === 'accords' || last.chordId) {
    const id = last.chordId && !learnedChords.has(last.chordId) ? last.chordId : nextChordId ?? last.chordId;
    if (id) return { review, resume: { kind: 'chord', voicingId: id } };
  }
  return { review, resume: { kind: 'scale' } };
}
