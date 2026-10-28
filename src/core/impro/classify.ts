/**
 * Improvisation (phase 7) : **classer une note jouée dans son contexte harmonique**.
 *
 * Le brief est explicite : « pas seulement dans la gamme / hors gamme ». Une même note change de valeur
 * selon l'accord qui passe dessous — le Fa sur un Do majeur est une **note à éviter** (quarte sur un
 * accord majeur), le même Fa sur un Ré mineur est la **tierce**. Un élève qui joue « dans la gamme » et
 * se demande pourquoi ça sonne sale a besoin de cette distinction, pas d'un pourcentage.
 *
 * Cinq rôles, dans l'ordre de valeur musicale :
 *
 * | rôle      | sens                                                            |
 * |-----------|-----------------------------------------------------------------|
 * | `chord`   | note de l'accord (1, 3, 5, 7) — elle **dit** l'harmonie        |
 * | `color`   | tension consonante (9, ♯11, 13) — elle colore sans contredire   |
 * | `passing` | note de la gamme étrangère à l'accord — elle **relie**          |
 * | `avoid`   | note de la gamme qui **contredit** l'accord (4 sur majeur)      |
 * | `out`     | hors gamme — elle sort du cadre choisi                          |
 *
 * Le classement ne dépend **pas** du temps : une note à éviter reste à éviter ; c'est le **score** qui
 * regarde *quand* elle tombe (une quarte sur un temps fort s'entend, la même en passage ne s'entend pas).
 */

export type ChordQuality = 'maj' | 'min' | 'dom7' | 'min7' | 'maj7' | 'sus4';

export type NoteRole = 'chord' | 'color' | 'passing' | 'avoid' | 'out';

export interface ChordContext {
  /** Classe de hauteur de la fondamentale (0 = do). */
  root: number;
  quality: ChordQuality;
}

export interface NoteJudgement {
  role: NoteRole;
  /** Degré de la note **dans l'accord** (1, 3, 5, 7, 9, 11, 13), `null` si la note n'y appartient pas. */
  chordDegree: number | null;
  /** Degré de la note **dans la gamme** (1-12 exprimé en demi-tons depuis la tonique), `null` si hors gamme. */
  scaleOffset: number | null;
  /** Libellé court prêt à afficher (« tierce », « 9 », « quarte », « hors gamme »). */
  label: string;
}

/** Intervalles (en demi-tons depuis la fondamentale) qui **définissent** chaque qualité. */
export const CHORD_INTERVALS: Record<ChordQuality, readonly number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dom7: [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus4: [0, 5, 7],
};

/** Nom du degré d'accord, pour l'affichage. */
const DEGREE_NAME: Record<number, string> = {
  0: 'fondamentale', 3: 'tierce mineure', 4: 'tierce majeure', 5: 'quarte', 7: 'quinte',
  9: 'sixte', 10: 'septième mineure', 11: 'septième majeure',
  1: '♭9', 2: '9', 6: '♭5', 8: '♭13', 13: '♭9 (octave)', 14: '9',
};

/**
 * Tensions **consonantes** par qualité, en demi-tons depuis la fondamentale.
 *
 * Les choix sont ceux de l'harmonie de jazz enseignée, pas d'un tableur : la 9 et la 13 passent sur
 * presque tout, la ♯11 est la couleur du majeur (elle évite la quarte), et la **quarte juste sur un
 * accord majeur ou de dominante est la note à éviter** — c'est le cas d'école (MUSIC_DESIGN §8).
 */
const CONSONANT_TENSIONS: Record<ChordQuality, readonly number[]> = {
  maj: [2, 6, 9],       // 9, ♯11, 13
  maj7: [2, 6, 9],
  min: [2, 5, 9],       // 9, 11, 13
  min7: [2, 5, 9],
  dom7: [2, 6, 9],      // 9, ♯11, 13
  sus4: [2, 9, 4],      // 9, 13, et la tierce majeure comme couleur (l'accord est suspendu)
};

/**
 * Notes **à éviter** par qualité, en demi-tons : la quarte sur majeur et dominante (elle frotte la
 * tierce majeure d'un demi-ton), rien sur mineur (la quarte y est consonne) ni sur suspendu.
 */
const AVOID_INTERVALS: Record<ChordQuality, readonly number[]> = {
  maj: [5],
  maj7: [5],
  dom7: [5],
  min: [],
  min7: [],
  sus4: [],
};

const pc = (n: number): number => ((n % 12) + 12) % 12;

/**
 * Classe une hauteur (MIDI ou classe de hauteur + octave, peu importe : seule la classe compte) dans un
 * accord et une gamme.
 *
 * @param midi hauteur jouée
 * @param chord accord en cours (fondamentale + qualité)
 * @param scalePcs classes de hauteur de la gamme de travail (celles de la position affichée)
 */
