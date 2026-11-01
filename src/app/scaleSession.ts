/**
 * Sélection courante dans le module Gammes (gamme, tonique orthographiée, accordage, système, position).
 * Persistée : on retrouve son travail en rouvrant l'app. Toute valeur invalide est **normalisée**
 * (voir `modules/gammes/resolve.ts`), jamais rejetée en bloc.
 */
import { useSyncExternalStore } from 'react';
import type { PositionSystem } from '../core/theory';
import type { KeyValueStore } from '../core/audio/mixer';

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

/** La gamme ouverte par défaut : La mineur pentatonique, box 1 (MUSIC_DESIGN §3.2). */
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
 * « Réviser cette forme » : la page Révision ouvre la forme courante au lieu de la file du jour.
 * Lue à l'ouverture de la page, puis effacée.
 */
let formReview = false;
export function requestFormReview(): void {
  formReview = true;
}
/** Lecture sans effacer (React peut appeler deux fois un initialiseur d'état) ; `clearFormReview` ensuite. */
export function peekFormReview(): boolean {
  return formReview;
}
export function clearFormReview(): void {
  formReview = false;
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

/** Demande d'ouvrir les séquences sur les liaisons, lue une seule fois par la page. */
let liaisonWanted = false;
export function requestLiaison(): void { liaisonWanted = true; }
export function takeLiaisonRequest(): boolean {
  const wanted = liaisonWanted;
  liaisonWanted = false;
  return wanted;
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
