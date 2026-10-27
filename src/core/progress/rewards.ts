/**
 * XP, série et badges — tous **dérivés du journal**, jamais incrémentés à la main.
 * Règles d'honnêteté (MUSIC_DESIGN §7.4, D22) :
 *  - une **écoute** ne rapporte aucun XP (elle n'est pas vérifiée) ;
 *  - l'XP est **plafonnée par jour** : la quantité ne doit pas payer plus que la qualité ;
 *  - le bonus de vitesse n'existe qu'à ≥ 95 % de précision ;
 *  - un badge dit ce qu'il récompense et ne décorera jamais un chiffre faux.
 */
import { dayKey, isVerified, nodeIdOf, scoreOf, type Attempt } from './journal';
import { PASS, summarizeNodes } from './mastery';

export const XP_HOLES = 10;
export const XP_RECALL = 15;
/** Poses à froid (Fixer) : c'est un rappel de mémoire, pas une lecture — même barème que le rappel. */
export const XP_COLD = 15;
/** Transitions (Enchaîner) : un geste mesuré, valorisé comme une série de trous. */
export const XP_TRANSITION = 10;
/** QCM (sans matériel) : de la connaissance, pas un geste — la moitié d'un exercice vérifié. */
export const XP_QUIZ = 6;
/** +5 seulement à ≥ 95 % de précision au premier essai. */
export const XP_SPEED_BONUS = 5;
export const DAILY_XP_CAP = 120;

export const SPEED_THRESHOLD = 0.95;

/** XP d'une tentative, avant plafond journalier. */
export function xpForAttempt(a: Attempt): number {
  const score = scoreOf(a);
  if (!isVerified(a) || score === null) return 0;
  const base = a.kind === 'qcm'
    ? XP_QUIZ
    : a.kind === 'cold'
      ? XP_COLD
      : a.kind === 'transition'
        ? XP_TRANSITION
        : a.level >= 3 ? XP_RECALL : XP_HOLES;
  // le bonus de vitesse ne paie que le geste : un QCM juste ne doit pas rapporter plus qu'une gamme jouée
  const bonus = a.kind !== 'qcm' && score >= SPEED_THRESHOLD ? XP_SPEED_BONUS : 0;
  return Math.round(base * score) + bonus;
}

export interface XpSummary {
  /** XP total, plafond journalier appliqué. */
  total: number;
  /** XP d'aujourd'hui (déjà plafonné). */
  today: number;
  cap: number;
}

export function xpByDay(attempts: readonly Attempt[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of attempts) {
    const xp = xpForAttempt(a);
    if (xp <= 0) continue;
    const k = dayKey(a.ts);
    out.set(k, (out.get(k) ?? 0) + xp);
  }
  for (const [k, v] of out) out.set(k, Math.min(DAILY_XP_CAP, v));
  return out;
}

export function xpSummary(attempts: readonly Attempt[], now: Date): XpSummary {
  const byDay = xpByDay(attempts);
  const total = [...byDay.values()].reduce((s, v) => s + v, 0);
  return { total, today: byDay.get(dayKey(now.getTime())) ?? 0, cap: DAILY_XP_CAP };
}

export interface StreakSummary {
  /** Jours consécutifs avec au moins une tentative (écoute comprise), jusqu'à aujourd'hui ou hier. */
  days: number;
  /** Une activité a-t-elle eu lieu aujourd'hui ? */
  today: boolean;
}

/**
 * Série : on compte les jours d'activité consécutifs. Si rien aujourd'hui mais quelque chose hier,
 * la série est encore vivante (on ne la casse pas à minuit pile avant que l'utilisateur n'ait joué).
 */
export function streak(attempts: readonly Attempt[], now: Date): StreakSummary {
  const days = new Set(attempts.map((a) => dayKey(a.ts)));
  const dayMs = 86_400_000;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const has = (offset: number) => days.has(dayKey(start - offset * dayMs));
  const todayActive = has(0);
  if (!todayActive && !has(1)) return { days: 0, today: false };
  let n = 0;
  let offset = todayActive ? 0 : 1;
  while (has(offset)) {
    n++;
    offset++;
  }
  return { days: n, today: todayActive };
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export interface BadgeContext {
  attempts: readonly Attempt[];
  now: Date;
}

export interface BadgeDef {
  id: string;
  title: string;
  /** Ce que le badge récompense, en une phrase. */
  why: string;
  earned: (ctx: BadgeContext) => boolean;
}

const verifiedOf = (ctx: BadgeContext) => ctx.attempts.filter(isVerified);

export const BADGES: readonly BadgeDef[] = [
  {
    id: 'first-listen',
    title: 'Première écoute',
    why: 'une gamme écoutée en entier',
    earned: (ctx) => ctx.attempts.some((a) => a.kind === 'listen'),
  },
  {
    id: 'first-holes',
    title: 'Premiers trous',
    why: 'un exercice de mémorisation terminé',
    earned: (ctx) => verifiedOf(ctx).some((a) => a.kind === 'holes'),
  },
  {
    id: 'holes-clean',
    title: 'Sans faute',
    why: 'tous les trous justes au premier essai',
    earned: (ctx) => verifiedOf(ctx).some((a) => a.kind === 'holes' && (scoreOf(a) ?? 0) === 1),
  },
  {
    id: 'first-recall',
    title: 'De mémoire',
    why: 'un rappel complet réussi (≥ 80 %)',
    earned: (ctx) => verifiedOf(ctx).some((a) => a.kind === 'recall' && (scoreOf(a) ?? 0) >= PASS),
  },
  {
    id: 'clean-recall',
    title: 'Rappel parfait',
    why: 'un rappel complet sans une seule erreur',
    earned: (ctx) => verifiedOf(ctx).some((a) => a.kind === 'recall' && (scoreOf(a) ?? 0) === 1),
  },
  {
    id: 'two-tonics',
    title: 'Deux toniques',
    why: 'une même forme jouée dans deux toniques',
    earned: (ctx) => summarizeNodes(ctx.attempts).some((n) => n.tonics.length >= 2),
  },
  {
    id: 'three-days',
    title: 'Trois jours d’affilée',
    why: 'trois jours consécutifs de pratique',
    earned: (ctx) => streak(ctx.attempts, ctx.now).days >= 3,
  },
  {
    id: 'week',
    title: 'Une semaine',
    why: 'sept jours consécutifs de pratique',
    earned: (ctx) => streak(ctx.attempts, ctx.now).days >= 7,
  },
];

export interface BadgeStatus {
  id: string;
  title: string;
  why: string;
  earned: boolean;
}

export function badgeStatus(attempts: readonly Attempt[], now: Date): BadgeStatus[] {
  const ctx: BadgeContext = { attempts, now };
  return BADGES.map((b) => ({ id: b.id, title: b.title, why: b.why, earned: b.earned(ctx) }));
}

/** Nœuds distincts travaillés (utile au hub : « 3 formes »). */
export function distinctNodes(attempts: readonly Attempt[]): number {
  return new Set(verifiedOf({ attempts, now: new Date() }).map(nodeIdOf)).size;
}
