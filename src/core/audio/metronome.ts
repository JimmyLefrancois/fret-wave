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

export class Metronome {
  constructor(private readonly ctx: AudioContext, private readonly out: AudioNode) {}

  /** Un clic à l'heure audio `time` : sinus court dont la hauteur descend (bloc de bois), enveloppe sans clic parasite. */
  click(time: number, accent: ClickAccent): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = CLICK_HZ[accent];
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.08, time);
    o.frequency.exponentialRampToValueAtTime(f * 0.9, time + 0.03);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(CLICK_LEVEL[accent], time + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    o.connect(g).connect(this.out);
    o.start(time);
    o.stop(time + 0.07);
    o.onended = () => g.disconnect();
  }
}
