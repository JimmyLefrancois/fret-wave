/**
 * Résolution d'une sélection de gamme → objet prêt à afficher : tonique ré-orthographiée si besoin,
 * système ramené au premier disponible, position bornée, titre, formule, mode parent, note de prof.
 * PUR et testé : les écrans ne décident de rien, ils affichent ce que cette fonction renvoie.
 */
import {
  TUNINGS, defaultSystem, degreeLabels, distinctTranspositions, fmtNote, fmtPositionLabel,
  generatePositions, getScale, parentMajorTonic, pitchClassOf, positionSupport, simpleSpellings, tonicSpellings,
  MAJOR_KEYS,
  type DegreeLabel, type NoteName, type NoteNotation, type Position, type PositionSystem, type ScaleDef,
  type SystemAvailability, type Tuning,
} from '../../core/theory';
import { defaultChordForScale, intervalStyle, fnToInterval, parseFn } from '../../core/tab';
import type { ScaleSelection } from '../../app/scaleSession';
import { DEFAULT_SELECTION } from '../../app/scaleSession';
import { SCALE_HINTS } from './content';

/** Degrés en glyphes réels : « b3 » → « ♭3 », « #4 » → « ♯4 », « bb7 » → « 𝄫7 ». */
// le formatage des degrés vit dans le cœur (`core/theory/notation`) : une seule fonction pour toute l'app
import { fmtDegree, toAsciiDegree } from '../../core/theory/notation';
export { fmtDegree, toAsciiDegree };

const NUMBER_NAME = ['unisson', 'seconde', 'tierce', 'quarte', 'quinte', 'sixte', 'septième'];



/** Nom français d'une fonction d'intervalle : « b3 » ou « ♭3 » → « tierce mineure ». */
export function degreeName(fn: string): string {
  const p = parseFn(toAsciiDegree(fn) as DegreeLabel);
  if (!p) return fn;
  const base = NUMBER_NAME[p.family - 1] ?? fn;
  // la tonique se dit « fondamentale » partout dans l'app (MUSIC_DESIGN), jamais « unisson juste »
  if (p.family === 1 && p.alt === 0) return 'fondamentale';
  const perfect = p.family === 1 || p.family === 4 || p.family === 5;
  if (p.alt === 0) return `${base} ${perfect ? 'juste' : 'majeure'}`;
  const quality = perfect
    ? ({ '-2': 'doublement diminuée', '-1': 'diminuée', '1': 'augmentée', '2': 'doublement augmentée' } as Record<string, string>)
    : ({ '-3': 'doublement diminuée', '-2': 'diminuée', '-1': 'mineure', '1': 'augmentée' } as Record<string, string>);
  const q = quality[String(p.alt)];
  return q ? `${base} ${q}` : (fnToInterval(fn as DegreeLabel) ?? fn);
}

/** Degrés ascii d'une gamme (« b3 », « #4 »…), sans glyphes. */
export function degreesOf(def: ScaleDef): string[] {
  return degreeLabels(def);
}

export interface LegendItem {
  fn: string;
  name: string;
  fill: string;
  digit: string;
  root: boolean;
  characteristic: boolean;
}

/** Légende des couleurs : une ligne par fonction de la formule, dans l'ordre de la gamme. */
export function legendFor(def: ScaleDef): LegendItem[] {
  const chars = new Set((def.characteristic ?? []).map(fmtDegree));
  return degreesOf(def).map((raw) => {
    const fn = fmtDegree(raw);
    // la couleur se calcule sur le degré ASCII du modèle, comme dans la tablature : « ♭3 » n'est pas parsable
    const st = intervalStyle(raw);
    return { fn, name: degreeName(fn), fill: st.fill, digit: st.digit, root: st.root, characteristic: chars.has(fn) };
  });
}

export interface ResolvedScale {
  selection: ScaleSelection;
  def: ScaleDef;
  tuning: Tuning;
  tonic: NoteName;
  support: SystemAvailability[];
  positions: Position[];
  position: Position | null;
  /** Accord de référence de la gamme (« Am7 »), s'il existe. */
  chord: string | null;
  title: string;
  formula: string;
  parent: string | null;
  hint: string;
  transpositions: number;
}

/** Titre à l'écran. Le genre suit le nom de la gamme (« Ré dorien », « La mineure pentatonique »). */
export function scaleTitle(def: ScaleDef, tonic: NoteName, notation: NoteNotation): string {
  const n = fmtNote(tonic, notation);
  switch (def.id) {
    case 'ionian': return `${n} majeur`;
    case 'aeolian': return `${n} mineure naturelle`;
    case 'pentatonic-minor': return `${n} mineure pentatonique`;
    case 'pentatonic-major': return `${n} majeure pentatonique`;
    case 'blues-minor': return `${n} blues mineur`;
    case 'blues-major': return `${n} blues majeur`;
    default:
      break;
  }
  if (def.family === 'symmetric' || def.family === 'bebop') return `${def.nameFr} sur ${n}`;
  return `${n} ${def.nameFr.toLowerCase()}`;
}

