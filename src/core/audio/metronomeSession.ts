/**
 * Page Métronome (D112) : programme les temps de `MetronomeRun` sur Tone.Transport, un par un, pour que tempo,
 * automation et silences se règlent en direct. Même horloge et même bus que le métronome de lecture.
 */
import { AudioEngine } from './engine';
import { MetronomeRun, type MetroBeat, type MetronomeConfig } from './metronomeRun';

export type MetroState = 'stopped' | 'playing' | 'paused';

interface Queued {
  time: number;
  beat: MetroBeat;
}

/** Temps gardés pour l'affichage : largement plus que l'avance de programmation et la latence de sortie. */
const MAX_QUEUE = 64;

export class MetronomeSession {
  state: MetroState = 'stopped';
  private run: MetronomeRun | null = null;
  private queue: Queued[] = [];
  private eventId: number | null = null;
  /** Incrémenté à chaque arrêt : un démarrage encore en attente de `unlock` n'aboutit pas. */
  private generation = 0;

  constructor(private config: MetronomeConfig, private readonly engine: AudioEngine = AudioEngine.get()) {}

  setConfig(config: MetronomeConfig): void {
    this.config = config;
    this.run?.setConfig(config);
  }

  /** À appeler dans un geste de l'utilisateur. */
  async start(): Promise<void> {
    const generation = ++this.generation;
    await this.engine.unlock();
    if (generation !== this.generation) return;
    const transport = this.engine.tone!.getTransport();
    transport.stop();
    transport.cancel(0); // le Transport est partagé : rien ne doit rester d'une tablature
    transport.loop = false;
    this.queue = [];
    const run = new MetronomeRun(this.config);
    this.run = run;
    transport.bpm.value = this.config.ramp.on ? this.config.ramp.from : this.config.bpm;
    let last = -1;
    this.eventId = transport.scheduleRepeat((time) => {
      if (Math.abs(time - last) < 1e-6) return; // même garde-fou que TabPlayer : Tone double parfois un rappel
      last = time;
      const beat = run.next();
      transport.bpm.setValueAtTime(beat.bpm, time);
      if (beat.audible) this.engine.metronome?.click(time, beat.accent, this.config.sound);
      this.queue.push({ time, beat });
      if (this.queue.length > MAX_QUEUE) this.queue.shift();
    }, '4n', 0);
    transport.start();
    this.state = 'playing';
  }

  pause(): void {
    if (this.state !== 'playing' || !this.engine.tone) return;
    this.engine.tone.getTransport().pause();
    this.state = 'paused';
  }

  resume(): void {
    if (this.state !== 'paused' || !this.engine.tone) return;
    this.engine.tone.getTransport().start();
    this.state = 'playing';
  }

  stop(): void {
    this.generation++;
    this.state = 'stopped';
    this.run = null;
    this.queue = [];
    const transport = this.engine.tone?.getTransport();
    if (!transport) return;
    transport.stop();
    if (this.eventId !== null) transport.clear(this.eventId);
    this.eventId = null;
  }

  /** Dernier temps ENTENDU : la latence de sortie est retranchée, comme pour le curseur de tablature. */
  heard(): MetroBeat | null {
    if (!this.engine.tone) return null;
    const raw = this.engine.rawContext;
    const now = raw.currentTime - (raw.outputLatency || 0) - (raw.baseLatency || 0);
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i]!.time <= now) return this.queue[i]!.beat;
    }
    return null;
  }
}
