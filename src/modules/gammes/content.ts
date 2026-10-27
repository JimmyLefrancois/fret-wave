/**
 * Contenu éditorial du module Gammes : groupes du catalogue, notes pédagogiques par gamme,
 * et trois points d'entrée recommandés. Aucune logique : c'est du texte relu en tant que prof.
 */
import type { PositionSystem } from '../../core/theory';

export interface ScaleGroup {
  id: string;
  title: string;
  /** Étiquette courte pour les segments sur téléphone. */
  short: string;
  /** Une ligne de contexte affichée sous le titre du groupe. */
  note: string;
  scaleIds: readonly string[];
}

export const SCALE_GROUPS: readonly ScaleGroup[] = [
  {
    id: 'pent',
    title: 'Pentatoniques & blues',
    short: 'Pentatoniques',
    note: 'Le meilleur premier succès : 2 notes par corde, ça sonne tout de suite.',
    scaleIds: ['pentatonic-minor', 'pentatonic-major', 'blues-minor', 'blues-major'],
  },
  {
    id: 'diatonic',
    title: 'Majeure & modes',
    short: 'Majeure & modes',
    note: 'Sept gammes, les mêmes notes : seule la tonique se déplace.',
    scaleIds: ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'],
  },
  {
    id: 'harmonic',
    title: 'Mineure harmonique',
    short: 'Harmonique',
    note: 'La 7e majeure crée la seconde augmentée : 3NPS avec étirement.',
    scaleIds: ['harmonic-minor', 'locrian-natural6', 'ionian-augmented', 'dorian-sharp4', 'phrygian-dominant', 'lydian-sharp2', 'altered-diminished'],
  },
  {
    id: 'melodic',
    title: 'Mineure mélodique (jazz)',
    short: 'Mélodique',
    note: 'Montée et descente identiques ; ses modes servent à improviser.',
    scaleIds: ['melodic-minor', 'dorian-b2', 'lydian-augmented', 'lydian-dominant', 'mixolydian-b6', 'locrian-natural2', 'altered'],
  },
  {
    id: 'sym',
    title: 'Symétriques & bebop',
    short: 'Symétriques',
    note: 'Motifs qui se répètent : moins de transpositions à réviser.',
    scaleIds: ['whole-tone', 'diminished-wh', 'diminished-hw', 'augmented', 'bebop-dominant', 'bebop-major'],
  },
];

/** Une phrase de prof par gamme : ce qu'il faut écouter, pas ce qu'il faut réciter. */
export const SCALE_HINTS: Readonly<Record<string, string>> = {
  'pentatonic-minor': 'Deux notes par corde, aucune note « à éviter » : la gamme qui sonne tout de suite, sur presque tout groove mineur.',
  'pentatonic-major': 'Les cinq mêmes formes que la pentatonique mineure, une tierce plus haut : La m pent = Do maj pent.',
  'blues-minor': 'La pentatonique mineure + la ♭5 (blue note). Elle est de passage : on la touche et on repart.',
  'blues-major': '1 2 ♭3 3 5 6 : la ♭3 frotte contre la 3e, et c’est voulu (country, rock’n’roll, blues majeur).',
  ionian: 'La majeure. La sensible (7) tire vers la tonique : c’est l’oreille qui décide de la tonique, pas la forme.',
  dorian: 'Mineure naturelle avec 6te majeure : c’est LA note du dorien, celle qui le sépare de l’éolien. Sur un groove en Ré m, elle sonne « jazz » sans être triste.',
  phrygien: 'La ♭2 est la note du phrygien : un demi-ton au-dessus de la tonique, couleur flamenco / métal.',
  lydian: 'Le ♯4, seule différence avec la majeure : couleur « film », suspension qui ne se pose jamais.',
  mixolydian: 'La majeure avec ♭7 : la gamme du V7 et de tout le rock. Une seule note change par rapport à la majeure.',
  aeolian: 'La mineure naturelle : ♭3 ♭6 ♭7. Le ♭6 la sépare du dorien — même forme, une note plus sombre.',
  locrian: '♭2 et ♭5 : instable sur une tonique. À penser comme la gamme du m7♭5 (le II du mineur) plutôt que comme une tonique.',
  'harmonic-minor': 'La 7e majeure crée la seconde augmentée ♭6→7 : couleur classique / métal, avec un étirement 3NPS documenté.',
  'locrian-natural6': '2e mode de l’harmonique. Rare : à visiter après les modes diatoniques.',
  'ionian-augmented': '3e mode de l’harmonique : ♯5, couleur augmentée.',
  'dorian-sharp4': '4e mode de l’harmonique : dorien avec ♯4.',
  'phrygian-dominant': '5e mode de l’harmonique = mixolydien ♭9 ♭13. Le V7 qui résout vers un mineur (flamenco, métal).',
  'lydian-sharp2': '6e mode de l’harmonique : ♯2, très instable.',
  'altered-diminished': '7e mode de l’harmonique (super-locrien 𝄫7) : sur un accord diminué.',
  'melodic-minor': 'Convention jazz : 1 2 ♭3 4 5 6 7 en montée ET en descente. Ses modes servent à improviser (altéré, lydien dominant).',
  'dorian-b2': '2e mode de la mélodique : dorien avec ♭2.',
  'lydian-augmented': '3e mode de la mélodique : ♯5.',
  'lydian-dominant': '4e mode : ♯4 + ♭7, la gamme du II7 « lydien » en jazz.',
  'mixolydian-b6': '5e mode de la mélodique : ♭6, couleur mélancolique sur un V.',
  'locrian-natural2': '6e mode = demi-diminué : la gamme du m7♭5 de la mélodique.',
  altered: '7e mode : ♭2 ♭3 ♭4 ♭5 ♭6 ♭7, la gamme du V7 altéré qui résout vers un mineur.',
  'whole-tone': 'Six notes, tout en tons : deux transpositions seulement. Sur un 7♯5.',
  'diminished-wh': 'Ton–demi-ton, 8 notes, motif tous les 3 cases : sur un accord diminué.',
  'diminished-hw': 'Demi-ton–ton : la même collection lue depuis l’autre type de note (2 modes distincts).',
  augmented: '1 ♯2 3 5 ♯5 7, motif toutes les 4 cases : quatre transpositions.',
  'bebop-dominant': 'Mixolydien + la 7M de passage : la gamme des boppers sur un V7.',
  'bebop-major': 'Ionien + la ♯5 de passage : sur un Imaj7.',
};

export interface EntryPoint {
  scaleId: string;
  tonic: string;
  system: PositionSystem;
  /** Forme CAGED visée, si le système est CAGED. */
  shape?: 'C' | 'A' | 'G' | 'E' | 'D';
  title: string;
  why: string;
}

/** Trois portes d'entrée : premier succès, couleur de mode, lien avec les accords. */
export const ENTRY_POINTS: readonly EntryPoint[] = [
  {
    scaleId: 'pentatonic-minor', tonic: 'A', system: 'boxes',
    title: 'La mineure pentatonique · box 1',
    why: 'Le premier succès : deux notes par corde, cases 5–8, aucune note à éviter.',
  },
  {
    scaleId: 'dorian', tonic: 'D', system: '3nps',
    title: 'Ré dorien · position 1',
    why: 'Entendre une note caractéristique : la 6te majeure, seule différence avec la mineure naturelle.',
  },
  {
    scaleId: 'ionian', tonic: 'C', system: 'caged', shape: 'E',
    title: 'Do majeur · forme de Mi (CAGED)',
    why: 'Le pont avec les accords : ton Mi barré est là, la gamme l’entoure.',
  },
];
