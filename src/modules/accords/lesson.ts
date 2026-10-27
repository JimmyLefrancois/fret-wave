/**
 * Leçon d'accord — moteur pur (phase 4a) : étapes, liste de vérification en **mode arpège**, verdicts
 * par corde, diagnostic de note morte.
 *
 * Ce que le micro a le droit de dire (D36, MUSIC_DESIGN §6) : une **hauteur**. En mode arpège, on
 * demande les cordes **dans l'ordre grave → aiguë** : la hauteur attendue est donc connue à chaque
 * instant, et une hauteur juste ne peut venir que de la corde demandée (ou d'une autre corde qui
 * donnerait la même note — rare dans une forme ouverte, et sans conséquence pédagogique : la note
 * sonne). C'est la raison pour laquelle l'arpège est **la seule validation fiable** en monophonie, et
 * pourquoi le plaqué reste en auto-évaluation jusqu'à la phase 5.
 *
 * Deux règles héritées de la phase 3 et non négociables :
 *  - une note **désaccordée** n'est pas une erreur (verdict `tuning`), une **octave fausse** non plus ;
 *  - une note **15 à 40 cents basse et faible** n'est pas un problème d'accord mais un doigt mal placé
 *    (P2 de la phase 3, `MUSIC_DESIGN` §14.3) : c'est le contresens le plus coûteux à éviter.
 */
import { matchPitch, type Target } from '../../core/input/match';
import { fretToMidi } from '../../core/theory/fretboard';
import { interpretChord } from '../../core/theory/chords';
import { TUNINGS, type Tuning } from '../../core/theory/tunings';
import type { DegreeLabel, NoteName } from '../../core/theory/types';
import type { Voicing } from '../../core/theory/voicings';

/** Étapes de la leçon **livrées en 4a** (les trois dernières arrivent en 4b). */
export type LessonStep = 'decouvrir' | 'construire' | 'verifier' | 'plaquer';

export const LESSON_STEPS: readonly { id: LessonStep; num: string; title: string; goal: string }[] = [
  { id: 'decouvrir', num: '01', title: 'Découvrir', goal: 'Nom, notes, couleur, écoute plaquée et arpégée' },
  { id: 'construire', num: '02', title: 'Construire', goal: 'Un doigt à la fois, dans l’ordre' },
  { id: 'verifier', num: '03', title: 'Vérifier', goal: 'Corde par corde, au micro ou à l’oreille' },
  { id: 'plaquer', num: '04', title: 'Plaquer', goal: 'Le geste complet — déclaré, pas encore vérifié' },
];

/** Ce qui reste du cycle des 7 étapes du brief, et où il vit. */
export const PENDING_STEPS = 'Fixer (rappel à froid chronométré), Enchaîner (transitions) et Intégrer (progression) arrivent en 4b : ils demandent le rythme et l’onset de la phase 5.';

// ---------------------------------------------------------------------------
// Liste de vérification en mode arpège
// ---------------------------------------------------------------------------

export interface ArpeggioCheck {
  /** Clé stable : `corde:case`. */
  key: string;
  string: number;
  fret: number;
  /** Hauteur sonore attendue (MIDI). */
  midi: number;
  note: NoteName;
  fn: DegreeLabel;
  finger: number | null;
  /** Nom de la corde dans l'accordage (ex. « A2 »). */
  stringName: string;
}

/**
 * Les cordes à jouer, **de la plus grave à la plus aiguë** : c'est l'ordre de l'arpège du brief, et
 * c'est aussi l'ordre où on vérifie une forme (la basse d'abord, elle porte l'accord).
 */
export function arpeggioCheck(v: Voicing, tuning: Tuning = TUNINGS[v.tuningId]!): ArpeggioCheck[] {
  const info = interpretChord(v.chord);
  const byPc = new Map(info.pitchClasses.map((pc, i) => [((pc % 12) + 12) % 12, { fn: info.degrees[i]!, note: info.notes[i]! }]));
  const out: ArpeggioCheck[] = [];
  v.frets.forEach((fret, string) => {
    if (fret === null) return;
    const midi = fretToMidi(tuning, string, fret);
    const c = byPc.get(((midi % 12) + 12) % 12)!;
    const finger = v.fingers?.[string];
    out.push({
      key: `${string}:${fret}`,
      string,
      fret,
      midi,
      note: c.note,
      fn: c.fn,
      finger: typeof finger === 'number' && finger > 0 ? finger : null,
      stringName: tuning.strings[string] ?? String(string),
    });
  });
  return out;
}

export type StringOutcome = 'ok' | 'tuning' | 'octave' | 'wrong';

export interface CheckState {
  /** Rang de la corde demandée dans la liste. */
  index: number;
  outcomes: Record<string, StringOutcome>;
  /** Essais ratés (verdict `wrong`) par corde. */
  tries: Record<string, number>;
  /** Dernier écart mesuré, en cents (pour l'affichage « +21 ¢ »). */
  cents: Record<string, number>;
}

/** Trois essais avant de révéler la note et de passer : on n'abandonne pas un débutant sur une corde. */
export const MAX_TRIES = 3;

