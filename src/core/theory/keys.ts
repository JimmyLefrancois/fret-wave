/**
 * Politique des tonalités (MUSIC_DESIGN.md §1.3) : armures ≤ 6 altérations ;
 * Fa♯/Sol♭ et Ré♯m/Mi♭m proposés tous les deux ; Do♯, Do♭, La♯m, La♭m refusés.
 */
import { Key } from 'tonal';
import type { NoteName, PitchClass } from './types';
import { pitchClassOf } from './scales';

export type KeyMode = 'major' | 'minor';

/** 13 tonalités majeures proposées (ordre : cycle des quintes ♯ puis ♭). */
export const MAJOR_KEYS: readonly NoteName[] = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
/** 13 tonalités mineures proposées. */
export const MINOR_KEYS: readonly NoteName[] = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'Eb', 'Bb', 'F', 'C', 'G', 'D'];

/** Tonalités explicitement refusées (7 altérations) et leur remplaçante. */
export const REJECTED_KEYS: ReadonlyArray<{ key: NoteName; mode: KeyMode; use: NoteName; signature: number }> = [
  { key: 'C#', mode: 'major', use: 'Db', signature: 7 },
  { key: 'Cb', mode: 'major', use: 'B', signature: -7 },
  { key: 'A#', mode: 'minor', use: 'Bb', signature: 7 },
  { key: 'Ab', mode: 'minor', use: 'G#', signature: -7 },
];

/** Armure signée : +n = n dièses, −n = n bémols. */
export function keySignature(tonic: NoteName, mode: KeyMode): number {
  const k = mode === 'major' ? Key.majorKey(tonic) : Key.minorKey(tonic);
  return k.alteration;
}

/** Tonalités proposées pour une classe de hauteur (1 ou 2 orthographes). */
export function keyOptions(pc: PitchClass, mode: KeyMode): NoteName[] {
  const list = mode === 'major' ? MAJOR_KEYS : MINOR_KEYS;
  return list.filter((n) => pitchClassOf(n) === pc);
}

/** Les deux variantes d'une même hauteur partagent le même nœud de progression. */
export function progressKeyId(tonic: NoteName, mode: KeyMode): string {
  return `${mode}:${pitchClassOf(tonic)}`;
}
