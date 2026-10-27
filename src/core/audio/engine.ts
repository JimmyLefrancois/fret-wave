/**
 * Moteur audio de sortie (phase 1c) : contexte Tone, bus master, guitare échantillonnée, drone, métronome, réglages.
 *
 * Cycle de vie :
 *   1. `preload()` (au lancement, sans geste) : charge Tone (chunk séparé), construit la chaîne, télécharge et décode
 *      les échantillons de l'instrument mémorisé — avec progression pour l'écran de chargement. Le contexte reste
 *      « suspended » : décoder n'exige pas de geste.
 *   2. `unlock()` (DANS le gestionnaire d'un clic / toucher) : `Tone.start()` reprend le contexte. À appeler en premier
 *      dans le gestionnaire, avant tout `await` d'autre chose (iOS, Safari).
 *   3. Lecture : `TabPlayer` programme les notes sur Tone.Transport ; ce module ne programme rien lui-même.
 *
 * Tone n'est jamais importé statiquement : la page de contrôle ne paie son poids qu'au premier chargement du son.
 */
import { Drone } from './drone';
import { GuitarSampler, type NoteRequest, type PlayedInfo } from './guitar';
import { buildMasterChain, type MasterChain } from './master';
import { Metronome } from './metronome';
import {
  CHANNELS, loadSettings, saveSettings, type AudioSettings, type Channel, type KeyValueStore,
} from './mixer';
import { SampleSet, fetchManifest, loadSampleBuffers, type LoadProgress, type SampleManifest } from './sampleBank';
import { PPQ } from '../tab/model';

type ToneModule = typeof import('tone');

export const INSTRUMENT_IDS = ['nylon', 'electric'] as const;
export type InstrumentId = (typeof INSTRUMENT_IDS)[number];

export type EngineState = 'idle' | 'loading' | 'ready' | 'error';

export interface LevelReading {
  /** Crête de la dernière fenêtre (dBFS), −Infinity si silence. */
  peakDb: number;
  rmsDb: number;
  /** Réduction de gain du compresseur et du limiteur (dB, ≤ 0). */
  compressorDb: number;
  limiterDb: number;
}

const storage = (): KeyValueStore | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // accès refusé (navigation privée stricte)
  }
};

export class AudioEngine {
  private static inst: AudioEngine | null = null;
  static get(): AudioEngine {
    return (AudioEngine.inst ??= new AudioEngine());
  }

  tone: ToneModule | null = null;
  chain: MasterChain | null = null;
  guitar: GuitarSampler | null = null;
  drone: Drone | null = null;
  metronome: Metronome | null = null;
  settings: AudioSettings = loadSettings(storage(), [...INSTRUMENT_IDS]);
  state: EngineState = 'idle';
  error: string | null = null;
  progress: LoadProgress | null = null;
  readonly manifests = new Map<string, SampleManifest>();
  private readonly loaded = new Map<string, { set: SampleSet; buffers: Map<string, AudioBuffer> }>();
  private initPromise: Promise<void> | null = null;
  private readonly loading = new Map<string, Promise<void>>();
  private readonly listeners = new Set<() => void>();
  private readonly meterBuf = new Float32Array(2048);
  /** Instrument actuellement branché sur la guitare. */
  activeInstrument: string | null = null;

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  /** Compteur incrémenté à chaque changement observable (instantané pour useSyncExternalStore). */
  version = 0;
  private emit(): void {
    this.version++;
    for (const l of this.listeners) l();
  }

  /** Charge Tone et construit la chaîne (idempotent, pas de geste requis). */
  init(): Promise<void> {
    return (this.initPromise ??= (async () => {
      const Tone = await import('tone');
      Tone.getTransport().PPQ = PPQ;
      this.tone = Tone;
      const ctx = this.rawContext;
      this.chain = buildMasterChain(Tone, this.settings.volumes, this.settings.reverb);
      this.guitar = new GuitarSampler(ctx, this.nativeInput('guitar'));
      this.drone = new Drone(ctx, this.nativeInput('drone'));
      this.metronome = new Metronome(ctx, this.nativeInput('metronome'));
    })().catch((e) => {
      this.initPromise = null;
      throw e;
    }));
  }

  get rawContext(): AudioContext {
    return this.tone!.getContext().rawContext as unknown as AudioContext;
  }

  /** Les bus Tone exposent un nœud d'entrée natif : les sources Web Audio s'y branchent directement. */
  private nativeInput(bus: 'guitar' | 'drone' | 'metronome'): AudioNode {
    return this.chain!.buses[bus].input as unknown as AudioNode;
  }

  /** À appeler dans un geste de l'utilisateur : reprend le contexte audio. */
  async unlock(): Promise<void> {
    await this.init();
    await this.tone!.start();
    this.emit();
  }

  get contextState(): string {
    return this.tone ? this.rawContext.state : 'non créé';
  }

  private preloadPromise: Promise<void> | null = null;

