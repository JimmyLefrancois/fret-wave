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
 *
 * Lot « mémoire et vitesse » (forme de gamme seulement) :
 *  - « apprise » exige en plus une **réussite forte** : la position **entière**, de mémoire (N3, pavé ou
 *    micro) ou jouée au micro (N2). Deux trous comblés sur deux cordes ne disent pas qu'on sait la forme ;
 *  - « maîtrisée » garde ses conditions ; la **vitesse** (`speedVerified`) est prouvée par une série
 *    propre au micro au tempo cible. Sans elle, l'état reste « maîtrisée », affiché « vitesse non
 *    vérifiée » — on ne bloque pas l'élève sans micro, on ne lui certifie rien non plus.
 */
import {
  chordIdOfNode, dayKey, isFullPosition, isProof, isVerified, nodeIdOf, progressionIdOfNode, scoreOf, transitionOfNode, zoneOf, type Attempt,
} from './journal';
import { cardsFrom, type Card } from './scheduler';
import { TUNINGS } from '../theory/tunings';
import { isLiaison } from '../tab/generators';

export const PASS = 0.8;
export const EXCELLENT = 0.95;

/** Médiane (les mesures de temps de changement n'ont pas de moyenne utile : une hésitation suffit). */
export function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

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
  /** Nature du nœud : une forme tenue, un savoir, une transition, une progression, une lecture de gamme. */
  nodeKind: 'gamme' | 'accord' | 'savoir' | 'transition' | 'progression';
  /** Voicing du nœud quand il s'agit d'une forme d'accord (`acc:accord:*`). */
  chordId: string | null;
  /** Paire ordonnée d'une transition (`acc:transition:a>b`). */
  pair: [string, string] | null;
  /** Progression (`acc:progression:*`). */
  progressionId: string | null;
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
  /** Poses à froid réussies **dans la limite** (étape Fixer) — exigées pour un accord. */
  coldPasses: number;
  /** Jours distincts de ces poses à froid. */
  coldDays: number;
  /** Meilleur temps de pose à froid (s), réussi ou non. */
  coldBestSeconds: number | null;
  /** Temps de changement médian mesuré (ms, transitions). */
  changeMs: number | null;
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
  /** Réussites **fortes** (position entière, N3 ou N2 au micro) — exigées pour une forme de gamme. */
  strongSuccesses: number;
  /** Vitesse prouvée : une série propre au micro au tempo cible (forme de gamme seulement). */
  speedVerified: boolean;
  /** État selon les règles d'avant ce lot : sert seulement à expliquer une forme « repassée en apprentissage ». */
  legacyState: NodeState;
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

/**
 * Une **pose à froid** réussie est exigée en plus, depuis la 4b : sans elle, un élève pouvait être
 * déclaré « appris » en posant l'accord lentement six fois de suite, sans jamais savoir le placer en
 * quelques secondes (c'était la demi-promesse de la 4a, §4.6).
 */
export const CHORD_COLD = 1;

/**
 * Un rappel à froid le **même jour** ne compte que s'il vient au moins dix minutes après la première
 * vérification (MUSIC_DESIGN §4.4) : la consolidation motrice demande un intervalle, pas un clic.
 */
export const COLD_SAME_DAY_MIN_MS = 10 * 60_000;

/** Une pose à froid est réussie si elle est propre **et** dans la limite de temps accordée. */
export function isColdPass(a: Attempt): boolean {
  if (a.kind !== 'cold') return false;
  if ((scoreOf(a) ?? 0) < PASS) return false;
  return a.seconds <= (a.limitSec ?? 8);
}

/**
 * Tempo cible de la vitesse, en **BPM de croches** (2 notes par temps) : 80 BPM en croches = 160 notes
 * par minute. Avis de prof : c'est le tempo où une gamme cesse d'être lue note à note et devient un geste,
 * sans exiger la virtuosité. Réglable (60-160).
 */
export const SPEED_TARGET_BPM = 80;
export const SPEED_TARGET_MIN = 60;
export const SPEED_TARGET_MAX = 160;
/** Une série « propre » pour la vitesse : le seuil du bonus de vitesse (95 %). */
export const SPEED_CLEAN = 0.95;
/** Réussites fortes exigées pour qu'une forme de gamme soit « apprise ». */
export const SCALE_STRONG = 1;

/** Série de lecture d'une forme (trous ou rappel), pas une impro, un accord ou une séquence. */
function isFormSeries(a: Attempt): boolean {
  return a.module !== 'accords' && (a.kind === 'holes' || a.kind === 'recall');
}

/** Réussite **forte** : ≥ 80 %, position entière, de mémoire (N3) ou jouée au micro (N2). */
export function isStrongSuccess(a: Attempt): boolean {
  if (!isFormSeries(a) || !isProof(a) || (scoreOf(a) ?? 0) < PASS || !isFullPosition(a)) return false;
  return a.level >= 3 || a.mic === true;
}

