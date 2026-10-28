/**
 * Tampon circulaire d'échantillons (phase 5) : garder les **dernières secondes** de ce que le micro a
 * entendu, pour pouvoir analyser un accord plaqué après coup.
 *
 * Le processeur audio envoie déjà une fenêtre glissante toutes les 21 ms (`hop` = 1 024 échantillons) :
 * les fenêtres se recouvrent, on ne peut donc pas les mettre bout à bout. Seule la **queue** de chaque
 * message (`hop` échantillons) est du son neuf — c'est elle qu'on empile ici.
 *
 * Rien n'est analysé en continu : le tampon ne coûte qu'une écriture par bloc, et l'analyse (FFT 16 384)
 * ne tourne qu'au moment où l'élève demande à être écouté.
 */

export class AudioRing {
  private readonly data: Float32Array;
  private write = 0;
  private filled = 0;
  readonly sampleRate: number;
  readonly capacity: number;
  /** Durée minimale d'une fenêtre analysable (ms). 150 ms par défaut : en dessous, il n'y a pas assez
   *  de périodes pour une FFT 16 384, et mieux vaut refuser que rendre un spectre faux. */
  readonly minMs: number;

  constructor(sampleRate: number, seconds = 1.5, minMs = 150) {
    this.sampleRate = sampleRate;
    this.capacity = Math.max(1024, Math.round(sampleRate * seconds));
    this.minMs = minMs;
    this.data = new Float32Array(this.capacity);
  }

  /** Empile un bloc (le plus ancien d'abord). Un bloc plus long que le tampon garde sa fin. */
  push(chunk: Float32Array): void {
    if (chunk.length === 0) return;
    const src = chunk.length > this.capacity ? chunk.subarray(chunk.length - this.capacity) : chunk;
    for (let i = 0; i < src.length; i += 1) {
      this.data[this.write] = src[i]!;
      this.write = (this.write + 1) % this.capacity;
      if (this.filled < this.capacity) this.filled += 1;
    }
  }

  /** Échantillons disponibles, du plus ancien au plus récent. */
  get length(): number {
    return this.filled;
  }

  reset(): void {
    this.data.fill(0);
    this.write = 0;
    this.filled = 0;
  }

  /**
   * Les `ms` dernières millisecondes, dans l'ordre. `null` si le tampon n'est pas encore assez rempli :
   * mieux vaut refuser une analyse que d'analyser du silence qu'on n'a pas enregistré.
   */
  snapshot(ms: number): Float32Array | null {
    const wanted = Math.min(this.filled, Math.round((ms / 1000) * this.sampleRate));
    if (wanted < Math.round((this.minMs / 1000) * this.sampleRate)) return null; // trop court : rien à analyser
    const out = new Float32Array(wanted);
    let read = (this.write - wanted + this.capacity) % this.capacity;
    for (let i = 0; i < wanted; i += 1) {
      out[i] = this.data[read]!;
      read = (read + 1) % this.capacity;
    }
    return out;
  }
}
