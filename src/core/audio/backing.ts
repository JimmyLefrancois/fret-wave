/**
 * Accompagnements de l'improvisation (phase 7) — **basse, pads, batterie**, synthétisés.
 *
 * Deux parties, séparées exprès :
 *
 *  1. `backingPattern()` est **pure** : elle rend la liste des événements (quel son, quand, quelle
 *     hauteur, quelle durée) pour une boucle. C'est la musique, et elle se teste sans audio ;
 *  2. `BackingPlayer` ne fait que **programmer** ces événements sur le contexte audio, avec une avance
 *     de 250 ms (un `setInterval` de 60 ms qui regarde devant) — la seule façon de ne pas entendre les
 *     à-coups d'un `setTimeout` par note.
 *
 * Pourquoi synthétiser plutôt que d'échantillonner : le brief veut **deux styles jouables** et l'app
 * embarque déjà 12 Mo d'échantillons de guitare. Une basse filtrée, un pad et une batterie de bruit
 * suffisent à installer une grille ; et un accompagnement synthétique ne vole jamais la vedette à la
 * guitare (c'est un support, pas un partenaire de volume).
 */
import type { ChordQuality } from '../impro/classify';
import type { ImproBackage } from '../../modules/gammes/impro';

export type BackingVoice = 'kick' | 'snare' | 'hat' | 'bass' | 'pad';

export interface BackingEvent {
  /** Position en **temps** depuis le début de la boucle (4 temps par mesure). */
  beat: number;
  voice: BackingVoice;
  /** Hauteurs MIDI (vide pour les percussions). */
  midis: readonly number[];
  /** Durée en temps. */
  beats: number;
  /** Gain relatif 0-1. */
  gain: number;
}

const THIRD: Record<ChordQuality, number> = { maj: 4, min: 3, dom7: 4, min7: 3, maj7: 4, sus4: 5 };
const SEVENTH: Partial<Record<ChordQuality, number>> = { dom7: 10, min7: 10, maj7: 11 };

/** Les hauteurs d'un accord, à partir d'une fondamentale MIDI (basse) : on empile à l'octave au-dessus. */
export function chordMidis(rootMidi: number, quality: ChordQuality, octaves = 1): number[] {
  const base = rootMidi + 12 * octaves;
  const out = [base, base + THIRD[quality], base + 7];
  const seventh = SEVENTH[quality];
  if (seventh !== undefined) out.push(base + seventh);
  return out;
}

/**
 * La boucle d'accompagnement, en événements. 4 temps par mesure, une mesure par accord.
 *
 * Les deux styles ne diffèrent pas que par le tempo : le synthwave a une caisse claire sur 2 et 4 (jeu
 * rock), le lo-fi une caisse **sur 3 seulement** (half-time) et une charleston feutrée — c'est ce qui
 * fait « traîner » la grille et laisse de la place à la guitare.
 */
export function backingPattern(b: ImproBackage, tonicMidi: number): BackingEvent[] {
  const events: BackingEvent[] = [];
  b.chords.forEach((spec, measure) => {
    const at = measure * 4;
    const rootMidi = tonicMidi + spec.offset;
    const chord = chordMidis(rootMidi, spec.quality);
    const third = rootMidi + THIRD[spec.quality];
    const fifth = rootMidi + 7;

    // --- pads : l'accord tenu sur la mesure, très doux
    events.push({ beat: at, voice: 'pad', midis: chord.map((m) => m + 12), beats: 4, gain: b.style === 'lofi' ? 0.42 : 0.34 });

    if (b.style === 'synthwave') {
      events.push({ beat: at, voice: 'kick', midis: [], beats: 0.5, gain: 0.85 });
      events.push({ beat: at + 2, voice: 'kick', midis: [], beats: 0.5, gain: 0.75 });
      events.push({ beat: at + 1, voice: 'snare', midis: [], beats: 0.5, gain: 0.5 });
      events.push({ beat: at + 3, voice: 'snare', midis: [], beats: 0.5, gain: 0.55 });
      for (let i = 0; i < 8; i += 1) {
        events.push({ beat: at + i * 0.5, voice: 'hat', midis: [], beats: 0.25, gain: i % 2 === 0 ? 0.22 : 0.14 });
      }
      // basse : fondamentale, fondamentale, quinte, fondamentale — le moteur du style
      events.push({ beat: at, voice: 'bass', midis: [rootMidi], beats: 1.2, gain: 0.75 });
      events.push({ beat: at + 1.5, voice: 'bass', midis: [rootMidi], beats: 0.5, gain: 0.5 });
      events.push({ beat: at + 2, voice: 'bass', midis: [fifth], beats: 1.4, gain: 0.7 });
      events.push({ beat: at + 3.5, voice: 'bass', midis: [rootMidi], beats: 0.5, gain: 0.5 });
    } else {
      // half-time : grosse caisse sur 1, caisse claire sur 3, charleston feutrée
      events.push({ beat: at, voice: 'kick', midis: [], beats: 0.5, gain: 0.7 });
      events.push({ beat: at + 2.5, voice: 'kick', midis: [], beats: 0.5, gain: 0.4 });
      events.push({ beat: at + 2, voice: 'snare', midis: [], beats: 0.5, gain: 0.34 });
      events.push({ beat: at + 0.5, voice: 'hat', midis: [], beats: 0.25, gain: 0.16 });
      events.push({ beat: at + 1.5, voice: 'hat', midis: [], beats: 0.25, gain: 0.12 });
      events.push({ beat: at + 2.5, voice: 'hat', midis: [], beats: 0.25, gain: 0.16 });
      events.push({ beat: at + 3.5, voice: 'hat', midis: [], beats: 0.25, gain: 0.12 });
      events.push({ beat: at, voice: 'bass', midis: [rootMidi], beats: 1.8, gain: 0.6 });
      events.push({ beat: at + 2, voice: 'bass', midis: [third + 12], beats: 1.5, gain: 0.45 });
    }
  });
  return events.sort((a, b2) => a.beat - b2.beat);
}

