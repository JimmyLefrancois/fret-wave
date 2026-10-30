/**
 * Étape **Intégrer** (phase 4b) — une progression courte, en tablature, avec un motif de strumming.
 *
 * Pourquoi cette étape arrive après les transitions : un accord seul n'est pas de la musique. Jouer
 * quatre accords **en mesure** est la première chose qui ressemble à une chanson, et c'est ce qui donne
 * envie de continuer. Le moteur existe depuis la 1b (`progressionToScore`) ; ce fichier n'ajoute que
 * des **données** (quelles progressions, pourquoi, avec quel motif) et le choix de ce qui est jouable.
 *
 * Honnêteté : la **progression** n'est pas segmentée (l'accord plaqué isolé, lui, est écouté depuis la
 * phase 5). L'élève déclare qu'il a joué la progression ;
 * le journal enregistre une activité sous le nœud `acc:progression:{id}`, jamais une preuve de justesse.
 * Ce qui est réellement entraîné ici, et qui n'a pas besoin du micro : la **mémoire de l'enchaînement**
 * et la tenue du tempo avec le métronome.
 *
 * Les progressions sont choisies pour être jouables avec les accords du parcours : aucune ne demande un
 * barré, toutes tournent autour de tonalités faciles à la guitare (Sol, Do, Ré, La, Mi mineur).
 */
import { progressionToScore, type StrumPatternId } from '../../core/tab/generators';
import type { TabScore } from '../../core/tab/model';
import type { Voicing } from '../../core/theory/voicings';
import { VOICINGS } from '../../data/voicings';

export interface Progression {
  id: string;
  title: string;
  /** Tonalité de travail (affichage). */
  key: string;
  /** Accords, dans l'ordre, un par mesure. */
  voicingIds: string[];
  /** Chiffrage romain de chaque mesure. */
  romans: string[];
  /** Motif de strum conseillé. */
  pattern: StrumPatternId;
  /** Tempo de départ conseillé. */
  tempo: number;
  /** Ce que cette progression apprend, en une phrase. */
  why: string;
}

/**
 * Neuf progressions, des plus accessibles aux plus complètes. Elles sont ordonnées par ce qu'elles
 * demandent, pas par style : c'est le nombre d'accords inconnus qui décide de ce qu'on propose.
 */
