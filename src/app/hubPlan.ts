/**
 * Ce que l'accueil propose en premier : une seule action, choisie depuis le journal (rien d'inventé).
 *
 * Ordre : une révision due passe avant tout (c'est la répétition espacée qui fait progresser), puis on
 * reprend le dernier module touché (gamme ou accord), et un journal vide donne « Commencer ».
 */
import { isVerified, summarizeNodes, type Attempt, type AttemptLevel, type Card, type DaySummary } from '../core/progress';

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
 * Activités du jour pour la jauge : écoutes et exercices vérifiés. Un grattage déclaré « sans micro »
 * n'y entre pas : une déclaration n'est jamais une preuve.
 */
export function dailyActivity(day: Pick<DaySummary, 'listens' | 'exercises'>): number {
  return day.listens + day.exercises;
}

const LEVEL_NAME: Readonly<Record<AttemptLevel, string>> = {
  1: 'écoute', 2: 'exercice à trous', 3: 'de mémoire', 4: 'impro',
};

/**
 * Pourquoi cette forme revient : son dernier passage réussi, tel que la carte l'a retenu
 * (« Dernier passage : exercice à trous, 85 % »). Aucune durée ni consigne inventée.
 */
export function reviewSummary(card: Pick<Card, 'lastLevel' | 'lastScore'>): string {
  return `Dernier passage : ${LEVEL_NAME[card.lastLevel]}, ${Math.round(card.lastScore * 100)}\u00a0%`;
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

/** Les balises qui ont déjà leur propre usage d'Espace et d'Entrée. */
const OWN_KEYS = new Set(['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'SUMMARY', 'OPTION', 'LABEL']);

/**
 * Espace ou Entrée lancent l'action du héros, guitare en main, **seulement** quand le focus n'est sur
 * aucun contrôle (un bouton, un lien, un champ garde son propre geste) et sans touche de modification.
 */
export function isHeroShortcut(
  e: { key: string; repeat?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean },
  target: { tagName?: string; isContentEditable?: boolean } | null,
): boolean {
  if (e.key !== ' ' && e.key !== 'Enter') return false;
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return false;
  if (!target) return true;
  return !target.isContentEditable && !OWN_KEYS.has((target.tagName ?? '').toUpperCase());
}

/**
 * Étape « Accorder » franchie ? Seulement sur un **fait observé** : le navigateur dit que le micro est
 * autorisé, ou l'accordeur a enregistré un accordage complet. Jamais une case cochée par l'élève.
 */
export function tuneStepDone(micPermission: string | null, tuned: boolean): boolean {
  return micPermission === 'granted' || tuned;
}

export type HeroStepId = 'tune' | 'listen' | 'play';

/**
 * Les deux étapes d'un premier pas (accorder, puis écouter ou jouer) et celle **en cours** : c'est elle
 * que portent le bouton primaire et le raccourci, jamais une étape plus loin que la suivante à faire.
 */
export function heroSteps(
  second: 'listen' | 'play',
  tuneDone: boolean,
): { steps: { id: HeroStepId; done: boolean }[]; current: HeroStepId } {
  return {
    steps: [{ id: 'tune', done: tuneDone }, { id: second, done: false }],
    current: tuneDone ? second : 'tune',
  };
}

/**
 * Formes de gamme apprises ou maîtrisées (lecture seule, l'impro est une compétence à part) : l'état
 * réel que la bande « Parcours » affiche, avec les mêmes seuils que la maîtrise. Avec `scaleId` et
 * `system`, seulement celles de cette gamme (une forme ne dépend pas de la tonique).
 */
export function learnedScaleForms(journal: readonly Attempt[], scaleId?: string, system?: string): number {
  const prefix = scaleId && system ? `gam:lecture:${scaleId}:${system}:` : 'gam:lecture:';
  return summarizeNodes(journal).filter(
    (n) => n.nodeId.startsWith(prefix) && (n.state === 'learned' || n.state === 'mastered'),
  ).length;
}

/**
 * Ligne de jauge du jour. L'objectif atteint se **dit** (c'est la fin d'une séance, pas trois cases
 * vertes de plus) ; au-delà, le compte continue sans fausse surenchère.
 */
export function dayGoalText(activity: number, goal: number): { text: string; reached: boolean } {
  if (activity >= goal) {
    return { text: `Objectif du jour atteint (${activity})`, reached: true };
  }
  return { text: `${activity} / ${goal} écoutes ou exercices aujourd’hui`, reached: false };
}
