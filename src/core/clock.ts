/**
 * Horloge de l'app : `Date.now()` plus un **décalage de développement** (voyage dans le temps du
 * simulateur, `src/dev/`). En production le décalage vaut toujours 0 : la clé n'est même pas lue.
 *
 * Tout ce qui horodate une tentative ou juge « aujourd'hui » (journal, révisions dues, série, XP du jour)
 * lit l'heure ici ; les chronos internes (`performance.now`, durées d'écoute) n'en ont pas besoin.
 */
import type { KeyValueStore } from './audio/mixer';

export const CLOCK_OFFSET_KEY = 'fretwave.dev.clockOffset';

let offset: number | null = null;

function safeStorage(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Décalage lu dans le stockage ; une valeur absente ou illisible vaut 0. */
export function readClockOffset(store: KeyValueStore | null): number {
  const raw = store?.getItem(CLOCK_OFFSET_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Décalage courant (ms). Toujours 0 hors développement. */
export function clockOffset(): number {
  if (!import.meta.env.DEV) return 0;
  if (offset === null) offset = readClockOffset(safeStorage());
  return offset;
}

/** Fixe le décalage (développement seulement) et le persiste : il survit au rechargement de la page. */
export function setClockOffset(ms: number): void {
  if (!import.meta.env.DEV) return;
  offset = Math.round(ms);
  safeStorage()?.setItem(CLOCK_OFFSET_KEY, String(offset));
}

export function now(): number {
  return Date.now() + clockOffset();
}

export function nowDate(): Date {
  return new Date(now());
}
