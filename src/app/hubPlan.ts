/**
 * Ce que l'accueil propose en premier : une seule action, choisie depuis le journal (rien d'inventé).
 *
 * Ordre : une révision due passe avant tout (c'est la répétition espacée qui fait progresser), puis on
 * reprend le dernier module touché (gamme ou accord), et un journal vide donne « Commencer ».
 */
import {
  DUE_CAP, PASS, isFullPosition, isProof, isVerified, medianOf, regressedForms, scoreOf, summarizeNodes,
  type Attempt, type Card, type DaySummary,
} from '../core/progress';
import type { NoteName, PositionSystem } from '../core/theory';
import type { ScaleSelection } from './scaleSession';
import type { Segment } from '../modules/gammes/exercise';
import { buildReviewQueue, dueToday, reviewContext, type ReviewOptions, type ReviewTarget } from '../modules/gammes/review';
import { capStep, nextCap, nextFormStep, scaleLearned, type Cap, type FormStep } from '../modules/gammes/curriculum';

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

/** La séance du jour (D98) : les révisions dues, puis l'étape suivante ou, la gamme apprise, un défi. */
export interface DailySession {
  /** Cartes dues pas encore tentées à froid aujourd'hui (Q1), dans l'ordre de la séance. */
  review: ReviewTarget[];
  /** Formes déjà rafraîchies (rappelées à froid) aujourd'hui. */
  reviewedToday: number;
  next: FormStep | null;
  /** Seulement si toute la gamme est apprise (`next === null`). */
  cap: Cap | null;
  /** Il ne manque qu'un second jour : la suite est demain (« Séance faite »). */
  waiting: boolean;
  /** Durée estimée, arrondie à la minute supérieure ; 0 si rien. */
  minutes: number;
}

export interface DailyOptions extends ReviewOptions {
  /** Durée de « Regarde la forme » après un rappel raté (réglage). */
  lookSeconds?: number;
}

/** Ce qu'on suppose sans mesure de l'élève : une série de 90 s, une écoute de 60 s. */
const SERIES_SECONDS = 90;
const LISTEN_SECONDS = 60;

const isColdRecall = (a: Attempt) => a.module !== 'accords' && a.kind === 'recall' && a.level >= 3
  && isFullPosition(a) && !a.afterReveal && a.correct !== null && a.total !== null;

/**
 * Durée estimée de la séance. Par forme due : la médiane des rappels N3 de l'élève sur la position entière
 * (90 s sans mesure), plus son taux d'échec à froid × (regard + nouvel essai). L'étape suivante : la médiane
 * de ses séries de ce niveau (90 s), une écoute 60 s.
 */
export function sessionMinutes(
  review: readonly unknown[], next: FormStep | null, journal: readonly Attempt[], lookSeconds: number,
): number {
  const recalls = journal.filter(isColdRecall);
  const med = medianOf(recalls.map((a) => a.seconds)) ?? SERIES_SECONDS;
  const fail = recalls.length ? recalls.filter((a) => (scoreOf(a) ?? 0) < PASS).length / recalls.length : 0;
  let total = review.length * (med + fail * (lookSeconds + med));
  if (next) {
    total += next.level === 1
      ? LISTEN_SECONDS
      : medianOf(journal.filter((a) => a.module !== 'accords' && (a.kind === 'holes' || a.kind === 'recall')
        && a.level === next.level && isFullPosition(a) && a.correct !== null).map((a) => a.seconds)) ?? SERIES_SECONDS;
  }
  return total > 0 ? Math.ceil(total / 60) : 0;
}

/** « Environ 8 min » ; « Moins d'une minute ». */
export function durationText(minutes: number): string {
  return minutes < 1 ? 'Moins d’une minute' : `Environ ${minutes} min`;
}

/**
 * La séance du jour sur la gamme choisie : révisions dues (pas encore tentées à froid aujourd'hui), puis
 * l'étape suivante (`nextFormStep`) ou, si toute la gamme est apprise, le défi suivant (`nextCap`).
 */
export function dailySession(
  journal: readonly Attempt[], now: number,
  sel: { scaleId: string; tonic: NoteName; system: PositionSystem; tuningId: string }, opts: DailyOptions = {},
): DailySession {
  const ctx = reviewContext(journal, now);
  const dueIds = new Set(ctx.due.map((c) => c.nodeId));
  const review = buildReviewQueue(journal, now, DUE_CAP, opts, ctx).filter((t) => dueIds.has(t.nodeId));
  const reviewedToday = ctx.cold.size;
  const next = nextFormStep(journal, sel.scaleId, sel.tonic, sel.system, sel.tuningId, now, ctx.nodes);
  const learned = !next && scaleLearned(journal, sel.scaleId, sel.tonic, sel.system, sel.tuningId, ctx.nodes);
  const cap = learned ? nextCap(journal, sel, ctx.nodes) : null;
  return {
    review, reviewedToday, next, cap, waiting: !next && !learned,
    minutes: sessionMinutes(review, next, journal, opts.lookSeconds ?? 20),
  };
}

