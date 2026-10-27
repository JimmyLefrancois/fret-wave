/**
 * Accordage guidé corde par corde (P4 de la phase 3, livré en 4b).
 *
 * Pourquoi ce n'est pas un gadget : la validation d'un accord au micro compare une **hauteur**. Une
 * guitare à −20 cents fait donc échouer des notes justes, et l'élève croit que ses doigts sont faux.
 * L'accordeur existait depuis la phase 3 ; il manquait l'**enchaînement** — les six cordes dans
 * l'ordre, une à la fois, avec un état qui avance tout seul et un souvenir de quand on l'a fait.
 *
 * Le critère « juste » est volontairement plus serré que la tolérance d'exercice (5 cents contre 35) :
 * on accorde une corde avant de jouer, on ne la juge pas pendant qu'on joue. Et il faut tenir la
 * justesse un court instant (400 ms) : une corde pincée qui traverse le juste en vibrant ne compte pas.
 */
import type { KeyValueStore } from '../audio/mixer';
import { midiToFreq, openStringMidi } from '../theory/fretboard';
import type { Tuning } from '../theory/tunings';

/** Écart accepté pendant l'accordage (cents). Serré exprès. */
export const IN_TUNE_CENTS = 5;
/** Durée pendant laquelle la corde doit rester juste avant de passer à la suivante. */
export const GUIDE_HOLD_MS = 400;
/** Au-delà de cet écart, ce n'est plus la corde qu'on accorde (on ignore). */
export const GUIDE_MAX_DETUNE = 90;

export const TUNING_STORE_KEY = 'fretwave.tuning.v1';
/** Un accordage de plus de trois jours n'est plus une information fiable (« dernier accordage : 3 jours »). */
export const TUNING_STALE_DAYS = 3;

export interface GuideStep {
  /** Index de corde du modèle (0 = la plus grave). */
  string: number;
  /** Numéro affiché (1 = la plus aiguë). */
  number: number;
  midi: number;
  hz: number;
  /** Nom de la note dans l'accordage (ex. « E2 »). */
  name: string;
}

/** Les cordes à accorder, de la plus grave à la plus aiguë : on commence par celle qui porte tout. */
export function guideSteps(tuning: Tuning, a4 = 440): GuideStep[] {
  const out: GuideStep[] = [];
  for (let s = 0; s < tuning.strings.length; s++) {
    const midi = openStringMidi(tuning, s);
    out.push({ string: s, number: tuning.strings.length - s, midi, hz: midiToFreq(midi, a4), name: tuning.strings[s]! });
  }
  return out;
}

export type GuideStatus = 'silent' | 'in-tune' | 'low' | 'high' | 'far';

/** État d'une corde d'après une hauteur détectée (pure : c'est testable sans audio). */
export function guideStatusOf(
  heard: { midi: number; cents: number } | null,
  step: GuideStep,
  tolerance = IN_TUNE_CENTS,
): { status: GuideStatus; cents: number | null } {
  if (!heard) return { status: 'silent', cents: null };
  const cents = (heard.midi - step.midi) * 100 + heard.cents;
  if (Math.abs(cents) > GUIDE_MAX_DETUNE) return { status: 'far', cents };
  if (Math.abs(cents) <= tolerance) return { status: 'in-tune', cents };
  return { status: cents < 0 ? 'low' : 'high', cents };
}

export const STATUS_TEXT: Readonly<Record<GuideStatus, string>> = {
  silent: 'joue la corde',
  'in-tune': 'juste — tiens-la',
  low: 'trop basse',
  high: 'trop haute',
  far: 'ce n’est pas cette corde',
};

export interface GuideState {
  /** Rang de la corde en cours dans `guideSteps`. */
  index: number;
  /** Instant depuis lequel la corde est juste (null : pas juste en ce moment). */
  holdSince: number | null;
  done: boolean;
  /** Cordes validées dans cette session. */
  validated: number;
}

export function newGuide(): GuideState {
  return { index: 0, holdSince: null, done: false, validated: 0 };
}

export interface GuideTick {
  state: GuideState;
  status: GuideStatus;
  cents: number | null;
  /** Vient de valider une corde (pour un retour visuel / sonore). */
  justValidated: boolean;
}

/**
 * Avance l'état d'un cran. Fonction **pure** : elle reçoit l'instant, jamais l'horloge interne, donc un
 * test peut simuler une corde tenue juste. `total` = nombre de cordes de l'accordage.
 */
export function guideTick(
  state: GuideState, step: GuideStep | undefined, heard: { midi: number; cents: number } | null, now: number, total: number,
): GuideTick {
  if (!step || state.done) return { state, status: 'silent', cents: null, justValidated: false };
  const { status, cents } = guideStatusOf(heard, step);
  if (status !== 'in-tune') {
    return { state: { ...state, holdSince: null }, status, cents, justValidated: false };
  }
  const holdSince = state.holdSince ?? now;
  if (now - holdSince < GUIDE_HOLD_MS) {
    return { state: { ...state, holdSince }, status, cents, justValidated: false };
  }
  const index = state.index + 1;
  const done = index >= total;
  return {
    state: { index, holdSince: null, done, validated: state.validated + 1 },
    status,
    cents,
    justValidated: true,
  };
}

/** Nombre de cordes d'un état d'accordage guidé (le total vient de l'accordage, pas de l'état). */
export function guideComplete(state: GuideState, steps: readonly GuideStep[]): boolean {
  return state.index >= steps.length;
}

// ---------------------------------------------------------------------------
// Souvenir du dernier accordage
// ---------------------------------------------------------------------------

export interface TuningRecord {
  at: number;
  tuningId: string;
  /** Cordes validées (toutes, sinon ce n'est pas un accordage). */
  strings: number;
}

export function readTuningRecord(store: KeyValueStore | null): TuningRecord | null {
  if (!store) return null;
  try {
    const raw = store.getItem(TUNING_STORE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<TuningRecord>;
    if (typeof o.at !== 'number' || !Number.isFinite(o.at)) return null;
    return {
      at: o.at,
      tuningId: typeof o.tuningId === 'string' ? o.tuningId : 'standard',
      strings: typeof o.strings === 'number' ? Math.max(0, Math.round(o.strings)) : 0,
    };
  } catch {
    return null;
  }
}

export function writeTuningRecord(store: KeyValueStore | null, rec: TuningRecord): void {
  if (!store) return;
  try {
    store.setItem(TUNING_STORE_KEY, JSON.stringify(rec));
  } catch {
    /* quota : on perd l'information, jamais l'accordage lui-même */
  }
}

export interface TuningFreshness {
  /** Jours écoulés (0 = aujourd'hui), `null` si jamais accordée. */
  days: number | null;
  /** Faut-il rappeler de s'accorder ? */
  stale: boolean;
  text: string;
}

export function tuningFreshness(rec: TuningRecord | null, now: Date): TuningFreshness {
  if (!rec) return { days: null, stale: true, text: 'Jamais accordée dans l’app' };
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(rec.at);
  const recStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const days = Math.max(0, Math.round((start - recStart) / 86_400_000));
  if (days === 0) return { days, stale: false, text: 'Dernier accordage : aujourd’hui' };
  if (days === 1) return { days, stale: false, text: 'Dernier accordage : hier' };
  return { days, stale: days > TUNING_STALE_DAYS, text: `Dernier accordage : il y a ${days} jours` };
}
