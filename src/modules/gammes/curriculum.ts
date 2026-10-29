/**
 * Parcours des gammes (D98) : ce qui manque à une forme, l'étape suivante sur la gamme en cours, puis le
 * défi suivant de l'arbre de compétences (MUSIC_DESIGN §3.2). Logique pure : l'accueil, l'écran
 * d'entraînement, la file de révision et le simulateur lisent les mêmes phrases.
 */
import {
  PASS, dayKey, isProof, isStrongSuccess, learnedGaps, nodeIdOf, scoreOf, summarizeNodes,
  type Attempt, type LearnedGap, type NodeStats,
} from '../../core/progress';
import {
  TUNINGS, defaultSystem, fmtNote, generatePositions, pitchClassOf, simpleSpellings,
  type NoteName, type Position, type PositionSystem,
} from '../../core/theory';
import type { ScaleSelection } from '../../app/scaleSession';
import type { Segment } from './exercise';
import { positionLabelPlain } from './resolve';
import { unseenZoneTonic } from './transpose';

/** Ce qui manque pour « apprise », en mots d'élève (une phrase, pas une liste de codes). */
export const GAP_TEXT: Readonly<Record<LearnedGap, string>> = {
  successes: 'encore une réussite (≥ 80 %)',
  days: 'une réussite un autre jour',
  strong: 'une réussite sur la position entière, de mémoire (N3) ou au micro',
};

/** « encore une réussite (≥ 80 %) et une réussite un autre jour » ; vide si rien ne manque. */
export function missingText(n: Pick<NodeStats, 'successes' | 'successDays' | 'strongSuccesses'>): string {
  return learnedGaps(n).map((g) => GAP_TEXT[g]).join(' et ');
}

const NO_NODE = { successes: 0, successDays: 0, strongSuccesses: 0 };

export interface FormStep {
  selection: ScaleSelection;
  level: 1 | 2 | 3;
  segment: Segment;
  /** « Position 3 · exercice à trous » */
  label: string;
  /** « il manque une réussite sur la position entière, de mémoire (N3) ou au micro » */
  why: string;
}

const formOf = (p: Position) => p.formIndex ?? p.index;
const isLearned = (n: NodeStats | undefined) => n?.state === 'learned' || n?.state === 'mastered';

function positionsOf(scaleId: string, tonic: NoteName, system: PositionSystem, tuningId: string): Position[] {
  try {
    return generatePositions(scaleId, tonic, TUNINGS[tuningId] ?? TUNINGS.standard!, system);
  } catch {
    return [];
  }
}

/** Toutes les formes du système sont-elles apprises (ou maîtrisées) ? */
export function scaleLearned(
  journal: readonly Attempt[], scaleId: string, tonic: NoteName, system: PositionSystem, tuningId: string,
  summary: readonly NodeStats[] = summarizeNodes(journal),
): boolean {
  const nodes = new Map(summary.map((n) => [n.nodeId, n] as const));
  const positions = positionsOf(scaleId, tonic, system, tuningId);
  return positions.length > 0
    && positions.every((p) => isLearned(nodes.get(nodeIdOf({ scaleId, system, formIndex: formOf(p) }))));
}

/**
 * Étape suivante sur la gamme : la première forme du système (ordre du manche) pas encore apprise, et ce
 * qui lui manque. Jamais écoutée → N1 ; pas 2 réussites → N2 sur la position entière (D91) ; pas de
 * réussite forte → N3 (ou N2 au micro si l'élève joue au micro) ; ne manque qu'un second jour et déjà
 * réussie aujourd'hui → `null` (« reviens demain »). Toutes apprises → `null` (voir `nextCap`).
 */
export function nextFormStep(
  journal: readonly Attempt[], scaleId: string, tonic: NoteName, system: PositionSystem, tuningId: string, now: number,
  summary: readonly NodeStats[] = summarizeNodes(journal),
): FormStep | null {
  const nodes = new Map(summary.map((n) => [n.nodeId, n] as const));
  const positions = positionsOf(scaleId, tonic, system, tuningId);
  const index = positions.findIndex((p) => !isLearned(nodes.get(nodeIdOf({ scaleId, system, formIndex: formOf(p) }))));
  if (index < 0) return null;
  const pos = positions[index]!;
  const formIndex = formOf(pos);
  const name = positionLabelPlain(pos).split(' · ')[0]!;
  const selection: ScaleSelection = { scaleId, tonic, tuningId, system, positionIndex: index };
  const mine = journal.filter((a) => a.module !== 'accords' && !a.chordId && a.scaleId === scaleId
    && a.system === system && a.formIndex === formIndex);
  const node = nodes.get(nodeIdOf({ scaleId, system, formIndex }));
  if (!mine.some((a) => a.kind === 'listen') && !node) {
    return { selection, level: 1, segment: 'updown', label: `${name} · écouter`, why: 'tu ne l’as jamais écoutée' };
  }
  const gaps = learnedGaps(node ?? NO_NODE);
  const why = `il manque ${missingText(node ?? NO_NODE)}`;
  if (gaps.includes('successes')) return { selection, level: 2, segment: 'updown', label: `${name} · exercice à trous`, why };
  if (gaps.includes('strong')) {
    return journal.some((a) => a.mic === true)
      ? { selection, level: 2, segment: 'updown', label: `${name} · exercice à trous, au micro`, why }
      : { selection, level: 3, segment: 'updown', label: `${name} · de mémoire`, why };
  }
  // il ne manque qu'un second jour : une réussite aujourd'hui suffit, sinon la suite est demain
  const today = dayKey(now);
  const passedToday = mine.some((a) => dayKey(a.ts) === today && isProof(a) && (scoreOf(a) ?? 0) >= PASS
    && (a.kind === 'holes' || a.kind === 'recall'));
  return passedToday ? null : { selection, level: 3, segment: 'updown', label: `${name} · de mémoire`, why };
}