/**
 * Les libellés de parenté sont écrits comme des **suites** (« mêmes notes que Do majeur ») : ils
 * s'affichaient seuls, en bas d'un panneau, commençant par une minuscule — une phrase cassée. On les
 * rend autonomes en les capitalisant à la source, puisqu'ils ne servent que sur leur propre ligne.
 */
const asSentence = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function parentLabel(def: ScaleDef, tonic: NoteName, notation: NoteNotation): string | null {
  const n = (x: NoteName) => fmtNote(x, notation);
  if (def.family === 'diatonic') {
    const parent = parentMajorTonic(def, tonic);
    if (!parent) return null;
    const rotation = def.parent?.rotation ?? 0;
    if (rotation === 0) return asSentence(`tonalité : ${n(parent)} majeur`);
    const playable = MAJOR_KEYS.includes(parent);
    return playable
      ? asSentence(`mode parent : ${n(parent)} majeur (${rotation + 1}${rotation === 1 ? 'er' : 'e'} degré`) + ')'
      : asSentence(`mode parent : ${n(parent)} majeur — 7 altérations ou double altération : couleur à écouter, pas une tonalité jouable`);
  }
  if (def.id === 'pentatonic-minor') {
    return asSentence(`mêmes notes que ${n(simpleSpellings((pitchClassOf(tonic) + 3) % 12)[0]!)} majeur`);
  }
  if (def.id === 'pentatonic-major') {
    return asSentence(`mêmes notes que ${n(simpleSpellings((pitchClassOf(tonic) + 9) % 12)[0]!)} mineure`);
  }
  if (def.parent && (def.family === 'harmonic-minor' || def.family === 'melodic-minor')) {
    const parentDef = getScale(def.parent.scaleId);
    return asSentence(`${def.parent.rotation + 1}e mode de la ${parentDef.nameFr.toLowerCase()}`);
  }
  if (def.family === 'symmetric') {
    const t = distinctTranspositions(def);
    return `${t} transposition${t > 1 ? 's' : ''} distincte${t > 1 ? 's' : ''} seulement`;
  }
  return null;
}

/**
 * Normalise puis résout. Ne jette jamais : une gamme inconnue, une tonique mal orthographiée, un système
 * indisponible ou une position hors plage sont ramenés à une valeur valide.
 */
export function resolveScale(sel: ScaleSelection, notation: NoteNotation = 'fr'): ResolvedScale {
  let def: ScaleDef;
  try {
    def = getScale(sel.scaleId);
  } catch {
    def = getScale(DEFAULT_SELECTION.scaleId);
  }
  let pc: number;
  try {
    pc = pitchClassOf(sel.tonic);
  } catch {
    pc = pitchClassOf(DEFAULT_SELECTION.tonic);
  }
  const spellings = tonicSpellings(def, pc);
  const tonic = (spellings.includes(sel.tonic) ? sel.tonic : spellings[0]!) as NoteName;
  const tuning = TUNINGS[sel.tuningId] ?? TUNINGS.standard!;
  const support = positionSupport(def.id, tuning);
  const available = support.filter((s) => s.available).map((s) => s.system);
  let system: PositionSystem = available.includes(sel.system) ? sel.system : (defaultSystem(def.id, tuning) ?? 'boxes');
  if (!available.includes(system)) system = available[0] ?? 'boxes';
  const positions = generatePositions(def.id, tonic, tuning, system);
  const index = Math.max(0, Math.min(Math.max(0, positions.length - 1), Math.round(sel.positionIndex)));
  const position = positions[index] ?? null;
  const chord = defaultChordForScale(def.id, tonic);
  return {
    selection: { scaleId: def.id, tonic, tuningId: tuning.id, system, positionIndex: index },
    def, tuning, tonic, support, positions, position, chord,
    title: scaleTitle(def, tonic, notation),
    formula: degreesOf(def).map(fmtDegree).join(' '),
    parent: parentLabel(def, tonic, notation),
    hint: SCALE_HINTS[def.id] ?? '',
    transpositions: distinctTranspositions(def),
  };
}

/** Étiquette de la position active (réutilise le formateur de la 1b : « Box 1 · cases 5–8 »). */
export function positionLabel(p: Position | null, notation: NoteNotation = 'fr'): string {
  return p ? fmtPositionLabel(p, notation) : 'aucune position';
}

/**
 * Même position, sans le vocabulaire du système : « Box 1 · cases 5–8 » → « Position 1 · cases 5–8 ».
 * Un débutant cherche une position sur le manche, pas une « box ». Le nom du système reste dans
 * l'étiquette du panneau, où il est expliqué.
 */
export function positionLabelPlain(p: Position | null, notation: NoteNotation = 'fr'): string {
  return positionLabel(p, notation).replace(/^Box (\d+)/, 'Position $1').replace(/^Motif (\d+)/, 'Position $1');
}
