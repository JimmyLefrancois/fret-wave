/**
 * Réglages globaux de l'app (notation, thème, animations, scanlines) — persistés dans localStorage,
 * lecture tolérante : une valeur absente, illisible ou inconnue retombe sur le défaut, jamais d'exception.
 * Les volumes audio ne sont pas ici : ils vivent dans `core/audio/mixer` (réglages du moteur).
 */
import { useSyncExternalStore } from 'react';
import type { ChordNotation, NoteNotation } from '../core/theory';
import type { KeyValueStore } from '../core/audio/mixer';
import { DEFAULT_THEME, THEMES, getTheme } from '../core/themes/registry';
import type { ThemeTokens } from '../core/themes/tokens';
import { DEFAULT_LOOK_SECONDS, LOOK_SECONDS, type LookSeconds } from '../modules/gammes/coldReview';
import { GRID_TEMPO_MAX, GRID_TEMPO_MIN, type GridSubdivision } from '../modules/gammes/exercise';
import { SPEED_TARGET_BPM, SPEED_TARGET_MAX, SPEED_TARGET_MIN } from '../core/progress/mastery';

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
  /** Tempo de la grille de l'exercice (un clic par temps), en BPM. */
  trainingTempo: number;
  /** Notes par temps de la grille : 1 (noires, défaut) ou 2 (croches, pour viser la vitesse). */
  gridSubdivision: GridSubdivision;
  /** Tempo cible de la vitesse (« maîtrisée »), en BPM de croches. */
  speedTargetBpm: number;
  /**
   * Boîte d'accord dans les étapes « Découvrir » et « Construire » du module Accords (D1 = B).
   * Désactivable : la tablature seule reste la règle par défaut du brief.
   */
  showChordBox: boolean;
  /**
   * Rappel à froid en révision : une carte due se révise d'abord en N3 sur la position entière, sans
   * revoir la forme (MUSIC_DESIGN §5). Désactivable : la révision reprend alors le choix de la phase 2.
   */
  coldReview: boolean;
  /** Durée de l'écran « Regarde la forme » après un rappel à froid manqué (s). */
  lookSeconds: LookSeconds;
}

/** Taux de trous du niveau 2 : trois crans, pas un curseur continu. */
export type HoleRate = 0.2 | 0.35 | 0.5;
export const HOLE_RATES: readonly HoleRate[] = [0.2, 0.35, 0.5];
export const MIN_TEMPO = GRID_TEMPO_MIN;
export const MAX_TEMPO = GRID_TEMPO_MAX;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: DEFAULT_THEME,
  noteNotation: 'fr',
  chordNotation: 'en',
  reduceMotion: false,
  scanlines: true,
  showDegreeRow: true,
  holeRate: 0.35,
  trainingTempo: 50,
  gridSubdivision: 1,
  speedTargetBpm: SPEED_TARGET_BPM,
  showChordBox: true,
  coldReview: true,
  lookSeconds: DEFAULT_LOOK_SECONDS,
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
    if (typeof o.showChordBox === 'boolean') out.showChordBox = o.showChordBox;
    if (typeof o.coldReview === 'boolean') out.coldReview = o.coldReview;
    if (LOOK_SECONDS.includes(o.lookSeconds as LookSeconds)) out.lookSeconds = o.lookSeconds as LookSeconds;
    if (HOLE_RATES.includes(o.holeRate as HoleRate)) out.holeRate = o.holeRate as HoleRate;
    if (typeof o.trainingTempo === 'number' && Number.isFinite(o.trainingTempo)) {
      out.trainingTempo = Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, Math.round(o.trainingTempo)));
    }
    if (o.gridSubdivision === 1 || o.gridSubdivision === 2) out.gridSubdivision = o.gridSubdivision;
    if (typeof o.speedTargetBpm === 'number' && Number.isFinite(o.speedTargetBpm)) {
      out.speedTargetBpm = Math.max(SPEED_TARGET_MIN, Math.min(SPEED_TARGET_MAX, Math.round(o.speedTargetBpm)));
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
/**
 * Jetons du thème actif. Indispensable aux rendus **canvas** (tablature, boîte d'accord) : le DOM suit
 * les variables CSS, mais un canvas doit recevoir ses couleurs en arguments — les coder en dur a
 * longtemps figé la tablature sur le thème sombre.
 */
export function useThemeTokens(): ThemeTokens {
  return getTheme(useSettings().theme);
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}

/** Réinitialise le magasin (tests). */
export function resetSettingsForTests(): void {
  current = null;
  listeners.clear();
}
