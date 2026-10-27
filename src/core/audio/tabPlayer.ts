/**
 * Lecteur d'un TabScore sur Tone.Transport (phase 1c : le son final remplace le son provisoire de la 1b).
 *
 * - Les événements sont ceux de `scoreToPlayEvents` (mêmes notes que l'écran) ; tick = tick du Transport (PPQ 480,
 *   identique au modèle) : conversion en UN seul endroit (`${tick}i`) ;
 * - le son vient de `AudioEngine` (guitare échantillonnée, bus, drone, métronome) ; ce module ne fait que PROGRAMMER ;
 * - métronome et drone se règlent EN COURS DE LECTURE (les clics sont programmés une fois, ils ne sonnent que si le
 *   métronome est actif au moment où ils tombent) ;
 * - le curseur lit `getTick()` : tick du Transport tel qu'il est ENTENDU (latence de sortie retranchée).
 */
import { PPQ, scoreToPlayEvents, totalTicks, type PlayOptions, type TabScore } from '../tab';
import { interpretChord } from '../theory';
import type { NoteName } from '../theory/types';
import { droneMidis, type DroneKind } from './drone';
import { AudioEngine } from './engine';
import { metronomeClicks } from './metronome';

export type PlayerState = 'stopped' | 'playing' | 'paused';

export interface PlayerOptions extends PlayOptions {
  loop?: boolean;
  /** Clics supplémentaires entre les temps. */
  subdivide?: boolean;
}

export interface TriggeredNote {
  tick: number;
  string: number;
  midi: number;
  velocity: number;
  atAudioTime: number;
  kind: 'sample' | 'synth' | null;
  file?: string;
}

/** Fondamentale du drone d'un score : tonique de la gamme, sinon fondamentale de l'accord ; rien pour une progression. */
export function scoreTonic(score: TabScore): NoteName | null {
  if (score.meta?.tonic) return score.meta.tonic;
  if (score.kind === 'progression') return null;
  const chord = score.meta?.chord;
  if (!chord) return null;
  try {
    return interpretChord(chord).root;
  } catch {
    return null;
  }
}

const MAX_LOG = 4000;

export class TabPlayer {
  private score: TabScore | null = null;
  private total = 0;
  state: PlayerState = 'stopped';
  /** Appelé (thread principal, synchronisé sur l'audio) quand la lecture se termine sans boucle. */
  onEnded: (() => void) | null = null;
  /** Notes déclenchées depuis le dernier `load` (vérification : tick du score, corde, hauteur, heure audio). */
  triggered: TriggeredNote[] = [];
  /** Réglages « en direct ». */
  private metronomeOn = false;
  private droneOn = false;
  droneKind: DroneKind = 'fifth';
  /** Nombre de clics de métronome joués depuis le dernier `load` (vérification). */
  clicksPlayed = 0;
  /** Rappels en double ignorés depuis le dernier `load` (diagnostic). */
  duplicateCallbacks = 0;

  constructor(private readonly engine: AudioEngine = AudioEngine.get()) {}

  /** Charge Tone et reprend le contexte audio. À appeler en premier dans un geste utilisateur. */
  async init(): Promise<void> {
    await this.engine.unlock();
  }

  private get Tone() {
    return this.engine.tone!;
  }

