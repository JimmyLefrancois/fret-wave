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
import { CHORD_INTERVALS, type ChordContext, type ChordQuality } from '../../core/impro/classify';
import { getScale, semitonesOf, type ScaleDef } from '../../core/theory';

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

/* --- grille au choix -------------------------------------------------------------------------------
   L'élève remplace les accords de la boucle. Un accord est **cohérent avec la gamme** quand toutes ses
   notes en font partie. Les pentatoniques et les blues n'ont pas assez de notes pour porter des accords
   (La pentatonique mineure n'a ni Fa ni Si) : on prend alors la gamme à sept notes dont elles sont
   tirées (éolien pour le mineur, ionien pour le majeur), celle sur laquelle on les joue en pratique. */

/** Gamme de référence pour bâtir les accords : la gamme elle-même, ou sa gamme parente à sept notes. */
export function harmonyScaleOf(def: ScaleDef): ScaleDef {
  if (def.id === 'pentatonic-major' || def.id === 'blues-major') return getScale('ionian');
  if (def.family === 'pentatonic' || def.family === 'blues') return getScale('aeolian');
  return def;
}

const QUALITY_ORDER: readonly ChordQuality[] = ['maj', 'min', 'sus4', 'maj7', 'dom7', 'min7'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
/** Altération du degré, depuis la qualité de l'intervalle (« 3m » → ♭III, « 4A » → ♯IV). */
const ACCIDENTAL: Record<string, string> = { m: '♭', d: '♭', A: '♯', M: '', P: '' };
/** Hors gamme : orthographe par défaut d'un demi-ton. */
const CHROMATIC_ROMAN = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♭V', 'V', '♭VI', 'VI', '♭VII', 'VII'];

/** Chiffrage romain d'un accord (« ♭VI », « ii7 », « ♭IIImaj7 »), orthographié selon la gamme. */
export function romanOf(offset: number, quality: ChordQuality, def?: ScaleDef): string {
  const off = ((offset % 12) + 12) % 12;
  let base = CHROMATIC_ROMAN[off]!;
  if (def) {
    const i = semitonesOf(def).findIndex((st) => ((st % 12) + 12) % 12 === off);
    const m = i >= 0 ? /^(\d+)([PMmdA])$/.exec(def.intervals[i]!) : null;
    if (m) base = `${ACCIDENTAL[m[2]!] ?? ''}${ROMAN[(Number(m[1]) - 1) % 7]}`;
  }
  const minor = quality === 'min' || quality === 'min7';
  const numeral = minor ? base.toLowerCase() : base;
  const suffix: Record<ChordQuality, string> = { maj: '', min: '', sus4: 'sus4', maj7: 'maj7', dom7: '7', min7: '7' };
  return `${numeral}${suffix[quality]}`;
}

/**
 * Accords proposés pour une gamme : sur chaque degré de la gamme de référence, chaque qualité dont toutes
 * les notes appartiennent à cette gamme. Ordre : degré, puis triades avant septièmes.
 */
export function chordChoices(def: ScaleDef): ImproChordSpec[] {
  const own = chordsInScale(harmonyScaleOf(def));
  if (own.length >= 4) return own;
  // gamme symétrique sans quinte juste (tons entiers) : trop peu d'accords, on se rabat sur le mode
  // majeur ou mineur que dit sa tierce, comme l'accompagnement par défaut
  const major = semitonesOf(def).some((st) => st % 12 === 4);
  return chordsInScale(getScale(major ? 'ionian' : 'aeolian'));
}

function chordsInScale(ref: ScaleDef): ImproChordSpec[] {
  const pcs = new Set(semitonesOf(ref).map((st) => ((st % 12) + 12) % 12));
  const out: ImproChordSpec[] = [];
  for (const root of [...pcs].sort((a, b) => a - b)) {
    for (const quality of QUALITY_ORDER) {
      if (CHORD_INTERVALS[quality].every((iv) => pcs.has((root + iv) % 12))) {
        out.push({ offset: root, quality, roman: romanOf(root, quality, ref) });
      }
    }
  }
  return out;
}

/** Un accord fait-il partie des choix ? (même degré, même qualité) */
export function sameChord(a: Pick<ImproChordSpec, 'offset' | 'quality'>, b: Pick<ImproChordSpec, 'offset' | 'quality'>): boolean {
  return ((a.offset % 12) + 12) % 12 === ((b.offset % 12) + 12) % 12 && a.quality === b.quality;
}
