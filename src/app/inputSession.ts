/**
 * Session d'entrée partagée par les écrans (phase 3) : **un seul** `InputEngine` par contexte audio.
 *
 * Deux moteurs ouverts en même temps, ce serait deux `getUserMedia` : sur Android le second échoue
 * ou coupe le premier, et l'utilisateur voit un micro qui « ne marche qu'une fois sur deux ».
 */
import { AudioEngine } from '../core/audio/engine';
import { InputEngine } from '../core/input/engine';
import { TUNINGS, pitchWindowSize } from '../core/theory';

let engine: InputEngine | null = null;

/**
 * Le contexte **natif** derrière l'enveloppe de Tone.
 *
 * Tone 15 renvoie un `AudioContext` de `standardized-audio-context` : cette enveloppe sait créer des
 * nœuds (`createMediaStreamSource`, oscillateurs) mais **pas** un `AudioWorkletNode` natif — il la
 * refuse (`parameter 1 is not of type 'BaseAudioContext'`, constaté au navigateur). On lui reprend
 * donc le contexte du navigateur qu'elle enveloppe : même horloge, même matériel, aucun second
 * contexte à réveiller.
 */
export function nativeContextOf(ctx: AudioContext): AudioContext {
  const wrapped = ctx as unknown as { _nativeAudioContext?: AudioContext; rawContext?: AudioContext };
  return wrapped._nativeAudioContext ?? wrapped.rawContext ?? ctx;
}

/** Moteur d'entrée, créé sur le contexte audio de l'app (doit être appelé dans un geste). */
export async function ensureInputEngine(): Promise<InputEngine> {
  const audio = AudioEngine.get();
  await audio.init();
  const ctx = nativeContextOf(audio.rawContext);
  engine ??= new InputEngine(ctx);
  return engine;
}

export function inputEngineIfAny(): InputEngine | null {
  return engine;
}

/**
 * Taille de fenêtre pour un accordage : 2048 en standard, 4096 dès qu'une corde descend sous ~100 Hz
 * (Si1 de 7 cordes, baryton, 8 cordes). Dérivée de l'accordage, jamais codée en dur.
 */
export function windowFor(tuningId: string): number {
  const tuning = TUNINGS[tuningId] ?? TUNINGS.standard!;
  return pitchWindowSize(tuning);
}
