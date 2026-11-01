/**
 * Rappel de mémoire (MUSIC_DESIGN §3.4) : le **même TabScore** que la page Découvrir, dont toutes les notes
 * sont masquées. Le score musical reste inchangé (mêmes positions, mêmes hauteurs) : seule la lisibilité
 * d'une note est retirée, jamais sa vérité. La révision porte toujours sur la position entière, en
 * aller-retour.
 */
import { TUNINGS, type NoteName, type Position } from '../../core/theory';
import { PPQ, type TabScore } from '../../core/tab';

/** Cordes couvertes par une position (journalisées avec la tentative). */
export function stringsOf(pos: Position): number {
  return pos.notes.length ? new Set(pos.notes.map((n) => n.string)).size : 0;
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
  /** Score dont les trous sont marqués `hidden` (le modèle garde la case : c'est la réponse). */
  score: TabScore;
  holes: Hole[];
  total: number;
}

/** Masque **toutes** les notes jouées : la tablature ne garde que les cordes, les mesures et le rythme. */
export function buildExercise(score: TabScore): Exercise {
  const holes: Hole[] = [];
  let column = 0;
  score.measures.forEach((m) => {
    m.events.forEach((ev) => {
      if (ev.notes.length === 1 && !ev.notes[0]!.muted) {
        const n = ev.notes[0]!;
        // la colonne est l'ordre d'événement global, identique à `layout.columns`
        holes.push({ key: `${column}:${n.string}`, columnIndex: column, string: n.string, fret: n.fret, fn: n.fn, note: n.note });
      }
      column++;
    });
  });
  const keys = new Set(holes.map((h) => h.key));
  let col = 0;
  const measures = score.measures.map((m) => ({
    ...m,
    events: m.events.map((ev) => {
      const notes = ev.notes.map((n) => (keys.has(`${col}:${n.string}`) && !n.muted ? { ...n, hidden: true } : n));
      col++;
      return { ...ev, notes };
    }),
  }));
  return { score: { ...score, measures }, holes, total: holes.length };
}

/**
 * Affiche les trous déjà trouvés (ou révélés après deux erreurs) : la pastille reprend sa couleur de
 * fonction. C'est la récompense visuelle, et elle enseigne la fonction de la note au passage.
 * Les clés de `missed` (révélées sans avoir été trouvées) gardent un contour pointillé : en fin de
 * série, l'élève voit où il a raté, pas une forme uniformément « juste ».
 */
export function withRevealed(score: TabScore, keys: ReadonlySet<string>, missed: ReadonlySet<string> = new Set()): TabScore {
  if (keys.size === 0) return score;
  let col = 0;
  const measures = score.measures.map((m) => ({
    ...m,
    events: m.events.map((ev) => {
      const notes = ev.notes.map((n) => {
        const k = `${col}:${n.string}`;
        if (!keys.has(k)) return n;
        return missed.has(k) ? { ...n, hidden: false, missed: true } : { ...n, hidden: false };
      });
      col++;
      return { ...ev, notes };
    }),
  }));
  return { ...score, measures };
}

/**
 * Résumé des cases manquées, par corde : « 3 cases manquées : Sol ×2, Si ×1 ».
 * `stringNames[i]` est le nom affiché de la corde i (0 = la plus grave). Rien à dire → null.
 */
