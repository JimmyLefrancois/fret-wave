/**
 * Journal de progression de la phase 2 : une **tentative** = un événement horodaté, jamais un agrégat.
 * Tout le reste (maîtrise, boîtes de révision, XP, séries, badges) se **recalcule** depuis ce journal :
 * on peut donc changer la formule ou l'algorithme sans perdre l'historique.
 *
 * Choix assumé (D25) : localStorage plafonné à 2 000 tentatives, et non IndexedDB.
 * Mesure : une tentative pèse ≈ 190 octets de JSON → 2 000 ≈ 380 ko, très en dessous du quota (~5 Mo)
 * et survivant à la purge iOS qui vise IndexedDB. Le jour où l'entrée audio produira des événements
 * beaucoup plus nombreux (phase 3), un `ProgressBackend` asynchrone prendra le relais.
 */
import { dayKey, readLog, type PracticeEntry } from './practiceLog';
import type { KeyValueStore } from '../audio/mixer';
import { SEQUENCE_PATTERNS, type SequencePattern } from '../tab/generators';

export { dayKey } from './practiceLog';

export const ATTEMPTS_KEY = 'fretwave.attempts.v1';
export const ATTEMPT_CAP = 2000;

/**
 * Genres de tentative. `listen` est une écoute (non vérifiée), `holes` / `recall` sont les exercices du
 * module Gammes, `arpeggio` la vérification corde par corde du module Accords (phase 4a), `strum`
 * l'auto-évaluation d'un accord plaqué — **déclarée, jamais vérifiée** tant que la phase 5 n'a pas
 * l'analyse polyphonique.
 *
 * Phase 4b : `cold` (pose à froid chronométrée, étape Fixer), `transition` (enchaînement mesuré, étape
 * Enchaîner) et `qcm` (reconnaissance sans instrument, statut **savoir**, jamais une preuve de geste).
 *
 * Phase 5 : `pluck` — un accord **plaqué écouté** (analyse polyphonique). C'est la première tentative du
 * module Accords qui porte un vrai verdict sur six cordes à la fois ; `strum` reste la déclaration.
 *
 * Phase 7 : `impro` — une **prise d'improvisation** sur un accompagnement. `correct`/`total` y valent
 * les notes d'accord sur le total joué : c'est un taux, pas un exercice réussi ou raté, et il vit sur un
 * nœud distinct (`gam:impro:…`) pour ne pas se mêler à la justesse d'une forme jouée note à note.
 *
 * Lot « mémoire et vitesse » : `sequence` — une **session de palier** de séquences (par 3, par 4, tierces,
 * quartes) : une tentative par session, jamais une par passe. Nœud `gam:sequence:…` : la séquence nourrit
 * la **vitesse** d'une forme, jamais « apprise » ni la révision espacée (la tablature y est visible).
 */
export type AttemptKind = 'listen' | 'holes' | 'recall' | 'arpeggio' | 'strum' | 'cold' | 'transition' | 'qcm' | 'pluck' | 'impro' | 'sequence';
export const ATTEMPT_KINDS: readonly AttemptKind[] = ['listen', 'holes', 'recall', 'arpeggio', 'strum', 'cold', 'transition', 'qcm', 'pluck', 'impro', 'sequence'];

/** Module d'appartenance d'une tentative. Absent = module Gammes (tentatives des phases 2-3). */
export type AttemptModule = 'gammes' | 'accords';

/**
 * Niveaux du module Gammes (MUSIC_DESIGN §3.4) : 1 découverte, 2 mémorisation, 3 rappel, **4 improvisation**
 * (phase 7 — une prise sur accompagnement, qui ne se mesure pas comme une forme jouée note à note).
 */
export type AttemptLevel = 1 | 2 | 3 | 4;

