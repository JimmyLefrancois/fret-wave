/**
 * Session de révision mélangée (interleaving) : 3 à 5 formes **différentes** enchaînées sans repasser par
 * le hub. La littérature sur l'apprentissage moteur est constante : entrelacer coûte plus cher sur le
 * moment et retient mieux que répéter la même forme. L'ordre est calculé depuis le journal :
 *
 *   1. les cartes **dues** (Leitner), la plus ancienne d'abord ;
 *   2. en complément, les formes **en apprentissage** pas encore rappelées à froid aujourd'hui, la plus
 *      fragile d'abord. Une forme apprise ou maîtrisée non due n'y entre jamais (D97).
 *
 * Deux formes voisines ne se suivent pas quand une alternative existe : c'est tout l'intérêt.
 *
 * **Rappel à froid** (lot « mémoire et vitesse ») : une carte **due** se révise d'abord en N3 sur la
 * position entière en aller-retour, tablature vide, sans revoir la forme. Un N2 se devine en comptant les cases depuis
 * une note voisine : ce n'est pas un rappel. Seul cet essai à froid compte (voir `coldReview.ts`).
 *
 * **Tonique de révision** (D97, MUSIC_DESIGN §3.1 et G1.4) : une fois que la gamme a 2 toniques
 * travaillées, le rappel à froid d'une forme apprise ou maîtrisée se fait un rang sur deux dans une
 * autre tonique, qui place la forme dans une zone du manche jamais vue. La raison le dit.
 */
import {
  DUE_CAP, cardsFrom, dayKey, dueCards, isFullPosition, summarizeNodes, type Attempt, type Card, type NodeStats,
} from '../../core/progress';
import type { ScaleSelection } from '../../app/scaleSession';
import { fmtNote, type NoteName, type PositionSystem } from '../../core/theory';
import type { Segment } from './exercise';
import { degreesOf, positionLabel, resolveScale } from './resolve';
import { missingText } from './curriculum';
import { unseenZoneTonic } from './transpose';

export interface ReviewTarget {
  selection: ScaleSelection;
  level: 2 | 3;
  /** `cold` : essai à froid (N3, position entière, rien revu avant) ; `practice` : exercice ordinaire. */
  mode: 'cold' | 'practice';
  /** Découpage imposé par la révision (le rappel à froid porte sur toute la position). */
  segment: Segment;
  /** Pourquoi cette forme est proposée (affiché). */
  reason: string;
  title: string;
  positionLabel: string;
  nodeId: string;
}

/** Plafond par défaut : 5 formes, assez pour une session de 10 minutes. */
export const REVIEW_MAX = 5;

/** Découpage d'une révision ordinaire : le défaut de l'écran, la position entière en aller-retour. */
export const PRACTICE_SEGMENT: Segment = 'updown';

export interface ReviewOptions {
  /** Rappel à froid des cartes dues (réglage, activé par défaut). */
  cold?: boolean;
}

function levelFor(box: number | null): 2 | 3 {
  // boîte 1-2 : on rappelle avec les notes visibles ; à partir de la boîte 3, on écrit de mémoire
  return box !== null && box >= 3 ? 3 : 2;
}

