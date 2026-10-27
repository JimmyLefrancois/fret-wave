/**
 * Entrée audio (phase 3) : micro ou interface USB → AudioWorklet → `pitchy` → note stabilisée.
 *
 * Ce module ne décide de rien musicalement : il **mesure** (`PitchReading`) et publie des images
 * (`InputFrame`). Le verdict (case remplie, mauvaise note, octave douteuse) appartient à `match.ts`
 * et l'écran décide de ce qu'il compte comme erreur.
 *
 * Choix et leurs raisons :
 *  - une seule source `getUserMedia` à la fois, arrêtée explicitement (`track.stop()`) : sur Android
 *    un flux oublié garde le micro occupé et l'indicateur allumé ;
 *  - `echoCancellation`, `noiseSuppression`, `autoGainControl` **désactivés** (une guitare attaquée
 *    franchement serait écrasée par la réduction de bruit ; l'AGC rendrait les niveaux inutilisables
 *    pour la calibration). Après ouverture, `track.getSettings()` dit la vérité : certains
 *    navigateurs mobiles ignorent les contraintes → `warning` explicite (R3) ;
 *  - le nœud worklet est relié à la sortie **par un gain à zéro** : il doit être dans le graphe pour
 *    être exécuté, mais le micro ne doit jamais s'entendre (larsen).
 */
import { NoteStabilizer, PitchTracker, type StableNote } from './pitch';
import type { InputSettings } from './settings';
import { rmsToDb } from './onset';

export const WORKLET_URL = '/worklets/fretwave-input.js';
export const WORKLET_NAME = 'fretwave-input';
/** Taille de saut : 1024 échantillons ≈ 21 ms à 48 kHz (47 fenêtres/s). */
export const HOP = 1024;

export type InputState = 'idle' | 'requesting' | 'listening' | 'denied' | 'unavailable' | 'insecure' | 'busy' | 'failed';

export interface InputFrame {
  /** Horloge du contexte audio (s) au moment de l'envoi du bloc. */
  t: number;
  /** `performance.now()` du centre de la fenêtre analysée (ms) : c'est l'instant « de la note ». */
  at: number;
  hz: number;
  midi: number;
  midiFloat: number;
  cents: number;
  clarity: number;
  rmsDb: number;
  /** Une attaque a été détectée dans ce bloc. */
  onset: boolean;
  /** Horloge du contexte de l'attaque (s), `null` si aucune. */
  onsetT: number | null;
  stable: StableNote | null;
  isNew: boolean;
}

interface WorkletMessage {
  buf: Float32Array;
  rms: number;
  peak: number;
  t: number;
  onset: boolean;
  onsetT: number;
}

export interface InputErrorText {
  state: InputState;
  message: string;
  hint: string;
}

/** Traduit un état d'erreur en message utile (jamais « une erreur est survenue »). */
export function describeInputError(state: InputState, detail: string | null): InputErrorText {
  switch (state) {
    case 'denied':
      return {
        state,
        message: 'accès au micro refusé',
        hint: 'autorise le micro pour ce site (cadenas de la barre d’adresse, ou Réglages du navigateur), puis réessaie.',
      };
    case 'insecure':
      return {
        state,
        message: 'micro indisponible : contexte non sécurisé',
        hint: 'le navigateur exige HTTPS ou localhost pour ouvrir un micro. Ouvre l’app en https:// ou sur http://localhost.',
      };
    case 'unavailable':
      return {
        state,
        message: 'aucun périphérique d’entrée',
        hint: 'branche un micro ou une interface USB, puis réessaie. Le mode sans matériel (pavé numérique) reste disponible.',
      };
    case 'busy':
      return {
        state,
        message: 'périphérique occupé',
        hint: 'une autre application utilise le micro (visioconférence, messagerie). Ferme-la, puis réessaie.',
      };
    case 'failed':
      return { state, message: `entrée audio indisponible${detail ? ` : ${detail}` : ''}`, hint: 'réessaie ; le pavé numérique reste un secours complet.' };
    default:
      return { state, message: 'micro arrêté', hint: 'active l’écoute pour jouer sur la vraie guitare.' };
  }
}

