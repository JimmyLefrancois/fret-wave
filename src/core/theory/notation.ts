/**
 * Couche UNIQUE de conversion / affichage anglo-saxon ↔ solfège.
 * Le modèle de données ne contient jamais de solfège ; tout composant passe par fmtNote / fmtChord.
 */
import type { ChordNotation, DisplayOptions, NoteName, NoteNotation } from './types';

const EN_TO_FR: Record<string, string> = { C: 'Do', D: 'Ré', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
const FR_TO_EN: Record<string, string> = {
  do: 'C', ré: 'D', re: 'D', mi: 'E', fa: 'F', sol: 'G', la: 'A', si: 'B',
};

const ACC_VALUE: Record<string, number> = {
  '#': 1, '♯': 1, b: -1, '♭': -1, x: 2, '𝄪': 2, '𝄫': -2, '♮': 0,
};

/** Altération → glyphes d'affichage. */
export function accidentalGlyph(alt: number): string {
  switch (alt) {
    case 0: return '';
    case 1: return '♯';
    case 2: return '𝄪';
    case -1: return '♭';
    case -2: return '𝄫';
    default: throw new RangeError(`altération non affichable : ${alt}`);
  }
}

/** Altération → ASCII du modèle ("#", "##", "b", "bb"). */
export function accidentalAscii(alt: number): string {
  if (alt === 0) return '';
  if (Math.abs(alt) > 2) throw new RangeError(`altération non gérée : ${alt}`);
  return (alt > 0 ? '#' : 'b').repeat(Math.abs(alt));
}

export interface ParsedNote {
  letter: string; // "C".."B"
  alt: number; // -2..2
  octave: number | null;
}

const EN_RE = /^([A-Ga-g])([#♯b♭x𝄪𝄫♮]*)(-?\d+)?$/u;
const FR_RE = /^(do|ré|re|mi|fa|sol|la|si)([#♯b♭x𝄪𝄫♮]*)(-?\d+)?$/iu;

function accSum(s: string): number | null {
  let sum = 0;
  for (const ch of s) {
    const v = ACC_VALUE[ch];
    if (v === undefined) return null;
    sum += v;
  }
  return Math.abs(sum) > 2 ? null : sum;
}

/**
 * Lit une note écrite en solfège OU en anglo ("Si♭", "Sib", "Bb", "mi", "F##", "Fa𝄪", "E2").
 * Renvoie null si l'entrée est invalide. Une lettre anglo seule est toujours anglo ("B" = Si).
 */
export function parseNote(input: string): ParsedNote | null {
  const s = input.trim();
  const fr = FR_RE.exec(s);
  if (fr) {
    const letter = FR_TO_EN[fr[1]!.toLowerCase()]!;
    const alt = accSum(fr[2] ?? '');
    if (alt === null) return null;
    return { letter, alt, octave: fr[3] !== undefined ? Number(fr[3]) : null };
  }
  const en = EN_RE.exec(s);
  if (en) {
    const alt = accSum(en[2] ?? '');
    if (alt === null) return null;
    // 'x' est une altération (double dièse) en anglo aussi : "Fx" = F##. Mais "b" après la lettre = bémol.
    return { letter: en[1]!.toUpperCase(), alt, octave: en[3] !== undefined ? Number(en[3]) : null };
  }
  return null;
}

/** Forme canonique du modèle (anglo, ASCII) : "Si♭" → "Bb", "Fa𝄪3" → "F##3". */
export function toModelNote(input: string): NoteName | null {
  const p = parseNote(input);
  if (!p) return null;
  return `${p.letter}${accidentalAscii(p.alt)}${p.octave ?? ''}`;
}

/** Nom du modèle → affichage. Fonction pure, testée, unique point d'affichage des notes. */
export function fmtNote(note: NoteName, notation: NoteNotation = 'fr'): string {
  const p = parseNote(note);
  if (!p) throw new Error(`note invalide : "${note}"`);
  const letter = notation === 'fr' ? EN_TO_FR[p.letter]! : p.letter;
  return `${letter}${accidentalGlyph(p.alt)}${p.octave ?? ''}`;
}

/** Étiquette de corde dans la tab : en solfège, "mi" minuscule distingue la corde aiguë. */
export function fmtStringLabel(pitch: string, isHighestString: boolean, notation: NoteNotation = 'fr'): string {
  const p = parseNote(pitch);
  if (!p) throw new Error(`hauteur invalide : "${pitch}"`);
  const base = notation === 'fr' ? EN_TO_FR[p.letter]! : p.letter;
  const cased = isHighestString ? base.toLowerCase() : base;
  return `${cased}${accidentalGlyph(p.alt)}`;
}

/**
 * Fonction d'intervalle du modèle (`b3`, `#4`, `bb7`) → glyphes d'affichage (`♭3`, `♯4`, `𝄫7`).
 * Le modèle ne porte **que** l'ASCII : cette fonction est le seul point où l'app dessine une altération
 * de degré, comme `fmtNote` l'est pour les notes. Un `b3` affiché tel quel dans un paragraphe est un
 * oubli de cette couche, pas un choix.
 */
export function fmtDegree(fn: string): string {
  return fn.replace(/bb/g, '𝄫').replace(/##/g, '𝄪').replace(/b/g, '♭').replace(/#/g, '♯');
}

/** Ramène les glyphes d'altération à l'ASCII du modèle : « ♭3 » → « b3 ». */
export function toAsciiDegree(fn: string): string {
  return fn.replace(/𝄫/g, 'bb').replace(/𝄪/g, '##').replace(/♭/g, 'b').replace(/♯/g, '#');
}

// ---------------------------------------------------------------------------
// Symboles d'accord
// ---------------------------------------------------------------------------

export interface ParsedChordSymbol {
  root: NoteName;
  /** Suffixe du modèle : "", "m", "7", "maj7", "m7b5", "sus4", "add9", "dim", "5"… */
  suffix: string;
  bass: NoteName | null;
}

/**
 * Découpe un symbole du modèle (anglo) : "Cmaj7/G", "F#m7b5", "Bb".
 * Règle : une altération juste après la lettre fait partie de la fondamentale
 * ("Bb5" = Si♭ power chord ; pour « B avec quinte bémol » on écrit "Bm7b5" / "B(b5)").
 */
export function parseChordSymbol(symbol: string): ParsedChordSymbol | null {
  const m = /^([A-G])(#{1,2}|b{1,2})?([^/]*)(?:\/([A-G](?:#{1,2}|b{1,2})?))?$/u.exec(symbol.trim());
  if (!m) return null;
  return { root: `${m[1]}${m[2] ?? ''}`, suffix: m[3] ?? '', bass: m[4] ?? null };
}

/** Table suffixe (modèle) → suffixe affiché, par style. Les suffixes inconnus passent tels quels. */
const SUFFIX_DISPLAY: Record<ChordNotation, Record<string, string>> = {
  en: { dim: 'dim', m7b5: 'm7♭5' },
  fr: { dim: 'dim', m7b5: 'm7♭5' },
  jazz: { m: '-', m7: '-7', maj7: 'Δ', m7b5: 'ø', dim: '°', dim7: '°7', m6: '-6' },
};

function prettifyFlats(suffix: string): string {
  // Dans un suffixe, « b » signifie toujours bémol (b5, b9, b13) ; « # » dièse.
  return suffix.replace(/b/g, '♭').replace(/#/g, '♯');
}

/**
 * Symbole d'accord du modèle → affichage. Décision D8 : style par défaut = anglo ("Am7").
 *  en   : Am7, Cmaj7, F♯m7♭5, C/G
 *  fr   : Lam7, Domaj7, Fa♯m7♭5, Do/Sol
 *  jazz : A-7, CΔ, F♯ø, C/G
 */
export function fmtChord(symbol: string, style: ChordNotation = 'en'): string {
  const p = parseChordSymbol(symbol);
  if (!p) throw new Error(`symbole d'accord invalide : "${symbol}"`);
  const noteStyle: NoteNotation = style === 'fr' ? 'fr' : 'en';
  const root = fmtNote(p.root, noteStyle);
  const suffix = SUFFIX_DISPLAY[style][p.suffix] ?? prettifyFlats(p.suffix);
  const bass = p.bass ? `/${fmtNote(p.bass, noteStyle)}` : '';
  return `${root}${suffix}${bass}`;
}

/** Raccourci : applique les DisplayOptions globales. */
export function makeFormatter(opts: DisplayOptions = {}) {
  const notes = opts.notes ?? 'fr';
  const chords = opts.chords ?? 'en';
  return {
    note: (n: NoteName) => fmtNote(n, notes),
    chord: (c: string) => fmtChord(c, chords),
    stringLabel: (pitch: string, isHighest: boolean) => fmtStringLabel(pitch, isHighest, notes),
  };
}
