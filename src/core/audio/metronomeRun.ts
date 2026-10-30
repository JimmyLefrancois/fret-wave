/**
 * Page Métronome (D112) : logique PURE, sans audio ni horloge. `MetronomeRun` déroule les temps un par un
 * (décompte, automation du tempo, mesures silencieuses) ; la programmation sur le Transport est dans
 * `metronomeSession.ts`. Réglages et mémoires : lecture tolérante, une valeur illisible retombe sur le défaut.
 */
import { CLICK_SOUNDS, type ClickAccent, type ClickSound } from './metronome';
import type { KeyValueStore } from './mixer';

export const METRO_KEY = 'fretwave.metronome.v1';
export const METRO_BPM_MIN = 10;
export const METRO_BPM_MAX = 300;
export const METRO_BEATS_MAX = 12;
export const METRO_COUNT_MAX = 4;
export const METRO_SLOTS = 10;
/** Palier ou plage de mesures silencieuses : borne haute commune aux réglages en nombre de mesures. */
const COUNT_MAX = 64;
const EVERY_MAX = 600;

export type RampUnit = 'bars' | 'seconds';

export interface TempoRamp {
  on: boolean;
  from: number;
  to: number;
  /** BPM ajoutés (ou retirés, si `to` < `from`) à chaque palier. */
  step: number;
  unit: RampUnit;
  /** Durée d'un palier, en mesures ou en secondes selon `unit`. */
  every: number;
  /** Une fois la cible tenue un palier, repart de `from`. */
  loop: boolean;
}

export interface SilentBars {
  on: boolean;
  audible: number;
  silent: number;
  /** Chaque série dure entre 1 et la valeur réglée, tirée au sort. */
  random: boolean;
}

export interface MetronomeConfig {
  bpm: number;
  beats: number;
  countIn: number;
  sound: ClickSound;
  flash: boolean;
  ramp: TempoRamp;
  silence: SilentBars;
}

export const DEFAULT_METRONOME: MetronomeConfig = {
  bpm: 120,
  beats: 4,
  countIn: 0,
  sound: 'bois',
  flash: false,
  ramp: { on: false, from: 60, to: 120, step: 5, unit: 'bars', every: 4, loop: false },
  silence: { on: false, audible: 2, silent: 2, random: false },
};

/** Tempo d'un palier ; `progress` est en mesures ou en secondes, selon `ramp.unit`. */
export function rampBpm(ramp: TempoRamp, progress: number): number {
  const dist = Math.abs(ramp.to - ramp.from);
  if (dist === 0) return ramp.from;
  const steps = Math.ceil(dist / ramp.step);
  let n = Math.floor(progress / ramp.every);
  // +1 : la cible est tenue un palier entier avant de repartir
  if (ramp.loop) n %= steps + 1;
  return ramp.from + Math.sign(ramp.to - ramp.from) * Math.min(n * ramp.step, dist);
}

/** Un temps tel qu'il doit sonner et s'afficher. */
export interface MetroBeat {
  phase: 'count' | 'play';
  /** Rang dans la mesure, à partir de 0. */
  beat: number;
  beats: number;
  /** Mesures jouées, celle-ci comprise ; 0 pendant le décompte. */
  bar: number;
  /** Temps joués, celui-ci compris, décompte exclu. */
  total: number;
  bpm: number;
  accent: ClickAccent;
  /** Faux dans une mesure silencieuse : le temps court, rien ne sonne. */
  audible: boolean;
  /** Secondes de jeu écoulées au moment de ce temps, décompte exclu. */
  elapsedS: number;
}

export class MetronomeRun {
  private beat = 0;
  private beatsInBar: number;
  private countLeft: number;
  private phase: MetroBeat['phase'] = 'play';
  private bar = 0;
  private total = 0;
  private elapsedS = 0;
  private barBpm = 0;
  private audible = true;
  private inAudible = false;
  private seriesLeft = 0;

  constructor(private config: MetronomeConfig, private readonly rng: () => number = Math.random) {
    this.countLeft = config.countIn;
    this.beatsInBar = config.beats;
  }

  /** Réglages en direct : le tempo manuel s'applique au temps suivant, le reste à la mesure suivante. */
  setConfig(config: MetronomeConfig): void {
    this.config = config;
  }

