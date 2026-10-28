/**
 * Série **à l'aveugle** (lot « mémoire et vitesse ») : un rappel N3 au micro pendant lequel **aucune
 * tablature n'est dessinée**. L'élève joue la position dans l'ordre, sur la grille ; l'app écoute, ne dit
 * rien note par note, et juge à la fin.
 *
 * Pourquoi : la tablature vide du N3 montre encore les cordes, le nombre de notes et leur place dans la
 * mesure — assez pour se repérer en comptant. À l'aveugle, il ne reste que la main et l'oreille.
 *
 * Notation (logique pure) : alignement **séquentiel** des attaques entendues sur les notes attendues, avec
 * le même appariement que le reste de l'app (`matchPitch`) :
 *  - `fill`, `tuning` (accord de la guitare) ou `octave` (erreur classique du détecteur sur les cordes
 *    graves) contre la note attendue → **juste**, on avance. [HYP] l'octave est tolérée : sans retour
 *    pendant la série, l'élève ne peut pas « rejouer plus fort » comme au N3 ordinaire ;
 *  - la note **suivante** juste (une note oubliée) → l'attendue est **manquée**, la suivante juste ;
 *  - `wrong` (à un ou deux demi-tons) → **fausse**, on avance (l'élève visait cette note) ;
 *  - `outside` (trop loin de tout) → ignorée : bruit, corde à vide effleurée, pas une tentative.
 * « Terminer » avant la fin compte les notes restantes comme manquées.
 */
import { matchPitch, type Target } from '../../core/input/match';
import { PPQ, type TabScore } from '../../core/tab';
import { tempoGrid, type GridSubdivision, type TempoGrid } from './exercise';

/** Une attaque entendue : hauteur flottante (MIDI + cents) et instant depuis le premier temps de la grille (s). */
export interface HeardNote {
  midi: number;
  t: number;
}

export type BlindMark = 'right' | 'wrong' | 'missed';

export interface BlindScore {
  /** Verdict par note attendue (clé de trou). Absente : pas encore jouée. */
  marks: Record<string, BlindMark>;
  correct: number;
  total: number;
  /** Notes attendues déjà jugées (justes, fausses ou manquées). */
  consumed: number;
  /** Cordes où une note a été fausse ou manquée (diagnostic par corde). */
  missedStrings: number[];
  /** Instant (s) de la dernière attaque **retenue**, ou `null` si rien n'a été retenu. */
  lastAttack: number | null;
  /** Instant (s) de l'attaque de chaque note juste (clé de trou) : sert à juger la mise en place. */
  times: Record<string, number>;
}

export interface BlindOptions {
  centsTolerance: number;
  /** Fin de série demandée : les notes restantes sont manquées. */
  finished?: boolean;
  /** Une même hauteur réentendue dans cet intervalle est un rebond, pas une nouvelle note (s). */
  dedupeSeconds?: number;
}

const accepted = (kind: string) => kind === 'fill' || kind === 'tuning' || kind === 'octave';

export function scoreBlind(targets: readonly Target[], heard: readonly HeardNote[], opts: BlindOptions): BlindScore {
  const marks: Record<string, BlindMark> = {};
  const times: Record<string, number> = {};
  const dedupe = opts.dedupeSeconds ?? 0.4;
  let i = 0;
  let lastAttack: number | null = null;
  let prev: HeardNote | null = null;
  for (const h of heard) {
    if (i >= targets.length) break;
    // rebond du détecteur sur la note qu'on vient d'accepter : ignoré
    if (prev && Math.round(prev.midi) === Math.round(h.midi) && h.t - prev.t < dedupe) continue;
    const cur = targets[i]!;
    const v = matchPitch(h.midi, [cur], { centsTolerance: opts.centsTolerance });
    if (accepted(v.kind)) {
      marks[cur.key] = 'right';
      times[cur.key] = h.t;
      i += 1;
      lastAttack = h.t;
      prev = h;
      continue;
    }
    const next = targets[i + 1];
    if (next && accepted(matchPitch(h.midi, [next], { centsTolerance: opts.centsTolerance }).kind)) {
      // une note oubliée : la suivante est juste, l'attendue est manquée
      marks[cur.key] = 'missed';
      marks[next.key] = 'right';
      times[next.key] = h.t;
      i += 2;
      lastAttack = h.t;
      prev = h;
      continue;
    }
    if (v.kind === 'wrong') {
      marks[cur.key] = 'wrong';
      i += 1;
      lastAttack = h.t;
      prev = h;
    }
    // `outside` : ignorée
  }
  if (opts.finished) for (const t of targets.slice(i)) marks[t.key] = 'missed';
  const correct = targets.filter((t) => marks[t.key] === 'right').length;
  const missedStrings = [...new Set(targets.filter((t) => marks[t.key] === 'wrong' || marks[t.key] === 'missed').map((t) => t.string))];
  return {
    marks,
    correct,
    total: targets.length,
    consumed: targets.filter((t) => marks[t.key] !== undefined).length,
    missedStrings,
    lastAttack,
    times,
  };
}

export interface BlindGrid {
  /** Score de silences : une mesure de décompte, puis la grille de la série. */
  score: TabScore;
  /** Durée du décompte (une mesure de 4 temps), en secondes. */
  countIn: number;
  /** La grille de la série elle-même (sans décompte) : c'est elle qui juge `tempoOk`. */
  grid: TempoGrid;
}

/** Décompte d'une mesure + grille : l'élève entend quatre clics avant sa première note. */
export function blindGrid(notes: number, tempo: number, perBeat: GridSubdivision = 1): BlindGrid {
  const grid = tempoGrid(notes, tempo, perBeat);
  const countMeasure = {
    events: [0, 1, 2, 3].map((b) => ({ startTick: b * PPQ, durTick: PPQ, kind: 'rest' as const, notes: [] })),
  };
  return {
    score: { ...grid.score, id: 'exercise:blind', measures: [countMeasure, ...grid.score.measures] },
    countIn: (4 * 60) / grid.score.tempo,
    grid,
  };
}

/** Temps du décompte restant à afficher (4, 3, 2, 1), ou `null` une fois la série lancée. */
export function countInBeat(elapsed: number, grid: BlindGrid): number | null {
  if (elapsed >= grid.countIn) return null;
  const beat = grid.countIn / 4;
  return Math.max(1, 4 - Math.floor(Math.max(0, elapsed) / beat));
}