export interface HeroAction {
  route: 'review' | 'tuner' | 'scale' | 'training' | 'chord';
  label: string;
  voicingId?: string;
  /** Ce que l'écran d'entraînement doit ouvrir (étape suivante ou défi). */
  selection?: ScaleSelection;
  level?: 1 | 2 | 3;
  segment?: Segment;
  /** Rien d'autre aujourd'hui : un bouton secondaire, pas l'action principale. */
  quiet?: true;
}

const FIRST_STEP: Readonly<Record<HeroStepId, HeroAction>> = {
  tune: { route: 'tuner', label: '▶ Accordeur' },
  listen: { route: 'scale', label: '▶ Écouter' },
  play: { route: 'training', label: '▶ Jouer au micro' },
};

/**
 * Ce que lance le bouton primaire du héros (et Espace / Entrée). Une révision due ouvre **la séance**
 * (`#/gammes/revision`, rappel à froid de D87), jamais une forme seule en exercice (D97) ; sinon l'accord
 * repris, l'étape en cours du premier pas, l'étape suivante (« Avancer ») ou le défi (« Découvrir »).
 */
export function heroAction(plan: HubPlan, session: DailySession, firstStep: HeroStepId | null = null): HeroAction {
  const n = session.review.length;
  if (n > 0) return { route: 'review', label: `▶ Réviser (${n} forme${n > 1 ? 's' : ''})` };
  if (plan.resume.kind === 'chord') return { route: 'chord', label: '▶ Ouvrir la leçon', voicingId: plan.resume.voicingId };
  if (firstStep) return FIRST_STEP[firstStep];
  const step = session.next ?? (session.cap ? capStep(session.cap) : null);
  if (!step) return { route: 'training', label: 'Continuer quand même', quiet: true };
  const target = { selection: step.selection, level: step.level, segment: step.segment };
  if (step.level === 1) {
    const what = session.next ? `la ${step.label.split(' · ')[0]!.toLowerCase()}` : session.cap!.name;
    const verb = !session.next ? 'Découvrir' : step.again ? 'Revoir' : 'Écouter';
    return { route: 'scale', label: `▶ ${verb} ${what}`, ...target };
  }
  return { route: 'training', label: session.next ? '▶ Avancer' : `▶ Découvrir ${session.cap!.name}`, ...target };
}

/** Comptes de la bande « Parcours » pour une gamme et un système (une forme ne dépend pas de la tonique). */
export function pathCounts(
  journal: readonly Attempt[], now: number, scaleId: string, system: string,
): { learned: number; mastered: number; due: number } {
  const prefix = `gam:lecture:${scaleId}:${system}:`;
  const nodes = summarizeNodes(journal).filter((n) => n.nodeId.startsWith(prefix) && (n.state === 'learned' || n.state === 'mastered'));
  const due = new Set(dueToday(journal, now).map((c) => c.nodeId));
  return {
    learned: nodes.length,
    mastered: nodes.filter((n) => n.state === 'mastered').length,
    due: nodes.filter((n) => due.has(n.nodeId)).length,
  };
}

/**
 * Ligne de série de l'accueil (D99) : « Série : 3 jours · 5 semaines ». La série de jours commence à deux
 * (MUSIC_DESIGN §17.3) ; sans elle, la série de semaines tient seule (« Série : 5 semaines ») : le joueur
 * du week-end voit ce qui dure. `null` : rien à dire.
 */
export function streakText(days: number, weeks: number): string | null {
  const w = `${weeks} semaine${weeks > 1 ? 's' : ''}`;
  if (days > 1) return weeks > 0 ? `Série : ${days} jours · ${w}` : `Série : ${days} jours d’affilée`;
  return weeks > 0 ? `Série : ${w}` : null;
}

/** « 5 formes apprises sur 5, dont 2 maîtrisées · 3 à rafraîchir » : apprise ne veut pas dire « fini ». */
export function pathCountText(learned: number, mastered: number, due: number, total: number): string {
  const s = (k: number) => (k > 1 ? 's' : '');
  return `${learned} forme${s(learned)} apprise${s(learned)} sur ${total}`
    + (mastered > 0 ? `, dont ${mastered} maîtrisée${s(mastered)}` : '')
    + (due > 0 ? ` · ${due} à rafraîchir` : '');
}

/**
 * Activités du jour pour la jauge : les exercices vérifiés, et eux seuls (décision de l'auteur). Une
 * écoute ne compte pas : l'app a joué, pas l'élève. Un grattage déclaré « sans micro » non plus :
 * une déclaration n'est jamais une preuve.
 */
export function dailyActivity(day: Pick<DaySummary, 'exercises'>): number {
  return day.exercises;
}

/** Date relative courte : « il y a 12 min », « hier », « il y a 3 j », puis « il y a 5 sem. » au-delà de 14 jours. */
export function whenLabel(ts: number, now: number): string {
  const d = now - ts;
  if (d < 60_000) return 'à l’instant';
  if (d < 3_600_000) return `il y a ${Math.round(d / 60_000)} min`;
  if (d < 86_400_000) return `il y a ${Math.round(d / 3_600_000)} h`;
  const days = Math.round(d / 86_400_000);
  if (days === 1) return 'hier';
  if (days <= 14) return `il y a ${days} j`;
  return `il y a ${Math.round(days / 7)} sem.`;
}