export function newCheck(): CheckState {
  return { index: 0, outcomes: {}, tries: {}, cents: {} };
}

export function checkTarget(c: ArpeggioCheck): Target {
  return { key: c.key, columnIndex: 0, string: c.string, fret: c.fret, midi: c.midi, note: c.note, fn: c.fn };
}

export interface JudgeOptions {
  /** Tolérance d'accord en cents (réglage d'entrée). */
  centsTolerance: number;
}

export type StringVerdict =
  | { kind: 'fill'; cents: number; inTune: boolean }
  | { kind: 'tuning'; cents: number }
  | { kind: 'octave'; direction: 'high' | 'low' }
  | { kind: 'wrong'; deltaSemitones: number; cents: number }
  | { kind: 'outside'; deltaSemitones: number };

/** Verdict pour une hauteur jouée, contre **la seule** corde demandée. */
export function judgeString(heardMidiFloat: number, check: ArpeggioCheck, opts: JudgeOptions): StringVerdict {
  const v = matchPitch(heardMidiFloat, [checkTarget(check)], { centsTolerance: opts.centsTolerance, maxAttemptSemitones: 2 });
  switch (v.kind) {
    case 'fill': return { kind: 'fill', cents: v.cents, inTune: v.inTune };
    case 'tuning': return { kind: 'tuning', cents: v.cents };
    case 'octave': return { kind: 'octave', direction: v.direction };
    case 'wrong': return { kind: 'wrong', deltaSemitones: v.deltaSemitones, cents: v.cents };
    case 'outside': return { kind: 'outside', deltaSemitones: v.deltaSemitones };
    default: return { kind: 'outside', deltaSemitones: 0 };
  }
}

export interface AdvanceResult {
  state: CheckState;
  /** La corde est validée (ou abandonnée après 3 essais) : on passe à la suivante. */
  advanced: boolean;
  message: string | null;
}

/**
 * Applique un verdict à l'état. Une note juste (dans la tolérance) valide la corde ; un problème
 * d'accord ou une octave douteuse **ne comptent pas comme une erreur** et ne font pas avancer ; une
 * mauvaise note compte un essai, et le 3e essai révèle la case et passe.
 */
export function applyVerdict(state: CheckState, check: ArpeggioCheck, verdict: StringVerdict): AdvanceResult {
  const next: CheckState = {
    index: state.index,
    outcomes: { ...state.outcomes },
    tries: { ...state.tries },
    cents: { ...state.cents },
  };
  if (verdict.kind === 'fill') {
    next.outcomes[check.key] = 'ok';
    next.cents[check.key] = Math.round(verdict.cents);
    next.index = state.index + 1;
    return { state: next, advanced: true, message: null };
  }
  if (verdict.kind === 'tuning') {
    next.cents[check.key] = Math.round(verdict.cents);
    return { state: next, advanced: false, message: 'juste, mais désaccordé' };
  }
  if (verdict.kind === 'octave') {
    return { state: next, advanced: false, message: 'octave douteuse — rejoue la note' };
  }
  if (verdict.kind === 'outside') {
    return { state: next, advanced: false, message: 'note hors de l’accord' };
  }
  const tries = (state.tries[check.key] ?? 0) + 1;
  next.tries[check.key] = tries;
  next.cents[check.key] = Math.round(verdict.cents);
  if (tries >= MAX_TRIES) {
    next.outcomes[check.key] = 'wrong';
    next.index = state.index + 1;
    return { state: next, advanced: true, message: `case ${check.fret} révélée` };
  }
  return { state: next, advanced: false, message: 'ce n’est pas la note attendue' };
}

export interface CheckSummary {
  ok: number;
  total: number;
  wrong: number;
  accuracy: number;
  done: boolean;
  /** Toutes les cordes justes : l'arpège est « propre ». */
  clean: boolean;
  /** Cordes ratées (index de corde) : alimente `missedStrings` du journal. */
  missedStrings: number[];
}

export function checkSummary(state: CheckState, checks: readonly ArpeggioCheck[]): CheckSummary {
  const ok = checks.filter((c) => state.outcomes[c.key] === 'ok').length;
  const wrong = checks.filter((c) => state.outcomes[c.key] === 'wrong');
  const total = checks.length;
  return {
    ok,
    total,
    wrong: wrong.length,
    accuracy: total ? ok / total : 0,
    done: state.index >= total,
    clean: total > 0 && ok === total,
    missedStrings: wrong.map((c) => c.string),
  };
}

// ---------------------------------------------------------------------------
// Diagnostic de note morte (P2 de la phase 3, livré ici)
// ---------------------------------------------------------------------------

export interface NoteContext {
  /** Écart mesuré en cents (négatif = trop bas). */
  cents: number;
  /** Niveau de la note (dBFS), pour distinguer « mal frettée » de « corde étouffée ». */
  rmsDb: number;
  /** Seuil de détection réglé (dBFS). */
  thresholdDb: number;
}

/**
 * Une corde mal frettée sonne **15 à 40 cents bas** : le doigt est trop loin de la frette. C'est
 * fréquent, bénin, et cela ne s'appelle pas « accorde ta guitare ». Le niveau faible distingue la note
 * morte (corde étouffée) du simple désaccord (note pleine mais basse).
 */