export interface Attempt {
  /** Identifiant stable (sert à dédupliquer un import). */
  id: string;
  ts: number;
  kind: AttemptKind;
  scaleId: string;
  /** Tonique orthographiée (anglo, ex. « A », « F# »). */
  tonic: string;
  tuningId: string;
  system: string;
  positionId: string;
  /** Identité de la forme, indépendante de la tonique (MUSIC_DESIGN §3.1). */
  formIndex: number;
  level: AttemptLevel;
  /** Nombre de cordes couvertes par le segment (découpage de l'entraînement). */
  strings: number;
  /** Réponses justes **au premier essai** ; `null` pour une écoute (non vérifiée). */
  correct: number | null;
  /** Nombre de trous posés ; `null` pour une écoute. */
  total: number | null;
  seconds: number;
  /** Première case de la position (zone du manche, MUSIC_DESIGN §3.1). */
  fretMin: number;
  /**
   * Cordes où une case a été manquée (premier essai faux ou case révélée).
   * Sert au diagnostic par corde (« tu rates souvent la corde de Si ») sans stocker chaque réponse.
   */
  missedStrings: number[];
  /** La grille rythmique a-t-elle été tenue (série finie dans le temps du métronome) ? */
  tempoOk: boolean;
  /**
   * Confiance de l'écoute polyphonique (0-1) pour une tentative `pluck`. Absent pour tout le reste :
   * une déclaration n'a pas de confiance, elle a une parole.
   */
  confidence?: number;
  /** Module d'appartenance (absent = gammes, compatibilité avec les tentatives des phases 2-3). */
  module?: AttemptModule;
  /**
   * Voicing de l'accord travaillé (module Accords) : c'est l'identité du nœud de progression
   * (`acc:accord:{chordId}`). Une forme d'accord se révise une fois, quelle que soit la session.
   */
  chordId?: string;
  /**
   * Deuxième accord d'une **transition** (étape Enchaîner) : le nœud devient
   * `acc:transition:{chordId}>{chordIdB}` — une paire ordonnée, comme le prévoit MUSIC_DESIGN §5.
   */
  chordIdB?: string;
  /** Progression travaillée (étape Intégrer) : nœud `acc:progression:{id}`. */
  progressionId?: string;
  /** Pose à froid : temps accordé au premier son (secondes). Sert à juger la passe, jamais à la décrire. */
  limitSec?: number;
  /** Transition : temps de changement **médian** mesuré (ms). Le détail par changement n'est pas stocké. */
  changeMs?: number;
  /**
   * Essai fait **juste après avoir revu la forme** (rattrapage du rappel à froid, « refaire » en révision) :
   * vérifié, donc compté comme pratique du jour, mais exclu de Leitner, de la maîtrise et de l'XP — un
   * essai réussi la réponse sous les yeux ne prouve rien (MUSIC_DESIGN §5).
   */
  afterReveal?: true;
  /**
   * Série validée **au micro** : toutes les cases trouvées l'ont été en jouant, aucune au pavé. Absent sur
   * les tentatives d'avant ce champ : « inconnu », donc traité comme non joué (on ne réécrit rien).
   */
  mic?: true;
  /** La série couvrait la **position entière** (montée ou aller-retour), pas un segment de cordes. */
  fullPosition?: true;
  /**
   * Débit nominal de la grille rythmique lancée pendant la série, en **notes par minute** (tempo ×
   * notes par temps). Absent sans grille. Sert à juger la vitesse (« maîtrisée »), avec `tempoOk`.
   */
  gridNpm?: number;
  /** Série jouée **à l'aveugle** : aucune tablature dessinée pendant le jeu, verdict à la fin seulement. */
  blind?: true;
  /** Séquence : motif travaillé. */
  pattern?: SequencePattern;
  /** Séquence : tempo de départ de la session (BPM de croches). */
  bpmStart?: number;
  /** Séquence : meilleur tempo **validé** (deux passes propres et en place d'affilée), absent si aucun. */
  bpmBest?: number;
  /** Séquence : nombre de passes jouées dans la session. */
  passes?: number;
}

export function zoneOf(fret: number): number {
  return Math.max(0, Math.min(4, Math.floor(Math.max(0, fret) / 5)));
}

/** Nœud de progression : une **forme lue dans un mode**, indépendante de la tonique. */
export function nodeIdOf(
  a: Pick<Attempt, 'scaleId' | 'system' | 'formIndex'>
    & { chordId?: string; module?: AttemptModule; kind?: AttemptKind; chordIdB?: string; progressionId?: string },
): string {
  // l'improvisation est une compétence à part : elle ne doit pas doper ni plomber la maîtrise d'une forme
  if (a.kind === 'impro') return `gam:impro:${a.scaleId}:${a.system}:${a.formIndex}`;
  // une séquence se joue tablature visible : elle prouve la vitesse, pas la mémoire de la forme
  if (a.kind === 'sequence') return `gam:sequence:${a.scaleId}:${a.system}:${a.formIndex}`;
  if (a.module === 'accords' || a.chordId || a.progressionId || a.chordIdB) {
    // une progression et une transition sont des compétences à part entière : elles ne se confondent
    // ni avec un accord seul ni entre elles (MUSIC_DESIGN §4.7, trois axes séparés)
    if (a.progressionId) return `acc:progression:${a.progressionId}`;
    if (a.chordIdB) return `acc:transition:${a.chordId ?? a.scaleId}>${a.chordIdB}`;
    // le QCM est une connaissance : nœud distinct, il ne rend jamais un accord « appris » (geste)
    if (a.kind === 'qcm') return `acc:savoir:${a.chordId ?? a.scaleId}`;
    return `acc:accord:${a.chordId ?? a.scaleId}`;
  }
  return `gam:lecture:${a.scaleId}:${a.system}:${a.formIndex}`;
}