/**
 * Preuve de vitesse : un rappel N3 **au micro**, position entière, propre (≥ 95 %), grille **tenue** à un
 * débit d'au moins le tempo cible en croches (`2 × cible` notes par minute) — ou une **séquence** au micro
 * dont le meilleur tempo validé atteint la cible (les séquences sont en croches). Une **liaison** n'en est
 * pas une : elle prouve le passage entre deux formes, pas la vitesse de celle-ci (D111).
 */
export function isSpeedProof(a: Attempt, targetBpm = SPEED_TARGET_BPM): boolean {
  if (a.kind === 'sequence') return a.module !== 'accords' && !isLiaison(a.pattern) && a.mic === true && isProof(a) && (a.bpmBest ?? 0) >= targetBpm;
  if (!isFormSeries(a) || !isProof(a) || a.mic !== true || a.level < 3 || !isFullPosition(a)) return false;
  if ((scoreOf(a) ?? 0) < SPEED_CLEAN || !a.tempoOk) return false;
  return (a.gridNpm ?? 0) >= 2 * targetBpm;
}

export function stateOf(opts: {
  attempts: number; successes: number; successDays: number; last: number; box: number | null;
  /** Seuil de réussites exigé (2 pour une forme de gamme, 3 pour un accord). */
  minSuccesses?: number;
  /** Poses à froid réussies et seuil exigé (un accord seulement). */
  coldPasses?: number;
  minCold?: number;
  /** Réussites fortes et seuil exigé (une forme de gamme seulement). */
  strongSuccesses?: number;
  minStrong?: number;
}): NodeState {
  if (opts.attempts === 0) return 'available';
  const learned = opts.successes >= (opts.minSuccesses ?? 2) && opts.successDays >= 2
    && (opts.coldPasses ?? 0) >= (opts.minCold ?? 0)
    && (opts.strongSuccesses ?? 0) >= (opts.minStrong ?? 0);
  if (!learned) return 'learning';
  if (opts.box !== null && opts.box >= 5 && opts.last >= PASS) return 'mastered';
  return 'learned';
}

/** Nature d'un nœud, déduite de son identifiant (une seule source de vérité : le préfixe). */
export function nodeKindOf(nodeId: string): NodeStats['nodeKind'] {
  if (nodeId.startsWith('acc:transition:')) return 'transition';
  if (nodeId.startsWith('acc:savoir:')) return 'savoir';
  if (nodeId.startsWith('acc:progression:')) return 'progression';
  if (nodeId.startsWith('acc:')) return 'accord';
  return 'gamme';
}

export interface SummaryOptions {
  /** Tempo cible de la vitesse (BPM de croches), réglage de l'élève. */
  speedTargetBpm?: number;
}

/** Nœud de lecture d'une forme auquel une tentative de gamme apporte une preuve (vitesse comprise). */
function lectureKey(a: Attempt): string {
  return `gam:lecture:${a.scaleId}:${a.system}:${a.formIndex}`;
}

export function summarizeNodes(attempts: readonly Attempt[], opts: SummaryOptions = {}): NodeStats[] {
  const target = opts.speedTargetBpm ?? SPEED_TARGET_BPM;
  const cards = new Map(cardsFrom(attempts).map((c) => [c.nodeId, c] as const));
  // la vitesse se prouve aussi sur un autre écran que la lecture (séquences) : on la rattache à la forme
  const speedNodes = new Set(attempts.filter((a) => a.module !== 'accords' && isSpeedProof(a, target)).map(lectureKey));
  const groups = new Map<string, Attempt[]>();
  for (const a of attempts) {
    if (!isProof(a)) continue;
    // une séquence ne fait pas un état de forme : elle n'apporte que la preuve de vitesse (ci-dessus)
    if (a.kind === 'sequence') continue;
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
    const kind = nodeKindOf(nodeId);
    const isChord = kind === 'accord';
    // poses à froid : une réussite le même jour ne compte que dix minutes après la première tentative
    const firstDay = dayKey(first.ts);
    const coldOk = sorted.filter(isColdPass).filter((a) => dayKey(a.ts) !== firstDay || a.ts - first.ts >= COLD_SAME_DAY_MIN_MS);
    const coldTries = sorted.filter((a) => a.kind === 'cold');
    const changeMs = medianOf(sorted.filter((a) => a.kind === 'transition' && typeof a.changeMs === 'number').map((a) => a.changeMs!));
    const stats: NodeStats = {
      nodeId,
      module: nodeId.startsWith('acc:') ? 'accords' : 'gammes',
      nodeKind: kind,
      chordId: chordIdOfNode(nodeId),
      pair: transitionOfNode(nodeId),
      progressionId: progressionIdOfNode(nodeId),
      scaleId: first.scaleId,
      system: first.system,
      formIndex: first.formIndex,
      attempts: sorted.length,
      successes: successAttempts.length,
      successDays,
      coldPasses: coldOk.length,
      coldDays: new Set(coldOk.map((a) => dayKey(a.ts))).size,
      coldBestSeconds: coldTries.length ? Math.min(...coldTries.map((a) => a.seconds)) : null,
      changeMs,
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
      strongSuccesses: sorted.filter(isStrongSuccess).length,
      speedVerified: false,
      legacyState: 'available',
    };
    const isLecture = nodeId.startsWith('gam:lecture:');
    const base = {
      attempts: stats.attempts,
      successes: stats.successes,
      successDays,
      last: stats.last,
      box: stats.box,
      // une forme d'accord exige 3 vérifications propres sur 2 jours (MUSIC_DESIGN §4.6) **et** une
      // pose à froid réussie (4b) ; un savoir (QCM) et une transition gardent le seuil des gammes (2)
      ...(isChord ? { minSuccesses: CHORD_SUCCESSES, coldPasses: stats.coldPasses, minCold: CHORD_COLD } : {}),
    };
    // une forme de gamme exige en plus une réussite forte (position entière, de mémoire ou au micro)
    stats.state = stateOf(isLecture ? { ...base, strongSuccesses: stats.strongSuccesses, minStrong: SCALE_STRONG } : base);
    stats.legacyState = stateOf(base);
    stats.speedVerified = isLecture && speedNodes.has(nodeId);
    out.push(stats);
  }
  return out.sort((a, b) => b.mastery - a.mastery);
}

