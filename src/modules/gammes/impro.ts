/**
 * Improvisation (phase 7) — **les accompagnements**, en données.
 *
 * Le brief demande deux styles jouables : **synthwave** et **lo-fi**. Ce ne sont pas deux habillages du
 * même fichier : la grille change. Une boucle en mineur (i–♭VI–♭III–♭VII) ne se joue pas comme un
 * ii–V–I de jazz, et c'est justement ce qui fait travailler l'oreille.
 *
 * Les accords sont décrits **par degré** (demi-tons depuis la tonique) et non par nom : la même boucle
 * se transpose sur n'importe quelle tonique, et l'élève peut improviser dans la gamme qu'il travaille.
 * Le chiffrage romain (i, ♭VI, IV…) est fourni pour l'affichage — c'est le vocabulaire qu'on lit sur
 * une grille, pas encore celui qu'on demande à un débutant : l'écran montre le nom de l'accord, et le
 * chiffrage en second.
 */
import type { ChordContext, ChordQuality } from '../../core/impro/classify';

export type BackingStyle = 'synthwave' | 'lofi';
export type BackingMode = 'minor' | 'major';

export interface ImproChordSpec {
  /** Demi-tons depuis la tonique (0 = i/I, 8 = ♭VI, 5 = IV…). */
  offset: number;
  quality: ChordQuality;
  /** Chiffrage romain, pour l'affichage secondaire. */
  roman: string;
}

export interface ImproBackage {
  id: string;
  style: BackingStyle;
  mode: BackingMode;
  label: string;
  tempo: number;
  /** Un accord par mesure, dans l'ordre. */
  chords: readonly ImproChordSpec[];
  why: string;
}

/** Libellé de style, à l'écran. */
export const STYLE_LABEL: Record<BackingStyle, string> = {
  synthwave: 'Synthwave',
  lofi: 'Lo-fi',
};

/**
 * Quatre accompagnements. Le mineur est le terrain de jeu de la pentatonique (le premier succès) ; le
 * majeur sert les gammes majeures. Lo-fi prend des accords de septième : c'est sa couleur, et c'est
 * l'occasion d'entendre une septième comme **note d'accord** et non comme une fausse note.
 */
export const IMPRO_BACKINGS: readonly ImproBackage[] = [
  {
    id: 'synthwave-minor',
    style: 'synthwave',
    mode: 'minor',
    label: 'Synthwave · mineur',
    tempo: 96,
    chords: [
      { offset: 0, quality: 'min', roman: 'i' },
      { offset: 8, quality: 'maj', roman: '♭VI' },
      { offset: 3, quality: 'maj', roman: '♭III' },
      { offset: 10, quality: 'maj', roman: '♭VII' },
    ],
    why: 'La boucle mineure la plus jouée du genre : elle laisse la pentatonique mineure sonner sur les quatre mesures, sans une seule note à éviter.',
  },
  {
    id: 'synthwave-major',
    style: 'synthwave',
    mode: 'major',
    label: 'Synthwave · majeur',
    tempo: 100,
    chords: [
      { offset: 0, quality: 'maj', roman: 'I' },
      { offset: 7, quality: 'maj', roman: 'V' },
      { offset: 9, quality: 'min', roman: 'vi' },
      { offset: 5, quality: 'maj', roman: 'IV' },
    ],
    why: 'I–V–vi–IV : la boucle pop par excellence. Elle apprend à changer de couleur sans changer de gamme.',
  },
  {
    id: 'lofi-minor',
    style: 'lofi',
    mode: 'minor',
    label: 'Lo-fi · mineur',
    tempo: 76,
    chords: [
      { offset: 0, quality: 'min7', roman: 'i7' },
      { offset: 5, quality: 'min7', roman: 'iv7' },
      { offset: 10, quality: 'maj', roman: '♭VII' },
      { offset: 3, quality: 'maj7', roman: '♭IIImaj7' },
    ],
    why: 'Des septièmes partout, un tempo lent : on entend chaque note se poser. La neuvième et la sixte y sont chez elles.',
  },
  {
    id: 'lofi-major',
    style: 'lofi',
    mode: 'major',
    label: 'Lo-fi · ii–V–I',
    tempo: 72,
    chords: [
      { offset: 2, quality: 'min7', roman: 'ii7' },
      { offset: 7, quality: 'dom7', roman: 'V7' },
      { offset: 0, quality: 'maj7', roman: 'Imaj7' },
      { offset: 9, quality: 'min7', roman: 'vi7' },
    ],
    why: 'Le ii–V–I du jazz, ralenti. C\'est la grille où la septième de dominante demande à descendre d\'un demi-ton.',
  },
];

/** Accompagnements disponibles pour un mode. */
export function backingsFor(mode: BackingMode): readonly ImproBackage[] {
  return IMPRO_BACKINGS.filter((b) => b.mode === mode);
}

/** Accord d'une mesure : fondamentale (classe de hauteur), qualité, chiffrage. */
export function chordAtMeasure(b: ImproBackage, tonicPc: number, measure: number): ChordContext & { roman: string } {
  const spec = b.chords[((measure % b.chords.length) + b.chords.length) % b.chords.length]!;
  return { root: (((tonicPc + spec.offset) % 12) + 12) % 12, quality: spec.quality, roman: spec.roman };
}

/** Nom d'accord lisible (« Em7 », « Cmaj7 », « D »), sans dépendre du module de théorie. */
const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: '', min: 'm', dom7: '7', min7: 'm7', maj7: 'maj7', sus4: 'sus4',
};

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function chordName(root: number, quality: ChordQuality): string {
  return `${SHARP_NAMES[((root % 12) + 12) % 12]}${QUALITY_SUFFIX[quality]}`;
}
