/**
 * Métronome (phase 1c) : planification PURE des clics à partir du score (testée), synthèse d'un clic propre.
 *
 * Règles : temps = unité de la signature (noire en 4/4, croche en x/8). Mesures composées (6/8, 9/8, 12/8) : un clic
 * par groupe de trois croches (accent sur le premier), les croches intermédiaires seulement en mode « subdiviser ».
 * Les clics sont posés sur Tone.Transport (jamais de setTimeout) : même horloge que les notes du score.
 */
import { PPQ, measureLength, measureStarts, timeSigOf, type TabScore } from '../tab/model';

export type ClickAccent = 'bar' | 'beat' | 'sub';

export interface Click {
  /** Tick absolu. */
  tick: number;
  accent: ClickAccent;
}

export const isCompound = ([num, den]: readonly [number, number]): boolean => den === 8 && num >= 6 && num % 3 === 0;

export function metronomeClicks(score: TabScore, opts: { subdivide?: boolean } = {}): Click[] {
  const starts = measureStarts(score);
  const out: Click[] = [];
  score.measures.forEach((_, mi) => {
    const sig = timeSigOf(score, mi);
    const len = measureLength(score, mi);
    const unit = (4 * PPQ) / sig[1];
    const step = isCompound(sig) ? unit * 3 : unit;
    const subStep = isCompound(sig) ? unit : unit / 2;
    for (let t = 0; t < len; t += step) {
      out.push({ tick: starts[mi]! + t, accent: t === 0 ? 'bar' : 'beat' });
    }
    if (opts.subdivide) {
      for (let t = 0; t < len; t += subStep) if (t % step !== 0) out.push({ tick: starts[mi]! + t, accent: 'sub' });
    }
  });
  return out.sort((a, b) => a.tick - b.tick);
}

const CLICK_HZ: Record<ClickAccent, number> = { bar: 1568, beat: 1046.5, sub: 784 };
const CLICK_LEVEL: Record<ClickAccent, number> = { bar: 0.5, beat: 0.38, sub: 0.2 };

export const CLICK_SOUNDS = ['bois', 'bip', 'cloche', 'sec'] as const;
export type ClickSound = (typeof CLICK_SOUNDS)[number];

/** Timbres synthétisés (aucun fichier) : `ratio` transpose le clic, `drop` fait descendre sa hauteur. */
const SOUND: Record<ClickSound, { type: OscillatorType; ratio: number; decay: number; gain: number; drop: boolean }> = {
  bois: { type: 'sine', ratio: 1, decay: 0.05, gain: 1, drop: true },
  bip: { type: 'square', ratio: 1, decay: 0.04, gain: 0.5, drop: false },
  cloche: { type: 'triangle', ratio: 1.5, decay: 0.18, gain: 0.9, drop: false },
  sec: { type: 'triangle', ratio: 2.2, decay: 0.015, gain: 1, drop: false },
};

export class Metronome {
  constructor(private readonly ctx: AudioContext, private readonly out: AudioNode) {}

  /** Un clic à l'heure audio `time`, par défaut un sinus court dont la hauteur descend (bloc de bois), enveloppe sans clic parasite. */
  click(time: number, accent: ClickAccent, sound: ClickSound = 'bois'): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const s = SOUND[sound];
    const f = CLICK_HZ[accent] * s.ratio;
    o.type = s.type;
    if (s.drop) {
      o.frequency.setValueAtTime(f * 1.08, time);
      o.frequency.exponentialRampToValueAtTime(f * 0.9, time + 0.03);
    } else {
      o.frequency.setValueAtTime(f, time);
    }
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(CLICK_LEVEL[accent] * s.gain, time + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, time + s.decay);
    o.connect(g).connect(this.out);
    o.start(time);
    o.stop(time + s.decay + 0.02);
    o.onended = () => g.disconnect();
  }
}
