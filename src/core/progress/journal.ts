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

export { dayKey } from './practiceLog';

export const ATTEMPTS_KEY = 'fretwave.attempts.v1';
export const ATTEMPT_CAP = 2000;

export type AttemptKind = 'listen' | 'holes' | 'recall';
export const ATTEMPT_KINDS: readonly AttemptKind[] = ['listen', 'holes', 'recall'];

/** Niveaux du module Gammes (MUSIC_DESIGN §3.4) : 1 découverte, 2 mémorisation, 3 rappel. */
export type AttemptLevel = 1 | 2 | 3;

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
}

export function zoneOf(fret: number): number {
  return Math.max(0, Math.min(4, Math.floor(Math.max(0, fret) / 5)));
}

/** Nœud de progression : une **forme lue dans un mode**, indépendante de la tonique. */
export function nodeIdOf(a: Pick<Attempt, 'scaleId' | 'system' | 'formIndex'>): string {
  return `gam:lecture:${a.scaleId}:${a.system}:${a.formIndex}`;
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
    level: a.level === 2 || a.level === 3 ? a.level : 1,
    strings: typeof a.strings === 'number' ? Math.max(1, Math.round(a.strings)) : 6,
    correct,
    total,
    seconds: Number.isFinite(a.seconds) ? Math.max(0, Math.round(a.seconds)) : 0,
    fretMin: Math.max(0, Math.round(a.fretMin)),
    missedStrings: Array.isArray(a.missedStrings)
      ? [...new Set(a.missedStrings.filter((s): s is number => typeof s === 'number' && Number.isInteger(s) && s >= 0 && s < 8))]
      : [],
    tempoOk: a.tempoOk === true,
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
