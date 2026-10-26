/**
 * Accordages : générique sur l'accordage ET le nombre de cordes. Hauteurs = son réel
 * (la guitare s'écrit une octave au-dessus ; E2 = 82,41 Hz).
 * strings[0] = corde la plus GRAVE (convention du modèle) ; la tab affiche la plus aiguë en haut.
 */
import type { PitchName } from './types';

export interface Tuning {
  id: string;
  nameFr: string;
  strings: readonly PitchName[];
}

function t(id: string, nameFr: string, strings: PitchName[]): Tuning {
  return { id, nameFr, strings };
}

export const TUNINGS: Readonly<Record<string, Tuning>> = {
  standard: t('standard', 'Standard (6 cordes)', ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']),
  dropD: t('dropD', 'Drop D', ['D2', 'A2', 'D3', 'G3', 'B3', 'E4']),
  dadgad: t('dadgad', 'DADGAD', ['D2', 'A2', 'D3', 'G3', 'A3', 'D4']),
  openG: t('openG', 'Open G (DGDGBD)', ['D2', 'G2', 'D3', 'G3', 'B3', 'D4']),
  openD: t('openD', 'Open D (DADF#AD)', ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4']),
  halfStepDown: t('halfStepDown', 'Demi-ton plus bas', ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4']),
  standard7: t('standard7', 'Standard 7 cordes (Si grave)', ['B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4']),
  baritone: t('baritone', 'Baryton (si–si)', ['B1', 'E2', 'A2', 'D3', 'F#3', 'B3']),
  standard8: t('standard8', 'Standard 8 cordes (Fa♯ grave)', ['F#1', 'B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4']),
};
