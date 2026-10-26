import { describe, expect, it } from 'vitest';
import {
  fretToMidi, freqToCandidates, midiToCandidates, midiToFreq, pitchToMidi, pitchWindowSize, playableFreqRange,
} from '../src/core/theory/fretboard';
import { TUNINGS } from '../src/core/theory/tunings';

const std = TUNINGS.standard!;

describe('hauteurs réelles (son)', () => {
  it('E2 = MIDI 40 = 82,41 Hz ; E4 = 329,63 Hz', () => {
    expect(pitchToMidi('E2')).toBe(40);
    expect(midiToFreq(40)).toBeCloseTo(82.4069, 3);
    expect(midiToFreq(pitchToMidi('E4'))).toBeCloseTo(329.6276, 3);
  });

  it('A4 réglable', () => {
    expect(midiToFreq(69, 442)).toBeCloseTo(442, 6);
  });

  it('fretToMidi : octave à la case 12, case 24 de la corde aiguë = E6', () => {
    expect(fretToMidi(std, 0, 12)).toBe(pitchToMidi('E3'));
    expect(fretToMidi(std, 5, 24)).toBe(pitchToMidi('E6'));
    expect(midiToFreq(fretToMidi(std, 5, 24))).toBeCloseTo(1318.51, 1);
  });

  it('chaque corde à vide donne l\'accordage standard sonore', () => {
    expect(std.strings.map((p) => pitchToMidi(p))).toEqual([40, 45, 50, 55, 59, 64]);
  });
});

describe('fréquence → corde/case', () => {
  it('82,41 Hz : une seule possibilité en standard (corde grave, case 0) ; Drop D : case 2', () => {
    expect(freqToCandidates(std, 82.41).map(({ string, fret }) => ({ string, fret }))).toEqual([{ string: 0, fret: 0 }]);
    expect(freqToCandidates(TUNINGS.dropD!, 82.41).map(({ string, fret }) => ({ string, fret }))).toEqual([{ string: 0, fret: 2 }]);
  });

  it('une même note existe à plusieurs endroits (E4 : 6 emplacements possibles ou moins)', () => {
    const c = midiToCandidates(std, pitchToMidi('E4'));
    expect(c).toContainEqual({ string: 5, fret: 0 });
    expect(c).toContainEqual({ string: 4, fret: 5 });
    expect(c).toContainEqual({ string: 3, fret: 9 });
    expect(c).toContainEqual({ string: 2, fret: 14 });
    expect(c).toContainEqual({ string: 1, fret: 19 });
    expect(c).toContainEqual({ string: 0, fret: 24 });
  });

  it('écart en cents signé, rejet au-delà de la tolérance, hors plage', () => {
    const e2 = midiToFreq(40);
    const c = freqToCandidates(std, e2 * Math.pow(2, 20 / 1200));
    expect(c[0]!.cents).toBeCloseTo(20, 1);
    // 50,1 cents au-dessus de Mi = 49,9 cents sous Fa : on rattache à la note la plus proche.
    expect(freqToCandidates(std, e2 * Math.pow(2, 50.1 / 1200))[0]!.midi).toBe(41);
    expect(freqToCandidates(std, e2 * Math.pow(2, 20 / 1200), { maxCents: 10 })).toEqual([]);
    expect(freqToCandidates(std, 50)).toEqual([]); // sous le Mi grave
    expect(freqToCandidates(std, 2000)).toEqual([]); // au-dessus de E6
  });
});

describe('plage et fenêtre déduites de l\'accordage', () => {
  it('plage standard ≈ 82 Hz → 1 318 Hz', () => {
    const r = playableFreqRange(std);
    expect(r.minHz).toBeCloseTo(82.41, 1);
    expect(r.maxHz).toBeCloseTo(1318.5, 0);
  });

  it('Drop D ≈ 73 Hz ; 7 cordes ≈ 62 Hz ; baryton ≤ 62 Hz', () => {
    expect(playableFreqRange(TUNINGS.dropD!).minHz).toBeCloseTo(73.42, 1);
    expect(playableFreqRange(TUNINGS.standard7!).minHz).toBeCloseTo(61.74, 1);
    expect(playableFreqRange(TUNINGS.baritone!).minHz).toBeLessThanOrEqual(62);
  });

  it('fenêtre de pitch : 2048 en standard/Drop D, 4096 en 7 cordes/baryton/8 cordes', () => {
    expect(pitchWindowSize(std)).toBe(2048);
    expect(pitchWindowSize(TUNINGS.dropD!)).toBe(2048);
    expect(pitchWindowSize(TUNINGS.standard7!)).toBe(4096);
    expect(pitchWindowSize(TUNINGS.baritone!)).toBe(4096);
    expect(pitchWindowSize(TUNINGS.standard8!)).toBe(4096);
  });

  it('nombre de cordes variable', () => {
    expect(Object.values(TUNINGS).map((t) => t.strings.length).sort()).toEqual([6, 6, 6, 6, 6, 6, 6, 7, 8]);
  });
});
