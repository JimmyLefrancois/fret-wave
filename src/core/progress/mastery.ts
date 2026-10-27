/**
 * Modèle de maîtrise (MUSIC_DESIGN §3.4, §5) : tout est **recalculé depuis le journal**, rien n'est stocké
 * à part les tentatives. Un nœud = une **forme lue dans un mode** (`gam:lecture:scale:system:form`),
 * indépendante de la tonique : la tonique est une preuve séparée, pour éviter de faire réviser 12 fois
 * la même forme (MUSIC_DESIGN §3.1).
 *
 * Seuils (configurables plus tard, constants ici pour être testables) :
 *  - réussite = ≥ 80 % de trous justes **au premier essai** ;
 *  - « appris » = 2 réussites sur **2 jours différents** (une leçon apprise un soir se consolide la nuit) ;
 *  - « maîtrisé » = appris **et** boîte de Leitner ≥ 5 (révision à 16 j tenue) **et** dernière tentative réussie.
 */
import { dayKey, isVerified, nodeIdOf, scoreOf, zoneOf, type Attempt } from './journal';
import { cardsFrom, type Card } from './scheduler';

export const PASS = 0.8;
export const EXCELLENT = 0.95;

/**
 * Poids d'une tentative dans la moyenne récente : une case écrite **de mémoire** (N3) vaut plus qu'un
 * trou comblé dans une tablature lisible (N2), où l'élève peut compter les cases depuis une note voisine.
 */
export function levelWeight(level: Attempt['level']): number {
  return level >= 3 ? 1.5 : 1;
}

export type NodeState = 'available' | 'learning' | 'learned' | 'mastered';

export const STATE_LABEL: Readonly<Record<NodeState, string>> = {
  available: 'jamais travaillée',
  learning: 'en apprentissage',
  learned: 'apprise',
  mastered: 'maîtrisée',
};

export interface NodeStats {
  nodeId: string;
  /** Module du nœud (les deux modules partagent le même modèle de maîtrise). */
  module: 'gammes' | 'accords';
  /** Voicing du nœud quand `module === 'accords'`. */
  chordId: string | null;
  /** Gamme du nœud (module Gammes) ; chaîne vide pour un accord. */
  scaleId: string;
  system: string;
  formIndex: number;
  /** Tentatives vérifiées du nœud. */
  attempts: number;
  /** Réussites (≥ 80 %). */
  successes: number;
  /** Jours distincts où le nœud a été réussi. */
  successDays: number;
  firstTs: number;
  lastTs: number;
  /** Meilleure précision au premier essai. */
  best: number;
  /** Moyenne des trois dernières précisions. */
  recent: number;
  /** Précision de la dernière tentative. */
  last: number;
  /** Toniques travaillées (orthographe modèle) et zones du manche (cases 0-4, 5-9, 10-14 …). */
  tonics: string[];
  zones: number[];
  mastery: number;
  state: NodeState;
  box: number | null;
  due: number | null;
  lastLevel: Attempt['level'];
}

/**
 * Maîtrise 0-1 : la précision compte, mais une forme vue un seul soir ne vaut pas une forme tenue.
 * `weights` (facultatif) pondère la moyenne récente par niveau : N3 pèse 1,5, N2 pèse 1.
 */
export function masteryOf(scores: readonly number[], days: number, weights?: readonly number[]): number {
  if (scores.length === 0) return 0;
  const best = Math.max(...scores);
  const from = Math.max(0, scores.length - 3);
  const recent = scores.slice(from);
  const w = weights ? weights.slice(from) : recent.map(() => 1);
  const wSum = w.reduce((s, v) => s + v, 0) || 1;
  const recentAvg = recent.reduce((s, v, i) => s + v * (w[i] ?? 1), 0) / wSum;
  const coverage = Math.min(1, days / 3);
  return Math.round((0.5 * best + 0.3 * recentAvg + 0.2 * coverage) * 1000) / 1000;
}

/** Moyenne des trois dernières tentatives, pondérée par le niveau. */
function weightedRecent(scores: readonly number[], weights: readonly number[]): number {
  const from = Math.max(0, scores.length - 3);
  const recent = scores.slice(from);
  const w = weights.slice(from);
  const wSum = w.reduce((s, v) => s + v, 0) || 1;
  return recent.reduce((s, v, i) => s + v * (w[i] ?? 1), 0) / wSum;
}

/**
 * Nombre de vérifications propres exigées pour déclarer un accord « appris » (MUSIC_DESIGN §4.6) :
 * trois arpèges propres sur deux jours différents. Moins, c'est valider un hasard — un accord peut
 * tomber juste une fois par chance de doigté.
 */
export const CHORD_SUCCESSES = 3;

