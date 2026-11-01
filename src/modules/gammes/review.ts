/**
 * Séance de révision : 1 à 5 formes **différentes** enchaînées. La littérature sur l'apprentissage moteur est
 * constante : entrelacer coûte plus cher sur le moment et retient mieux que répéter la même forme. La file
 * est calculée depuis le journal : les cartes **dues** (Leitner), la plus ancienne d'abord. Deux formes
 * voisines ne se suivent pas quand une alternative existe.
 *
 * **Rappel à froid** (lot « mémoire et vitesse ») : une forme se révise sur la position entière en
 * aller-retour, tablature vide, sans la revoir. Seul cet essai à froid compte (voir `coldReview.ts`).
 *
 * **Tonique de révision** (D97, MUSIC_DESIGN §3.1 et G1.4) : une fois que la gamme a 2 toniques
 * travaillées, le rappel à froid d'une forme apprise ou maîtrisée se fait un rang sur deux dans une
 * autre tonique, qui place la forme dans une zone du manche jamais vue. La raison le dit.
 *
 * **Réviser cette forme** (D128) : la page Découvrir lance un rappel à froid sur la forme ouverte. Comme
 * toute tentative de rappel, sa première série crée la carte Leitner de la forme.
 */
import {
  DAY, DUE_CAP, cardsFrom, dayKey, dueCards, isFullPosition, nodeIdOf, summarizeNodes, type Attempt, type Card, type NodeStats,
} from '../../core/progress';
import type { ScaleSelection } from '../../app/scaleSession';
import { fmtNote, type NoteName, type PositionSystem } from '../../core/theory';
import { degreesOf, positionLabel, resolveScale } from './resolve';
import { unseenZoneTonic } from './transpose';

export interface ReviewTarget {
  selection: ScaleSelection;
  /** Pourquoi cette forme est proposée (affiché). */
  reason: string;
  title: string;
  positionLabel: string;
  nodeId: string;
  /** Lancée depuis la page Découvrir, qu'elle soit due ou non. */
  asked?: true;
}

/** Plafond par défaut : 5 formes, assez pour une session de 10 minutes. */
export const REVIEW_MAX = 5;

function target(
  node: NodeStats, tuningId: string, reason: string, tonic: NoteName,
): ReviewTarget | null {
  const resolved = resolveScale({
    scaleId: node.scaleId,
    tonic,
    tuningId,
    system: node.system as PositionSystem,
    positionIndex: 0,
  });
  const index = resolved.positions.findIndex((p) => (p.formIndex ?? p.index) === node.formIndex);
  if (index < 0) return null;
  return {
    selection: {
      scaleId: node.scaleId,
      tonic: resolved.tonic,
      tuningId: resolved.tuning.id,
      system: resolved.selection.system,
      positionIndex: index,
    },
    reason,
    title: resolved.title,
    positionLabel: positionLabel(resolved.positions[index] ?? null),
    nodeId: node.nodeId,
  };
}

/** Réordonne pour éviter deux formes de la même gamme et du même système à la suite. */
function interleave(items: ReviewTarget[]): ReviewTarget[] {
  const out: ReviewTarget[] = [];
  const pool = [...items];
  let prev = '';
  while (pool.length) {
    const key = (t: ReviewTarget) => `${t.selection.scaleId}|${t.selection.system}`;
    const idx = pool.findIndex((t) => key(t) !== prev);
    const [next] = pool.splice(idx < 0 ? 0 : idx, 1);
    out.push(next!);
    prev = key(next!);
  }
  return out;
}

/** Série de lecture d'une forme de gamme (trous ou rappel), pas une impro ni un accord. */
function isLectureSeries(a: Attempt): boolean {
  return a.module !== 'accords' && (a.kind === 'holes' || a.kind === 'recall');
}

const lectureId = (a: Attempt) => `gam:lecture:${a.scaleId}:${a.system}:${a.formIndex}`;

/** Cartes de lecture de gammes dues (ce que la séance rappelle à froid), la plus ancienne d'abord. */
export function dueReviewCards(attempts: readonly Attempt[], now: number): Card[] {
  return dueCards(cardsFrom(attempts), now).filter((c) => c.nodeId.startsWith('gam:lecture:'));
}

/** Formes rappelées à froid le jour de `now` : premier essai N3 sur la position entière (pas un rattrapage). */
export function coldToday(attempts: readonly Attempt[], now: number): Set<string> {
  const key = dayKey(now);
  const out = new Set<string>();
  for (const a of attempts) {
    if (isLectureSeries(a) && a.kind === 'recall' && a.level >= 3 && isFullPosition(a)
      && !a.afterReveal && a.correct !== null && dayKey(a.ts) === key) out.add(lectureId(a));
  }
  return out;
}

/**
 * Cartes dues **à réviser aujourd'hui** : une forme déjà rappelée à froid aujourd'hui sort de la séance
 * jusqu'à demain (Q1, D98), même si Leitner la dit due (palier 1 = 10 min). Affichage seul : les
 * échéances ne changent pas.
 */
export function dueToday(attempts: readonly Attempt[], now: number, cold = coldToday(attempts, now)): Card[] {
  return dueReviewCards(attempts, now).filter((c) => !cold.has(c.nodeId));
}

/** Ce que Gammes annonce : les formes dues aujourd'hui, `DUE_CAP` au plus (une absence ne crée pas de dette). */
export function reviewCount(attempts: readonly Attempt[], now: number): number {
  return Math.min(dueToday(attempts, now).length, DUE_CAP);
}

/**
 * Ce que le bilan de séance propose encore (« Encore 3 formes dues ») : les dues restantes, sans dépasser
 * `DUE_CAP` rappels à froid dans la journée.
 */
