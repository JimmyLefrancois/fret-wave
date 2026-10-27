/**
 * Réglages globaux de l'app (notation, thème, animations, scanlines) — persistés dans localStorage,
 * lecture tolérante : une valeur absente, illisible ou inconnue retombe sur le défaut, jamais d'exception.
 * Les volumes audio ne sont pas ici : ils vivent dans `core/audio/mixer` (réglages du moteur).
 */
import { useSyncExternalStore } from 'react';
import type { ChordNotation, NoteNotation } from '../core/theory';
import type { KeyValueStore } from '../core/audio/mixer';
import { DEFAULT_THEME, THEMES } from '../core/themes/registry';

export const SETTINGS_KEY = 'fretwave.settings.v1';

export interface AppSettings {
  theme: string;
  noteNotation: NoteNotation;
  chordNotation: ChordNotation;
  /** « Réduire les animations » : grille figée, pas de pulsation, pas de particules. */
  reduceMotion: boolean;
  /** Scanlines CRT sur la scène (jamais sur le panneau de tablature). */
  scanlines: boolean;
  /** Rangée de degrés sous la tablature (niveau 1). */
  showDegreeRow: boolean;
  /** Part des notes masquées au niveau 2 (20 / 35 / 50 %). */
  holeRate: HoleRate;
  /** Tempo de la grille de l'exercice (un clic par trou), en BPM. */
  trainingTempo: number;
}

/** Taux de trous du niveau 2 : trois crans, pas un curseur continu. */
export type HoleRate = 0.2 | 0.35 | 0.5;
export const HOLE_RATES: readonly HoleRate[] = [0.2, 0.35, 0.5];
export const MIN_TEMPO = 30;
export const MAX_TEMPO = 120;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: DEFAULT_THEME,
  noteNotation: 'fr',
  chordNotation: 'en',
  reduceMotion: false,
  scanlines: true,
  showDegreeRow: true,
  holeRate: 0.35,
  trainingTempo: 50,
};

const NOTATIONS: NoteNotation[] = ['fr', 'en'];
const CHORD_NOTATIONS: ChordNotation[] = ['en', 'fr', 'jazz'];

export function loadAppSettings(store: KeyValueStore | null): AppSettings {
  const out: AppSettings = { ...DEFAULT_SETTINGS };
  if (!store) return out;
  try {
    const raw = store.getItem(SETTINGS_KEY);
    if (!raw) return out;
    const o = JSON.parse(raw) as Partial<Record<keyof AppSettings, unknown>>;
    if (typeof o.theme === 'string' && THEMES[o.theme]) out.theme = o.theme;
    if (NOTATIONS.includes(o.noteNotation as NoteNotation)) out.noteNotation = o.noteNotation as NoteNotation;
    if (CHORD_NOTATIONS.includes(o.chordNotation as ChordNotation)) out.chordNotation = o.chordNotation as ChordNotation;
    if (typeof o.reduceMotion === 'boolean') out.reduceMotion = o.reduceMotion;
    if (typeof o.scanlines === 'boolean') out.scanlines = o.scanlines;
    if (typeof o.showDegreeRow === 'boolean') out.showDegreeRow = o.showDegreeRow;
    if (HOLE_RATES.includes(o.holeRate as HoleRate)) out.holeRate = o.holeRate as HoleRate;
    if (typeof o.trainingTempo === 'number' && Number.isFinite(o.trainingTempo)) {
      out.trainingTempo = Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, Math.round(o.trainingTempo)));
    }
  } catch {
    /* JSON cassé : on garde les défauts */
  }
  return out;
}

export function saveAppSettings(store: KeyValueStore | null, s: AppSettings): void {
  if (!store) return;
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* stockage plein ou interdit : le réglage reste valable pour la session */
  }
}

// ---------------------------------------------------------------------------
// Petit magasin observable (pas de dépendance d'état globale)
// ---------------------------------------------------------------------------

function safeStorage(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

let current: AppSettings | null = null;
const listeners = new Set<() => void>();
const storage = safeStorage();

export function getSettings(): AppSettings {
  current ??= loadAppSettings(storage);
  return current;
}

export function setSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...patch };
  current = next;
  saveAppSettings(storage, next);
  for (const l of listeners) l();
  return next;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Lit les réglages dans un composant React (re-rendu à chaque changement). */
export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}

/** Réinitialise le magasin (tests). */
export function resetSettingsForTests(): void {
  current = null;
  listeners.clear();
}
