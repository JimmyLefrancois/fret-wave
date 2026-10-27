/**
 * Niveaux 2 « Mémorisation » et 3 « Rappel » (MUSIC_DESIGN §3.4) : un exercice = le **même TabScore** que
 * le niveau 1, dont certaines notes sont des **trous** à compléter. Le score musical reste inchangé
 * (mêmes positions, mêmes hauteurs) : seule la lisibilité d'une note est retirée, jamais sa vérité.
 *
 * Découpage (chunking) : 1 corde → 2 → 3 → position entière (montée) → aller-retour. Une position
 * complète en 3 notes par corde fait 18 notes : les demander d'un bloc au pavé numérique est un abandon
 * assuré (MUSIC_DESIGN §3.4), d'où les segments.
 */
import { TUNINGS, filterPosition, type NoteName, type Position } from '../../core/theory';
import { PPQ, type Direction, type TabScore } from '../../core/tab';

export type Segment = 'string1' | 'strings2' | 'strings3' | 'all' | 'updown';

export const SEGMENTS: readonly { value: Segment; label: string; hint: string }[] = [
  { value: 'string1', label: '1 corde', hint: 'la corde grave seule : 2 ou 3 notes' },
  { value: 'strings2', label: '2 cordes', hint: 'les deux cordes graves' },
  { value: 'strings3', label: '3 cordes', hint: 'les trois cordes graves' },
  { value: 'all', label: 'montée', hint: 'la position entière, en montant' },
  { value: 'updown', label: 'aller-retour', hint: 'la position entière, montée et descente' },
];

export interface SegmentPlan {
  position: Position;
  direction: Direction;
  /** Cordes couvertes (journalisées avec la tentative). */
  strings: number;
  label: string;
}

export function segmentPlan(pos: Position, seg: Segment): SegmentPlan {
  const dir: Direction = seg === 'updown' ? 'updown' : 'up';
  switch (seg) {
    case 'string1': return { position: filterPosition(pos, (n) => n.string === 0), direction: dir, strings: 1, label: 'corde grave' };
    case 'strings2': return { position: filterPosition(pos, (n) => n.string < 2), direction: dir, strings: 2, label: '2 cordes graves' };
    case 'strings3': return { position: filterPosition(pos, (n) => n.string < 3), direction: dir, strings: 3, label: '3 cordes graves' };
    case 'all': return { position: pos, direction: dir, strings: pos.notes.length ? new Set(pos.notes.map((n) => n.string)).size : 0, label: 'position entière' };
    case 'updown': return { position: pos, direction: dir, strings: pos.notes.length ? new Set(pos.notes.map((n) => n.string)).size : 0, label: 'position entière, aller-retour' };
  }
}

// ---------------------------------------------------------------------------
// Trous
// ---------------------------------------------------------------------------

export interface Hole {
  /** Clé stable `${columnIndex}:${string}` — identifie une pastille sans révéler sa case. */
  key: string;
  /** Rang de la colonne (événement) dans le score. */
  columnIndex: number;
  string: number;
  /** Réponse attendue. Jamais affichée : seule la comparaison l'utilise. */
  fret: number;
  fn: string;
  /** Nom orthographié de la note (affiché seulement une fois la case trouvée). */
  note: NoteName;
}

export interface Exercise {
  level: 2 | 3;
  /** Score dont les trous sont marqués `hidden` (le modèle garde la case : c'est la réponse). */
  score: TabScore;
  holes: Hole[];
  total: number;
  /** Nombre total de notes du segment (trous + notes lisibles). */
  notes: number;
  /** Part des notes masquées (0-1). */
  ratio: number;
}

/** Générateur pseudo-aléatoire reproductible (les tests et une « nouvelle série » veulent le même outil). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Part de trous au niveau 2 : assez pour obliger à lire, assez peu pour ne pas décourager. */
export const HOLES_RATIO = 0.35;
/** En dessous de deux trous, l'exercice ne teste rien : on en pose deux (et jamais tous). */
export const MIN_HOLES = 2;

/**
 * Marque les trous. Niveau 3 : **toutes** les notes (tablature vide, on écrit de mémoire).
 * Niveau 2 : ~35 % des notes, tirées au hasard reproductible, au moins une.
 */