/** Le nœud appartient-il au module Accords ? (le hub et les écrans de gamme filtrent dessus) */
export function isChordNode(nodeId: string): boolean {
  return nodeId.startsWith('acc:');
}

/** Voicing d'un nœud d'**accord** (forme tenue), ou `null` pour un nœud de transition, de savoir, etc. */
export function chordIdOfNode(nodeId: string): string | null {
  return nodeId.startsWith('acc:accord:') ? nodeId.slice('acc:accord:'.length) : null;
}

/** Voicing dont le nœud décrit le **savoir** (QCM), ou `null`. */
export function savoirIdOfNode(nodeId: string): string | null {
  return nodeId.startsWith('acc:savoir:') ? nodeId.slice('acc:savoir:'.length) : null;
}

/** Paire ordonnée d'un nœud de transition, ou `null`. */
export function transitionOfNode(nodeId: string): [string, string] | null {
  if (!nodeId.startsWith('acc:transition:')) return null;
  const body = nodeId.slice('acc:transition:'.length);
  const i = body.indexOf('>');
  if (i <= 0) return null;
  return [body.slice(0, i), body.slice(i + 1)];
}

/** Progression d'un nœud `acc:progression:*`, ou `null`. */
export function progressionIdOfNode(nodeId: string): string | null {
  return nodeId.startsWith('acc:progression:') ? nodeId.slice('acc:progression:'.length) : null;
}

/** Part d'un nœud qui reste à expliquer : la tonique (preuve séparée). */
export function tonicKey(a: Pick<Attempt, 'tonic'>): string {
  return a.tonic;
}

export function scoreOf(a: Pick<Attempt, 'correct' | 'total'>): number | null {
  if (a.correct === null || a.total === null || a.total <= 0) return null;
  return Math.max(0, Math.min(1, a.correct / a.total));
}

export function isVerified(a: Pick<Attempt, 'correct' | 'total'>): boolean {
  return scoreOf(a) !== null;
}

/**
 * Tentative qui vaut **preuve** : vérifiée, et pas faite juste après avoir revu la réponse. C'est le filtre
 * de Leitner, de la maîtrise et de l'XP ; la série et l'objectif du jour gardent `isVerified` (un
 * rattrapage est de la pratique réelle, pas une preuve de mémoire).
 */
export function isProof(a: Pick<Attempt, 'correct' | 'total' | 'afterReveal'>): boolean {
  return isVerified(a) && a.afterReveal !== true;
}

export function newAttemptId(ts: number, nodeId: string, seq: number): string {
  return `${ts}-${seq}-${hash32(nodeId).toString(36)}`;
}

/** FNV-1a 32 bits : identifiants courts et reproductibles (pas de `Math.random` dans les données). */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Lecture / écriture tolérantes
// ---------------------------------------------------------------------------

function isAttempt(v: unknown): v is Attempt {
  if (!v || typeof v !== 'object') return false;
  const a = v as Partial<Attempt>;
  return typeof a.id === 'string'
    && typeof a.ts === 'number' && Number.isFinite(a.ts)
    && ATTEMPT_KINDS.includes(a.kind as AttemptKind)
    && typeof a.scaleId === 'string'
    && typeof a.tonic === 'string'
    && typeof a.system === 'string'
    && typeof a.formIndex === 'number'
    && typeof a.fretMin === 'number';
}

