import { describe, expect, it } from 'vitest';
import {
  analyzeChord,
  detectOnsetMs,
  prepareSpectrum,
  scoreHypothesis,
  type ChordTarget,
} from '../src/core/input/poly';
import { padStart, synthChord, synthHz, VOICINGS } from './synth';

const SR = 48000;
const opts = { sampleRate: SR };
const targets = (midis: number[]): ChordTarget[] => midis.map((midi, string) => ({ midi, string }));

/** Analyse un signal de synthèse et rend la confiance de chaque corde, dans l'ordre grave → aigu. */
function confidences(midis: number[], synth: Parameters<typeof synthChord>[1] = {}) {
  const a = analyzeChord(synthChord(midis, synth), targets(midis), opts);
  return { a, conf: a.notes.map((n) => n.confidence) };
}

describe('FFT et attaque', () => {
  it('place un sinus dans le bon bin, à la bonne amplitude', () => {
    const n = 8192;
    const f = 440;
    const sig = new Float32Array(n);
    for (let i = 0; i < n; i += 1) sig[i] = 0.5 * Math.sin((2 * Math.PI * f * i) / SR);
    const sp = prepareSpectrum(sig, { sampleRate: SR, fftSize: n });
    // amplitude retrouvée à ±10 % (fenêtre de Hann, interpolation grossière)
    const bin = Math.round(f / sp.binHz);
    const amp = Math.max(sp.mag[bin - 1]!, sp.mag[bin]!, sp.mag[bin + 1]!);
    expect(amp).toBeGreaterThan(0.45);
    expect(amp).toBeLessThan(0.55);
    expect(Math.abs(bin * sp.binHz - f)).toBeLessThan(sp.binHz * 1.5);
  });

  it('trouve une attaque à un instant connu', () => {
    const sig = padStart(synthChord(VOICINGS.Em.midis, { snrDb: 30 }), 150);
    const hit = detectOnsetMs(sig, SR);
    expect(hit).not.toBeNull();
    expect(hit!.ms).toBeGreaterThan(120);
    expect(hit!.ms).toBeLessThan(175);
  });
});

describe('accord plaqué : présent ou absent', () => {
  it('entend les six cordes d’un Em propre, justes à quelques cents', () => {
    const { a, conf } = confidences(VOICINGS.Em.midis);
    expect(a.verdict).toBe('ok');
    expect(conf.every((c) => c > 0.6)).toBe(true);
    expect(a.notes.every((n) => n.cents !== null && Math.abs(n.cents) < 6)).toBe(true);
    expect(a.explainedShare).toBeGreaterThan(0.85);
  });

  it('tient à 30, 20 puis 10 dB de rapport signal/bruit, en se dégradant honnêtement', () => {
    const c30 = confidences(VOICINGS.Em.midis, { snrDb: 30 });
    const c20 = confidences(VOICINGS.Em.midis, { snrDb: 20 });
    const c10 = confidences(VOICINGS.Em.midis, { snrDb: 10 });
    expect(c30.a.verdict).toBe('ok');
    expect(c20.a.verdict).toBe('ok');
    expect(c10.a.verdict).toBe('ok');
    // À 30 et 20 dB la confiance est **la même** : le plancher est relatif (0,4 % du pic le plus
    // fort), donc tant que les harmoniques dominent, la certitude ne bouge pas. C'est à 10 dB que la
    // mesure se dégrade — et elle le dit (0,67 contre 0,81).
    expect(Math.abs(c30.a.confidence - c20.a.confidence)).toBeLessThan(0.05);
    expect(c10.a.confidence).toBeLessThan(c20.a.confidence - 0.05);
  });

  it('repère la corde étouffée et n’accuse qu’elle', () => {
    const { a, conf } = confidences(VOICINGS.Em.midis, { muted: [4], snrDb: 30 });
    expect(a.verdict).toBe('partial');
    expect(conf[4]).toBeLessThan(0.45);
    expect(conf.filter((_, i) => i !== 4).every((c) => c > 0.6)).toBe(true);
    expect(a.missing).toHaveLength(1);
  });

  it('mesure le désaccordage à ±12 cents de la valeur injectée', () => {
    for (const cents of [15, -30]) {
      const { a } = confidences(VOICINGS.Em.midis, { detuneCents: [cents, 0, 0, 0, 0, 0], snrDb: 30 });
      const m = a.notes[0]!.cents!;
      expect(Math.abs(m - cents)).toBeLessThan(12);
    }
  });

  it('ne dit rien d’un silence', () => {
    const a = analyzeChord(new Float32Array(21600), targets(VOICINGS.Em.midis), opts);
    expect(a.verdict).toBe('silent');
    expect(a.confidence).toBe(0);
    expect(a.notes.every((n) => n.confidence === 0)).toBe(true);
  });
});

describe('accords voisins : le bon gagne', () => {
  const pairs: { truth: keyof typeof VOICINGS; other: keyof typeof VOICINGS }[] = [
    { truth: 'Am', other: 'C' },
    { truth: 'Em', other: 'E' },
    { truth: 'D', other: 'Dsus2' },
    { truth: 'D', other: 'Dsus4' },
    { truth: 'Cmaj7', other: 'C' },
    { truth: 'Am7', other: 'Am' },
    { truth: 'G', other: 'G/B' },
  ];

  for (const snr of [30, 20]) {
    it(`préfère la vérité à son voisin, à ${snr} dB`, () => {
      for (const { truth, other } of pairs) {
        const sig = synthChord(VOICINGS[truth].midis, { snrDb: snr });
        const sp = prepareSpectrum(sig, opts);
        const good = scoreHypothesis(sp, targets(VOICINGS[truth].midis), opts);
        const bad = scoreHypothesis(sp, targets(VOICINGS[other].midis), opts);
        expect(good, `${truth} contre ${other} à ${snr} dB : ${good.toFixed(2)} vs ${bad.toFixed(2)}`).toBeGreaterThan(bad);
      }
    });
  }

  it('nomme la note fautive quand la corde de Sol est poussée au Sol♯', () => {
    const sig = synthChord(VOICINGS.E.midis, { snrDb: 30 }); // joué majeur, attendu mineur
    const a = analyzeChord(sig, targets(VOICINGS.Em.midis), opts);
    expect(a.verdict).not.toBe('ok');
    const sol = a.notes[3]!; // corde de Sol dans le voicing de Em
    expect(sol.confidence).toBeLessThan(0.45);
    const fautive = a.extraNotes.find((e) => e.midi === 56); // Sol♯3
    expect(fautive, JSON.stringify(a.extraNotes)).toBeDefined();
  });
});

describe('arpège et strum', () => {
  it('reste juste quand les cordes sont étalées de 40 ms', () => {
    const { a } = confidences(VOICINGS.Em.midis, { strumMs: 8, snrDb: 20 }); // 8 ms × 5 = 40 ms
    expect(a.verdict).toBe('ok');
  });

  it('la hauteur attendue suit le La de référence', () => {
    const a = analyzeChord(synthChord([45], { snrDb: 40, a4: 432 }), [{ midi: 45, string: 0 }], { sampleRate: SR, a4: 432 });
    expect(a.verdict).toBe('ok');
    expect(Math.abs(a.notes[0]!.cents!)).toBeLessThan(6);
    expect(a.notes[0]!.hz).toBeCloseTo(synthHz(45, 432), 1);
  });
});
