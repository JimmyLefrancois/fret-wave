/**
 * Conventions (voir MUSIC_DESIGN.md §1) :
 *  - le MODÈLE n'utilise que la notation anglo-saxonne (C, Bb, F#, F##) ;
 *  - l'AFFICHAGE (solfège ou anglo) passe uniquement par notation.ts ;
 *  - les hauteurs sont celles du son réel (E2 = 82,41 Hz, MIDI 40).
 */

/** Nom de note sans octave, notation anglo : "C", "Bb", "F#", "F##". */
export type NoteName = string;
/** Nom de note avec octave : "E2", "Bb3". */
export type PitchName = string;
/** Classe de hauteur 0-11 (C = 0). */
export type PitchClass = number;

/** Intervalle au format `tonal` : "1P", "3m", "5d", "7M"… */
export type IntervalName = string;
/** Étiquette de degré affichée : "1", "b3", "#4", "bb7"… */
export type DegreeLabel = string;

export type NoteNotation = 'fr' | 'en';
export type ChordNotation = 'en' | 'fr' | 'jazz';

export interface DisplayOptions {
  /** Notation des noms de notes. Défaut : solfège. */
  notes?: NoteNotation;
  /** Notation des symboles d'accord. Défaut : anglo (décision D8). */
  chords?: ChordNotation;
}
