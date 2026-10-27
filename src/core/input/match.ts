/**
 * Appariement hauteur mesurée → case attendue (phase 3). C'est ici que se prend la seule décision
 * pédagogique que le micro autorise, et il faut être clair sur ce qu'il **ne** permet pas :
 *
 *  - il donne une **hauteur**, pas une **corde**. La même hauteur existe à plusieurs endroits du
 *    manche (La3 = corde de Mi case 5 = corde de La à vide) : l'app ne peut pas dire sur quelle corde
 *    l'élève a joué. Elle valide donc une **case attendue** (dont la corde est connue du modèle) et
 *    ne prétend jamais faire un diagnostic par corde à partir du son ;
 *  - il est faux d'une octave sur les cordes graves avec un micro de téléphone (peu d'énergie sous
 *    100 Hz). Ce cas est traité à part (`kind: 'octave'`) : on ne compte **pas** d'erreur, on demande
 *    de rejouer — accuser un élève d'une faute du détecteur serait le pire des messages ;
 *  - une guitare désaccordée fait passer une note juste pour fausse : au-delà de la tolérance mais
 *    dans la même demi-teinte, le verdict est `tuning` (aucune erreur comptée), et l'écran renvoie
 *    vers l'accordeur (MUSIC_DESIGN §6).
 */
import { fretToMidi, midiToCandidates, openStringMidi, type Tuning } from '../theory';
import type { NoteName } from '../theory';

/** Une réponse attendue : un trou de l'exercice, ou n'importe quelle case visée. */
export interface Target {
  /** Identité de la cible (clé de trou `colonne:corde`). */
  key: string;
  columnIndex: number;
  string: number;
  fret: number;
  /** Hauteur sonore attendue (MIDI, son réel). */
  midi: number;
  note: NoteName;
  /** Fonction d'intervalle (« 1 », « b3 », « 5 »). */
  fn: string;
}

export interface HoleLike {
  key: string;
  columnIndex: number;
  string: number;
  fret: number;
  note: NoteName;
  fn: string;
}

/** Convertit des trous en cibles (la hauteur attendue vient de l'accordage, jamais du hasard). */
export function targetsFor(holes: readonly HoleLike[], tuning: Tuning): Target[] {
  return holes.map((h) => ({
    key: h.key,
    columnIndex: h.columnIndex,
    string: h.string,
    fret: h.fret,
    midi: fretToMidi(tuning, h.string, h.fret),
    note: h.note,
    fn: h.fn,
  }));
}

export type MatchVerdict =
  | { kind: 'fill'; target: Target; cents: number; inTune: boolean }
  | { kind: 'tuning'; target: Target; cents: number }
  | { kind: 'octave'; target: Target; direction: 'high' | 'low' }
  | { kind: 'wrong'; target: Target; heardMidi: number; deltaSemitones: number; cents: number }
  | { kind: 'outside'; heardMidi: number; nearest: Target | null; deltaSemitones: number }
  | { kind: 'empty' };

export interface MatchOptions {
  /** Tolérance d'accord en cents (10-60). */
  centsTolerance: number;
  /** Trou désigné : à hauteur égale, c'est lui qui est rempli (les allers-retours répètent la même note). */
  activeKey?: string | null;
  /**
   * Au-delà de cet écart (demi-tons), la note n'est **pas** considérée comme une tentative : c'est
   * une autre note du segment, ou une fausse route. Défaut 2 : un élève qui vise une case se trompe
   * d'un ou deux demi-tons (mauvaise case, corde à côté), pas d'une quinte. Compter une erreur
   * au-delà punirait le fait de jouer les **notes visibles** de l'exercice pour se repérer.
   */
  maxAttemptSemitones?: number;
}

/**
 * Verdict pour une hauteur entendue. `heardMidiFloat` est la hauteur flottante (pas la note arrondie) :
 * c'est elle qui porte les cents.
 */