export function missedSummary(holes: readonly Hole[], missed: ReadonlySet<string>, stringNames: readonly string[]): string | null {
  const byString = new Map<number, number>();
  for (const h of holes) if (missed.has(h.key)) byString.set(h.string, (byString.get(h.string) ?? 0) + 1);
  const total = [...byString.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const parts = [...byString.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([str, n]) => `${stringNames[str] ?? `corde ${str + 1}`} ×${n}`);
  return `${total} case${total > 1 ? 's' : ''} manquée${total > 1 ? 's' : ''} : ${parts.join(', ')}`;
}

/**
 * Trou ouvert suivant (`dir` = 1) ou précédent (-1) dans l'ordre de la série, en bouclant ;
 * `from` null = depuis le début. Sert au clic d'après une réponse et aux flèches du clavier.
 */
export function stepOpen(order: readonly string[], isOpen: (key: string) => boolean, from: string | null, dir: 1 | -1 = 1): string | null {
  const n = order.length;
  if (n === 0) return null;
  const at = from ? order.indexOf(from) : -1;
  const start = at === -1 ? (dir === 1 ? -1 : 0) : at;
  for (let i = 1; i <= n; i++) {
    const k = order[(((start + dir * i) % n) + n) % n]!;
    if (isOpen(k)) return k;
  }
  return null;
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
  /** Notes par temps : 1 (noires) ou 2 (croches). */
  perBeat: GridSubdivision;
  /** Débit nominal, en notes par minute (tempo × notes par temps) — c'est ce que juge la vitesse. */
  npm: number;
}

/** Notes par clic de la grille : une par temps (noires) ou deux (croches). */
export type GridSubdivision = 1 | 2;
/** Bornes du tempo de la grille (BPM). 200 en noires = 200 notes/min ; en croches, 400. */
export const GRID_TEMPO_MIN = 30;
export const GRID_TEMPO_MAX = 200;

/**
 * Grille de travail : **un temps par trou** (ou deux trous par temps en croches), en mesures entières de 4/4.
 * Les croches existent pour la vitesse : à 160 notes/min en noires, chaque note tomberait sur un clic,
 * que le masque du micro (± 90 ms, `nearClick`) effacerait ; en croches à 80 BPM, une note sur deux
 * tombe entre deux clics et le masque ne couvre que 24 % du temps. Le métronome de la 1c joue
 * les clics (aucune note : le score ne contient que des silences), donc l'élève entend la grille sans
 * que l'app lui donne les réponses.
 *
 */
export function tempoGrid(holes: number, tempo: number, perBeat: GridSubdivision = 1): TempoGrid {
  // en croches, deux trous par temps : la grille est deux fois plus courte au même tempo
  const beats = Math.max(4, Math.ceil(Math.max(1, holes) / perBeat / 4) * 4);
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
    tempo: Math.max(GRID_TEMPO_MIN, Math.min(GRID_TEMPO_MAX, Math.round(tempo))),
    timeSig: [4, 4],
    measures,
  };
  return { score, beats, seconds: (beats * 60) / score.tempo, perBeat, npm: score.tempo * perBeat };
}

/**
 * Le temps écoulé est-il à portée d'un clic du métronome ? (phase 3)
 *
 * Les clics de la grille sont des attaques larges : au micro, le métronome de l'app est entendu
 * comme un coup de médiator et pourrait remplir une case tout seul. On ignore donc les fenêtres
 * proches d'un clic (± 90 ms, soit un peu plus de la moitié d'un temps à 50 BPM). Le prix est
 * assumé : jouer **exactement** sur le clic peut coûter une analyse. C'est le compromis inverse
 * d'une fausse validation, qui elle apprendrait du faux.
 */
export function nearClick(elapsedSeconds: number, bpm: number, windowMs = 90): boolean {
  const beat = 60 / Math.max(1, bpm);
  const phase = ((elapsedSeconds % beat) + beat) % beat;
  const ms = phase * 1000;
  return Math.min(ms, beat * 1000 - ms) <= windowMs;
}

/**
 * Le clic du métronome est un sinus court de Do6 (1 046,5 Hz, temps) ou Sol6 (1 568 Hz, premier temps),
 * dont la hauteur glisse de +8 % à −10 % (`core/audio/metronome.ts`). Entendu par le micro, il donne une
 * note de cette bande — très au-dessus d'une position de guitare (Mi aigu case 24 = Mi6, MIDI 88).
 */
export function isClickPitch(midi: number): boolean {
  return (midi >= 81.5 && midi <= 86) || (midi >= 88.5 && midi <= 93);
}

/**
 * Attaque à écarter : proche d'un clic **et** à la hauteur d'un clic. Lot « mémoire et vitesse » : le
 * masque par le temps seul effaçait toute note jouée **sur** le temps — mesuré au micro simulé à 60 BPM,
 * 3 notes sur 12 perdues, exactement celles qui tombaient sur un clic. Or jouer sur le temps est
 * précisément ce qu'on demande à la grille, à l'aveugle et en séquence.
 */
export function clickMasked(elapsedSeconds: number, bpm: number, heardMidi: number, windowMs = 90): boolean {
  return nearClick(elapsedSeconds, bpm, windowMs) && isClickPitch(heardMidi);
}

/** Début du chrono à la reprise d'une série en pause : décalé de la durée de la pause, qui ne compte pas. */
export function resumedStart(startedAt: number, pausedAt: number, now: number): number {
  return startedAt + Math.max(0, now - pausedAt);
}
