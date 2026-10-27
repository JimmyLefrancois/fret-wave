/**
 * Détection de hauteur (phase 3) — vérifiée sur des signaux **synthétiques** dont on connaît la
 * réponse, avant tout essai sur une vraie guitare : c'est la seule façon de chiffrer une justesse.
 *
 * Les chiffres obtenus (48 kHz, `pitchy` 4.1.0) : écart ≤ 0,3 cent sur tout le manche, y compris
 * avec la fondamentale affaiblie ou absente, et refus net du bruit seul.
 */
import { describe, expect, it } from 'vitest';
import { NoteStabilizer, PitchTracker, centsBetween, midiFloatOf, readingFrom } from '../src/core/input/pitch';
import { TUNINGS, midiToFreq, playableFreqRange, pitchWindowSize } from '../src/core/theory';
import { hzOf, noise, plucked, silence, tone } from './helpers/signals';

const SR = 48000;

function tracker(windowSize = 4096, a4 = 440, minVolumeDb = -60) {
  return new PitchTracker({ windowSize, sampleRate: SR, a4, minVolumeDb });
}

/** Fenêtre prélevée au milieu du signal (l'attaque est un cas à part, testé plus bas). */
function frame(buf: Float32Array, size: number, offset = 0.25): Float32Array {
  const start = Math.min(Math.max(0, Math.round(buf.length * offset) - size / 2), buf.length - size);
  return buf.slice(Math.max(0, start), Math.max(0, start) + size);
}

describe('détection de hauteur', () => {
  it('une sinusoïde à 440 Hz donne La4 à 0 cent, clarté maximale', () => {
    const r = tracker(2048).detect(frame(tone({ freq: 440, seconds: 0.3 }), 2048));
    expect(r).not.toBeNull();
    expect(r!.hz).toBeCloseTo(440, 0);
    expect(r!.midi).toBe(69);
    expect(Math.abs(r!.cents)).toBeLessThan(1);
    expect(r!.clarity).toBeGreaterThan(0.99);
  });

  it('tout le manche : chaque case de chaque corde est reconnue, à moins de 5 cents', () => {
    const tuning = TUNINGS.standard!;
    const { minMidi, maxMidi } = playableFreqRange(tuning);
    const tr = tracker(4096);
    const errors: string[] = [];
    let worst = 0;
    for (let midi = minMidi; midi <= maxMidi; midi++) {
      const hz = midiToFreq(midi);
      const r = tr.detect(frame(plucked(hz, { seconds: 0.6 }), 4096));
      if (!r) {
        errors.push(`midi ${midi} : rien détecté`);
        continue;
      }
      if (Math.abs(r.cents) > 5) worst = Math.max(worst, Math.abs(r.cents));
      if (r.midi !== midi) errors.push(`midi ${midi} lu ${r.midi} (${r.hz.toFixed(1)} Hz)`);
    }
    expect(errors).toEqual([]);
    expect(worst).toBeLessThan(5);
  });

  it('la fondamentale affaiblie ou absente ne fait pas basculer d’octave', () => {
    const tr = tracker(4096);
    const weak = tr.detect(frame(tone({ freq: 82.41, harmonics: [0.2, 1, 0.7, 0.5, 0.3], decay: 0.5 }), 4096));
    const none = tr.detect(frame(tone({ freq: 82.41, harmonics: [0, 1, 0.7, 0.5, 0.3], decay: 0.5 }), 4096));
    expect(weak!.midi).toBe(40);
    expect(none!.midi).toBe(40);
    expect(Math.abs(none!.cents)).toBeLessThan(1);
  });

  it('une guitare désaccordée est mesurée, pas jugée : +25 cents se lit +25', () => {
    const r = tracker(4096).detect(frame(plucked(440, { cents: 25 }), 4096));
    expect(r!.midi).toBe(69);
    expect(r!.cents).toBeCloseTo(25, 0);
  });

  it('le bruit seul et le silence ne produisent aucune note', () => {
    const tr = tracker(4096);
    expect(tr.detect(noise(4096, 0.02))).toBeNull();
    expect(tr.detect(silence(4096))).toBeNull();
  });

  it('un signal sous le seuil de volume n’est pas analysé', () => {
    // plucked normalisé à ~0,5 RMS ; on l'atténue de 40 dB : sous −30 dBFS
    const quiet = frame(plucked(220, { seconds: 0.6 }), 4096).map((v) => v * 0.01);
    const strict = new PitchTracker({ windowSize: 4096, sampleRate: SR, minVolumeDb: -30 });
    expect(strict.detect(quiet)).toBeNull();
    const loose = new PitchTracker({ windowSize: 4096, sampleRate: SR, minVolumeDb: -60 });
    expect(loose.detect(quiet)!.midi).toBe(57);
  });

  it('le La de référence se règle : à 442, un 442 lu donne 0 cent', () => {
    const r = tracker(2048, 442).detect(frame(tone({ freq: 442, seconds: 0.3 }), 2048));
    expect(r!.midi).toBe(69);
    expect(Math.abs(r!.cents)).toBeLessThan(1);
    // et le même la 440 lu avec la référence 442 est 7,85 cents bas
    const r2 = tracker(2048, 442).detect(frame(tone({ freq: 440, seconds: 0.3 }), 2048));
    expect(r2!.cents).toBeCloseTo(-7.85, 1);
  });

  it('la fenêtre doit faire exactement la taille annoncée (garde-fou du worklet)', () => {
    expect(tracker(4096).detect(new Float32Array(2048))).toBeNull();
  });

  it('les tailles de fenêtre suivent l’accordage (2048 en standard, 4096 avec un Si1)', () => {
    expect(pitchWindowSize(TUNINGS.standard!, SR)).toBe(2048);
    expect(pitchWindowSize(TUNINGS.standard7!, SR)).toBe(4096);
    expect(pitchWindowSize(TUNINGS.standard8!, SR)).toBe(4096);
  });

  it('utilitaires de hauteur : fréquence ↔ demi-tons ↔ cents', () => {
    expect(midiFloatOf(440)).toBeCloseTo(69, 6);
    expect(midiFloatOf(880)).toBeCloseTo(81, 6);
    expect(centsBetween(452, 440)).toBeCloseTo(46.58, 1);
    expect(readingFrom(0, 1)).toBeNull();
    expect(readingFrom(440, 0)).toBeNull();
    expect(readingFrom(440, 0.95)!.midi).toBe(69);
  });
});

