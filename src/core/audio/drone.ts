/**
 * Drone de la fondamentale (phase 1c) : fond continu et doux pour entendre la COULEUR d'une gamme ou d'un mode
 * (la tierce mineure d'un dorien sonne mineure parce qu'elle est entendue contre une tonique qui ne bouge pas).
 *
 * - `droneMidis` (pur, testé) : fondamentale ramenée entre Mi2 et Ré♯3, + quinte juste et octave. Jamais de tierce :
 *   le drone ne doit pas annoncer « majeur » ou « mineur » à la place de la gamme.
 * - `Drone` : deux triangles légèrement désaccordés par note + un sinus grave sur la fondamentale, filtre passe-bas
 *   lent (le timbre « respire »), attaque et fin en fondu (aucun clic). Web Audio natif, pas de dépendance à Tone.
 */
import { midiToFreq, pitchClassOf } from '../theory';
import type { NoteName } from '../theory/types';

export type DroneKind = 'root' | 'fifth';

/** Hauteur MIDI de la fondamentale du drone : la tonique la plus grave entre Mi2 (40) et Ré♯3 (51). */
export function droneRootMidi(tonic: NoteName): number {
  return 40 + ((pitchClassOf(tonic) - 4 + 12) % 12);
}

export function droneMidis(tonic: NoteName, kind: DroneKind = 'fifth'): number[] {
  const r = droneRootMidi(tonic);
  return kind === 'root' ? [r, r + 12] : [r, r + 7, r + 12];
}

const WEIGHTS = [1, 0.55, 0.7];

export class Drone {
  private layer: { gain: GainNode; oscs: OscillatorNode[]; startAt: number; fadeInS: number } | null = null;
  midis: number[] = [];

  constructor(private readonly ctx: AudioContext, private readonly out: AudioNode, private readonly a4 = 440) {}

  get active(): boolean {
    return this.layer !== null;
  }

  /** Démarre (ou remplace par fondu enchaîné) le drone. */
  start(midis: number[], fadeInS = 1.2, when = this.ctx.currentTime): void {
    if (this.layer) this.stop(0.5, when);
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(1, when + fadeInS);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 850;
    filter.Q.value = 0.4;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.11;
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start(when);
    const oscs: OscillatorNode[] = [lfo];
    const level = 0.16 / Math.sqrt(midis.length); // somme des voix bornée : le drone ne sature jamais le bus
    midis.forEach((m, i) => {
      const w = (WEIGHTS[i] ?? 0.5) * level;
      for (const detune of [-5, 5]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = midiToFreq(m, this.a4);
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = w;
        o.connect(g).connect(filter);
        o.start(when);
        oscs.push(o);
      }
      if (i === 0) {
        const sub = ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.value = midiToFreq(m, this.a4);
        const g = ctx.createGain();
        g.gain.value = w * 0.9;
        sub.connect(g).connect(filter);
        sub.start(when);
        oscs.push(sub);
      }
    });
    filter.connect(gain).connect(this.out);
    this.layer = { gain, oscs, startAt: when, fadeInS };
    this.midis = [...midis];
  }

  stop(fadeOutS = 0.9, when = this.ctx.currentTime): void {
    const l = this.layer;
    if (!l) return;
    this.layer = null;
    this.midis = [];
    // valeur de l'enveloppe à l'instant de l'arrêt (si on coupe pendant le fondu d'entrée : pas de saut)
    const v = Math.max(0, Math.min(1, (when - l.startAt) / l.fadeInS));
    const g = l.gain.gain;
    g.cancelScheduledValues(when);
    g.setValueAtTime(v, when);
    g.setTargetAtTime(0, when, fadeOutS / 4);
    const end = when + fadeOutS * 2;
    for (const o of l.oscs) o.stop(end);
    l.oscs[0]!.onended = () => l.gain.disconnect();
  }
}