export function isDeadNote(ctx: NoteContext): boolean {
  return ctx.cents <= -15 && ctx.cents >= -45 && ctx.rmsDb < ctx.thresholdDb + 10;
}

export type AdviceCode = 'dead' | 'tune' | 'replay' | 'wrong-note' | 'muted';

export interface Advice {
  code: AdviceCode;
  text: string;
}

/**
 * Nom de corde tel qu'il doit apparaître dans un conseil. Le modèle porte `E2` (nom technique, utile à
 * la mesure) ; l'élève, lui, lit « Mi grave » ou « mi aigu » selon le réglage de notation. La couche
 * d'affichage le fournit : sans elle, l'app parlerait en notation anglo-saxonne à un francophone.
 */
export interface AdviceNaming {
  /** Nom affiché de la corde (`fmtStringLabel`). */
  stringLabel?: string;
  /** Nom affiché de la note visée (`fmtNote`) : « Mi », jamais « E ». */
  noteLabel?: string;
}

/**
 * Conseil pédagogique pour une corde qui ne valide pas. Toujours une **cause** et une **action** :
 * « appuie juste derrière la frette », « accorde la corde », « rejoue-la seule ».
 *
 * Une corde **à vide** n'a pas de frette à viser : le conseil doit dire « rejoue-la à vide », pas
 * « vérifie ton doigt » (défaut trouvé en regardant une capture, pas dans un test).
 */
export function adviceFor(verdict: StringVerdict, check: ArpeggioCheck, ctx: NoteContext, naming: AdviceNaming = {}): Advice | null {
  const name = naming.stringLabel ?? check.stringName;
  const noteName = naming.noteLabel ?? check.note;
  const where = check.fret === 0 ? `la corde de ${name} à vide` : `la corde de ${name}, case ${check.fret}`;
  if (verdict.kind === 'fill') {
    // une corde à vide n'a pas de doigt à replacer : « près de la frette » n'y veut rien dire
    if (check.fret > 0 && isDeadNote(ctx)) {
      return { code: 'dead', text: `La corde de ${name} sonne ${Math.abs(Math.round(ctx.cents))} cents bas et faible : le doigt est trop loin de la frette. Appuie juste derrière la frette ${check.fret}, sans serrer plus fort.` };
    }
    return null;
  }
  if (verdict.kind === 'tuning') {
    if (check.fret > 0 && isDeadNote(ctx)) {
      return { code: 'dead', text: `Ce n’est pas un problème d’accord : la corde de ${name} sonne ${Math.abs(Math.round(ctx.cents))} cents bas et faible. Appuie juste derrière la frette ${check.fret}.` };
    }
    return { code: 'tune', text: `La corde de ${name} est ${verdict.cents < 0 ? 'trop basse' : 'trop haute'} de ${Math.abs(Math.round(verdict.cents))} cents : c’est l’accord de l’instrument, pas ton doigt. Passe par l’accordeur.` };
  }
  if (verdict.kind === 'octave') {
    return { code: 'replay', text: `Le détecteur entend une octave au-dessus ou en dessous — fréquent sur les cordes graves au téléphone. Rejoue ${where} seule, franchement.` };
  }
  if (verdict.kind === 'outside') {
    return { code: 'wrong-note', text: `Ce n’est pas une note de cet accord : joue ${where} seule, sans toucher les autres cordes.` };
  }
  return {
    code: 'wrong-note',
    text: check.fret === 0
      ? `La corde de ${name} devrait sonner ${noteName} (${check.fn}) : elle est à vide, donc rien à frettes — vérifie qu’aucun doigt ne la touche et qu’elle est bien pincée.`
      : `La corde de ${name} devrait donner ${noteName} (${check.fn}, case ${check.fret}) : vérifie que le doigt est bien derrière cette case, sur cette corde, et qu’aucune autre ne sonne.`,
  };
}

/** Marque une corde comme étouffée (l'élève n'entend rien) : diagnostic explicite, pas une erreur muette. */
export function mutedAdvice(check: ArpeggioCheck, naming: AdviceNaming = {}): Advice {
  const name = naming.stringLabel ?? check.stringName;
  return {
    code: 'muted',
    text: `Rien n’a sonné sur la corde de ${name} : elle est probablement étouffée par un doigt voisin, ou tu ne l’as pas pincée. Rejoue-la seule.`,
  };
}

// ---------------------------------------------------------------------------
// Tentative journalisée
// ---------------------------------------------------------------------------

/** Ce qu'une vérification d'arpège enregistre : justesse par corde, sans stocker chaque essai. */
export interface ChordAttemptResult {
  correct: number;
  total: number;
  missedStrings: number[];
  seconds: number;
}

export function attemptFromCheck(summary: CheckSummary, seconds: number): ChordAttemptResult {
  return {
    correct: summary.ok,
    total: summary.total,
    missedStrings: [...new Set(summary.missedStrings)].sort((a, b) => a - b),
    seconds: Math.max(0, Math.round(seconds)),
  };
}
