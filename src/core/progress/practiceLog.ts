/**
 * Journal de pratique local (début du modèle de progression de la phase 2, journal d'événements).
 * La 1d n'a ni XP ni répétition espacée : on se contente d'**enregistrer ce qui a réellement été écouté**
 * (gamme, tonique, système, position, durée) pour que le hub affiche des chiffres vrais, pas des décors.
 */
import type { KeyValueStore } from '../audio/mixer';

export const PRACTICE_KEY = 'fretwave.practice.v1';
/** Au-delà, les plus anciennes entrées tombent (localStorage n'est pas une base de données). */
export const PRACTICE_CAP = 400;

export interface PracticeEntry {
  /** Date en ms. */
  ts: number;
  scaleId: string;
  /** Tonique orthographiée (modèle anglo, ex. "A"). */
  tonic: string;
  system: string;
  positionId: string;
  /** Durée réellement écoutée, en secondes. */
  seconds: number;
}

export function readLog(store: KeyValueStore | null): PracticeEntry[] {
  if (!store) return [];
  try {
    const raw = store.getItem(PRACTICE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { v?: unknown; entries?: unknown };
    if (!Array.isArray(parsed.entries)) return [];
    return parsed.entries.filter(
      (e): e is PracticeEntry =>
        !!e && typeof e === 'object' && typeof (e as PracticeEntry).ts === 'number'
          && typeof (e as PracticeEntry).scaleId === 'string' && typeof (e as PracticeEntry).tonic === 'string',
    );
  } catch {
    return [];
  }
}

export function writeLog(store: KeyValueStore | null, entries: readonly PracticeEntry[]): void {
  if (!store) return;
  try {
    store.setItem(PRACTICE_KEY, JSON.stringify({ v: 1, entries: entries.slice(-PRACTICE_CAP) }));
  } catch {
    /* stockage plein / interdit : on perd l'entrée, jamais l'app */
  }
}

export function logPractice(store: KeyValueStore | null, entry: PracticeEntry): PracticeEntry[] {
  const next = [...readLog(store), entry].slice(-PRACTICE_CAP);
  writeLog(store, next);
  return next;
}

/** Minuit local du jour de `d` (les journées sont locales, comme l'utilisateur). */
export function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface DaySummary {
  /** Nombre d'écoutes aujourd'hui. */
  count: number;
  /** Gammes distinctes (gamme + tonique + position) écoutées aujourd'hui. */
  distinct: number;
  /** Secondes cumulées aujourd'hui. */
  seconds: number;
  /** Clés distinctes, dans l'ordre de première écoute (plus récentes en tête). */
  keys: string[];
}

export function summarizeDay(entries: readonly PracticeEntry[], now: Date): DaySummary {
  const today = dayKey(now.getTime());
  const mine = entries.filter((e) => dayKey(e.ts) === today);
  const keys: string[] = [];
  for (const e of [...mine].reverse()) {
    const k = `${e.scaleId}@${e.tonic}:${e.positionId}`;
    if (!keys.includes(k)) keys.push(k);
  }
  return {
    count: mine.length,
    distinct: keys.length,
    seconds: mine.reduce((s, e) => s + (Number.isFinite(e.seconds) ? e.seconds : 0), 0),
    keys,
  };
}

export function lastEntry(entries: readonly PracticeEntry[]): PracticeEntry | null {
  return entries.length ? entries[entries.length - 1]! : null;
}

/** Accès localStorage tolérant (navigation privée stricte, quota) : null si indisponible. */
export function practiceStore(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