  /**
   * Initialise puis charge l'instrument mémorisé. Progression pour l'écran de chargement. Idempotent (React en mode
   * strict lance les effets deux fois) ; `retry()` relance après une erreur.
   */
  preload(onProgress?: (p: LoadProgress) => void): Promise<void> {
    return (this.preloadPromise ??= (async () => {
      this.state = 'loading';
      this.error = null;
      this.emit();
      try {
        await this.init();
        await this.loadInstrument(this.settings.instrument, onProgress);
        this.state = 'ready';
      } catch (e) {
        this.state = 'error';
        // fetch() lève un TypeError opaque (« Failed to fetch ») quand le réseau est coupé
        this.error = e instanceof TypeError ? 'RÉSEAU INDISPONIBLE' : (e as Error).message;
      }
      this.emit();
    })());
  }

  retry(onProgress?: (p: LoadProgress) => void): Promise<void> {
    this.preloadPromise = null;
    this.initPromise = this.tone ? this.initPromise : null; // un échec d'import de Tone se retente
    return this.preload(onProgress);
  }

  loadInstrument(id: string, onProgress?: (p: LoadProgress) => void): Promise<void> {
    const pending = this.loading.get(id);
    if (pending) return pending;
    const p = (async () => {
      await this.init();
      if (!this.loaded.has(id)) {
        const manifest = this.manifests.get(id) ?? (await fetchManifest(id));
        this.manifests.set(id, manifest);
        const set = new SampleSet(manifest);
        const buffers = await loadSampleBuffers(this.rawContext, set, (pr) => {
          this.progress = pr;
          onProgress?.(pr);
          this.emit();
        });
        this.loaded.set(id, { set, buffers });
      }
      if (id === this.settings.instrument || this.activeInstrument === null) this.useInstrument(id);
    })();
    this.loading.set(id, p);
    p.catch(() => this.loading.delete(id));
    return p;
  }

  isLoaded(id: string): boolean {
    return this.loaded.has(id);
  }

  private useInstrument(id: string): void {
    const l = this.loaded.get(id);
    if (!l || !this.guitar) return;
    this.guitar.setBank(l.set, l.buffers);
    this.activeInstrument = id;
    this.emit();
  }

  /** Change d'instrument (charge ses échantillons si besoin) et mémorise le choix. */
  async setInstrument(id: string, onProgress?: (p: LoadProgress) => void): Promise<void> {
    await this.loadInstrument(id, onProgress);
    this.settings = { ...this.settings, instrument: id };
    this.useInstrument(id);
    this.persist();
  }

  get bank(): SampleSet | null {
    return this.guitar?.bank ?? null;
  }

  // --- réglages --------------------------------------------------------------------------------------------------
  update(partial: Partial<Omit<AudioSettings, 'volumes'>>): void {
    this.settings = { ...this.settings, ...partial };
    if (partial.reverb !== undefined) this.chain?.setReverb(partial.reverb);
    this.persist();
    this.emit();
  }

  setVolume(ch: Channel, v: number): void {
    this.settings = { ...this.settings, volumes: { ...this.settings.volumes, [ch]: v } };
    this.chain?.setVolume(ch, v);
    this.persist();
    this.emit();
  }

  resetVolumes(volumes: AudioSettings['volumes']): void {
    for (const c of CHANNELS) this.setVolume(c, volumes[c]);
  }

  private persist(): void {
    saveSettings(storage(), this.settings);
  }

  // --- jeu immédiat (page de debug, tests d'écoute) --------------------------------------------------------------
  /** Une note tout de suite (≈ 30 ms de marge) ; `holdS` = durée avant relâchement, `null` = laissée sonner. */
  playNow(string: number, midi: number, velocity = 0.8, holdS: number | null = null): PlayedInfo | null {
    if (!this.guitar) return null;
    const t = this.rawContext.currentTime + 0.03;
    const req: NoteRequest = { string, midi, time: t, velocity, releaseAt: holdS === null ? null : t + holdS };
    return this.guitar.play(req);
  }

  // --- mesure ----------------------------------------------------------------------------------------------------
  readLevel(): LevelReading {
    const c = this.chain;
    if (!c) return { peakDb: -Infinity, rmsDb: -Infinity, compressorDb: 0, limiterDb: 0 };
    c.analyser.getFloatTimeDomainData(this.meterBuf);
    let peak = 0, sum = 0;
    for (const v of this.meterBuf) {
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sum += v * v;
    }
    const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
    return {
      peakDb: db(peak),
      rmsDb: db(Math.sqrt(sum / this.meterBuf.length)),
      compressorDb: c.compressor.reduction,
      limiterDb: c.limiter.reduction,
    };
  }

  /** Informations sur le contexte audio (page de debug). */
  contextInfo(): Array<[string, string]> {
    if (!this.tone) return [['état', 'Tone pas encore chargé']];
    const T = this.tone;
    const raw = this.rawContext;
    const ctx = T.getContext();
    return [
      ['état du contexte', raw.state],
      ['fréquence d’échantillonnage', `${raw.sampleRate} Hz`],
      ['latencyHint', String(ctx.latencyHint)],
      ['baseLatency', `${((raw.baseLatency || 0) * 1000).toFixed(1)} ms`],
      ['outputLatency', `${((raw.outputLatency || 0) * 1000).toFixed(1)} ms`],
      ['lookAhead (Tone)', `${(ctx.lookAhead * 1000).toFixed(0)} ms`],
      ['PPQ du Transport', String(T.getTransport().PPQ)],
      ['Tone', T.version],
    ];
  }
}