/** « 83 % », ou le compte quand la série a moins de 5 trous (« 1 sur 2 ») : 50 % de 2 trous ne dit rien. */
function scoreText(a: Attempt, long: boolean): string {
  const total = a.total ?? 0;
  const correct = a.correct ?? 0;
  if (total >= 5) return `${Math.round((correct / total) * 100)} %`;
  return long ? `${correct} trou${correct > 1 ? 's' : ''} juste${correct > 1 ? 's' : ''} sur ${total}` : `${correct} sur ${total}`;
}

/**
 * Carte de révision en deux lignes (lot 3) : **quand** elle a été vue et **où elle en est** (« vue il y a 3 j ·
 * encore fragile : à 80 % elle s'espace »), puis la **tendance** de ses trois dernières preuves (« tes 3 derniers
 * essais : 50 % → 75 % → 83 % ») ; une seule preuve : « premier essai : 83 % ». La boîte de Leitner reste interne :
 * l'élève lit ce qu'elle veut dire, et le seuil qui la fait avancer. Les preuves sont celles que la carte retient
 * (position entière ou de mémoire, D97).
 */
export function reviewLine(card: Card, attempts: readonly Attempt[], now: number): { reason: string; trend: string } {
  const proofs = attempts
    .filter((a) => isProof(a) && a.module !== 'accords' && (a.kind === 'recall' || (a.kind === 'holes' && isFullPosition(a)))
      && `gam:lecture:${a.scaleId}:${a.system}:${a.formIndex}` === card.nodeId)
    .sort((x, y) => x.ts - y.ts)
    .slice(-3);
  const reason = `vue ${whenLabel(card.lastTs, now)} · ${boxText(card.box)}`;
  if (proofs.length <= 1) return { reason, trend: proofs[0] ? `premier essai : ${scoreText(proofs[0], true)}` : '' };
  return { reason, trend: `tes ${proofs.length} derniers essais : ${proofs.map((a) => scoreText(a, false)).join(' → ')}` };
}

/** Ce que dit la boîte (1-2 / 3-4 / 5-6), avec le seuil qui espace la forme tant qu'elle est fragile. */
function boxText(box: number): string {
  if (box <= 2) return `encore fragile : à ${Math.round(PASS * 100)}\u00a0% elle s’espace`;
  if (box <= 4) return 'elle s’installe';
  return 'presque acquise, elle revient rarement';
}

/** Jours calendaires depuis le dernier exercice vérifié (une écoute ne compte pas) ; 0 sans journal. */
export function absenceDays(attempts: readonly Attempt[], now: Date): number {
  let last = -Infinity;
  for (const a of attempts) if (isVerified(a) && a.ts > last && a.ts <= now.getTime()) last = a.ts;
  if (last === -Infinity) return 0;
  const l = new Date(last);
  const from = new Date(l.getFullYear(), l.getMonth(), l.getDate());
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** À partir de 3 jours d'absence, le héros accueille l'élève (lot 3). */
export const ABSENCE_DAYS = 3;

/**
 * Lignes de retour après une absence, en tête du héros : un accueil, ce qui attend et sa durée, puis ce qui
 * tient de la série (jamais de reproche). Vide sous `ABSENCE_DAYS`.
 */
export function returnLines(absence: number, due: number, minutes: number, days: number, weeks: number): string[] {
  // tant que la série de semaines tient, l'absence est un rythme, pas un retour : le joueur du week-end ne
  // se fait pas accueillir chaque samedi (D101, constat 36)
  if (absence < ABSENCE_DAYS || weeks > 0) return [];
  const n = Math.min(due, DUE_CAP);
  const out = [n > 0
    ? `Content de te revoir. ${n} forme${n > 1 ? 's' : ''} à rafraîchir, environ ${minutes} min : on reprend doucement.`
    : 'Content de te revoir : on reprend doucement.'];
  if (days <= 1) out.push('Une nouvelle série commence aujourd’hui.');
  if (due > DUE_CAP) out.push(`${DUE_CAP} aujourd’hui, les autres reviendront.`);
  return out;
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
 * Formes de gamme « apprises » selon les règles d'avant le lot « mémoire et vitesse », et « en
 * apprentissage » aujourd'hui : le hub le dit, sinon l'élève croirait avoir perdu sa progression.
 */
export function regressedScaleForms(journal: readonly Attempt[]): number {
  return regressedForms(summarizeNodes(journal)).length;
}

/**
 * Ligne de jauge du jour. L'objectif atteint se **dit** (c'est la fin d'une séance, pas trois cases
 * vertes de plus) ; au-delà, le compte continue sans fausse surenchère.
 */
export function dayGoalText(activity: number, goal: number): { text: string; reached: boolean } {
  if (activity >= goal) {
    return { text: `Objectif du jour atteint (${activity})`, reached: true };
  }
  return { text: `${activity} / ${goal} exercices aujourd’hui`, reached: false };
}
