/**
 * Session de révision mélangée (interleaving) : 3 à 5 formes **différentes** enchaînées sans repasser par
 * le hub. La littérature sur l'apprentissage moteur est constante : entrelacer coûte plus cher sur le
 * moment et retient mieux que répéter la même forme. L'ordre est calculé depuis le journal :
 *
 *   1. les cartes **dues** (Leitner), la plus ancienne d'abord ;
 *   2. les formes les plus **fragiles** (maîtrise la plus basse) ;
 *   3. celles **vues dans une seule zone** du manche (« tonique à varier »).
 *
 * Deux formes voisines ne se suivent pas quand une alternative existe : c'est tout l'intérêt.
 *
 * **Rappel à froid** (lot « mémoire et vitesse ») : une carte **due** se révise d'abord en N3 sur la
 * position entière en aller-retour, tablature vide, sans revoir la forme. Un N2 se devine en comptant les cases depuis
 * une note voisine : ce n'est pas un rappel. Seul cet essai à froid compte (voir `coldReview.ts`).
 */
import { cardsFrom, dueCards, summarizeNodes, type Attempt, type NodeStats } from '../../core/progress';
import type { ScaleSelection } from '../../app/scaleSession';
import type { PositionSystem } from '../../core/theory';
import type { Segment } from './exercise';
import { positionLabel, resolveScale } from './resolve';

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
  mode: ReviewTarget['mode'] = 'practice', segment: Segment = PRACTICE_SEGMENT,
): ReviewTarget | null {
  const resolved = resolveScale({
    scaleId: node.scaleId,
    tonic: last.tonic,
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
    if (a.module === 'accords' || (a.kind !== 'holes' && a.kind !== 'recall')) continue;
    lastByNode.set(`gam:lecture:${a.scaleId}:${a.system}:${a.formIndex}`, a);
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
    const t = cold
      ? target(node, last, 3, `due · boîte ${card.box} sur 6 · rappel à froid`, 'cold', 'updown')
      : target(node, last, levelFor(card.box), `due · boîte ${card.box} sur 6`);
    if (!t) continue;
    seen.add(card.nodeId);
    picked.push(t);
  }

  // 2. formes fragiles, puis 3. toniques à varier (même liste, la raison change)
  const fragile = [...nodes]
    .filter((n) => !seen.has(n.nodeId))
    .sort((a, b) => a.mastery - b.mastery || a.zones.length - b.zones.length);
  for (const node of fragile) {
    if (picked.length >= max) break;
    const last = lastByNode.get(node.nodeId);
    if (!last) continue;
    const reason = node.zones.length < 3
      ? 'vue dans une seule zone du manche'
      : node.state === 'available' ? 'jamais travaillée' : 'forme la plus fragile';
    const t = target(node, last, 2, reason);
    if (!t) continue;
    seen.add(node.nodeId);
    picked.push(t);
  }

  return interleave(picked).slice(0, max);
}
