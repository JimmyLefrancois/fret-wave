/**
 * Lecteur provisoire d'un TabScore sur Tone.Transport (phase 1b).
 *
 * - Les événements sont ceux de `scoreToPlayEvents` (mêmes notes que l'écran) ;
 * - tick = tick du Transport (PPQ 480, identique au modèle) : conversion en UN seul endroit (`${tick}i`) ;
 * - SON PROVISOIRE : une corde pincée (Karplus-Strong, `Tone.PluckSynth`) par corde de la guitare — pas
 *   d'échantillons : le moteur audio final (échantillons, bus, mixage) est prévu en 1c ;
 * - Tone est chargé à la demande (import dynamique) : la page de contrôle n'embarque pas Tone tant qu'on ne joue pas.
 */
import { PPQ, scoreToPlayEvents, totalTicks, type TabScore } from '../tab';

type ToneModule = typeof import('tone');

export type PlayerState = 'stopped' | 'playing' | 'paused';

export interface PlayerOptions {
  loop?: boolean;
  strumSpreadMs?: number;
}

export class TabPlayer {
  private tone: ToneModule | null = null;
  private synths: Array<import('tone').PluckSynth> = [];
  private out: Array<{ dispose(): unknown }> = [];
  private score: TabScore | null = null;
  private total = 0;
  state: PlayerState = 'stopped';
  /** Appelé (thread principal, synchronisé sur l'audio) quand la lecture se termine sans boucle. */
  onEnded: (() => void) | null = null;
  /** Notes déclenchées depuis le dernier `load` (vérification : tick du score, corde, hauteur, heure audio). */
  triggered: Array<{ tick: number; string: number; midi: number; atAudioTime: number }> = [];

  /** Charge Tone et démarre le contexte audio. À appeler depuis un geste utilisateur. */
  async init(): Promise<void> {
    if (this.tone) return;
    const Tone = await import('tone');
    await Tone.start();
    this.tone = Tone;
    Tone.getTransport().PPQ = PPQ;
  }

  private buildInstrument(stringCount: number): void {
    const Tone = this.tone!;
    this.synths.forEach((s) => s.dispose());
    this.out.forEach((o) => o.dispose());
    const limiter = new Tone.Limiter(-3).toDestination();
    const gain = new Tone.Gain(0.55).connect(limiter);
    this.out = [limiter, gain];
    this.synths = Array.from({ length: stringCount }, () => {
      const s = new Tone.PluckSynth({ attackNoise: 1.2, dampening: 3800, resonance: 0.985, release: 0.4 });
      s.connect(gain);
      return s;
    });
  }

  /** Programme tout le score sur le Transport (remplace la programmation précédente). */
  async load(score: TabScore, opts: PlayerOptions = {}): Promise<void> {
    await this.init();
    const Tone = this.tone!;
    const transport = Tone.getTransport();
    this.stop();
    transport.cancel(0);
    this.score = score;
    this.total = totalTicks(score);
    this.triggered = [];
    transport.bpm.value = score.tempo;
    this.buildInstrument(score.stringCount);
    for (const ev of scoreToPlayEvents(score, { strumSpreadMs: opts.strumSpreadMs })) {
      transport.schedule((time) => {
        for (const n of ev.notes) {
          const at = time + n.offsetMs / 1000;
          this.synths[n.string]?.triggerAttack(Tone.Frequency(n.midi, 'midi').toFrequency(), at);
          this.triggered.push({ tick: ev.tick, string: n.string, midi: n.midi, atAudioTime: at });
        }
      }, `${ev.tick}i`);
    }
    if (opts.loop) {
      transport.loop = true;
      transport.loopStart = 0;
      transport.loopEnd = `${this.total}i`;
    } else {
      transport.loop = false;
      transport.schedule((time) => {
        // Fin du morceau. On NE PEUT PAS appeler transport.stop(time) ici : Tone relance alors une dernière fois les
        // événements du tick 0 (une note parasite sonne après la fin — constaté dans le navigateur). On arrête donc
        // immédiatement, à l'heure audio de la fin (aucun événement n'existe au-delà), via une minuterie qui ne dépend
        // pas de requestAnimationFrame (onglet masqué).
        const raw = Tone.getContext().rawContext as AudioContext;
        const delayMs = Math.max(0, (time - raw.currentTime) * 1000);
        setTimeout(() => {
          if (this.state !== 'playing') return;
          this.stop();
          this.onEnded?.();
        }, delayMs);
      }, `${this.total}i`);
    }
  }

  setTempo(bpm: number): void {
    if (this.tone) this.tone.getTransport().bpm.value = bpm;
  }

  async play(): Promise<void> {
    await this.init();
    if (this.state === 'playing') return;
    this.tone!.getTransport().start();
    this.state = 'playing';
  }

  pause(): void {
    if (!this.tone || this.state !== 'playing') return;
    this.tone.getTransport().pause();
    this.state = 'paused';
  }

  stop(): void {
    if (!this.tone) return;
    this.tone.getTransport().stop();
    this.state = 'stopped';
  }

  /**
   * Tick du Transport tel qu'il est ENTENDU maintenant : on retranche la latence de sortie du navigateur
   * (outputLatency + baseLatency) à l'horloge audio, puis on interroge le Transport à cet instant.
   */
  getTick(): number {
    if (!this.tone) return 0;
    const Tone = this.tone;
    const t = Tone.getTransport();
    if (this.state !== 'playing') return t.ticks;
    const raw = Tone.getContext().rawContext as AudioContext;
    const latency = (raw.outputLatency || 0) + (raw.baseLatency || 0);
    const ticks = t.getTicksAtTime(Math.max(0, raw.currentTime - latency));
    return Math.max(0, Math.min(this.total, ticks));
  }

  /** Latence de sortie estimée par le navigateur, en secondes (0 si inconnue). */
  get outputLatency(): number {
    if (!this.tone) return 0;
    const raw = this.tone.getContext().rawContext as AudioContext;
    return (raw.outputLatency || 0) + (raw.baseLatency || 0);
  }

  get totalTicks(): number {
    return this.total;
  }

  get ready(): boolean {
    return this.tone !== null && this.score !== null;
  }

  dispose(): void {
    this.stop();
    this.tone?.getTransport().cancel(0);
    this.synths.forEach((s) => s.dispose());
    this.out.forEach((o) => o.dispose());
    this.synths = [];
    this.out = [];
  }
}
