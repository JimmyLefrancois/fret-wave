/**
 * Ce que l'accueil propose en premier : une seule action, choisie depuis le journal (rien d'inventé).
 *
 * Ordre : une révision due passe avant tout (c'est la répétition espacée qui fait progresser), puis on
 * reprend le dernier module touché (gamme ou accord), et un journal vide donne « Commencer ».
 */
import { isVerified, type Attempt, type Card } from '../core/progress';

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
  /** Un accord absent des données (vieux journal, import) ne se rouvre pas : on passe au suivant du parcours. */
  isKnownChord: (id: string) => boolean = () => true,
): HubPlan {
  const review = due.length > 0 ? { count: due.length, first: due[0]! } : null;
  let last: Attempt | null = null;
  for (const a of journal) if (!last || a.ts >= last.ts) last = a;
  if (!last) return { review, resume: { kind: 'start' } };
  if (last.module === 'accords' || last.chordId) {
    const lastId = last.chordId && isKnownChord(last.chordId) ? last.chordId : undefined;
    const id = lastId && !learnedChords.has(lastId) ? lastId : nextChordId ?? lastId;
    if (id) return { review, resume: { kind: 'chord', voicingId: id } };
  }
  return { review, resume: { kind: 'scale' } };
}

/**
 * Étape suivante sur une gamme : tant qu'elle n'a été ni écoutée ni jouée, on la fait **écouter** ;
 * dès la première écoute, l'étape suivante est de la **jouer au micro** (réécouter passe en second).
 * Une gamme se reconnaît à son identifiant et sa tonique ; les tentatives d'accords n'y comptent pas.
 */
export function scaleStep(journal: readonly Attempt[], scaleId: string, tonic: string): 'listen' | 'play' {
  return journal.some((a) => a.module !== 'accords' && !a.chordId && a.scaleId === scaleId && a.tonic === tonic)
    ? 'play'
    : 'listen';
}

/**
 * Le micro a-t-il déjà entendu l'élève ? Une tentative vérifiée suffit, sauf le QCM (sans instrument)
 * et le grattage auto-déclaré (une déclaration n'est jamais une preuve). Sans cela, l'accueil propose
 * de passer d'abord par l'accordeur, qui demande l'accès au micro.
 */
export function micHeardBefore(journal: readonly Attempt[]): boolean {
  return journal.some((a) => a.kind !== 'qcm' && a.kind !== 'strum' && isVerified(a));
}