export function buildExercise(
  score: TabScore,
  level: 2 | 3,
  opts: { ratio?: number; rng?: () => number } = {},
): Exercise {
  const rng = opts.rng ?? mulberry32(0x5eed);
  const candidates: Hole[] = [];
  let column = 0;
  score.measures.forEach((m) => {
    m.events.forEach((ev) => {
      if (ev.notes.length === 1 && !ev.notes[0]!.muted) {
        const n = ev.notes[0]!;
        // la colonne est l'ordre d'événement global, identique à `layout.columns`
        candidates.push({ key: `${column}:${n.string}`, columnIndex: column, string: n.string, fret: n.fret, fn: n.fn, note: n.note });
      }
      column++;
    });
  });
  const ratio = level === 3 ? 1 : Math.max(0, Math.min(1, opts.ratio ?? HOLES_RATIO));
  let chosen: Hole[];
  if (level === 3 || ratio >= 1) chosen = candidates;
  else {
    // au moins deux trous, jamais toute la position : un exercice à un trou ne prouve rien
    const wanted = Math.max(MIN_HOLES, Math.round(candidates.length * ratio));
    const count = Math.min(Math.max(1, candidates.length - 1), wanted);
    // tirage sans remise, puis remise en ordre de lecture
    const pool = [...candidates];
    chosen = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const k = Math.floor(rng() * pool.length);
      chosen.push(pool.splice(k, 1)[0]!);
    }
    chosen.sort((a, b) => a.columnIndex - b.columnIndex);
  }
  const keys = new Set(chosen.map((h) => h.key));
  let col = 0;
  const measures = score.measures.map((m) => ({
    ...m,
    events: m.events.map((ev) => {
      const notes = ev.notes.map((n) => (keys.has(`${col}:${n.string}`) && !n.muted ? { ...n, hidden: true } : n));
      col++;
      return { ...ev, notes };
    }),
  }));
  return { level, score: { ...score, measures }, holes: chosen, total: chosen.length, notes: candidates.length, ratio };
}

/**
 * Affiche les trous déjà trouvés (ou révélés après deux erreurs) : la pastille reprend sa couleur de
 * fonction. C'est la récompense visuelle, et elle enseigne la fonction de la note au passage.
 */
export function withRevealed(score: TabScore, keys: ReadonlySet<string>): TabScore {
  if (keys.size === 0) return score;
  let col = 0;
  const measures = score.measures.map((m) => ({
    ...m,
    events: m.events.map((ev) => {
      const notes = ev.notes.map((n) => (keys.has(`${col}:${n.string}`) ? { ...n, hidden: false } : n));
      col++;
      return { ...ev, notes };
    }),
  }));
  return { ...score, measures };
}

/** Pastille désignée par un toucher (`columnIndex:string`). */
export function holeKey(columnIndex: number, string: number): string {
  return `${columnIndex}:${string}`;
}

/** Réponse juste ? Compare la case saisie à celle que porte le modèle. */
export function checkAnswer(hole: Hole, entry: number): boolean {
  return Number.isInteger(entry) && entry >= 0 && entry <= 24 && entry === hole.fret;
}

/** Résultat vis-à-vis de la grille rythmique (absente, tenue, manquée). */
export type GridOutcome = 'off' | 'kept' | 'missed';

/**
 * Étoiles : ★ précision (≥ 80 %), ★★ ≥ 95 %, ★★★ sans une erreur ni révélation.
 * Si une grille a été lancée, elle doit être **tenue** pour prétendre à ★★ ou ★★★ : la précision seule
 * ne suffit plus (MUSIC_DESIGN §3.4). Hors grille, une série juste reste à ★ : on ne punit pas, on ne certifie pas.
 */
export function starsFor(accuracy: number, revealed: number, errors: number, grid: GridOutcome = 'off'): 0 | 1 | 2 | 3 {
  if (accuracy < 0.8) return 0;
  if (grid === 'missed') return 1;
  const perfect = accuracy === 1 && revealed === 0 && errors === 0;
  if (grid === 'kept') return perfect ? 3 : accuracy >= 0.95 ? 2 : 1;
  if (perfect) return 3;
  if (accuracy >= 0.95) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// Grille rythmique (métronome)
// ---------------------------------------------------------------------------

export interface TempoGrid {
  /** Score de silences : le métronome y place un clic par temps, aucune note ne sonne. */
  score: TabScore;
  /** Nombre de temps de la grille (multiple de 4 : la grille fait des mesures entières). */
  beats: number;
  /** Durée de la grille en secondes au tempo demandé. */
  seconds: number;
}

/**
 * Grille de travail : **un temps par trou**, en mesures entières de 4/4. Le métronome de la 1c joue
 * les clics (aucune note : le score ne contient que des silences), donc l'élève entend la grille sans
 * que l'app lui donne les réponses.
 *
 * Limite assumée : tant que la validation passe par le pavé, ce temps mesure la **rapidité à écrire**
 * une case, pas à la jouer. La phase 3 (entrée audio) rendra la mesure honnête.
 */
export function tempoGrid(holes: number, tempo: number): TempoGrid {
  const beats = Math.max(4, Math.ceil(Math.max(1, holes) / 4) * 4);
  // `startTick` est RELATIF à la mesure (invariant du modèle) : chaque mesure porte 4 silences de noire
  const measures = Array.from({ length: beats / 4 }, () => ({
    events: [0, 1, 2, 3].map((b) => ({ startTick: b * PPQ, durTick: PPQ, kind: 'rest' as const, notes: [] })),
  }));
  const score: TabScore = {
    id: 'exercise:grid',
    kind: 'exercise',
    tuning: TUNINGS.standard!,
    stringCount: 6,
    ppq: PPQ,
    tempo: Math.max(30, Math.min(120, Math.round(tempo))),
    timeSig: [4, 4],
    measures,
  };
  return { score, beats, seconds: (beats * 60) / score.tempo };
}

/** Le trou a-t-il été posé dans la grille ? (tolérance : la dernière case sur le dernier temps) */
export function insideGrid(seconds: number, grid: TempoGrid, tolerance = 0.3): boolean {
  return seconds <= grid.seconds + tolerance;
}
