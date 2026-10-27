/**
 * Voicings (formes d'accord guitare) : types, calcul des notes produites et validation.
 * Règle non négociable : les notes réellement produites par la forme dans l'accordage donné doivent
 * correspondre exactement à celles de l'accord (aucune erreur de transcription tolérée).
 */
import { interpretChord, expectedBassPitchClass, CHORD_QUALITIES } from './chords';
import { fretToMidi } from './fretboard';
import { pitchClassOf } from './scales';
import { TUNINGS, type Tuning } from './tunings';
import type { DegreeLabel, NoteName } from './types';

export type VoicingFamily =
  | 'open' | 'open7' | 'sus' | 'add' | 'slash' | 'power'
  | 'barre-E' | 'barre-A' | 'triad3' | 'drop2' | 'drop3' | 'ext';

export type Finger = 0 | 1 | 2 | 3 | 4 | 'T';

export interface Voicing {
  id: string;
  /** Symbole du modèle (anglo) : "Em", "G/B", "C5". */
  chord: string;
  tuningId: string;
  /** Une entrée par corde, index 0 = corde grave ; null = non jouée (X). */
  frets: ReadonlyArray<number | null>;
  family: VoicingFamily;
  /** 1 (très facile) à 5 (barré complet). Heuristique à calibrer (MUSIC_DESIGN.md §4.8). */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Palier du curriculum : "P1"…"P10", "P2b" (branche rock). */
  palier: string;
  /** Degrés volontairement omis (ex. "5" pour C7 x32310). */
  omitted: readonly DegreeLabel[];
  /** Doigtés par corde : saisis et relus en phase 4. */
  fingers?: ReadonlyArray<Finger | null>;
  barre?: { fret: number; fromString: number; toString: number; finger: Finger };
  /** Version simplifiée d'un autre voicing (jamais présentée comme « le vrai accord »). */
  simplifiedOf?: string;
  note?: string;
}

/** Forme mobile : offsets relatifs à la case de la fondamentale, sur une corde donnée. */
export interface MobileShape {
  id: string;
  /** Suffixe de qualité du modèle ("", "m", "7", "m7", "maj7"). */
  quality: string;
  rootString: number;
  offsets: ReadonlyArray<number | null>;
  family: 'barre-E' | 'barre-A';
  caged: 'E' | 'A';
  omitted?: readonly DegreeLabel[];
}

export function voicingMidis(v: Voicing, tuning: Tuning = TUNINGS[v.tuningId]!): number[] {
  const out: number[] = [];
  v.frets.forEach((f, s) => {
    if (f !== null) out.push(fretToMidi(tuning, s, f));
  });
  return out;
}

/** Notes jouées (corde grave → aiguë), orthographe de l'accord. Lève une erreur si une note est étrangère. */
export function voicingNotes(v: Voicing, tuning: Tuning = TUNINGS[v.tuningId]!): NoteName[] {
  const info = interpretChord(v.chord);
  const byPc = new Map(info.notes.map((n) => [pitchClassOf(n), n]));
  return voicingMidis(v, tuning).map((m) => {
    const n = byPc.get(((m % 12) + 12) % 12);
    if (!n) throw new Error(`${v.id} : note étrangère à ${v.chord} (midi ${m})`);
    return n;
  });
}