  next(): MetroBeat {
    if (this.beat === 0) this.startBar();
    const { ramp, bpm: manual } = this.config;
    const bpm = ramp.on ? this.barBpm : manual;
    const out: MetroBeat = {
      phase: this.phase,
      beat: this.beat,
      beats: this.beatsInBar,
      bar: this.bar,
      total: this.phase === 'play' ? ++this.total : this.total,
      bpm,
      accent: this.beat === 0 ? 'bar' : 'beat',
      audible: this.audible,
      elapsedS: this.elapsedS,
    };
    if (this.phase === 'play') this.elapsedS += 60 / bpm;
    this.beat = (this.beat + 1) % this.beatsInBar;
    return out;
  }

  private startBar(): void {
    const { ramp, beats } = this.config;
    this.beatsInBar = beats;
    if (this.countLeft > 0) {
      this.countLeft--;
      this.phase = 'count';
      this.audible = true;
      this.barBpm = ramp.from;
      return;
    }
    this.phase = 'play';
    this.barBpm = rampBpm(ramp, ramp.unit === 'bars' ? this.bar : this.elapsedS);
    this.bar++;
    this.audible = this.nextBarAudible();
  }

  private nextBarAudible(): boolean {
    const { on, audible, silent, random } = this.config.silence;
    if (!on) {
      this.inAudible = false;
      this.seriesLeft = 0;
      return true;
    }
    if (this.seriesLeft <= 0) {
      this.inAudible = !this.inAudible;
      const n = this.inAudible ? audible : silent;
      this.seriesLeft = random ? 1 + Math.floor(this.rng() * n) : n;
    }
    this.seriesLeft--;
    return this.inAudible;
  }
}

export interface MetronomeState {
  config: MetronomeConfig;
  /** Dix emplacements ; `null` = vide. */
  slots: (MetronomeConfig | null)[];
}

const int = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

function parseConfig(raw: unknown): MetronomeConfig {
  const d = DEFAULT_METRONOME;
  const o = (raw ?? {}) as Partial<Record<keyof MetronomeConfig, unknown>>;
  const r = (o.ramp ?? {}) as Partial<Record<keyof TempoRamp, unknown>>;
  const s = (o.silence ?? {}) as Partial<Record<keyof SilentBars, unknown>>;
  return {
    bpm: int(o.bpm, METRO_BPM_MIN, METRO_BPM_MAX, d.bpm),
    beats: int(o.beats, 1, METRO_BEATS_MAX, d.beats),
    countIn: int(o.countIn, 0, METRO_COUNT_MAX, d.countIn),
    sound: CLICK_SOUNDS.includes(o.sound as ClickSound) ? (o.sound as ClickSound) : d.sound,
    flash: bool(o.flash, d.flash),
    ramp: {
      on: bool(r.on, d.ramp.on),
      from: int(r.from, METRO_BPM_MIN, METRO_BPM_MAX, d.ramp.from),
      to: int(r.to, METRO_BPM_MIN, METRO_BPM_MAX, d.ramp.to),
      step: int(r.step, 1, METRO_BPM_MAX, d.ramp.step),
      unit: r.unit === 'seconds' ? 'seconds' : 'bars',
      every: int(r.every, 1, EVERY_MAX, d.ramp.every),
      loop: bool(r.loop, d.ramp.loop),
    },
    silence: {
      on: bool(s.on, d.silence.on),
      audible: int(s.audible, 1, COUNT_MAX, d.silence.audible),
      silent: int(s.silent, 1, COUNT_MAX, d.silence.silent),
      random: bool(s.random, d.silence.random),
    },
  };
}

export function loadMetronomeState(store: KeyValueStore | null): MetronomeState {
  const empty = (): MetronomeState => ({ config: parseConfig(null), slots: Array.from({ length: METRO_SLOTS }, () => null) });
  if (!store) return empty();
  try {
    const raw = store.getItem(METRO_KEY);
    if (!raw) return empty();
    const o = JSON.parse(raw) as { config?: unknown; slots?: unknown };
    const slots = Array.isArray(o.slots) ? o.slots : [];
    return {
      config: parseConfig(o.config),
      slots: Array.from({ length: METRO_SLOTS }, (_, i) => (slots[i] ? parseConfig(slots[i]) : null)),
    };
  } catch {
    return empty(); // JSON cassé : on garde les défauts
  }
}

export function saveMetronomeState(store: KeyValueStore | null, state: MetronomeState): void {
  if (!store) return;
  try {
    store.setItem(METRO_KEY, JSON.stringify(state));
  } catch {
    /* stockage plein ou interdit : le réglage reste valable pour la session */
  }
}