function target(
  node: NodeStats, last: Attempt, level: 2 | 3, reason: string,
  mode: ReviewTarget['mode'] = 'practice', segment: Segment = PRACTICE_SEGMENT, tonic: NoteName = last.tonic,
): ReviewTarget | null {
  const resolved = resolveScale({
    scaleId: node.scaleId,
    tonic,
    tuningId: last.tuningId,
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
    level,
    mode,
    segment,
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

/** Rappel à froid de la forme le jour de `now` : premier essai N3 sur la position entière (pas un rattrapage). */
export function triedColdToday(attempts: readonly Attempt[], nodeId: string, now: number): boolean {
  const key = dayKey(now);
  return attempts.some((a) => isLectureSeries(a) && a.kind === 'recall' && a.level >= 3 && isFullPosition(a)
    && !a.afterReveal && a.correct !== null && dayKey(a.ts) === key && lectureId(a) === nodeId);
}

/** Ce que l'accueil annonce : les formes dues, `DUE_CAP` au plus (une absence ne crée pas de dette). */
export function reviewCount(attempts: readonly Attempt[], now: number): number {
  return Math.min(dueReviewCards(attempts, now).length, DUE_CAP);
}

/**
 * Ce que le bilan de séance propose encore (« Encore 3 formes dues ») : les dues restantes, sans dépasser
 * `DUE_CAP` rappels à froid dans la journée.
 */
export function moreDue(attempts: readonly Attempt[], now: number): number {
  const key = dayKey(now);
  const coldToday = new Set(attempts.filter((a) => dayKey(a.ts) === key).map(lectureId)
    .filter((id) => triedColdToday(attempts, id, now))).size;
  return Math.max(0, Math.min(dueReviewCards(attempts, now).length, DUE_CAP - coldToday));
}

/** « Do m », « Sol » : la tonique et, pour une gamme mineure, son « m ». */
function keyName(scale: ReturnType<typeof resolveScale>): string {
  return `${fmtNote(scale.tonic)}${degreesOf(scale.def).includes('b3') ? ' m' : ''}`;
}

export function buildReviewQueue(
  attempts: readonly Attempt[], now: number, max = REVIEW_MAX, opts: ReviewOptions = {},
): ReviewTarget[] {
  const cold = opts.cold ?? true;
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
    if (!n.nodeId.startsWith('gam:lecture:')) continue;
    const set = tonicsOf.get(n.scaleId) ?? new Set<string>();
    for (const t of n.tonics) set.add(t);
    tonicsOf.set(n.scaleId, set);
  }
  const seen = new Set<string>();
  const picked: ReviewTarget[] = [];

  // 1. cartes dues
  for (const card of dueCards(cardsFrom(attempts), now)) {
    if (seen.has(card.nodeId) || picked.length >= max) continue;
    const node = byId.get(card.nodeId);
    const last = lastByNode.get(card.nodeId);
    if (!node || !last) continue;
    // la forme a déjà été travaillée (sinon pas de carte) : à froid, de mémoire, sur toute la position
    let t: ReviewTarget | null = null;
    const known = node.state === 'learned' || node.state === 'mastered';
    if (cold && known && (tonicsOf.get(node.scaleId)?.size ?? 0) >= 2 && card.reps % 2 === 0) {
      // un rang sur deux : même dessin, autre case (une zone du manche que la forme n'a jamais vue)
      const tonic = unseenZoneTonic(node.scaleId, node.system as PositionSystem, node.formIndex, last.tuningId, node.zones, node.tonics);
      if (tonic) {
        t = target(node, last, 3, '', 'cold', 'updown', tonic);
        const pos = t ? resolveScale(t.selection).position : null;
        if (t && pos) t.reason = `même dessin, autre case : en ${keyName(resolveScale(t.selection))}, cases ${pos.fretMin}–${pos.fretMax}`;
        else t = null;
      }
    }
    t ??= cold
      ? target(node, last, 3, `à revoir · palier ${card.box} sur 6 · rappel à froid`, 'cold', 'updown')
      : target(node, last, levelFor(card.box), `à revoir · palier ${card.box} sur 6`);
    if (!t) continue;
    seen.add(card.nodeId);
    picked.push(t);
  }

  // 2. complément : formes en apprentissage pas encore rappelées à froid aujourd'hui, la plus fragile d'abord
  const learning = nodes
    .filter((n) => n.state === 'learning' && !seen.has(n.nodeId) && !triedColdToday(attempts, n.nodeId, now))
    .sort((a, b) => a.mastery - b.mastery);
  for (const node of learning) {
    if (picked.length >= max) break;
    const last = lastByNode.get(node.nodeId);
    if (!last) continue;
    const gaps = missingText(node);
    const t = target(node, last, 2, gaps ? `en apprentissage · il manque ${gaps}` : 'en apprentissage');
    if (!t) continue;
    seen.add(node.nodeId);
    picked.push(t);
  }

  return interleave(picked).slice(0, max);
}
