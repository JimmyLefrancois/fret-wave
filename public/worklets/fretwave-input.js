/**
 * Processeur AudioWorklet d'entrée (phase 3). **JavaScript pur, sans import** : un module
 * AudioWorklet est chargé par `addModule()` et n'est pas passé par le bundler, donc `pitchy` (paquet
 * ESM) ne peut pas y être importé sans une étape de build séparée dont le résultat peut se périmer
 * en développement (même piège que le CSS servi par un vieux serveur Vite, constaté deux fois).
 *
 * Répartition choisie (PROJECT.md §4.8, D36) :
 *   - ce processeur, au rythme des blocs (128 échantillons ≈ 2,7 ms) : anneau glissant, niveau,
 *     détection d'attaque. Coût négligeable, aucun à-coup possible dans le fil audio ;
 *   - le fil principal, à chaque `hop` (1024 échantillons ≈ 21 ms) : `pitchy` sur la fenêtre
 *     (2048 à 4096 échantillons selon l'accordage). Mesuré à ~1,3 ms par fenêtre.
 *
 * Messages envoyés : { buf, rms, peak, t, onset, onsetT }
 *   buf      fenêtre ordonnée du plus ancien au plus récent (transfert, pas de copie)
 *   rms      RMS du bloc courant (amplitude 0-1)
 *   peak     crête tenue depuis le dernier envoi
 *   t        currentTime (s) à l'envoi
 *   onset    une attaque a été détectée dans ce bloc
 *   onsetT   currentTime (s) du bloc où l'attaque a eu lieu (−1 si aucune)
 */
const DEFAULTS = { windowSize: 2048, hop: 1024, floor: 0.005, riseFactor: 2.2, refractoryMs: 90 };

class FretwaveInputProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.windowSize = Math.max(512, (o.windowSize | 0) || DEFAULTS.windowSize);
    this.hop = Math.max(128, (o.hop | 0) || DEFAULTS.hop);
    this.floor = typeof o.floor === 'number' ? o.floor : DEFAULTS.floor;
    this.riseFactor = typeof o.riseFactor === 'number' ? o.riseFactor : DEFAULTS.riseFactor;
    this.refractoryMs = typeof o.refractoryMs === 'number' ? o.refractoryMs : DEFAULTS.refractoryMs;
    this.ring = new Float32Array(this.windowSize);
    this.write = 0;
    this.sinceHop = 0;
    this.env = 0;
    this.lastOnsetMs = -1e9;
    this.onsetPending = false;
    this.peakHold = 0;
  }

  /** Règle d'attaque — identique à `onsetStep` de `src/core/input/onset.ts` (vérifiée par test). */
  process(inputs) {
    const input = inputs && inputs[0];
    const channel = input && input[0];
    if (!channel) return true;

    let peak = 0;
    let sum = 0;
    const n = channel.length;
    for (let i = 0; i < n; i++) {
      const v = channel[i];
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
      sum += v * v;
      this.ring[this.write] = v;
      this.write = this.write + 1 === this.windowSize ? 0 : this.write + 1;
    }

    const rms = Math.sqrt(sum / n);
    const tMs = currentTime * 1000;
    const onset =
      rms >= this.floor
      && rms > this.riseFactor * this.env
      && tMs - this.lastOnsetMs >= this.refractoryMs;
    if (onset) {
      this.lastOnsetMs = tMs;
      // l'attaque est mémorisée jusqu'au prochain envoi : un bloc intermédiaire ne la perd pas
      this.onsetPending = true;
    }
    this.env = rms > this.env ? 0.6 * this.env + 0.4 * rms : 0.9 * this.env + 0.1 * rms;
    if (peak > this.peakHold) this.peakHold = peak;

    this.sinceHop += n;
    if (this.sinceHop >= this.hop) {
      this.sinceHop = 0;
      // fenêtre ordonnée : le plus ancien échantillon est celui qui va être écrasé
      const out = new Float32Array(this.windowSize);
      const w = this.write;
      out.set(this.ring.subarray(w, this.windowSize), 0);
      out.set(this.ring.subarray(0, w), this.windowSize - w);
      this.port.postMessage(
        { buf: out, rms, peak: this.peakHold, t: currentTime, onset: this.onsetPending, onsetT: this.lastOnsetMs / 1000 },
        [out.buffer],
      );
      this.peakHold = 0;
      this.onsetPending = false;
    }
    return true;
  }
}

registerProcessor('fretwave-input', FretwaveInputProcessor);
