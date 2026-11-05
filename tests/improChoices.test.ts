import { describe, expect, it } from 'vitest';
import { getScale, semitonesOf } from '../src/core/theory';
import { CHORD_INTERVALS } from '../src/core/impro/classify';
import { chordChoices, harmonyScaleOf, IMPRO_BACKINGS, romanOf, sameChord } from '../src/modules/gammes/impro';

const labels = (id: string) => chordChoices(getScale(id)).map((c) => c.roman);

describe('chordChoices', () => {
  it('ionien : les sept degrés harmonisés, triades et septièmes', () => {
    const l = labels('ionian');
    expect(l).toEqual(expect.arrayContaining(['I', 'Imaj7', 'ii', 'ii7', 'iii', 'IV', 'IVmaj7', 'V', 'V7', 'vi', 'vi7']));
    // pas de V majeur septième ni de IV7 : leurs notes sortent de la gamme
    expect(l).not.toContain('Vmaj7');
    expect(l).not.toContain('IV7');
  });

  it('pentatonique mineure : accords de la gamme parente (éolien)', () => {
    const l = labels('pentatonic-minor');
    expect(l).toEqual(expect.arrayContaining(['i', 'i7', '♭III', '♭IIImaj7', 'iv', '♭VI', '♭VII']));
    expect(l).not.toContain('IV');
  });

  it('dorien : le IV est majeur, pas de ♭VI', () => {
    const l = labels('dorian');
    expect(l).toContain('IV');
    expect(l).not.toContain('♭VI');
  });

  it('chaque accord proposé tient dans la gamme de référence', () => {
    for (const id of ['ionian', 'dorian', 'lydian', 'mixolydian', 'pentatonic-major', 'blues-minor']) {
      const def = getScale(id);
      const pcs = new Set(semitonesOf(harmonyScaleOf(def)).map((st) => st % 12));
      const choices = chordChoices(def);
      expect(choices.length).toBeGreaterThanOrEqual(4);
      for (const c of choices) {
        for (const iv of CHORD_INTERVALS[c.quality]) expect(pcs.has((c.offset + iv) % 12)).toBe(true);
      }
    }
  });

  it('les grilles toutes faites des styles mineurs restent proposées en pentatonique mineure', () => {
    const choices = chordChoices(getScale('pentatonic-minor'));
    for (const b of IMPRO_BACKINGS.filter((x) => x.mode === 'minor')) {
      for (const c of b.chords) expect(choices.some((o) => sameChord(o, c))).toBe(true);
    }
  });
});

it('tons entiers : repli sur le majeur, au moins quatre accords', () => {
  expect(chordChoices(getScale('whole-tone')).map((c) => c.roman)).toContain('I');
});

describe('romanOf', () => {
  it('orthographie selon la gamme', () => {
    expect(romanOf(6, 'maj', getScale('lydian'))).toBe('♯IV');
    expect(romanOf(8, 'maj')).toBe('♭VI');
    expect(romanOf(2, 'min7')).toBe('ii7');
  });
});