export function judgeNote(midi: number, chord: ChordContext, scalePcs: readonly number[]): NoteJudgement {
  const pitch = pc(midi);
  const interval = pc(pitch - chord.root);
  const intervals = CHORD_INTERVALS[chord.quality];
  const inScale = scalePcs.some((p) => pc(p) === pitch);
  const scaleOffset = inScale ? pc(pitch - pc(scalePcs[0] ?? 0)) : null;

  if (intervals.includes(interval)) {
    // rang dans l'accord : 1 pour la fondamentale, puis 3/5/7 selon l'intervalle
    const degree = interval === 0 ? 1 : interval === 3 || interval === 4 ? 3 : interval === 7 ? 5 : 7;
    return {
      role: 'chord',
      chordDegree: degree,
      scaleOffset,
      label: DEGREE_NAME[interval] ?? `degré ${degree}`,
    };
  }

  if (CONSONANT_TENSIONS[chord.quality].includes(interval)) {
    return { role: 'color', chordDegree: null, scaleOffset, label: DEGREE_NAME[interval] ?? `${interval} demi-tons` };
  }

  if (AVOID_INTERVALS[chord.quality].includes(interval)) {
    return { role: 'avoid', chordDegree: null, scaleOffset, label: 'quarte (à éviter sur cet accord)' };
  }

  if (!inScale) {
    return { role: 'out', chordDegree: null, scaleOffset: null, label: 'hors gamme' };
  }

  return { role: 'passing', chordDegree: null, scaleOffset, label: DEGREE_NAME[interval] ?? 'note de passage' };
}

export interface ImproNote {
  midi: number;
  /** Instant (ms `performance.now`) de la note. */
  at: number;
  /** Position dans la mesure, 0-1 (0 = temps 1, 0,5 = temps 3 en 4/4). */
  beatPhase: number;
  /** Accord en cours au moment de la note. */
  chord: ChordContext;
  judgement: NoteJudgement;
}

export interface ImproStats {
  notes: number;
  byRole: Record<NoteRole, number>;
  /** Part des notes qui appartiennent à l'accord. */
  chordRate: number;
  /** Part des notes dans la gamme. */
  inScaleRate: number;
  /** Part des notes **sur temps fort** qui appartiennent à l'accord — c'est là que ça s'entend. */
  strongChordRate: number;
  /** Score 0-100 : un repère, pas une note de conservatoire (voir `scoreOf`). */
  score: number;
  /** Une phrase de diagnostic, celle qu'un prof dirait en premier. */
  advice: string;
}

/** Un temps fort : premier et troisième temps d'une mesure à 4 temps (phase 0 ou 0,5). */
export const isStrongBeat = (phase: number): boolean => phase < 0.125 || (phase >= 0.5 && phase < 0.625);

/**
 * Score 0-100 : 45 % de notes d'accord, 20 % de notes dans la gamme, 35 % de notes d'accord **sur les
 * temps forts**. Les poids disent la pédagogie : jouer juste ne suffit pas, il faut **dire l'harmonie**,
 * et c'est sur les temps forts que ça s'entend. Une note hors gamme n'est pas une faute morale — elle
 * coûte seulement sa part.
 */
export function scoreOf(byRole: Record<NoteRole, number>, strongChordRate: number): number {
  const total = Object.values(byRole).reduce((s, n) => s + n, 0);
  if (total === 0) return 0;
  const chordRate = byRole.chord / total;
  const inScaleRate = (byRole.chord + byRole.color + byRole.passing + byRole.avoid) / total;
  return Math.round(100 * (0.45 * chordRate + 0.2 * inScaleRate + 0.35 * strongChordRate));
}

/** Statistiques d'une prise d'improvisation. */
export function summarizeImpro(notes: readonly ImproNote[]): ImproStats {
  const byRole: Record<NoteRole, number> = { chord: 0, color: 0, passing: 0, avoid: 0, out: 0 };
  let strong = 0;
  let strongChord = 0;
  for (const n of notes) {
    byRole[n.judgement.role] += 1;
    if (isStrongBeat(n.beatPhase)) {
      strong += 1;
      if (n.judgement.role === 'chord') strongChord += 1;
    }
  }
  const total = notes.length;
  const chordRate = total > 0 ? byRole.chord / total : 0;
  const inScaleRate = total > 0 ? (total - byRole.out) / total : 0;
  const strongChordRate = strong > 0 ? strongChord / strong : 0;
  const score = scoreOf(byRole, strongChordRate);
  return {
    notes: total,
    byRole,
    chordRate,
    inScaleRate,
    strongChordRate,
    score,
    advice: adviceFor({ notes: total, byRole, chordRate, inScaleRate, strongChordRate, score }),
  };
}

/**
 * Le conseil : **une** phrase, celle qui débloque le plus. L'ordre est celui de l'urgence pédagogique —
 * d'abord rester dans le cadre, ensuite visiter l'harmonie, enfin la placer au bon moment.
 */
function adviceFor(s: Omit<ImproStats, 'advice'>): string {
  if (s.notes < 6) return 'Joue quelques notes de plus : il faut au moins six notes pour dire quelque chose.';
  if (s.inScaleRate < 0.85) {
    const out = s.byRole.out;
    return `${out} note${out > 1 ? 's' : ''} hors gamme : commence par rester dans la position, c'est elle qui cadre.`;
  }
  if (s.chordRate < 0.45) {
    return 'Tu joues juste, mais tu visites peu l\'accord : vise sa tierce ou sa septième quand il arrive.';
  }
  if (s.strongChordRate < 0.5) {
    return 'Tu connais les notes de l\'accord, mais rarement sur le temps : arrive sur une note d\'accord au temps 1.';
  }
  if (s.byRole.color === 0 && s.notes >= 12) {
    return 'La grille est tenue. Essaie maintenant une tension (9 ou 13) juste avant de retomber sur une note d\'accord.';
  }
  return 'La grille est tenue : notes d\'accord sur les temps forts, la ligne respire. Continue plus lentement pour écouter les tensions.';
}

/** Libellé d'un rôle, pour l'écran. */
export const ROLE_LABEL: Record<NoteRole, string> = {
  chord: 'note de l’accord',
  color: 'couleur',
  passing: 'passage',
  avoid: 'à éviter',
  out: 'hors gamme',
};