export class InputEngine {
  state: InputState = 'idle';
  error: string | null = null;
  /** Contraintes ignorées par le navigateur (AGC, réduction de bruit) : à dire à l'utilisateur. */
  warning: string | null = null;
  last: InputFrame | null = null;
  /** Échantillons de niveau pour la calibration (t en ms `performance.now`). */
  readonly levels: { t: number; db: number; peak: number }[] = [];
  version = 0;

  private readonly ctx: AudioContext;
  private node: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private sink: GainNode | null = null;
  private stream: MediaStream | null = null;
  private tracker: PitchTracker | null = null;
  private readonly stabilizer = new NoteStabilizer();
  private readonly listeners = new Set<() => void>();
  private moduleLoaded = false;
  private token = 0;
  private windowSize = 2048;
  private anchorCtx = 0;
  private anchorPerf = 0;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.version++;
    for (const l of this.listeners) l();
  }

  get sampleRate(): number {
    return this.ctx.sampleRate;
  }

  /** Horloge du contexte audio (s) : instant de programmation des clics de latence. */
  get now(): number {
    return this.ctx.currentTime;
  }

  /** Demi-fenêtre en ms : une note jouée à T est « vue » au centre de la fenêtre, T + cette valeur. */
  get halfWindowMs(): number {
    return (this.windowSize / this.sampleRate) * 500;
  }

  /** Convertit un instant du contexte audio en `performance.now()` (même horloge pour tout l'écran). */
  ctxToPerf(t: number): number {
    return this.anchorPerf + (t - this.anchorCtx) * 1000;
  }

  /** Réglages à chaud (seuil, clarté, La) : pas besoin de rouvrir le micro. */
  setGates(opts: { thresholdDb?: number; clarityMin?: number; a4?: number }): void {
    this.tracker?.setGates({
      ...(opts.thresholdDb !== undefined ? { minVolumeDb: opts.thresholdDb } : {}),
      ...(opts.clarityMin !== undefined
        ? { clarityThreshold: Math.min(0.98, Math.max(0.5, opts.clarityMin - 0.02)), minClarity: opts.clarityMin }
        : {}),
      ...(opts.a4 !== undefined ? { a4: opts.a4 } : {}),
    });
  }

  /** Périphériques d'entrée (les libellés n'apparaissent qu'après autorisation, limitation du navigateur). */
  async devices(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === 'audioinput');
  }

  /** Ouvre l'entrée et démarre l'analyse. Idempotent : un appel pendant l'écoute la relance proprement. */
  async start(settings: InputSettings, opts: { windowSize: number }): Promise<void> {
    // `stop()` incrémente le jeton : le nôtre doit être pris APRÈS, sinon la garde `token !== this.token`
    // annule silencieusement l'ouverture (défaut trouvé à la vérification navigateur).
    this.stop();
    const token = ++this.token;
    this.state = 'requesting';
    this.error = null;
    this.warning = null;
    this.emit();

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      this.state = 'insecure';
      this.emit();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      this.state = 'insecure';
      this.emit();
      return;
    }

    const audio: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
      ...(settings.deviceId ? { deviceId: { exact: settings.deviceId } } : {}),
    };

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
    } catch (e) {
      const name = (e as DOMException).name;
      this.state =
        name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
          : name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError' ? 'unavailable'
            : name === 'NotReadableError' || name === 'AbortError' ? 'busy'
              : 'failed';
      this.error = name === 'OverconstrainedError' ? 'périphérique mémorisé absent' : (e as Error).message;
      this.emit();
      return;
    }
    if (token !== this.token) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    // Les contraintes ne sont pas toujours respectées (surtout sur mobile) : on le dit.
    const track = stream.getAudioTracks()[0];
    const s = track?.getSettings() as (MediaTrackSettings & { autoGainControl?: boolean; echoCancellation?: boolean; noiseSuppression?: boolean }) | undefined;
    if (s && (s.autoGainControl === true || s.echoCancellation === true || s.noiseSuppression === true)) {
      this.warning = 'le navigateur a gardé la réduction de bruit ou le gain automatique : les niveaux seront moins fiables (utilise une interface USB si tu en as une).';
    }

    try {
      if (!this.moduleLoaded) {
        await this.ctx.audioWorklet.addModule(WORKLET_URL);
        this.moduleLoaded = true;
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      this.state = 'failed';
      this.error = (e as Error).message;
      this.emit();
      return;
    }
    if (token !== this.token) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    this.windowSize = opts.windowSize;
    this.anchorCtx = this.ctx.currentTime;
    this.anchorPerf = performance.now();

    this.tracker = new PitchTracker({
      windowSize: this.windowSize,
      sampleRate: this.ctx.sampleRate,
      a4: settings.a4,
      minVolumeDb: settings.thresholds[settings.source],
      clarityThreshold: Math.min(0.98, Math.max(0.5, settings.clarityMin - 0.02)),
      minClarity: settings.clarityMin,
    });
    this.stabilizer.reset();

    this.stream = stream;
    this.source = this.ctx.createMediaStreamSource(stream);
    this.node = new AudioWorkletNode(this.ctx, WORKLET_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: 'explicit',
      processorOptions: {
        windowSize: this.windowSize,
        hop: HOP,
        floor: Math.pow(10, settings.thresholds[settings.source] / 20),
      },
    });
    this.sink = this.ctx.createGain();
    this.sink.gain.value = 0; // dans le graphe pour être exécuté, muet pour ne pas larsener
    this.node.port.onmessage = (ev: MessageEvent<WorkletMessage>) => this.onBlock(ev.data, token);
    this.source.connect(this.node);
    this.node.connect(this.sink);
    this.sink.connect(this.ctx.destination);

    this.state = 'listening';
    this.emit();
  }

  private onBlock(msg: WorkletMessage, token: number): void {
    if (token !== this.token || !this.tracker) return;
    const rmsDb = rmsToDb(msg.rms);
    this.levels.push({ t: this.ctxToPerf(msg.t), db: rmsDb, peak: msg.peak });
    if (this.levels.length > 600) this.levels.splice(0, this.levels.length - 600); // 12 s environ

    const reading = this.tracker.detect(msg.buf);
    const step = this.stabilizer.push(reading);
    const stable = step.note;
    const frame: InputFrame = {
      t: msg.t,
      at: this.ctxToPerf(msg.t) - this.halfWindowMs,
      hz: reading?.hz ?? 0,
      midi: reading?.midi ?? -1,
      midiFloat: reading?.midiFloat ?? 0,
      cents: reading?.cents ?? 0,
      clarity: reading?.clarity ?? 0,
      rmsDb,
      onset: msg.onset,
      onsetT: msg.onset ? msg.onsetT : null,
      stable,
      isNew: step.isNew,
    };
    this.last = frame;
    this.emit();
  }

  /** Niveaux relevés depuis `ms` millisecondes (calibration du bruit de fond). */
  recentLevels(ms: number): { t: number; db: number; peak: number }[] {
    const from = performance.now() - ms;
    return this.levels.filter((l) => l.t >= from);
  }

  stop(): void {
    this.token++;
    try {
      this.node?.port.close();
      this.node?.disconnect();
      this.source?.disconnect();
      this.sink?.disconnect();
    } catch {
      /* déjà déconnecté */
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.node = null;
    this.source = null;
    this.sink = null;
    this.stream = null;
    this.tracker = null;
    this.stabilizer.reset();
    this.last = null;
    if (this.state !== 'idle') {
      this.state = 'idle';
      this.emit();
    }
  }

  /**
   * Clic de mesure de latence : une sinusoïde de 30 ms à 1 kHz, programmée **exactement** à `atS`
   * sur l'horloge du contexte. C'est un signal de mesure, pas un son de musique : il est joué
   * directement sur la sortie, hors du bus master (son niveau ne dépend pas des réglages de mixage).
   */
  clickAt(atS: number, freq = 1000, gain = 0.25): void {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, atS);
    g.gain.linearRampToValueAtTime(gain, atS + 0.002);
    g.gain.setValueAtTime(gain, atS + 0.028);
    g.gain.linearRampToValueAtTime(0, atS + 0.032);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(atS);
    osc.stop(atS + 0.04);
  }
}
