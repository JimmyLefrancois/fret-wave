/**
 * Lecture d'un TabScore : conversion PURE score → événements sonores (sans Tone, sans navigateur).
 * Le moteur audio ne joue que ce que ce module produit, et ce module ne produit que les notes du score :
 * « l'audio joué = les notes affichées » (BRIEF.md). Tempo constant (`score.tempo`) en phase 1b.
 */
import { PPQ, measureStarts, totalTicks, type TabScore } from './model';

export const DEFAULT_STRUM_SPREAD_MS = 14;

export interface PlayNote {
  string: number;
  fret: number;
  midi: number;
  /** Décalage par rapport au début de l'événement (strum : 0, s, 2s… de la corde jouée en premier). */
  offsetMs: number;
}

export interface PlayEvent {
  /** Tick absolu du début. */
  tick: number;
  durTicks: number;
  notes: PlayNote[];
  /** Mesure et rang de l'événement dans le score (pour relier à la colonne affichée). */
  measureIndex: number;
  eventIndex: number;
}

export function scoreToPlayEvents(score: TabScore, opts: { strumSpreadMs?: number } = {}): PlayEvent[] {
  const starts = measureStarts(score);
  const out: PlayEvent[] = [];
  score.measures.forEach((m, mi) => {
    m.events.forEach((ev, ei) => {
      const playable = ev.notes.filter((n) => !n.muted);
      if (ev.kind !== 'notes' || playable.length === 0) return;
      let ordered = [...playable].sort((a, b) => a.string - b.string); // grave → aigu
      let spread = 0;
      if (ev.strum && ordered.length > 1) {
        if (ev.strum.dir === 'U') ordered = ordered.reverse(); // aigu → grave
        spread = ev.strum.spreadMs ?? opts.strumSpreadMs ?? DEFAULT_STRUM_SPREAD_MS;
      }
      out.push({
        tick: starts[mi]! + ev.startTick,
        durTicks: ev.durTick,
        measureIndex: mi,
        eventIndex: ei,
        notes: ordered.map((n, i) => ({ string: n.string, fret: n.fret, midi: n.midi, offsetMs: i * spread })),
      });
    });
  });
  return out;
}

export function ticksToSeconds(ticks: number, bpm: number): number {
  return (ticks / PPQ) * (60 / bpm);
}

export function secondsToTicks(seconds: number, bpm: number): number {
  return (seconds * bpm * PPQ) / 60;
}

export function scoreDurationSeconds(score: TabScore): number {
  return ticksToSeconds(totalTicks(score), score.tempo);
}