export interface Cap {
  scaleId: string;
  tonic: NoteName;
  system: PositionSystem;
  /** `scale` : une autre gamme (on l'écoute d'abord) ; `tonic` / `transpose` : le même dessin ailleurs. */
  kind: 'scale' | 'tonic' | 'transpose';
  /** « blues mineur, position 1 » */
  title: string;
  /** Pour le bouton : « ▶ Découvrir le blues mineur ». */
  name: string;
  why: string;
}

/** Le défi comme étape : la position 1, écoutée d'abord pour une autre gamme, jouée en N2 pour un même dessin ailleurs. */
export function capStep(cap: Cap): FormStep {
  return {
    selection: { scaleId: cap.scaleId, tonic: cap.tonic, tuningId: TUNING_ID, system: cap.system, positionIndex: 0 },
    level: cap.kind === 'scale' ? 1 : 2, segment: 'updown', label: cap.title, why: cap.why,
  };
}

/** Une gamme de l'arbre, sa tonique (relative à la tonique de départ, en La m : décalage en demi-tons). */
interface ScaleEntry { scaleId: string; shift?: number; fixed?: NoteName; short: string; name: string; why: string }

/** G2-G7 dans l'ordre de l'arbre (§3.2) ; G1 (blues, 2ᵉ tonique, transposition) est calculé à part. */
const LATER: readonly ScaleEntry[] = [
  { scaleId: 'pentatonic-major', shift: 3, short: 'pentatonique majeure', name: 'la pentatonique majeure', why: 'Les mêmes dessins, une autre racine : la relative majeure.' },
  { scaleId: 'blues-major', shift: 3, short: 'blues majeur', name: 'le blues majeur', why: 'Une note de passage (la ♭3) sur la pentatonique majeure.' },
  { scaleId: 'ionian', fixed: 'C', short: 'Do majeur', name: 'la gamme majeure', why: 'Sept notes : la gamme majeure, en Do.' },
  { scaleId: 'aeolian', shift: 0, short: 'mineure naturelle', name: 'la mineure naturelle', why: 'Ta pentatonique mineure, plus deux notes.' },
  { scaleId: 'mixolydian', fixed: 'G', short: 'mode mixolydien', name: 'le mode mixolydien', why: 'Une seule note change par rapport à la majeure : la ♭7.' },
  { scaleId: 'dorian', fixed: 'D', short: 'mode dorien', name: 'le mode dorien', why: 'La sixte majeure sur une gamme mineure.' },
  { scaleId: 'lydian', fixed: 'F', short: 'mode lydien', name: 'le mode lydien', why: 'La quarte augmentée, couleur « film ».' },
  { scaleId: 'phrygian', fixed: 'E', short: 'mode phrygien', name: 'le mode phrygien', why: 'La seconde mineure, flamenco et métal.' },
  { scaleId: 'locrian', fixed: 'B', short: 'mode locrien', name: 'le mode locrien', why: 'À connaître comme contexte de l’accord m7♭5.' },
  { scaleId: 'harmonic-minor', shift: 0, short: 'mineure harmonique', name: 'la mineure harmonique', why: 'La sensible en mineur.' },
  { scaleId: 'melodic-minor', shift: 0, short: 'mineure mélodique', name: 'la mineure mélodique', why: 'La mineure du jazz.' },
  { scaleId: 'whole-tone', fixed: 'C', short: 'gamme par tons', name: 'la gamme par tons', why: 'Une gamme symétrique : un motif qui se répète.' },
  { scaleId: 'diminished-hw', fixed: 'C', short: 'diminuée demi-ton–ton', name: 'la diminuée', why: 'Une gamme symétrique : un motif qui se répète.' },
  { scaleId: 'bebop-dominant', fixed: 'G', short: 'bebop dominante', name: 'la bebop dominante', why: 'Une note de passage pour tomber sur le temps.' },
];

