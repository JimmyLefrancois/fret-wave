/**
 * Lecture d'un TabScore : conversion PURE score → événements sonores (sans Tone, sans navigateur).
 * Le moteur audio ne joue que ce que ce module produit, et ce module ne produit que les notes du score :
 * « l'audio joué = les notes affichées » (BRIEF.md). Tempo constant (`score.tempo`) jusqu'à la phase 2.
 *
 * Phase 1c : en plus des notes, ce module décide COMMENT elles sont jouées — c'est du jeu de guitare, pas du son :
 *  - strum : décalage entre cordes (moyen `strumSpreadMs`), qui s'accélère légèrement en fin de geste ; vélocité qui
 *    décroît du côté d'où part la main (le médiator attaque plus fort la corde par laquelle il arrive) ; montant plus
 *    doux que descendant ; frappe sur le temps plus appuyée que sur le contretemps. Notes seules : dynamique égale ;
 *  - humanisation DÉTERMINISTE (graine = tick, corde, option `seed`) : rejouer deux fois donne exactement la même chose ;
 *  - tenue : accords et arpèges de l'accord sonnent jusqu'à la fin de la mesure (la corde n'est coupée que si on la
 *    rejoue, comme à la main), les gammes sont étouffées à la fin de chaque note.
 */
import { PPQ, measureLength, measureStarts, totalTicks, type TabScore } from './model';

export const DEFAULT_STRUM_SPREAD_MS = 14;
export const DEFAULT_BASE_VELOCITY = 0.7;
/** Part maximale de la durée d'un événement que peut occuper le balayage d'un strum (au-delà on le resserre). */
export const MAX_STRUM_FRACTION = 0.35;

export type SustainPolicy = 'ring' | 'legato' | 'damp';

export interface PlayNote {
  string: number;
  fret: number;
  midi: number;
  /** Décalage par rapport au début de l'événement (strum : 0, puis l'écart cumulé de chaque corde suivante). */
  offsetMs: number;
  /** 0-1 : gain de la note (forme du strum, humanisation). */
  velocity: number;
  /** 0-1 : vélocité de l'ÉVÉNEMENT (base × accents), identique pour toutes ses cordes : choisit la couche d'échantillons. */
  layerVelocity: number;
}

export interface PlayEvent {
  /** Tick absolu du début. */
  tick: number;
  durTicks: number;
  notes: PlayNote[];
  /** Mesure et rang de l'événement dans le score (pour relier à la colonne affichée). */
  measureIndex: number;
  eventIndex: number;
  /** Tick absolu de la fin de la mesure. */
  measureEndTick: number;
  /** Durée pendant laquelle les cordes de cet événement sonnent avant d'être relâchées (ticks, depuis `tick`). */
  sustainTicks: number;
  /** Frappe de strum (D / U) si l'événement en est un. */
  strumDir?: 'D' | 'U';
}

export interface PlayOptions {
  strumSpreadMs?: number;
  /** 0 = mécanique (défaut ici, pour des tests exacts), 1 = très humain. Le moteur passe le réglage utilisateur. */
  humanize?: number;
  sustain?: SustainPolicy | 'auto';
  baseVelocity?: number;
  seed?: number;
}

export function defaultSustain(kind: TabScore['kind']): SustainPolicy {
  return kind === 'chord' || kind === 'progression' ? 'ring' : kind === 'arpeggio' ? 'legato' : 'damp';
}