/** Normalise une tentative venue du stockage ou d'un import (valeurs bornées, jamais d'exception). */
export function normalizeAttempt(v: unknown): Attempt | null {
  if (!isAttempt(v)) return null;
  const a = v;
  const total = a.total === null || typeof a.total !== 'number' ? null : Math.max(0, Math.round(a.total));
  const correct = a.correct === null || typeof a.correct !== 'number' || total === null
    ? null
    : Math.max(0, Math.min(total, Math.round(a.correct)));
  return {
    id: a.id,
    ts: Math.round(a.ts),
    kind: a.kind,
    scaleId: a.scaleId,
    tonic: a.tonic,
    tuningId: typeof a.tuningId === 'string' ? a.tuningId : 'standard',
    system: a.system,
    positionId: typeof a.positionId === 'string' ? a.positionId : '',
    formIndex: Math.round(a.formIndex),
    level: a.level === 2 || a.level === 3 || a.level === 4 ? a.level : 1,
    strings: typeof a.strings === 'number' ? Math.max(1, Math.round(a.strings)) : 6,
    correct,
    total,
    seconds: Number.isFinite(a.seconds) ? Math.max(0, Math.round(a.seconds)) : 0,
    fretMin: Math.max(0, Math.round(a.fretMin)),
    missedStrings: Array.isArray(a.missedStrings)
      ? [...new Set(a.missedStrings.filter((s): s is number => typeof s === 'number' && Number.isInteger(s) && s >= 0 && s < 8))]
      : [],
    tempoOk: a.tempoOk === true,
    ...(a.module === 'accords' || a.module === 'gammes' ? { module: a.module } : {}),
    ...(typeof a.chordId === 'string' && a.chordId ? { chordId: a.chordId } : {}),
    ...(typeof a.chordIdB === 'string' && a.chordIdB ? { chordIdB: a.chordIdB } : {}),
    ...(typeof a.progressionId === 'string' && a.progressionId ? { progressionId: a.progressionId } : {}),
    // une limite de pose à froid hors de 1-60 s n'est pas une mesure : on la préfère absente à fausse
    ...(typeof a.limitSec === 'number' && Number.isFinite(a.limitSec) && a.limitSec >= 1 && a.limitSec <= 60
      ? { limitSec: Math.round(a.limitSec) } : {}),
    ...(typeof a.changeMs === 'number' && Number.isFinite(a.changeMs) && a.changeMs > 0 && a.changeMs <= 60_000
      ? { changeMs: Math.round(a.changeMs) } : {}),
    // confiance d'une écoute polyphonique : hors de 0-1, ce n'est pas une mesure — on la préfère absente
    ...(typeof a.confidence === 'number' && Number.isFinite(a.confidence) && a.confidence >= 0 && a.confidence <= 1
      ? { confidence: Math.round(a.confidence * 1000) / 1000 } : {}),
    ...(a.afterReveal === true ? { afterReveal: true as const } : {}),
    ...(a.mic === true ? { mic: true as const } : {}),
    ...(a.fullPosition === true ? { fullPosition: true as const } : {}),
    ...(a.blind === true ? { blind: true as const } : {}),
    // un débit hors de 20-400 notes/min n'est pas une grille de l'app : absent plutôt que faux
    ...(typeof a.gridNpm === 'number' && Number.isFinite(a.gridNpm) && a.gridNpm >= 20 && a.gridNpm <= 400
      ? { gridNpm: Math.round(a.gridNpm) } : {}),
    ...(SEQUENCE_PATTERNS.includes(a.pattern as SequencePattern) ? { pattern: a.pattern } : {}),
    // tempos de séquence hors des bornes du palier (40-200) : absents plutôt que faux
    ...(typeof a.bpmStart === 'number' && Number.isFinite(a.bpmStart) && a.bpmStart >= 40 && a.bpmStart <= 200
      ? { bpmStart: Math.round(a.bpmStart) } : {}),
    ...(typeof a.bpmBest === 'number' && Number.isFinite(a.bpmBest) && a.bpmBest >= 40 && a.bpmBest <= 200
      ? { bpmBest: Math.round(a.bpmBest) } : {}),
    ...(typeof a.passes === 'number' && Number.isFinite(a.passes) && a.passes >= 0 && a.passes <= 10_000
      ? { passes: Math.round(a.passes) } : {}),
  };
}

