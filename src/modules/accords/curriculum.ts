/**
 * Module Accords — curriculum des formes ouvertes (phase 4a), en données.
 *
 * L'ordre n'est pas théorique (I-IV-V), il est **physique** : chaque nouvel accord est soit un accord
 * connu + un doigt, soit le même doigté décalé d'une corde. Le palier P4 (Do et Sol) est le mur des
 * débutants ; il s'ouvre par un marchepied (Cmaj7) et n'est jamais un verrou pour la suite.
 * Justifications complètes : MUSIC_DESIGN.md §4.2 ; avis de prof par palier ci-dessous.
 *
 * Ce fichier ne contient **aucune logique de décision** : il décrit. Les règles (prérequis, prochain
 * accord, transitions) sont dans `recommend.ts` et testées.
 */
import { VOICINGS } from '../../data/voicings';

export interface ChordEntry {
  /** Identifiant d'un voicing de `src/data/voicings.ts`. */
  voicingId: string;
  /** Pourquoi cet accord arrive ici, en une phrase utilisable à l'écran. */
  why: string;
  /** Accords à savoir déjà former (identifiants de voicings). */
  prereq: string[];
}

export interface Palier {
  id: 'P0' | 'P1' | 'P2' | 'P2b' | 'P3' | 'P4';
  title: string;
  goal: string;
  entries: ChordEntry[];
  /** Transitions à travailler, dans l'ordre d'utilité (paires de voicings). */
  transitions: [string, string][];
  /** Branche optionnelle (rock) : ouverte dès P2, jamais imposée. */
  branch?: boolean;
  /** Étape sans accord à former (P0 : matériel, posture, une note nette). */
  drills?: string[];
  /** Avis de prof : ce qui se joue vraiment dans ce palier. */
  prof: string;
}