export function moreDue(attempts: readonly Attempt[], now: number): number {
  const cold = coldToday(attempts, now);
  return Math.max(0, Math.min(dueToday(attempts, now, cold).length, DUE_CAP - cold.size));
}

/** « Do m », « Sol » : la tonique et, pour une gamme mineure, son « m ». */
function keyName(scale: ReturnType<typeof resolveScale>): string {
  return `${fmtNote(scale.tonic)}${degreesOf(scale.def).includes('b3') ? ' m' : ''}`;
}

export function buildReviewQueue(attempts: readonly Attempt[], now: number, max = REVIEW_MAX): ReviewTarget[] {
  const nodes = summarizeNodes(attempts);
  const byId = new Map(nodes.map((n) => [n.nodeId, n] as const));
  const lastByNode = new Map<string, Attempt>();
  for (const a of [...attempts].sort((x, y) => x.ts - y.ts)) {
    if (a.correct === null || a.total === null) continue;
    // seules les séries de lecture d'une forme : une prise d'impro ou un accord ne rouvrent pas une forme
    if (!isLectureSeries(a)) continue;
    lastByNode.set(lectureId(a), a);
  }
  // toniques travaillées par gamme : à partir de 2, la transposition est débloquée (G1.4)
  const tonicsOf = new Map<string, Set<string>>();
  for (const n of nodes) {
    const set = tonicsOf.get(n.scaleId) ?? new Set<string>();
    for (const t of n.tonics) set.add(t);
    tonicsOf.set(n.scaleId, set);
  }
  const picked: ReviewTarget[] = [];
  for (const card of dueToday(attempts, now)) {
    if (picked.length >= max) break;
    const node = byId.get(card.nodeId);
    const last = lastByNode.get(card.nodeId);
    if (!node || !last) continue;
    let t: ReviewTarget | null = null;
    const known = node.state === 'learned' || node.state === 'mastered';
    if (known && (tonicsOf.get(node.scaleId)?.size ?? 0) >= 2 && card.reps % 2 === 0) {
      // un rang sur deux : même dessin, autre case (une zone du manche que la forme n'a jamais vue)
      const tonic = unseenZoneTonic(node.scaleId, node.system as PositionSystem, node.formIndex, last.tuningId, node.zones, node.tonics);
      if (tonic) {
        t = target(node, last.tuningId, '', tonic);
        const pos = t ? resolveScale(t.selection).position : null;
        if (t && pos) t.reason = `même dessin, autre case : en ${keyName(resolveScale(t.selection))}, cases ${pos.fretMin}–${pos.fretMax}`;
        else t = null;
      }
    }
    t ??= target(node, last.tuningId, `palier ${card.box} sur 6`, last.tonic);
    if (t) picked.push(t);
  }
  return interleave(picked).slice(0, max);
}

/** La forme ouverte, à réviser à la demande. `null` si aucune position n'existe pour cette sélection. */
export function formReviewTarget(selection: ScaleSelection): ReviewTarget | null {
  const resolved = resolveScale(selection);
  const position = resolved.position;
  if (!position) return null;
  return {
    selection: {
      scaleId: resolved.def.id,
      tonic: resolved.tonic,
      tuningId: resolved.tuning.id,
      system: resolved.selection.system,
      positionIndex: resolved.selection.positionIndex,
    },
    reason: 'à ta demande',
    title: resolved.title,
    positionLabel: positionLabel(position),
    nodeId: nodeIdOf({ scaleId: resolved.def.id, system: resolved.selection.system, formIndex: position.formIndex ?? position.index }),
    asked: true,
  };
}

export interface ReviewSummary {
  /** Formes de la prochaine séance, dans l'ordre. */
  forms: ReviewTarget[];
  /** Formes dues aujourd'hui (`DUE_CAP` au plus), parfois plus nombreuses que celles d'une séance. */
  count: number;
  /** Prochaine échéance quand rien n'est dû ; `null` si aucune forme n'est suivie. */
  nextDue: number | null;
}

/** Début du jour local qui suit `now`, à l'heure près d'un changement d'heure : assez juste pour un délai affiché. */
function nextDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + DAY;
}

/** Ce que le bloc « À réviser » de la page Gammes affiche. */
export function reviewSummary(attempts: readonly Attempt[], now: number): ReviewSummary {
  const forms = buildReviewQueue(attempts, now);
  const count = reviewCount(attempts, now);
  const lecture = cardsFrom(attempts).filter((c) => c.nodeId.startsWith('gam:lecture:'));
  // une carte due déjà rappelée à froid aujourd'hui attend demain
  const waiting = lecture.map((c) => (c.due > now ? c.due : nextDay(now)));
  return { forms, count, nextDue: forms.length === 0 && waiting.length > 0 ? Math.min(...waiting) : null };
}

/** « révision dans 3 jours » : l'échéance d'une forme, arrondie pour être lue d'un coup d'œil. */
export function reviewDelayText(ms: number): string {
  if (ms <= 0) return 'à réviser maintenant';
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `révision dans ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `révision dans ${h} h`;
  const d = Math.round(h / 24);
  return `révision dans ${d} jour${d > 1 ? 's' : ''}`;
}

/**
 * « 2 sur 5 · Position 3 · à rafraîchir » : où en est la séance et pourquoi cette forme (panneau de séance,
 * constat 14).
 */
export function sessionFact(index: number, count: number, t: ReviewTarget): string {
  const kind = t.asked ? 'à ta demande' : t.reason.startsWith('même dessin') ? 'même dessin, autre case' : 'à rafraîchir';
  return `${index + 1} sur ${count} · ${t.positionLabel.split(' · ')[0]} · ${kind}`;
}