/** Générateur pseudo-aléatoire à graine (mulberry32) : même graine → même suite. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (a: number, b: number, c: number): number => Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0xc2b2ae35, 0x27d4eb2f) ^ Math.imul(c + 1, 0x165667b1);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function scoreToPlayEvents(score: TabScore, opts: PlayOptions = {}): PlayEvent[] {
  const starts = measureStarts(score);
  const human = clamp(opts.humanize ?? 0, 0, 1);
  const policy = !opts.sustain || opts.sustain === 'auto' ? defaultSustain(score.kind) : opts.sustain;
  const base = opts.baseVelocity ?? DEFAULT_BASE_VELOCITY;
  const seed = opts.seed ?? 0;
  const msPerTick = 60000 / (score.tempo * PPQ);
  const out: PlayEvent[] = [];
  score.measures.forEach((m, mi) => {
    const measureEnd = starts[mi]! + measureLength(score, mi);
    m.events.forEach((ev, ei) => {
      const playable = ev.notes.filter((n) => !n.muted);
      if (ev.kind !== 'notes' || playable.length === 0) return;
      const tick = starts[mi]! + ev.startTick;
      let ordered = [...playable].sort((a, b) => a.string - b.string); // grave → aigu
      const isStrum = !!ev.strum && ordered.length > 1;
      if (isStrum && ev.strum!.dir === 'U') ordered = ordered.reverse(); // aigu → grave
      const rnd = seeded(hash(tick, seed, 7));
      const jitter = () => (rnd() * 2 - 1) * human;

      // --- accent. Strum (jeu rythmique) : début de mesure +, contretemps −, montant plus doux. Notes seules (gammes,
      // arpèges) : dynamique égale — on veut entendre chaque hauteur — sauf un léger appui sur la première de la mesure.
      let accent = 1;
      if (isStrum) {
        accent = ei === 0 ? 1.06 : ev.startTick % PPQ === 0 ? 1 : 0.9;
        if (ev.strum!.dir === 'U') accent *= 0.88;
      } else if (ei === 0) accent = 1.04;

      // --- décalages (strum)
      const offsets: number[] = ordered.map(() => 0);
      if (isStrum) {
        const spread = ev.strum!.spreadMs ?? opts.strumSpreadMs ?? DEFAULT_STRUM_SPREAD_MS;
        const gaps = ordered.slice(1).map((_, i, a) => {
          const t = a.length > 1 ? i / (a.length - 1) : 0;
          const shape = 1 + human * 0.25 * (1 - 2 * t); // le geste accélère : premiers écarts plus longs
          return Math.max(1, spread * shape + jitter() * 0.2 * spread);
        });
        // le balayage ne doit pas occuper plus de MAX_STRUM_FRACTION de l'événement (tempos rapides)
        const total = gaps.reduce((s, g) => s + g, 0);
        const cap = ev.durTick * msPerTick * MAX_STRUM_FRACTION;
        const k = total > cap && total > 0 ? cap / total : 1;
        let acc = 0;
        gaps.forEach((g, i) => {
          acc += g * k;
          offsets[i + 1] = acc;
        });
      }

      // --- vélocités
      const eventVelocity = clamp(base * accent, 0.05, 1);
      const notes: PlayNote[] = ordered.map((n, i) => {
        let v = base * accent;
        if (isStrum) {
          const t = ordered.length > 1 ? i / (ordered.length - 1) : 0;
          v *= 1 - 0.18 * t; // la corde par laquelle la main arrive est la plus forte
        } else if (n.fn === '1') {
          v *= 1.08; // fondamentale très légèrement appuyée (entendre où est la tonique)
        }
        v *= 1 + jitter() * 0.07;
        return { string: n.string, fret: n.fret, midi: n.midi, offsetMs: Math.round(offsets[i]! * 1000) / 1000, velocity: clamp(v, 0.05, 1), layerVelocity: eventVelocity };
      });

      const sustainTicks = policy === 'ring' ? measureEnd - tick : policy === 'legato' ? Math.min(ev.durTick * 2, measureEnd - tick) : ev.durTick;
      out.push({
        tick,
        durTicks: ev.durTick,
        measureIndex: mi,
        eventIndex: ei,
        measureEndTick: measureEnd,
        sustainTicks,
        ...(isStrum ? { strumDir: ev.strum!.dir } : {}),
        notes,
      });
    });
  });
  return out;
}

/**
 * Rang du dernier événement commencé à `tick` (-1 avant le premier). `events` est trié, comme le rend
 * `scoreToPlayEvents` ; un silence garde la note précédente : le repère ne clignote pas entre deux notes.
 */
export function eventIndexAt(events: readonly PlayEvent[], tick: number): number {
  let lo = 0;
  let hi = events.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid]!.tick <= tick) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
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