/** Durée d'une boucle, en temps. */
export const loopBeatsOf = (b: ImproBackage): number => b.chords.length * 4;

// --- lecture ------------------------------------------------------------------------------------

const LOOKAHEAD_S = 0.25;
const TICK_MS = 60;

export class BackingPlayer {
  private events: BackingEvent[] = [];
  private tempo = 96;
  private loopBeats = 16;
  private startedAt = 0;
  private nextIndex = 0;
  private loopsDone = 0;
  private timer: number | null = null;
  private noise: AudioBuffer | null = null;
  state: 'stopped' | 'playing' = 'stopped';
  /** Appelé à chaque début de mesure (thread principal) : l'écran y accroche son curseur. */
  onMeasure: ((measure: number) => void) | null = null;

  constructor(private readonly ctx: AudioContext, private readonly destination: AudioNode) {}

  get beatSeconds(): number {
    return 60 / this.tempo;
  }

  load(events: BackingEvent[], tempo: number, loopBeats: number): void {
    this.events = events;
    this.tempo = tempo;
    this.loopBeats = loopBeats;
  }

  /** Position courante dans la boucle, en temps (0 → loopBeats). */
  positionBeats(): number {
    if (this.state !== 'playing') return 0;
    const elapsed = (this.ctx.currentTime - this.startedAt) / this.beatSeconds;
    return elapsed % this.loopBeats;
  }

  /** Numéro de la mesure courante (0 → nombre d'accords − 1). */
  currentMeasure(): number {
    return Math.floor(this.positionBeats() / 4) % Math.max(1, this.loopBeats / 4);
  }

  start(): void {
    if (this.state === 'playing' || this.events.length === 0) return;
    this.state = 'playing';
    this.startedAt = this.ctx.currentTime + 0.12;
    this.nextIndex = 0;
    this.loopsDone = 0;
    this.ensureNoise();
    this.pump();
    this.timer = window.setInterval(() => this.pump(), TICK_MS);
  }

  stop(): void {
    this.state = 'stopped';
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Programme tout ce qui tombe dans la fenêtre d'avance. */
  private pump(): void {
    const horizon = this.ctx.currentTime + LOOKAHEAD_S;
    let guard = 0;
    while (guard < 500) {
      guard += 1;
      const ev = this.events[this.nextIndex];
      if (!ev) break;
      const t = this.startedAt + (this.loopsDone * this.loopBeats + ev.beat) * this.beatSeconds;
      if (t > horizon) break;
      if (t >= this.ctx.currentTime) this.play(ev, t);
      this.nextIndex += 1;
      if (this.nextIndex >= this.events.length) {
        this.nextIndex = 0;
        this.loopsDone += 1;
      }
    }
  }

  private ensureNoise(): void {
    if (this.noise) return;
    const len = Math.round(this.ctx.sampleRate * 0.4);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    // bruit déterministe (LCG) : deux rendus de la même boucle sonnent identiques
    let seed = 0x2f6e2b1;
    for (let i = 0; i < len; i += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    this.noise = buf;
  }

  private env(gain: ReturnType<AudioContext['createGain']>, t: number, attack: number, decay: number, peak: number): void {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private play(ev: BackingEvent, t: number): void {
    const ctx = this.ctx;
    const dur = Math.max(0.03, ev.beats * this.beatSeconds);
    if (ev.voice === 'kick') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(46, t + 0.12);
      this.env(g, t, 0.004, 0.16, ev.gain * 0.9);
      osc.connect(g).connect(this.destination);
      osc.start(t);
      osc.stop(t + 0.3);
      return;
    }
    if (ev.voice === 'snare' || ev.voice === 'hat') {
      if (!this.noise) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      if (ev.voice === 'snare') {
        filter.type = 'bandpass';
        filter.frequency.value = 1800;
        filter.Q.value = 0.9;
        this.env(g, t, 0.002, 0.12, ev.gain * 0.5);
      } else {
        filter.type = 'highpass';
        filter.frequency.value = 7000;
        this.env(g, t, 0.001, 0.045, ev.gain * 0.35);
      }
      src.connect(filter).connect(g).connect(this.destination);
      src.start(t);
      src.stop(t + 0.25);
      return;
    }
    if (ev.voice === 'bass') {
      const midi = ev.midis[0];
      if (midi === undefined) return;
      const hz = 440 * 2 ** ((midi - 69) / 12);
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = hz;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520, t);
      filter.frequency.exponentialRampToValueAtTime(240, t + dur);
      filter.Q.value = 4;
      this.env(g, t, 0.012, dur, ev.gain * 0.32);
      osc.connect(filter).connect(g).connect(this.destination);
      osc.start(t);
      osc.stop(t + dur + 0.1);
      return;
    }
    // pad : une sinusoïde par note, attaque lente, c'est ce qui « nappe »
    for (const midi of ev.midis) {
      const hz = 440 * 2 ** ((midi - 69) / 12);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = hz;
      osc.detune.value = (midi % 3) * 4 - 4; // léger désaccord : deux oscillateurs ne battent pas à l'unisson
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(ev.gain * 0.09, t + Math.min(0.6, dur * 0.4));
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(this.destination);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }
}