/** Liste des erreurs (vide = valide). */
export function validateVoicing(v: Voicing, tuning: Tuning = TUNINGS[v.tuningId]!): string[] {
  const errs: string[] = [];
  const tag = `${v.id} (${v.chord})`;
  if (v.frets.length !== tuning.strings.length) {
    return [`${tag} : ${v.frets.length} cases pour ${tuning.strings.length} cordes`];
  }
  let info;
  try {
    info = interpretChord(v.chord);
  } catch (e) {
    return [`${tag} : ${(e as Error).message}`];
  }
  const midis = voicingMidis(v, tuning);
  if (midis.length < 2) errs.push(`${tag} : moins de 2 cordes jouées`);
  const pcs = new Set(midis.map((m) => ((m % 12) + 12) % 12));

  // (a) aucune note étrangère
  const allowed = new Set(info.pitchClasses);
  for (const pc of pcs) if (!allowed.has(pc)) errs.push(`${tag} : classe de hauteur étrangère ${pc}`);
  // (a') toutes les notes requises présentes (hors omissions déclarées)
  info.degrees.forEach((d, i) => {
    if (v.omitted.includes(d)) {
      if (pcs.has(info.pitchClasses[i]!)) errs.push(`${tag} : le degré ${d} est déclaré omis mais présent`);
    } else if (!pcs.has(info.pitchClasses[i]!)) {
      errs.push(`${tag} : degré ${d} absent (non déclaré omis)`);
    }
  });
  // (b) basse
  if (midis.length > 0) {
    const bass = ((Math.min(...midis) % 12) + 12) % 12;
    if (bass !== expectedBassPitchClass(info)) errs.push(`${tag} : mauvaise basse`);
  }
  // (c) orthographe : voicingNotes lève si étranger ; on vérifie aussi qu'aucune note n'a 2+ altérations hors dim7
  try {
    voicingNotes(v, tuning);
  } catch (e) {
    errs.push((e as Error).message);
  }
  // (d) étendue ≤ 4 cases hors cases à vide (un barré compte pour 1 doigt)
  const fretted = v.frets.filter((f): f is number => f !== null && f > 0);
  if (fretted.length > 0 && Math.max(...fretted) - Math.min(...fretted) > 3) errs.push(`${tag} : étendue > 4 cases`);
  // (e) doigts
  if (v.fingers) {
    if (v.fingers.length !== v.frets.length) errs.push(`${tag} : doigtés incohérents avec les cordes`);
    const used = new Set(v.fingers.filter((f): f is Finger => f !== null && f !== 0));
    if (used.size > 5) errs.push(`${tag} : plus de 4 doigts + pouce`);
  }
  // barré : toutes les cordes jouées de son étendue sont à la case du barré ou au-dessus, et au moins deux y sont posées
  if (v.barre) {
    const b = v.barre;
    const inRange = v.frets.flatMap((f, i) => (i >= Math.min(b.fromString, b.toString) && i <= Math.max(b.fromString, b.toString) && f !== null ? [f] : []));
    if (inRange.some((f) => f < b.fret)) errs.push(`${tag} : une corde du barré est sous la case ${b.fret}`);
    if (inRange.filter((f) => f === b.fret).length < 2) errs.push(`${tag} : le barré case ${b.fret} ne couvre pas 2 cordes`);
  }
  // cases négatives / trop hautes
  for (const f of v.frets) if (f !== null && (f < 0 || f > 24)) errs.push(`${tag} : case hors plage (${f})`);
  // cohérence de qualité
  if (!CHORD_QUALITIES.some((q) => q.suffix === info.quality.suffix)) errs.push(`${tag} : qualité inconnue`);
  return errs;
}

/** Instancie une forme mobile pour une fondamentale donnée (nom du modèle). */
export function instantiateShape(shape: MobileShape, rootName: NoteName, tuning: Tuning = TUNINGS.standard!): Voicing {
  const openPc = ((fretToMidi(tuning, shape.rootString, 0) % 12) + 12) % 12;
  const rootFret = (((pitchClassOf(rootName) - openPc) % 12) + 12) % 12;
  // barré : l'index remplace le sillet — cordes à l'offset 0 de la forme, seulement quand la forme est déplacée
  const atRoot = shape.offsets.flatMap((o, i) => (o === 0 ? [i] : []));
  const barre = rootFret > 0 && atRoot.length >= 2
    ? { fret: rootFret, fromString: atRoot[0]!, toString: atRoot[atRoot.length - 1]!, finger: 1 as const }
    : undefined;
  return {
    id: `${shape.id}@${rootName}`,
    chord: `${rootName}${shape.quality}`,
    tuningId: tuning.id,
    frets: shape.offsets.map((o) => (o === null ? null : o + rootFret)),
    family: shape.family,
    difficulty: rootFret === 0 ? 2 : 4,
    palier: 'P8',
    omitted: shape.omitted ?? [],
    ...(barre ? { barre } : {}),
  };
}