export function matchPitch(heardMidiFloat: number, targets: readonly Target[], opts: MatchOptions): MatchVerdict {
  if (targets.length === 0) return { kind: 'empty' };
  const tol = Math.max(1, opts.centsTolerance);
  const maxAttempt = opts.maxAttemptSemitones ?? 2;

  let best: Target | null = null;
  let bestDelta = Infinity;
  for (const t of targets) {
    const d = heardMidiFloat - t.midi;
    const ad = Math.abs(d);
    if (ad < bestDelta - 1e-9) {
      best = t;
      bestDelta = ad;
      continue;
    }
    // écart égal (même note écrite deux fois, montée puis descente) : le trou désigné gagne
    if (best && Math.abs(ad - bestDelta) <= 1e-9 && opts.activeKey && t.key === opts.activeKey && best.key !== opts.activeKey) {
      best = t;
      bestDelta = ad;
    }
  }
  const target = best!;
  const delta = heardMidiFloat - target.midi;
  const cents = delta * 100;
  const ad = Math.abs(delta);

  if (ad * 100 <= tol) return { kind: 'fill', target, cents, inTune: Math.abs(cents) <= 15 };
  // même demi-ton, mais trop loin : c'est l'accord de la guitare, pas la mémoire de l'élève
  if (ad * 100 <= Math.max(tol + 10, 60)) return { kind: 'tuning', target, cents };
  if (ad >= 10.5 && ad <= 13.5) {
    // une octave d'écart : vers le haut sur une cible grave, c'est le détecteur qui se trompe ;
    // vers le bas, c'est l'élève (mais on ne compte pas l'erreur ici : l'écran décide, voir `ScaleTrainingPage`)
    return { kind: 'octave', target, direction: delta > 0 ? 'high' : 'low' };
  }
  if (ad <= maxAttempt) return { kind: 'wrong', target, heardMidi: Math.round(heardMidiFloat), deltaSemitones: delta, cents };
  return { kind: 'outside', heardMidi: Math.round(heardMidiFloat), nearest: target, deltaSemitones: delta };
}

// ---------------------------------------------------------------------------
// Accordeur
// ---------------------------------------------------------------------------

export interface OpenStringReading {
  string: number;
  /** Nom orthographié de la corde à vide selon l'accordage (ex. « Eb3 »). */
  pitch: string;
  targetMidi: number;
  targetHz: number;
  /** Écart signé en cents entre la note jouée et la corde (négatif = trop bas). */
  cents: number;
  /** Distance absolue en demi-tons (0 = c'est cette corde, 12 = une octave). */
  distance: number;
}

/**
 * Corde à vide la plus proche de la hauteur jouée (accordeur). `maxDistance` borne l'écart accepté
 * en demi-tons : 7 par défaut (une quinte, pour un diagnostic large), **0,6 dans l'interface** —
 * afficher « corde de Ré3 · 198 cents bas » pour un Do3 serait une information fausse, pas une aide.
 */
export function nearestOpenString(tuning: Tuning, heardMidiFloat: number, a4 = 440, maxDistance = 7): OpenStringReading | null {
  let best: OpenStringReading | null = null;
  for (let string = 0; string < tuning.strings.length; string++) {
    const targetMidi = openStringMidi(tuning, string);
    const distance = Math.abs(heardMidiFloat - targetMidi);
    if (best !== null && distance >= best.distance) continue;
    const targetHz = a4 * Math.pow(2, (targetMidi - 69) / 12);
    const hz = a4 * Math.pow(2, (heardMidiFloat - 69) / 12);
    best = {
      string,
      pitch: tuning.strings[string]!,
      targetMidi,
      targetHz,
      cents: 1200 * Math.log2(hz / targetHz),
      distance,
    };
  }
  return best !== null && best.distance <= maxDistance ? best : null;
}

export type TuneStatus = 'in' | 'low' | 'high' | 'far';

/** Bande d'accord : juste à ±5 cents, sinon trop bas / trop haut ; au-delà de 50 cents, « loin ». */
export function tuneStatus(cents: number): TuneStatus {
  const a = Math.abs(cents);
  if (a <= 5) return 'in';
  if (a > 50) return 'far';
  return cents < 0 ? 'low' : 'high';
}

/**
 * Nom de note (anglo) d'une hauteur, **en dièses** : l'accordeur affiche une hauteur chromatique,
 * pas une tonalité, donc on ne choisit pas d'enharmonique par armure (MUSIC_DESIGN §1.3 — la règle
 * « une note par lettre » vaut pour les gammes, pas pour un nom de touche). `tonal.fromMidi` alterne
 * dièses et bémols selon la note : inutilisable pour une lecture stable.
 */
const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export function noteNameOf(midi: number): NoteName {
  return CHROMATIC[((Math.round(midi) % 12) + 12) % 12]!;
}

/**
 * Diagnostic d'une attaque hors cible : quelle note l'élève a réellement jouée, et sur quelles cases
 * elle existe dans cet accordage. Sert au message (« tu joues Fa♯, le trou est Sol ») — jamais à
 * affirmer une corde.
 */
export function describeHeard(tuning: Tuning, heardMidi: number, maxFret = 24): { note: NoteName; places: { string: number; fret: number }[] } {
  return { note: noteNameOf(heardMidi), places: midiToCandidates(tuning, Math.round(heardMidi), maxFret) };
}