/** Étiquette d'état : « maîtrisée » ne se dit sans réserve que si la vitesse a été entendue. */
export function stateLabel(n: Pick<NodeStats, 'state' | 'speedVerified' | 'nodeKind'>): string {
  if (n.state === 'mastered' && n.nodeKind === 'gamme' && !n.speedVerified) return `${STATE_LABEL.mastered} (vitesse non vérifiée)`;
  return STATE_LABEL[n.state];
}

/** Ce qui manque à une forme de gamme pour être « apprise » (vide si rien ne manque). */
export type LearnedGap = 'successes' | 'days' | 'strong';
export function learnedGaps(n: Pick<NodeStats, 'successes' | 'successDays' | 'strongSuccesses'>): LearnedGap[] {
  const out: LearnedGap[] = [];
  if (n.successes < 2) out.push('successes');
  if (n.successDays < 2) out.push('days');
  if (n.strongSuccesses < SCALE_STRONG) out.push('strong');
  return out;
}

/**
 * Formes de gamme « apprises » (ou « maîtrisées ») selon les anciennes règles et « en apprentissage »
 * selon les nouvelles : la maîtrise se recalcule depuis le journal, l'écran doit dire pourquoi.
 */
export function regressedForms(nodes: readonly NodeStats[]): NodeStats[] {
  return nodes.filter((n) => n.nodeId.startsWith('gam:lecture:')
    && (n.legacyState === 'learned' || n.legacyState === 'mastered') && n.state === 'learning');
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
  /** Tentatives vérifiées où la corde était **jouée** (un segment de 3 cordes graves n'expose pas les aiguës). */
  exposure: number;
}

/** Cordes jouées par une tentative : un segment « 1/2/3 cordes » couvre les graves, le reste toute la position. */
function exposedStrings(a: Attempt): number[] {
  const all = TUNINGS[a.tuningId]?.strings.length ?? 6;
  const n = (a.kind === 'holes' || a.kind === 'recall') && !isFullPosition(a) ? Math.min(a.strings, all) : all;
  return Array.from({ length: n }, (_, i) => i);
}

/**
 * Diagnostic par corde : agrège les cases manquées. Seules les tentatives vérifiées comptent
 * (une écoute ne dit rien de la main gauche). Trié par **taux** : cases manquées rapportées aux séries où
 * la corde était jouée (`exposure`) ; sans cela, des échauffements sur les cordes graves les désignaient à
 * tort (lot 6 du simulateur).
 */
export function stringWeakness(attempts: readonly Attempt[]): StringWeakness[] {
  const byString = new Map<number, { attempts: number; misses: number }>();
  const exposure = new Map<number, number>();
  for (const a of attempts) {
    if (!isVerified(a)) continue;
    for (const s of exposedStrings(a)) exposure.set(s, (exposure.get(s) ?? 0) + 1);
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
  // une case ratée sur une corde « non jouée » (journal ancien) compte comme exposée
  const rate = (w: StringWeakness) => w.misses / w.exposure;
  return [...byString.entries()]
    .map(([string, v]) => ({ string, ...v, exposure: Math.max(exposure.get(string) ?? 0, v.attempts) }))
    .sort((x, y) => rate(y) - rate(x) || y.misses - x.misses || x.string - y.string);
}
