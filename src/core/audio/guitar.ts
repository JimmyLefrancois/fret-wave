/**
 * Guitare échantillonnée (phase 1c) : une « corde » = une voix à la fois, comme sur le manche.
 *
 *  - Rejouer une corde COUPE la note précédente de cette corde (coupure de ≈ 25 ms) : un accord rejoué ne s'empile pas,
 *    un arpège laissé sonner reste propre.
 *  - Attaque de 2 ms depuis le silence et relâchement exponentiel avant l'arrêt de la source : aucun clic.
 *  - Hauteur = hauteur du score + correction de l'écart MESURÉ de l'échantillon ; niveau = gain de nivellement × vélocité.
 *  - Répétitions (round-robin) quand la banque en a ; sinon désaccord aléatoire de ±3 cents (graine fixe par note)
 *    pour qu'une même note rejouée ne soit pas un clone sonore.
 *  - Note hors plage des échantillons : synthèse Karplus-Strong (jamais de note muette).
 */
import { karplusStrong } from './karplus';
import { SampleSet, type NotePlan } from './sampleBank';
import { midiToFreq } from '../theory';
import { seeded } from '../tab/playback';

export interface NoteRequest {
  string: number;
  midi: number;
  /** Heure audio du début (s). */
  time: number;
  velocity: number;
  /** Vélocité de l'événement entier (choix de la couche d'échantillons, même timbre pour toutes les cordes d'un strum). */
  layerVelocity?: number;
  /** Heure audio où la corde est relâchée ; `null` = laissée sonner jusqu'à la fin de l'échantillon. */
  releaseAt: number | null;
}

/** Ce qui a été réellement déclenché (vérification, page de debug). */
export interface PlayedInfo {
  string: number;
  midi: number;
  kind: 'sample' | 'synth';
  file?: string;
  layer?: string;
  rate: number;
  gain: number;
  startAt: number;
  stopAt: number;
}

interface Voice {
  src: AudioBufferSourceNode;
  gain: GainNode;
  level: number;
  startAt: number;
  releaseAt: number;
  stopAt: number;
}

const ATTACK_S = 0.002;
const CHOKE_TAU = 0.008;

export class GuitarSampler {
  private set: SampleSet | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Map<number, Voice>();
  private rr = new Map<number, number>();
  private synthCache = new Map<number, AudioBuffer>();
  /** Désaccord global (cents), p. ex. un La de référence ≠ 440 Hz. */
  tuningCents = 0;

  constructor(private readonly ctx: AudioContext, private readonly out: AudioNode) {}

  setBank(set: SampleSet, buffers: Map<string, AudioBuffer>): void {
    this.stopAll(this.ctx.currentTime, 0.02);
    this.set = set;
    this.buffers = buffers;
    this.rr.clear();
  }

  get bank(): SampleSet | null {
    return this.set;
  }

  /** Prévoit la note sans la jouer : quel échantillon, quelle vitesse (page de debug, tests). */
  plan(midi: number, velocity: number): NotePlan | null {
    return this.set ? this.set.plan(midi, velocity, this.rr.get(midi) ?? 0, this.tuningCents) : null;
  }

  play(req: NoteRequest): PlayedInfo | null {
    const set = this.set;
    if (!set) return null;
    const ctx = this.ctx;
    const when = Math.max(req.time, ctx.currentTime);
    const rrIdx = this.rr.get(req.midi) ?? 0;
    this.rr.set(req.midi, rrIdx + 1);
    const rnd = seeded(req.midi * 131 + rrIdx);
    const jitterCents = set.layered ? 0 : (rnd() * 2 - 1) * 3;
    const plan = set.plan(req.midi, req.velocity, rrIdx, this.tuningCents + jitterCents, req.layerVelocity ?? req.velocity);

    let buffer: AudioBuffer;
    let rate: number;
    let gainLin: number;
    let info: Pick<PlayedInfo, 'kind' | 'file' | 'layer'>;
    if (plan) {
      const b = this.buffers.get(plan.entry.file);
      if (!b) return null;
      buffer = b;
      rate = plan.rate;
      gainLin = plan.gain;
      info = { kind: 'sample', file: plan.entry.file, layer: plan.entry.layer };
    } else {
      buffer = this.synthBuffer(req.midi);
      rate = 1;
      gainLin = 0.5 * (0.3 + 0.7 * req.velocity);
      info = { kind: 'synth' };
    }

    // la corde est reprise : la note précédente de cette corde est coupée
    this.choke(req.string, when);

    const naturalEnd = when + buffer.duration / rate;
    const releaseTau = set.manifest.releaseS / 4;
    // relâchement demandé, mais jamais après le fondu de fin naturel de l'échantillon
    const letRing = req.releaseAt === null;
    // (jamais avant la fin de la rampe d'attaque : sinon l'arrêt de la source tomberait à pleine amplitude)
    const releaseAt = Math.max(Math.min(req.releaseAt ?? Infinity, naturalEnd - 0.06), when + ATTACK_S + 0.002);
    const stopAt = Math.min(naturalEnd, releaseAt + releaseTau * 8);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gainLin, when + ATTACK_S);
    g.gain.setTargetAtTime(0, releaseAt, letRing ? 0.02 : releaseTau);
    src.connect(g).connect(this.out);
    src.start(when);
    src.stop(stopAt);
    const voice: Voice = { src, gain: g, level: gainLin, startAt: when, releaseAt, stopAt };
    this.voices.set(req.string, voice);
    src.onended = () => {
      g.disconnect();
      if (this.voices.get(req.string) === voice) this.voices.delete(req.string);
    };
    return { string: req.string, midi: req.midi, ...info, rate, gain: gainLin, startAt: when, stopAt };
  }

  /**
   * Coupe la note de la corde à l'heure `when` (fondu court).
   * Si la corde est rejouée pendant les 2 ms d'attaque de la note précédente, la coupure est reportée juste après la
   * fin de cette rampe : annuler une rampe en cours la ferait retomber à 0 puis sauter (clic mesuré : 12 × la pente
   * normale), alors que la reporter de ≤ 2,5 ms est inaudible.
   */
  private choke(string: number, when: number, tau = CHOKE_TAU): void {
    const v = this.voices.get(string);
    if (!v) return;
    const t = Math.max(when, v.startAt + ATTACK_S + 0.0005);
    if (t >= v.stopAt || t >= v.releaseAt) return; // déjà en train de s'éteindre
    const g = v.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(v.level, t);
    g.setTargetAtTime(0, t, tau);
    const end = t + tau * 10;
    if (end < v.stopAt) {
      try {
        v.src.stop(end);
      } catch {
        /* source déjà arrêtée */
      }
      v.stopAt = end;
    }
    v.releaseAt = t;
  }

  /** Coupe toutes les cordes (arrêt, pause). */
  stopAll(when = this.ctx.currentTime, tau = 0.03): void {
    for (const s of [...this.voices.keys()]) this.choke(s, Math.max(when, this.ctx.currentTime), tau);
  }

  private synthBuffer(midi: number): AudioBuffer {
    const hit = this.synthCache.get(midi);
    if (hit) return hit;
    const sr = this.ctx.sampleRate;
    const data = karplusStrong(midiToFreq(midi) * 2 ** (this.tuningCents / 1200), sr, 3, midi);
    const buf = this.ctx.createBuffer(1, data.length, sr);
    buf.getChannelData(0).set(data);
    this.synthCache.set(midi, buf);
    return buf;
  }

  dispose(): void {
    this.stopAll(this.ctx.currentTime, 0.01);
    this.voices.clear();
    this.buffers.clear();
    this.synthCache.clear();
  }
}