const TUNING_ID = 'standard';

/** « Mi m », « Ré m » : la tonique et le « m » des formes mineures du parcours G1. */
const minorKey = (t: NoteName) => `${fmtNote(t)} m`;

function systemFor(scaleId: string): PositionSystem | null {
  return defaultSystem(scaleId, TUNINGS[TUNING_ID]!);
}

/** La forme de la position 1 d'une gamme (dans son système par défaut) est-elle apprise ? */
function firstFormLearned(nodes: Map<string, NodeStats>, scaleId: string, tonic: NoteName, system: PositionSystem): boolean {
  const first = positionsOf(scaleId, tonic, system, TUNING_ID)[0];
  return !!first && isLearned(nodes.get(nodeIdOf({ scaleId, system, formIndex: formOf(first) })));
}

/**
 * Défi suivant, dans l'ordre de l'arbre (§3.2), en partant de la pentatonique mineure (tonique de `from`
 * si l'élève y est, La sinon) ; chaque entrée déjà apprise est sautée :
 *   G1.2 blues mineur, même tonique, position 1 → G1.1 la position 1 en Mi m (la 2ᵉ tonalité, qui
 *   débloque G1.4) → G1.4 la position 1 dans une zone non couverte, tant que < 3 zones → G2 … G7.
 * L'improvisation (G8) n'est jamais un défi : c'est une ligne à part.
 */
export function nextCap(
  journal: readonly Attempt[], from: { scaleId: string; tonic: NoteName; system: PositionSystem },
  summary: readonly NodeStats[] = summarizeNodes(journal),
): Cap | null {
  const nodes = new Map(summary.map((n) => [n.nodeId, n] as const));
  const base: NoteName = from.scaleId === 'pentatonic-minor' || from.scaleId === 'blues-minor' ? from.tonic : 'A';
  const pent = 'pentatonic-minor';
  const pentSystem: PositionSystem = 'boxes';

  // G1.2 blues mineur
  const blues = systemFor('blues-minor');
  if (blues && !firstFormLearned(nodes, 'blues-minor', base, blues)) {
    return {
      scaleId: 'blues-minor', tonic: base, system: blues, kind: 'scale', title: 'blues mineur, position 1',
      name: 'le blues mineur', why: 'Une note de plus (la ♭5) sur le dessin que tu connais.',
    };
  }
  // G1.1 la position 1 dans une 2ᵉ tonique : Mi m (cases 0-3), ou La m si l'élève a commencé en Mi
  const first = positionsOf(pent, base, pentSystem, TUNING_ID)[0];
  const firstForm = first ? formOf(first) : 0;
  const second: NoteName = base === 'E' ? 'A' : 'E';
  const playedIn = (tonic: NoteName) => journal.some((a) => a.scaleId === pent && a.system === pentSystem
    && a.formIndex === firstForm && a.tonic === tonic && isStrongSuccess(a));
  if (!playedIn(second)) {
    return {
      scaleId: pent, tonic: second, system: pentSystem, kind: 'tonic', title: `${minorKey(second)}, position 1`,
      name: minorKey(second),
      why: second === 'E' ? 'Même dessin, presque à vide : Mi mineur.' : `Même dessin, autre case : ${minorKey(second)}.`,
    };
  }
  // G1.4 transposition : même dessin, dans une zone du manche que la forme n'a jamais vue
  const node = nodes.get(nodeIdOf({ scaleId: pent, system: pentSystem, formIndex: firstForm }));
  if (node && node.zones.length < 3) {
    const tonic = unseenZoneTonic(pent, pentSystem, firstForm, TUNING_ID, node.zones, node.tonics);
    const pos = tonic ? positionsOf(pent, tonic, pentSystem, TUNING_ID).find((p) => formOf(p) === firstForm) : null;
    if (tonic && pos) {
      return {
        scaleId: pent, tonic, system: pentSystem, kind: 'transpose', title: `${minorKey(tonic)}, position 1`,
        name: minorKey(tonic), why: `Même dessin, autre case : ${minorKey(tonic)}, cases ${pos.fretMin}–${pos.fretMax}.`,
      };
    }
  }
  // G2 … G7
  for (const e of LATER) {
    const system = systemFor(e.scaleId);
    if (!system) continue;
    const tonic = e.fixed ?? (simpleSpellings((pitchClassOf(base) + (e.shift ?? 0)) % 12)[0]! as NoteName);
    if (firstFormLearned(nodes, e.scaleId, tonic, system)) continue;
    return { scaleId: e.scaleId, tonic, system, kind: 'scale', title: `${e.short}, position 1`, name: e.name, why: e.why };
  }
  return null;
}
