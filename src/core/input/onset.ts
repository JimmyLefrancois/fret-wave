/**
 * Détection d'attaque (onset) : une fonction pure, appelée une fois par bloc audio (128 échantillons
 * ≈ 2,7 ms à 48 kHz). Elle sert à deux choses :
 *  - mesurer la **latence** (l'app joue un clic, écoute quand il revient) ;
 *  - **redéclencher** l'écoute quand la même note est rejouée (sinon la retenue de note croit que
 *    rien n'a changé).
 *
 * Le processeur AudioWorklet (`public/worklets/fretwave-input.js`) contient la **même** règle en
 * JavaScript : elle est vérifiée par un test qui charge le fichier du worklet et le fait tourner
 * hors navigateur (`tests/worklet.test.ts`), pour que les deux copies ne divergent pas en silence.
 */

export interface OnsetOptions {
  /** Amplitude (RMS du bloc) en dessous de laquelle il n'y a pas de son : ~0,005 ≈ −46 dBFS. */
  floor: number;
  /** Facteur de saut exigé au-dessus du niveau lissé (2,2 = +7 dB en un bloc). */
  riseFactor?: number;
  /** Deux attaques plus proches que cela sont la même (90 ms). */
  refractoryMs?: number;
}

export interface OnsetState {
  /** Niveau lissé : montée rapide, descente lente. */
  env: number;
  lastOnsetMs: number;
}

export const INITIAL_ONSET: OnsetState = { env: 0, lastOnsetMs: -Infinity };

export interface OnsetStep {
  onset: boolean;
  state: OnsetState;
}

export function onsetStep(state: OnsetState, level: number, tMs: number, opts: OnsetOptions): OnsetStep {
  const rise = opts.riseFactor ?? 2.2;
  const refractory = opts.refractoryMs ?? 90;
  const onset =
    level >= opts.floor
    && level > rise * state.env
    && tMs - state.lastOnsetMs >= refractory;
  const env = level > state.env ? 0.6 * state.env + 0.4 * level : 0.9 * state.env + 0.1 * level;
  return { onset, state: { env, lastOnsetMs: onset ? tMs : state.lastOnsetMs } };
}

/** Amplitude RMS → dBFS (−Infinity pour le silence). */
export function rmsToDb(rms: number): number {
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}