describe('retenue de note (anti-jitter)', () => {
  const reading = (hz: number) => readingFrom(hz, 0.99)!;

  it('une note n’est retenue qu’après trois fenêtres, et n’est « nouvelle » qu’une fois', () => {
    const st = new NoteStabilizer({ frames: 3 });
    expect(st.push(reading(110)).note).toBeNull();
    expect(st.push(reading(110.02)).note).toBeNull();
    const third = st.push(reading(110.01));
    expect(third.note!.midi).toBe(45);
    expect(third.isNew).toBe(true);
    const fourth = st.push(reading(110));
    expect(fourth.note!.midi).toBe(45);
    expect(fourth.isNew).toBe(false);
  });

  it('un silence casse la retenue : rejouer la même note la redéclenche', () => {
    const st = new NoteStabilizer({ frames: 3 });
    for (let i = 0; i < 3; i++) st.push(reading(110));
    expect(st.push(null).note).toBeNull();
    st.push(reading(110));
    st.push(reading(110));
    expect(st.push(reading(110)).isNew).toBe(true);
  });

  it('un saut d’une demi-teinte repart de zéro (pas de moyenne entre deux notes)', () => {
    const st = new NoteStabilizer({ frames: 3 });
    st.push(reading(110));
    st.push(reading(110));
    const jump = st.push(reading(116.54)); // Sib2
    expect(jump.note).toBeNull();
    expect(st.push(reading(116.54)).note).toBeNull();
    expect(st.push(reading(116.54)).note!.midi).toBe(46);
  });

  it('une note qui s’éteint en glissant n’est jamais retenue', () => {
    const st = new NoteStabilizer({ frames: 3, maxSpreadCents: 20 });
    st.push(reading(110));
    st.push(reading(110.7)); // +11 cents
    // +23 cents : étalement de 23 > 20 → pas de retenue
    expect(st.push(reading(111.5)).note).toBeNull();
  });

  it('la justesse affichée est la médiane, pas la dernière fenêtre', () => {
    const st = new NoteStabilizer({ frames: 3 });
    st.push(reading(hzOf(45, 440) * 1.01)); // +17 cents
    st.push(reading(hzOf(45, 440) * 1.0));
    st.push(reading(hzOf(45, 440) * 1.005));
    const note = st.push(reading(hzOf(45, 440) * 1.0)).note!;
    expect(Math.abs(note.cents)).toBeLessThan(6);
  });
});
