/**
 * Bus master (phase 1c) : sommation → passe-haut 30 Hz → compresseur → limiteur (plafond −1 dBFS) → volume général.
 *
 *   guitare ──┬──────────────────────────────┐
 *             └→ envoi réverb → convolution ─┤
 *   drone ───────────────────────────────────┼→ [mix] → HP 30 Hz → compresseur → limiteur → plafond → [général] → sortie
 *   métronome ───────────────────────────────┘
 *
 * Le limiteur de Tone (compresseur 20:1) laisse passer les crêtes plus rapides que son attaque (mesuré : +2,2 dBFS
 * sur un strum fort réglé à fond) : il est donc suivi d'un PLAFOND DUR — une courbe de saturation douce (identité
 * jusqu'à −3 dBFS, asymptote à −1 dBFS) qui garantit mathématiquement |sortie| ≤ −1 dBFS. Le volume général est APRÈS
 * le plafond : le curseur ne dépasse jamais 0 dB, le plafond tient donc à n'importe quel réglage.
 * La réponse impulsionnelle de la réverbération est calculée une seule fois (≈ 1,3 s, 2 canaux),
 * de façon déterministe, avant toute lecture.
 */
import { seeded } from '../tab/playback';
import { sliderToGain, type Channel, type Volumes } from './mixer';

type ToneModule = typeof import('tone');

/** Compensations de niveau entre sources (dB), réglées par mesure (MUSIC_DESIGN.md §11.4). */
export const TRIM_DB: Record<Channel, number> = { master: 0, guitar: -2, backing: -3, drone: 0, metronome: 12 };

/** Plafond dur : début de la saturation (linéaire, −3,1 dBFS) et plafond (linéaire, −1 dBFS). */
export const CEILING = { knee: 0.7, ceiling: 10 ** (-1 / 20) } as const;

/**
 * Courbe du plafond sur [−1, 1] : identité sous `knee`, puis `knee + (plafond − knee)·tanh((|x| − knee)/(plafond − knee))`.
 * Dérivée continue en `knee`, strictement croissante, bornée par `plafond` ; impaire.
 */
export function ceilingCurve(n = 4096, knee: number = CEILING.knee, ceiling: number = CEILING.ceiling): Float32Array {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + (ceiling - knee) * Math.tanh((a - knee) / (ceiling - knee));
    c[i] = Math.sign(x) * y;
  }
  return c;
}

export const COMPRESSOR = { threshold: -18, ratio: 3, attack: 0.012, release: 0.22, knee: 10 } as const;
export const LIMITER_DB = -1;
export const HIGHPASS_HZ = 30;
/** Gain d'envoi réverb à « réverb = 1 ». */
export const REVERB_SEND_MAX = 0.35;

/** Réponse impulsionnelle stéréo d'une petite pièce : bruit à enveloppe exponentielle, aigus qui s'éteignent plus vite. */
export function makeReverbIR(sampleRate: number, seconds = 1.3, seed = 42): [Float32Array, Float32Array] {
  const n = Math.round(seconds * sampleRate);
  const pre = Math.round(0.012 * sampleRate);
  const chans: Float32Array[] = [];
  for (let c = 0; c < 2; c++) {
    const rnd = seeded(seed + c * 1013);
    const out = new Float32Array(n);
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sampleRate;
      const env = Math.exp((-6.9 * t) / (seconds * 0.8)); // −60 dB à 0,8 × la durée
      const a = Math.min(0.95, 0.15 + t * 0.9); // lissage croissant : les aigus meurent d'abord
      lp = a * lp + (1 - a) * (rnd() * 2 - 1);
      out[i] = lp * env;
    }
    chans.push(out);
  }
  // normalisation en énergie : même niveau de réverbération quelle que soit la fréquence d'échantillonnage
  let e = 0;
  for (const ch of chans) for (const v of ch) e += v * v;
  const k = 1 / Math.sqrt(e / 2);
  for (const ch of chans) for (let i = 0; i < ch.length; i++) ch[i] = ch[i]! * k;
  return [chans[0]!, chans[1]!];
}

export interface MasterChain {
  buses: Record<Exclude<Channel, 'master'>, import('tone').Gain>;
  master: import('tone').Gain;
  compressor: import('tone').Compressor;
  limiter: import('tone').Limiter;
  ceiling: import('tone').WaveShaper;
  reverbSend: import('tone').Gain;
  analyser: AnalyserNode;
  setVolume(ch: Channel, v: number): void;
  setReverb(v: number): void;
  dispose(): void;
}

const trimGain = (c: Channel) => 10 ** (TRIM_DB[c] / 20);

/** Construit la chaîne dans le contexte courant de Tone (ou dans le contexte hors ligne d'un rendu de test). */
export function buildMasterChain(Tone: ToneModule, volumes: Volumes, reverb: number): MasterChain {
  const ctx = Tone.getContext().rawContext as unknown as AudioContext;
  const mix = new Tone.Gain(1);
  const hp = new Tone.Filter(HIGHPASS_HZ, 'highpass', -12);
  const compressor = new Tone.Compressor(COMPRESSOR);
  const limiter = new Tone.Limiter(LIMITER_DB);
  const ceiling = new Tone.WaveShaper(ceilingCurve());
  ceiling.oversample = '2x'; // la saturation ne replie pas d'harmoniques audibles
  const master = new Tone.Gain(sliderToGain(volumes.master));
  mix.chain(hp, compressor, limiter, ceiling, master);
  master.toDestination();

  const [l, r] = makeReverbIR(ctx.sampleRate);
  const irBuf = ctx.createBuffer(2, l.length, ctx.sampleRate);
  irBuf.getChannelData(0).set(l);
  irBuf.getChannelData(1).set(r);
  const convolver = new Tone.Convolver(irBuf as unknown as AudioBuffer);
  const reverbSend = new Tone.Gain(Math.max(0, Math.min(1, reverb)) * REVERB_SEND_MAX);
  reverbSend.chain(convolver, mix);

  const buses = {
    guitar: new Tone.Gain(trimGain('guitar') * sliderToGain(volumes.guitar)),
    // l'accompagnement (basse, pads, batterie) est **derrière** la guitare : c'est un support, pas un
    // partenaire de volume. Il ne part pas dans la réverbère : un backing réverbéré noie la guitare.
    backing: new Tone.Gain(trimGain('backing') * sliderToGain(volumes.backing)),
    drone: new Tone.Gain(trimGain('drone') * sliderToGain(volumes.drone)),
    metronome: new Tone.Gain(trimGain('metronome') * sliderToGain(volumes.metronome)),
  };
  buses.guitar.connect(mix);
  buses.guitar.connect(reverbSend);
  buses.backing.connect(mix);
  buses.drone.connect(mix);
  buses.metronome.connect(mix);

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0;
  (master.output as unknown as AudioNode).connect(analyser);

  return {
    buses,
    master,
    compressor,
    limiter,
    ceiling,
    reverbSend,
    analyser,
    setVolume(ch, v) {
      const g = ch === 'master' ? master : buses[ch];
      g.gain.rampTo(sliderToGain(v) * trimGain(ch), 0.03); // jamais de saut de gain : pas de craquement au curseur
    },
    setReverb(v) {
      reverbSend.gain.rampTo(Math.max(0, Math.min(1, v)) * REVERB_SEND_MAX, 0.05);
    },
    dispose() {
      for (const n of [mix, hp, compressor, limiter, ceiling, master, convolver, reverbSend, ...Object.values(buses)]) n.dispose();
      analyser.disconnect();
    },
  };
}
