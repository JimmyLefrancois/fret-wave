/**
 * Liste des accords (D128) : les formes de `data/voicings`, rangées par type puis par fondamentale, comme
 * dans un dictionnaire. Les triades sur trois cordes (`triad3`) n'y entrent pas : elles n'ont jamais été
 * proposées à l'écran.
 */
import { interpretChord } from '../../core/theory/chords';
import { findVoicings, lowFret } from '../../core/theory/chordFinder';
import type { NoteName } from '../../core/theory';
import type { Voicing } from '../../core/theory/voicings';

export type ChordGroupId = 'majeurs' | 'mineurs' | 'septiemes' | 'couleurs' | 'slash' | 'power';

export interface ChordGroup {
  id: ChordGroupId;
  title: string;
  voicings: Voicing[];
}

const TITLES: readonly (readonly [ChordGroupId, string])[] = [
  ['majeurs', 'Majeurs'],
  ['mineurs', 'Mineurs'],
  ['septiemes', 'Septièmes'],
  ['couleurs', 'Sus et add'],
  ['slash', 'Slash'],
  ['power', 'Power chords'],
];

/** Ordre de la gamme de Do : Do, Ré, Mi, Fa, Sol, La, Si. */
const ROOTS = 'CDEFGAB';

function groupOf(v: Voicing): ChordGroupId | null {
  if (v.family === 'triad3') return null;
  const { quality, bass } = interpretChord(v.chord);
  if (bass) return 'slash';
  switch (quality.id) {
    case 'maj': return 'majeurs';
    case 'min': return 'mineurs';
    case 'dom7':
    case 'maj7':
    case 'min7': return 'septiemes';
    case 'power': return 'power';
    default: return 'couleurs';
  }
}

function rootRank(v: Voicing): number {
  return ROOTS.indexOf(interpretChord(v.chord).root.charAt(0));
}

export function chordGroups(voicings: readonly Voicing[]): ChordGroup[] {
  const sorted = [...voicings].sort((a, b) => rootRank(a) - rootRank(b)
    || a.chord.localeCompare(b.chord)
    || a.difficulty - b.difficulty);
  return TITLES
    .map(([id, title]) => ({ id, title, voicings: sorted.filter((v) => groupOf(v) === id) }))
    .filter((g) => g.voicings.length > 0);
}

/** Une note par hauteur : les orthographes courantes en tête de manche. */
export const DICT_TONICS: readonly NoteName[] = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export interface DictType { suffix: string; label: string }

export const DICT_BASIC: readonly DictType[] = [{ suffix: '', label: 'Majeur' }, { suffix: 'm', label: 'Mineur' }];
const typeLabel = (suffix: string) => (suffix === '5' ? 'Power' : suffix.replace(/b/g, '♭').replace(/#/g, '♯'));

/** Types de « Avancé », rangés par famille : on cherche un 7♭9 parmi les altérés, pas parmi 48 boutons. */
export const DICT_FAMILIES: readonly { title: string; types: readonly DictType[] }[] = ([
  ['Septièmes', ['7', 'm7', 'maj7', 'mmaj7', '7sus4']],
  ['Sixtes', ['6', 'm6', '6add9', 'm6add9']],
  ['Sus, add, power', ['sus2', 'sus4', 'sus2sus4', 'add9', 'm(add9)', '5']],
  ['Neuvièmes', ['9', 'm9', 'maj9', 'mmaj9', 'maj9(#11)']],
  ['Onzièmes et treizièmes', ['11', 'm11', 'maj11', '13', 'm13', 'maj13', '13#11', 'maj13(#11)']],
  ['Altérés', ['7b5', '7#5', '7b9', '7#9', '7(b5,b9)', '7(b5,#9)', '7(#5,b9)', '7(#5,#9)', '9b5', '9#5', '11b9', '13b9', 'maj7(b5)', 'maj7(#5)', 'm7#5']],
  ['Diminués et augmentés', ['dim', 'dim7', 'm7b5', 'aug', '-5']],
] as const).map(([title, suffixes]) => ({ title, types: suffixes.map((suffix) => ({ suffix, label: typeLabel(suffix) })) }));

export const DICT_ADVANCED: readonly DictType[] = DICT_FAMILIES.flatMap((f) => f.types);

/** Variantes d'un accord : les formes saisies et relues d'abord, puis une forme calculée par zone libre du manche. */
export function dictionaryForms(symbol: string, curated: readonly Voicing[]): Voicing[] {
  const mine = curated.filter((v) => v.chord === symbol && v.family !== 'triad3');
  return [...mine, ...findVoicings(symbol, { taken: mine.map(lowFret) })];
}