export const PROGRESSIONS: readonly Progression[] = [
  {
    id: 'rock-A',
    title: 'Rock en La (I–IV–V)',
    key: 'La majeur',
    voicingIds: ['A-x02220', 'D-xx0232', 'E-022100'],
    romans: ['I', 'IV', 'V'],
    pattern: 'quarters',
    tempo: 70,
    why: 'Trois accords, tout le rock et tout le blues. Le I–IV–V est la progression la plus jouée du siècle dernier.',
  },
  {
    id: 'blues-A7',
    title: 'Blues en La (I7–IV7–V7)',
    key: 'La majeur',
    voicingIds: ['A7-x02020', 'D7-xx0212', 'E7-020100'],
    romans: ['I7', 'IV7', 'V7'],
    pattern: 'quarters',
    tempo: 80,
    why: 'La même grille, avec les septièmes : c’est le son du blues. Un doigt bouge par rapport aux accords majeurs.',
  },
  {
    id: 'minor-Am',
    title: 'Mineurs en La (i–V–iv–i)',
    key: 'La mineur',
    voicingIds: ['Am-x02210', 'E-022100', 'Dm-xx0231', 'Am-x02210'],
    romans: ['i', 'V', 'iv', 'i'],
    pattern: 'quarters',
    tempo: 60,
    why: 'Trois accords de « Mes premiers accords », dont deux mineurs : La mineur et Mi sont la même forme, une corde plus bas. Lentement, d’abord deux accords, puis les trois.',
  },
  {
    id: 'pop-Em',
    title: 'Boucle mineure (vi–IV–I–V)',
    key: 'Sol majeur',
    voicingIds: ['Em-022000', 'C-x32010', 'G-320003', 'D-xx0232'],
    romans: ['vi', 'IV', 'I', 'V'],
    pattern: 'quarters',
    tempo: 70,
    why: 'La boucle de la moitié des chansons pop. Elle commence par le mineur : c’est ce qui la rend mélancolique.',
  },
  {
    id: 'ballad-Em',
    title: 'Ballade en Mi mineur',
    key: 'Sol majeur',
    voicingIds: ['Em-022000', 'Asus2-x02200', 'C-x32010', 'D-xx0232'],
    romans: ['vi', 'ii', 'IV', 'V'],
    pattern: 'quarters',
    tempo: 65,
    why: 'Deux accords faciles d’un côté (Em, Asus2), les deux murs de l’autre : c’est un bon test de ce qui tient.',
  },
  {
    id: 'doowop-C',
    title: 'Doo-wop en Do (I–vi–IV–V)',
    key: 'Do majeur',
    voicingIds: ['C-x32010', 'Am-x02210', 'Fmaj7-xx3210', 'G-320003'],
    romans: ['I', 'vi', 'IV', 'V'],
    pattern: 'eighths',
    tempo: 65,
    why: 'La grille des années 50, avec Fmaj7 au lieu du Fa barré : la même couleur, sans barré.',
  },
  {
    id: 'folk-G',
    title: 'Folk en Sol (I–IV–vi–V)',
    key: 'Sol majeur',
    voicingIds: ['G-320003', 'C-x32010', 'Em-022000', 'D-xx0232'],
    romans: ['I', 'IV', 'vi', 'V'],
    pattern: 'universal',
    tempo: 70,
    why: 'La progression à connaître par cœur : elle marche dans des centaines de chansons, et elle fait travailler le changement Sol → Do.',
  },
  {
    id: 'country-D',
    title: 'Country en Ré (I–V–vi–IV)',
    key: 'Ré majeur',
    voicingIds: ['D-xx0232', 'A-x02220', 'Bm7-x20202', 'G-320003'],
    romans: ['I', 'V', 'vi7', 'IV'],
    pattern: 'eighths',
    tempo: 75,
    why: 'La boucle pop dans une tonalité de guitare. Le Si mineur y entre par sa version simple (Bm7, deux doigts) : le barré viendra plus tard, il ne bloque rien.',
  },
  {
    id: 'seventies-G',
    title: 'Couleurs en Sol (maj7 et 7)',
    key: 'Sol majeur',
    voicingIds: ['Gmaj7-320002', 'Cadd9-x32030', 'G7-320001', 'C7-x32310'],
    romans: ['Imaj7', 'IVadd9', 'I7', 'IV7'],
    pattern: 'quarters',
    tempo: 60,
    why: 'Entendre ce que les couleurs changent : les mêmes deux accords, quatre couleurs. À jouer lentement.',
  },
];

export function progressionById(id: string): Progression | null {
  return PROGRESSIONS.find((p) => p.id === id) ?? null;
}

/** Voicings d'une progression (les données du curriculum sont la seule source). */
export function progressionVoicings(p: Progression): Voicing[] {
  const out: Voicing[] = [];
  for (const id of p.voicingIds) {
    const v = VOICINGS.find((x) => x.id === id);
    if (!v) throw new Error(`progression ${p.id} : voicing inconnu « ${id} »`);
    out.push(v);
  }
  return out;
}

export interface ProgressionCandidate {
  progression: Progression;
  /** Accords de la progression pas encore appris. */
  missing: string[];
  /** Jouable entièrement avec les accords appris ? */
  playable: boolean;
}

/**
 * Progressions proposées : jouables d'abord, puis celles qui ne demandent qu'un accord de plus. Une
 * progression à trois inconnues reste visible (rien ne se cache) mais n'est pas mise en avant.
 */
export function progressionCandidates(learned: ReadonlySet<string>): ProgressionCandidate[] {
  return PROGRESSIONS.map((progression) => {
    const missing = [...new Set(progression.voicingIds.filter((id) => !learned.has(id)))];
    return { progression, missing, playable: missing.length === 0 };
  }).sort((a, b) => a.missing.length - b.missing.length);
}

/** La tablature de la progression : un accord par mesure, un motif de strum, les chiffres romains. */
export function progressionScore(p: Progression, opts: { tempo?: number; pattern?: StrumPatternId } = {}): TabScore {
  return progressionToScore(progressionVoicings(p), {
    tempo: opts.tempo ?? p.tempo,
    pattern: opts.pattern ?? p.pattern,
    romans: p.romans,
    id: `progression:${p.id}`,
  });
}
