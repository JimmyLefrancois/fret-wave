/**
 * Sélection courante dans le module Gammes (gamme, tonique orthographiée, accordage, système, position).
 * Persistée : on retrouve son travail en rouvrant l'app. Toute valeur invalide est **normalisée**
 * (voir `modules/gammes/resolve.ts`), jamais rejetée en bloc.
 */
import { useSyncExternalStore } from 'react';
import type { PositionSystem } from '../core/theory';
import type { KeyValueStore } from '../core/audio/mixer';
import type { Segment } from '../modules/gammes/exercise';

export const SCALE_SELECTION_KEY = 'fretwave.scale.v1';

export interface ScaleSelection {
  scaleId: string;
  /** Tonique orthographiée (modèle anglo, ex. "A", "F#", "Bb"). */
  tonic: string;
  tuningId: string;
  system: PositionSystem;
  /** Rang de la position dans `generatePositions` (0 = la plus basse du manche). */
  positionIndex: number;
  /**
   * Famille affichée dans le choix des gammes (`SCALE_GROUPS`). Une gamme vit dans plusieurs familles
   * (la pentatonique mineure : « Pentatoniques » et « Mineures ») : sans elle, choisir une gamme
   * ramenait à la première famille qui la contient.
   */
  groupId?: string;
}

/** Le point d'entrée pédagogique du module : La mineur pentatonique, box 1 (MUSIC_DESIGN §3.2). */
export const DEFAULT_SELECTION: ScaleSelection = {
  scaleId: 'pentatonic-minor',
  tonic: 'A',
  tuningId: 'standard',
  system: 'boxes',
  positionIndex: 0,
};

const SYSTEMS: PositionSystem[] = ['boxes', '3nps', 'caged', 'symmetric', 'passing-note'];

export function loadScaleSelection(store: KeyValueStore | null): ScaleSelection {
  if (!store) return { ...DEFAULT_SELECTION };
  try {
    const raw = store.getItem(SCALE_SELECTION_KEY);
    if (!raw) return { ...DEFAULT_SELECTION };
    const o = JSON.parse(raw) as Partial<Record<keyof ScaleSelection, unknown>>;
    return {
      scaleId: typeof o.scaleId === 'string' ? o.scaleId : DEFAULT_SELECTION.scaleId,
      tonic: typeof o.tonic === 'string' ? o.tonic : DEFAULT_SELECTION.tonic,
      tuningId: typeof o.tuningId === 'string' ? o.tuningId : DEFAULT_SELECTION.tuningId,
      system: SYSTEMS.includes(o.system as PositionSystem) ? (o.system as PositionSystem) : DEFAULT_SELECTION.system,
      positionIndex: typeof o.positionIndex === 'number' && Number.isFinite(o.positionIndex) ? Math.max(0, Math.round(o.positionIndex)) : 0,
      ...(typeof o.groupId === 'string' ? { groupId: o.groupId } : {}),
    };
  } catch {
    return { ...DEFAULT_SELECTION };
  }
}

function safeStorage(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Départ demandé à l'écran d'entraînement (niveau, découpage) par l'accueil ou le bilan de séance
 * (« Avancer : Position 3, exercice à trous ») : lu à l'ouverture de l'écran, puis effacé.
 */
let pendingStart: { level: 2 | 3; segment: Segment } | null = null;
export function setTrainingStart(start: { level: 2 | 3; segment: Segment } | null): void {
  pendingStart = start;
}
/** Lecture sans effacer (React peut appeler deux fois un initialiseur d'état) ; `clearTrainingStart` ensuite. */
export function peekTrainingStart(): { level: 2 | 3; segment: Segment } | null {
  return pendingStart;
}
export function clearTrainingStart(): void {
  pendingStart = null;
}

let current: ScaleSelection | null = null;
const listeners = new Set<() => void>();
const storage = safeStorage();

export function getScaleSelection(): ScaleSelection {
  current ??= loadScaleSelection(storage);
  return current;
}

export function setScaleSelection(patch: Partial<ScaleSelection>): ScaleSelection {
  const next = { ...getScaleSelection(), ...patch };
  current = next;
  try {
    storage?.setItem(SCALE_SELECTION_KEY, JSON.stringify(next));
  } catch {
    /* stockage plein / interdit : la sélection reste valable pour la session */
  }
  for (const l of listeners) l();
  return next;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useScaleSelection(): ScaleSelection {
  return useSyncExternalStore(subscribe, getScaleSelection, getScaleSelection);
}

/** Remet la sélection par défaut (tests). */
export function resetScaleSelectionForTests(): void {
  current = null;
  listeners.clear();
}