export function readAttempts(store: KeyValueStore | null): Attempt[] {
  if (!store) return [];
  try {
    const raw = store.getItem(ATTEMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { v?: unknown; attempts?: unknown };
    if (!Array.isArray(parsed.attempts)) return [];
    return parsed.attempts.map(normalizeAttempt).filter((a): a is Attempt => a !== null);
  } catch {
    return [];
  }
}

export function writeAttempts(store: KeyValueStore | null, list: readonly Attempt[]): void {
  if (!store) return;
  try {
    store.setItem(ATTEMPTS_KEY, JSON.stringify({ v: 1, attempts: list.slice(-ATTEMPT_CAP) }));
  } catch {
    /* quota / navigation privée : on perd l'écriture, jamais l'app */
  }
}

/** Une écoute de la 1d devient une tentative non vérifiée : rien ne se perd, rien n'est inventé. */
export function fromLegacyEntry(e: PracticeEntry, i: number): Attempt {
  return {
    id: `legacy-${e.ts}-${i}`,
    ts: e.ts,
    kind: 'listen',
    scaleId: e.scaleId,
    tonic: e.tonic,
    tuningId: 'standard',
    system: e.system,
    positionId: e.positionId,
    formIndex: -1,
    level: 1,
    strings: 6,
    correct: null,
    total: null,
    seconds: Number.isFinite(e.seconds) ? Math.max(0, Math.round(e.seconds)) : 0,
    fretMin: 0,
    missedStrings: [],
    tempoOk: false,
  };
}

/**
 * Journal complet : les tentatives de la phase 2, plus — **une seule fois** — la migration du journal
 * d'écoute de la 1d. La clé d'origine n'est pas effacée (retour arrière possible).
 */
export function loadJournal(store: KeyValueStore | null): Attempt[] {
  if (!store) return [];
  const current = readAttempts(store);
  const raw = (() => {
    try {
      return store.getItem(ATTEMPTS_KEY);
    } catch {
      return null;
    }
  })();
  if (raw !== null) return current;
  const legacy = readLog(store).map(fromLegacyEntry);
  if (legacy.length) writeAttempts(store, legacy);
  return legacy;
}

export function appendAttempt(store: KeyValueStore | null, attempt: Attempt): Attempt[] {
  const next = [...readAttempts(store), normalizeAttempt(attempt)].filter((a): a is Attempt => a !== null);
  writeAttempts(store, next);
  return next;
}

// ---------------------------------------------------------------------------
// Résumés de journée (les journées sont locales, comme l'utilisateur)
// ---------------------------------------------------------------------------

export interface DaySummary {
  /** Écoutes (non vérifiées) aujourd'hui. */
  listens: number;
  /** Exercices vérifiés aujourd'hui (trous + rappel). */
  exercises: number;
  /** Trous justes au premier essai aujourd'hui. */
  correct: number;
  /** Trous posés aujourd'hui. */
  holes: number;
  seconds: number;
  /** Nœuds distincts travaillés aujourd'hui. */
  nodes: number;
  /** Précision du jour (0-1), `null` sans exercice vérifié. */
  accuracy: number | null;
  /** Accords plaqués **auto-déclarés** (non vérifiés) : une activité, jamais une preuve. */
  selfAssessed: number;
  /** Poses à froid vérifiées aujourd'hui (étape Fixer). */
  coldPoses: number;
  /** Changements d'accord mesurés aujourd'hui (étape Enchaîner). */
  transitions: number;
}

export function summarizeDay(attempts: readonly Attempt[], now: Date): DaySummary {
  const today = dayKey(now.getTime());
  const mine = attempts.filter((a) => dayKey(a.ts) === today);
  const verified = mine.filter(isVerified);
  const correct = verified.reduce((s, a) => s + (a.correct ?? 0), 0);
  const holes = verified.reduce((s, a) => s + (a.total ?? 0), 0);
  return {
    listens: mine.filter((a) => a.kind === 'listen').length,
    exercises: verified.length,
    correct,
    holes,
    seconds: mine.reduce((s, a) => s + a.seconds, 0),
    nodes: new Set(mine.map(nodeIdOf)).size,
    accuracy: holes > 0 ? correct / holes : null,
    selfAssessed: mine.filter((a) => a.kind === 'strum').length,
    coldPoses: mine.filter((a) => a.kind === 'cold' && isVerified(a)).length,
    transitions: mine.filter((a) => a.kind === 'transition' && isVerified(a)).length,
  };
}

export function lastAttempt(attempts: readonly Attempt[]): Attempt | null {
  return attempts.length ? attempts[attempts.length - 1]! : null;
}

/** Accès localStorage tolérant (navigation privée stricte, quota) : null si indisponible. */
export function progressStore(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