  /** Programme tout le score sur le Transport (remplace la programmation précédente). */
  async load(score: TabScore, opts: PlayerOptions = {}): Promise<void> {
    await this.engine.init();
    const Tone = this.Tone;
    const transport = Tone.getTransport();
    this.stop();
    transport.cancel(0);
    this.score = score;
    this.total = totalTicks(score);
    this.triggered = [];
    this.clicksPlayed = 0;
    this.duplicateCallbacks = 0;
    transport.bpm.value = score.tempo;
    const engine = this.engine;
    const humanize = opts.humanize ?? engine.settings.humanize;
    const spread = opts.strumSpreadMs ?? engine.settings.strumSpreadMs;

    for (const ev of scoreToPlayEvents(score, { ...opts, strumSpreadMs: spread, humanize })) {
      let lastTime = -1;
      transport.schedule((time) => {
        // Garde-fou : Tone rappelle parfois le MÊME événement avec la MÊME heure audio (constaté, ≈ 1 lecture sur 10
        // quand on relance juste après un arrêt, toujours sur un début de mesure) → la note serait frappée deux fois.
        // Une vraie répétition (boucle) arrive avec une heure différente.
        if (Math.abs(time - lastTime) < 1e-6) {
          this.duplicateCallbacks++;
          return;
        }
        lastTime = time;
        const secPerTick = 60 / (transport.bpm.value * PPQ);
        const releaseAt = time + ev.sustainTicks * secPerTick;
        for (const n of ev.notes) {
          const at = time + n.offsetMs / 1000;
          const info = engine.guitar?.play({ string: n.string, midi: n.midi, time: at, velocity: n.velocity, layerVelocity: n.layerVelocity, releaseAt: Math.max(releaseAt, at + 0.06) }) ?? null;
          if (this.triggered.length < MAX_LOG) {
            this.triggered.push({ tick: ev.tick, string: n.string, midi: n.midi, velocity: n.velocity, atAudioTime: at, kind: info?.kind ?? null, ...(info?.file ? { file: info.file } : {}) });
          }
        }
      }, `${ev.tick}i`);
    }

    for (const click of metronomeClicks(score, { subdivide: opts.subdivide })) {
      let lastClick = -1;
      transport.schedule((time) => {
        if (Math.abs(time - lastClick) < 1e-6) return; // même garde-fou que les notes
        lastClick = time;
        if (!this.metronomeOn) return;
        engine.metronome?.click(time, click.accent);
        this.clicksPlayed++;
      }, `${click.tick}i`);
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
        // à l'heure audio de la fin (aucun événement n'existe au-delà), via une minuterie qui ne dépend pas de
        // requestAnimationFrame (onglet masqué). Les cordes ne sont PAS coupées : elles ont leur propre relâchement.
        const raw = this.engine.rawContext;
        const delayMs = Math.max(0, (time - raw.currentTime) * 1000);
        setTimeout(() => {
          if (this.state !== 'playing') return;
          this.stop(false);
          this.onEnded?.();
        }, delayMs);
      }, `${this.total}i`);
    }
  }

  setTempo(bpm: number): void {
    if (this.engine.tone) this.engine.tone.getTransport().bpm.value = bpm;
  }

  setMetronome(on: boolean): void {
    this.metronomeOn = on;
  }

  setDrone(on: boolean): void {
    this.droneOn = on;
    if (this.state === 'playing') this.syncDrone();
  }

  private syncDrone(): void {
    const d = this.engine.drone;
    if (!d) return;
    const tonic = this.score ? scoreTonic(this.score) : null;
    if (this.droneOn && tonic && this.state === 'playing') {
      const want = droneMidis(tonic, this.droneKind);
      if (!d.active || want.join() !== d.midis.join()) d.start(want);
    } else if (d.active) d.stop();
  }

  async play(): Promise<void> {
    await this.init();
    if (this.state === 'playing') return;
    if (this.state === 'stopped') {
      // nouvelle lecture depuis le début : le journal de vérification repart de zéro
      this.triggered = [];
      this.clicksPlayed = 0;
    }
    this.Tone.getTransport().start();
    this.state = 'playing';
    this.syncDrone();
  }

  pause(): void {
    if (!this.engine.tone || this.state !== 'playing') return;
    this.engine.tone.getTransport().pause();
    this.state = 'paused';
    this.engine.guitar?.stopAll(undefined, 0.04);
    this.engine.drone?.stop(0.5);
  }

  /** `cut` : coupe les cordes qui sonnent encore (arrêt demandé) ; faux à la fin naturelle du morceau. */
  stop(cut = true): void {
    if (!this.engine.tone) return;
    this.engine.tone.getTransport().stop();
    this.state = 'stopped';
    if (cut) this.engine.guitar?.stopAll(undefined, 0.04);
    this.engine.drone?.stop(cut ? 0.5 : 1.2);
  }

  /**
   * Tick du Transport tel qu'il est ENTENDU maintenant : on retranche la latence de sortie du navigateur
   * (outputLatency + baseLatency) à l'horloge audio, puis on interroge le Transport à cet instant.
   */
  getTick(): number {
    if (!this.engine.tone) return 0;
    const t = this.engine.tone.getTransport();
    if (this.state !== 'playing') return t.ticks;
    const raw = this.engine.rawContext;
    const latency = (raw.outputLatency || 0) + (raw.baseLatency || 0);
    const ticks = t.getTicksAtTime(Math.max(0, raw.currentTime - latency));
    return Math.max(0, Math.min(this.total, ticks));
  }

  /** Latence de sortie estimée par le navigateur, en secondes (0 si inconnue). */
  get outputLatency(): number {
    if (!this.engine.tone) return 0;
    const raw = this.engine.rawContext;
    return (raw.outputLatency || 0) + (raw.baseLatency || 0);
  }

  get totalTicks(): number {
    return this.total;
  }

  get ready(): boolean {
    return this.engine.tone !== null && this.score !== null;
  }

  dispose(): void {
    this.stop();
    this.engine.tone?.getTransport().cancel(0);
  }
}