export const CURRICULUM: readonly Palier[] = [
  {
    id: 'P0',
    title: 'Fondations',
    goal: 'Une seule note, nette, et un instrument accordé.',
    entries: [],
    transitions: [],
    drills: [
      'accorder les six cordes (accordeur guidé)',
      'nommer les cordes : Mi grave · La · Ré · Sol · Si · mi aigu',
      'lire une pile d’accord en tablature : X, 0, chiffres, flèches',
      'posture : pouce derrière le manche, doigts arrondis, près de la frette',
      'un seul doigt, une note qui sonne (validée au micro)',
    ],
    prof:
      'Rien à jouer encore : ce palier valide le matériel. Un débutant qui n’entend pas la différence entre « ça sonne » et « ça frise » ne peut pas apprendre un accord — et c’est exactement ce que le micro vérifie ici.',
  },
  {
    id: 'P1',
    title: 'Un ou deux doigts',
    goal: 'Deux accords qui sonnent tout de suite, sans rien étouffer côté aigu.',
    entries: [
      { voicingId: 'Em-022000', why: 'le premier accord : deux doigts, six cordes qui sonnent, rien à étouffer', prereq: [] },
      { voicingId: 'Em7-020000', why: 'un seul doigt, et tu changes de couleur en levant le majeur', prereq: ['Em-022000'] },
      { voicingId: 'Asus2-x02200', why: 'la même paire de doigts que Mi mineur, décalée d’une corde', prereq: ['Em-022000'] },
      { voicingId: 'Am7-x02010', why: 'deux doigts, une couleur douce ; la 6e corde ne se joue pas', prereq: ['Asus2-x02200'] },
    ],
    transitions: [
      ['Em-022000', 'Em7-020000'],
      ['Em-022000', 'Asus2-x02200'],
    ],
    prof:
      'Mi mineur d’abord, parce qu’il sonne même si la main est mal placée : c’est le premier succès sonore. Am est volontairement plus loin (P2) : trois doigts et cinq cordes à jouer, ce n’est pas un accord « à 1-2 doigts ».',
  },
  {
    id: 'P2',
    title: 'Famille Mi / La, trois doigts',
    goal: 'Les quatre accords qui ouvrent la moitié du répertoire rock et folk.',
    entries: [
      { voicingId: 'Am-x02210', why: 'Asus2 + l’index : ton premier mineur « complet »', prereq: ['Asus2-x02200'] },
      { voicingId: 'E-022100', why: 'la même forme que La mineur, une corde plus grave', prereq: ['Am-x02210'] },
      { voicingId: 'A-x02220', why: 'la forme de Mi, une corde plus aiguë : même geste, un demi-ton plus haut', prereq: ['E-022100'] },
      { voicingId: 'E7-020100', why: 'un doigt s’en va, la couleur devient blues', prereq: ['E-022100'] },
      { voicingId: 'A7-x02020', why: 'idem sur la forme de La ; c’est l’accord qui appelle Ré', prereq: ['A-x02220'] },
    ],
    transitions: [
      ['Em-022000', 'Am-x02210'],
      ['Am-x02210', 'E-022100'],
      ['E-022100', 'A-x02220'],
      ['A-x02220', 'Am-x02210'],
      ['Asus2-x02200', 'Am-x02210'],
    ],
    prof:
      'Le pivot de ce palier, c’est la forme de Mi : Mi, La mineur et La majeur ne sont qu’une même forme déplacée d’une corde. Après ce palier, un débutant peut jouer des chansons entières avec quatre accords.',
  },
  {
    id: 'P2b',
    title: 'Branche rock — power chords',
    goal: 'Deux doigts, du son, et la notion d’accord sans tierce.',
    entries: [
      { voicingId: 'E5-022xxx', why: 'deux doigts, tout le rock : ni majeur ni mineur', prereq: ['E-022100'] },
      { voicingId: 'A5-x022xx', why: 'la même forme une corde plus haut', prereq: ['E5-022xxx'] },
      { voicingId: 'D5-xx023x', why: 'sur la corde de Ré : le riff qui va avec', prereq: ['A5-x022xx'] },
      { voicingId: 'G5-355xxx', why: 'premier power chord mobile : la forme se déplace', prereq: ['D5-xx023x'] },
      { voicingId: 'C5-x355xx', why: 'la même, une case plus bas sur la corde de La', prereq: ['G5-355xxx'] },
    ],
    transitions: [
      ['E5-022xxx', 'A5-x022xx'],
      ['G5-355xxx', 'C5-x355xx'],
    ],
    branch: true,
    prof:
      'Branche ouverte, jamais imposée : les power chords sont faciles pour la main gauche et très motivants, mais ils n’apprennent ni le majeur ni le mineur. On les présente pour ce qu’ils sont — un accord sans tierce.',
  },
  {
    id: 'P3',
    title: 'Famille Ré',
    goal: 'Un triangle serré sur trois cordes, et le premier vrai enchaînement de blues.',
    entries: [
      { voicingId: 'Dsus2-xx0230', why: 'le geste de Ré avec deux doigts seulement', prereq: [] },
      { voicingId: 'D-xx0232', why: 'le triangle de Ré : trois cordes, trois doigts serrés', prereq: ['Dsus2-xx0230'] },
      { voicingId: 'Dsus4-xx0233', why: 'un doigt de plus : la couleur suspendue, sans changer de forme', prereq: ['D-xx0232'] },
      { voicingId: 'Dm-xx0231', why: 'un seul doigt bouge par rapport à Ré : le mode mineur', prereq: ['D-xx0232'] },
    ],
    transitions: [
      ['A-x02220', 'D-xx0232'],
      ['D-xx0232', 'Dsus2-xx0230'],
      ['D-xx0232', 'Dsus4-xx0233'],
      ['D-xx0232', 'Dm-xx0231'],
    ],
    prof:
      'Le triangle de Ré fatigue la main au début : on passe par Dsus2 pour installer le geste, puis on ajoute. Ré → Sol et La → Ré sont les deux transitions les plus utiles du blues et du folk.',
  },
  {
    id: 'P4',
    title: 'Les deux murs : Do et Sol',
    goal: 'Passer le palier où la moitié des débutants décroche, avec des marches.',
    entries: [
      { voicingId: 'Cmaj7-x32000', why: 'deux doigts, et presque Do : le marchepied', prereq: ['Am-x02210'] },
      { voicingId: 'C-x32010', why: 'Cmaj7 + l’index : le Do complet, sixième corde étouffée', prereq: ['Cmaj7-x32000'] },
      { voicingId: 'G-320003', why: 'trois doigts, un accord qui sonne large', prereq: ['D-xx0232'] },
      { voicingId: 'G-320033', why: 'la variante à quatre doigts : plus pleine, l’auriculaire sur la corde de Si', prereq: ['G-320003'] },
    ],
    transitions: [
      ['Cmaj7-x32000', 'C-x32010'],
      ['C-x32010', 'Am-x02210'],
      ['D-xx0232', 'G-320003'],
      ['G-320003', 'C-x32010'],
      ['Em-022000', 'C-x32010'],
    ],
    prof:
      'Sol et Do sont deux murs pour deux raisons différentes : Do demande d’étouffer la 6e corde et d’écarter la main, Sol demande de changer tout le poignet. D’où le marchepied Cmaj7 et la variante 4 doigts de Sol, et d’où l’interdiction de bloquer : si Do ne vient pas, G/B et C/G permettent de jouer quand même.',
  },
];

/** Tous les accords du parcours principal (hors branche), dans l'ordre d'apprentissage. */
export function mainlineChordIds(): string[] {
  return CURRICULUM.filter((p) => !p.branch).flatMap((p) => p.entries.map((e) => e.voicingId));
}

export function allChordIds(): string[] {
  return CURRICULUM.flatMap((p) => p.entries.map((e) => e.voicingId));
}

export function palierOfVoicing(voicingId: string): Palier | null {
  return CURRICULUM.find((p) => p.entries.some((e) => e.voicingId === voicingId)) ?? null;
}

export function entryOf(voicingId: string): { palier: Palier; entry: ChordEntry } | null {
  for (const palier of CURRICULUM) {
    const entry = palier.entries.find((e) => e.voicingId === voicingId);
    if (entry) return { palier, entry };
  }
  return null;
}

/** Le voicing correspondant, ou une erreur explicite (le curriculum ne doit jamais pointer dans le vide). */
export function voicingFor(voicingId: string) {
  const v = VOICINGS.find((x) => x.id === voicingId);
  if (!v) throw new Error(`curriculum : voicing inconnu « ${voicingId} »`);
  return v;
}

/** Nombre d'accords du parcours principal par palier (affiché à l'écran). */
export function palierProgress(learned: ReadonlySet<string>): { total: number; done: number } {
  const ids = mainlineChordIds();
  return { total: ids.length, done: ids.filter((id) => learned.has(id)).length };
}
