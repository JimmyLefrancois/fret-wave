/**
 * Sélection courante du module Accords (phase 4a) : l'accord ouvert dans la leçon.
 * Persistée comme la sélection de gamme : on retrouve son travail en rouvrant l'app.
 */
import { useSyncExternalStore } from 'react';
import type { KeyValueStore } from '../core/audio/mixer';

export const CHORD_SELECTION_KEY = 'fretwave.chord.v1';

export interface ChordSelection {
  /** Identifiant de voicing (`src/data/voicings.ts`), ex. « Em-022000 ». */
  voicingId: string;
  /** Palier du curriculum (affichage seul ; le curriculum reste la source). */
  palier: string;
}

export const DEFAULT_CHORD_SELECTION: ChordSelection = { voicingId: 'Em-022000', palier: 'P1' };

export function loadChordSelection(store: KeyValueStore | null): ChordSelection {
  if (!store) return { ...DEFAULT_CHORD_SELECTION };
  try {
    const raw = store.getItem(CHORD_SELECTION_KEY);
    if (!raw) return { ...DEFAULT_CHORD_SELECTION };
    const o = JSON.parse(raw) as Partial<Record<keyof ChordSelection, unknown>>;
    return {
      voicingId: typeof o.voicingId === 'string' && o.voicingId ? o.voicingId : DEFAULT_CHORD_SELECTION.voicingId,
      palier: typeof o.palier === 'string' ? o.palier : DEFAULT_CHORD_SELECTION.palier,
    };
  } catch {
    return { ...DEFAULT_CHORD_SELECTION };
  }
}

function safeStorage(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

let current: ChordSelection | null = null;
const listeners = new Set<() => void>();
const storage = safeStorage();

export function getChordSelection(): ChordSelection {
  current ??= loadChordSelection(storage);
  return current;
}

export function setChordSelection(patch: Partial<ChordSelection>): ChordSelection {
  const next = { ...getChordSelection(), ...patch };
  current = next;
  try {
    storage?.setItem(CHORD_SELECTION_KEY, JSON.stringify(next));
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

export function useChordSelection(): ChordSelection {
  return useSyncExternalStore(subscribe, getChordSelection, getChordSelection);
}

export function resetChordSelectionForTests(): void {
  current = null;
  listeners.clear();
}

// ---------------------------------------------------------------------------
// Étape demandée à l'ouverture de la leçon (D106)
// ---------------------------------------------------------------------------

/**
 * Un lien peut ouvrir la leçon sur une étape précise (le bloc « Changer d'accord » mène à Enchaîner).
 * La demande ne sert **qu'une fois** : rouvrir la leçon ensuite repart de Découvrir, comme avant.
 * Pas persistée : c'est une intention de navigation, pas un réglage.
 */
let pendingStep: string | null = null;

export function requestLessonStep(step: string): void {
  pendingStep = step;
}

/** Lue à l'initialisation de la page (le mode strict de React appelle l'initialiseur deux fois :
 *  la lecture ne consomme pas), puis effacée par `clearLessonStep` au montage. */
export function pendingLessonStep(): string | null {
  return pendingStep;
}

export function clearLessonStep(): void {
  pendingStep = null;
}