export function stateOf(opts: {
  attempts: number; successes: number; successDays: number; last: number; box: number | null;
  /** Seuil de réussites exigé (2 pour une forme de gamme, 3 pour un accord). */
  minSuccesses?: number;
}): NodeState {
  if (opts.attempts === 0) return 'available';
  const learned = opts.successes >= (opts.minSuccesses ?? 2) && opts.successDays >= 2;
  if (!learned) return 'learning';
  if (opts.box !== null && opts.box >= 5 && opts.last >= PASS) return 'mastered';
  return 'learned';
}

export function summarizeNodes(attempts: readonly Attempt[]): NodeStats[] {
  const cards = new Map(cardsFrom(attempts).map((c) => [c.nodeId, c] as const));
  const groups = new Map<string, Attempt[]>();
  for (const a of attempts) {
    if (!isVerified(a)) continue;
    const id = nodeIdOf(a);
    const list = groups.get(id);
    if (list) list.push(a);
    else groups.set(id, [a]);
  }
  const out: NodeStats[] = [];
  for (const [nodeId, list] of groups) {
    const sorted = [...list].sort((x, y) => x.ts - y.ts);
    const scores = sorted.map((a) => scoreOf(a) ?? 0);
    const weights = sorted.map((a) => levelWeight(a.level));
    const successAttempts = sorted.filter((a) => (scoreOf(a) ?? 0) >= PASS);
    const successDays = new Set(successAttempts.map((a) => dayKey(a.ts))).size;
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const card: Card | null = cards.get(nodeId) ?? null;
    const isChord = nodeId.startsWith('acc:');
    const stats: NodeStats = {
      nodeId,
      module: isChord ? 'accords' : 'gammes',
      chordId: isChord ? nodeId.slice('acc:accord:'.length) : null,
      scaleId: first.scaleId,
      system: first.system,
      formIndex: first.formIndex,
      attempts: sorted.length,
      successes: successAttempts.length,
      successDays,
      firstTs: first.ts,
      lastTs: last.ts,
      best: Math.max(...scores),
      recent: weightedRecent(scores, weights),
      last: scores[scores.length - 1]!,
      tonics: [...new Set(sorted.map((a) => a.tonic))],
      zones: [...new Set(sorted.map((a) => zoneOf(a.fretMin)))].sort((x, y) => x - y),
      mastery: masteryOf(scores, successDays, weights),
      state: 'available',
      box: card ? card.box : null,
      due: card ? card.due : null,
      lastLevel: last.level,
    };
    stats.state = stateOf({
      attempts: stats.attempts,
      successes: stats.successes,
      successDays,
      last: stats.last,
      box: stats.box,
      // un accord exige 3 vérifications propres sur 2 jours (MUSIC_DESIGN §4.6) ; une forme de gamme 2
      ...(isChord ? { minSuccesses: CHORD_SUCCESSES } : {}),
    });
    out.push(stats);
  }
  return out.sort((a, b) => b.mastery - a.mastery);
}

export function findNode(nodes: readonly NodeStats[], nodeId: string): NodeStats | null {
  return nodes.find((n) => n.nodeId === nodeId) ?? null;
}

/** Dernière tentative (vérifiée ou non) par nœud : sert à retrouver l'écran et l'étiquette à rouvrir. */
export function lastAttemptByNode(attempts: readonly Attempt[]): Map<string, Attempt> {
  const out = new Map<string, Attempt>();
  for (const a of [...attempts].sort((x, y) => x.ts - y.ts)) {
    if (!isVerified(a)) continue;
    out.set(nodeIdOf(a), a);
  }
  return out;
}

/** Nœuds où la tonique n'a pas encore été rencontrée dans ≥ 3 zones (MUSIC_DESIGN §3.1). */
export function weakTonics(nodes: readonly NodeStats[]): NodeStats[] {
  return nodes.filter((n) => n.zones.length < 3).sort((a, b) => a.zones.length - b.zones.length || b.mastery - a.mastery);
}

export interface StringWeakness {
  /** Index de corde (0 = la plus grave). */
  string: number;
  /** Nombre de tentatives où une case de cette corde a été manquée. */
  attempts: number;
  /** Nombre total de cases manquées sur cette corde. */
  misses: number;
}

/**
 * Diagnostic par corde : agrège les cases manquées. Seules les tentatives vérifiées comptent
 * (une écoute ne dit rien de la main gauche). Trié par nombre de cases manquées.
 */
export function stringWeakness(attempts: readonly Attempt[]): StringWeakness[] {
  const byString = new Map<number, { attempts: number; misses: number }>();
  for (const a of attempts) {
    if (!isVerified(a)) continue;
    for (const s of a.missedStrings) {
      const cur = byString.get(s) ?? { attempts: 0, misses: 0 };
      cur.misses += 1;
      byString.set(s, cur);
    }
    for (const s of new Set(a.missedStrings)) {
      const cur = byString.get(s)!;
      cur.attempts += 1;
    }
  }
  return [...byString.entries()]
    .map(([string, v]) => ({ string, ...v }))
    .sort((x, y) => y.misses - x.misses || x.string - y.string);
}
