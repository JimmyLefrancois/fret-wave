/**
 * Réglages de l'entrée audio (phase 3) : périphérique, seuils et latence **par source**
 * (micro du téléphone / interface USB), tolérance de justesse, La de référence.
 *
 * Persistés dans localStorage, lecture tolérante : une valeur absente, illisible ou hors plage
 * retombe sur le défaut, jamais d'exception (même contrat que `app/settings.ts`).
 *
 * Pourquoi des seuils par source : un micro de téléphone capte la pièce et filtre les graves
 * (RMS utile plus faible, plancher de bruit plus haut) ; une Focusrite en direct donne 15-20 dB
 * de plus et un bruit de fond très bas. Un seuil unique rendrait l'un des deux inutilisable.
 */
import { useSyncExternalStore } from 'react';
import type { KeyValueStore } from '../audio/mixer';

export const INPUT_SETTINGS_KEY = 'fretwave.input.v1';

export type InputSource = 'mic' | 'usb';

export const INPUT_SOURCES: readonly { value: InputSource; label: string; hint: string }[] = [
  { value: 'mic', label: 'Micro', hint: 'micro du téléphone ou de l’ordinateur' },
  { value: 'usb', label: 'Interface USB', hint: 'Focusrite et autres cartes son (signal plus propre)' },
];

export interface InputSettings {
  /** `null` = périphérique par défaut du navigateur. */
  deviceId: string | null;
  source: InputSource;
  /** Seuil de détection (dBFS, RMS) : en dessous, l'app considère qu'il n'y a pas de note. */
  thresholds: Record<InputSource, number>;
  /** Latence aller-retour **mesurée** (ms), 0 = non mesurée. */
  latencies: Record<InputSource, number>;
  /** Clarté minimale de `pitchy` (0-1) : en dessous, la note n'est pas jugée. */
  clarityMin: number;
  /** Tolérance d'accord (cents) pour valider une case. */
  centsTolerance: number;
  /** La de référence (Hz). */
  a4: number;
}

export const THRESHOLD_MIN = -80;
export const THRESHOLD_MAX = -10;
export const CLARITY_MIN = 0.5;
export const CLARITY_MAX = 0.98;
export const CENTS_MIN = 10;
export const CENTS_MAX = 60;
export const A4_MIN = 415;
export const A4_MAX = 445;
export const LATENCY_MAX = 500;

export const DEFAULT_INPUT_SETTINGS: InputSettings = {
  deviceId: null,
  source: 'mic',
  // −42 dBFS : au-dessus du bruit d'une pièce calme, en dessous d'une corde pincée doucement au micro
  thresholds: { mic: -42, usb: -36 },
  latencies: { mic: 0, usb: 0 },
  clarityMin: 0.9,
  centsTolerance: 35,
  a4: 440,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function loadInputSettings(store: KeyValueStore | null): InputSettings {
  const out: InputSettings = { ...DEFAULT_INPUT_SETTINGS, thresholds: { ...DEFAULT_INPUT_SETTINGS.thresholds }, latencies: { ...DEFAULT_INPUT_SETTINGS.latencies } };
  if (!store) return out;
  try {
    const raw = store.getItem(INPUT_SETTINGS_KEY);
    if (!raw) return out;
    const o = JSON.parse(raw) as Partial<Record<keyof InputSettings, unknown>>;
    if (typeof o.deviceId === 'string' && o.deviceId.length > 0) out.deviceId = o.deviceId;
    if (o.source === 'mic' || o.source === 'usb') out.source = o.source;
    const t = o.thresholds as Partial<Record<InputSource, unknown>> | undefined;
    for (const s of ['mic', 'usb'] as const) {
      const v = t?.[s];
      if (typeof v === 'number' && Number.isFinite(v)) out.thresholds[s] = clamp(Math.round(v), THRESHOLD_MIN, THRESHOLD_MAX);
    }
    const l = o.latencies as Partial<Record<InputSource, unknown>> | undefined;
    for (const s of ['mic', 'usb'] as const) {
      const v = l?.[s];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out.latencies[s] = clamp(Math.round(v), 0, LATENCY_MAX);
    }
    if (typeof o.clarityMin === 'number' && Number.isFinite(o.clarityMin)) out.clarityMin = clamp(o.clarityMin, CLARITY_MIN, CLARITY_MAX);
    if (typeof o.centsTolerance === 'number' && Number.isFinite(o.centsTolerance)) out.centsTolerance = clamp(Math.round(o.centsTolerance), CENTS_MIN, CENTS_MAX);
    if (typeof o.a4 === 'number' && Number.isFinite(o.a4)) out.a4 = clamp(Math.round(o.a4), A4_MIN, A4_MAX);
  } catch {
    /* JSON cassé : on garde les défauts */
  }
  return out;
}

export function saveInputSettings(store: KeyValueStore | null, s: InputSettings): void {
  if (!store) return;
  try {
    store.setItem(INPUT_SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* stockage plein ou interdit : le réglage reste valable pour la session */
  }
}

// ---------------------------------------------------------------------------
// Magasin observable (même forme que `app/settings.ts`)
// ---------------------------------------------------------------------------

function safeStorage(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

let current: InputSettings | null = null;
const listeners = new Set<() => void>();
const storage = safeStorage();

export function getInputSettings(): InputSettings {
  current ??= loadInputSettings(storage);
  return current;
}

export function setInputSettings(patch: Partial<InputSettings>): InputSettings {
  const base = getInputSettings();
  const next: InputSettings = {
    ...base,
    ...patch,
    thresholds: { ...base.thresholds, ...(patch.thresholds ?? {}) },
    latencies: { ...base.latencies, ...(patch.latencies ?? {}) },
  };
  next.thresholds.mic = clamp(next.thresholds.mic, THRESHOLD_MIN, THRESHOLD_MAX);
  next.thresholds.usb = clamp(next.thresholds.usb, THRESHOLD_MIN, THRESHOLD_MAX);
  next.clarityMin = clamp(next.clarityMin, CLARITY_MIN, CLARITY_MAX);
  next.centsTolerance = clamp(next.centsTolerance, CENTS_MIN, CENTS_MAX);
  next.a4 = clamp(next.a4, A4_MIN, A4_MAX);
  current = next;
  saveInputSettings(storage, next);
  for (const l of listeners) l();
  return next;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useInputSettings(): InputSettings {
  return useSyncExternalStore(subscribe, getInputSettings, getInputSettings);
}

/** Réinitialise le magasin (tests). */
export function resetInputSettingsForTests(): void {
  current = null;
  listeners.clear();
}
