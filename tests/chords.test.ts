import { describe, expect, it } from 'vitest';
import { CHORD_QUALITIES, interpretChord } from '../src/core/theory/chords';
import { hasOneNotePerLetter } from '../src/core/theory/scales';

describe('construction des accords', () => {
  it('Cmaj7 = C E G B (jamais Cb ni B#)', () => {
    expect(interpretChord('Cmaj7').notes).toEqual(['C', 'E', 'G', 'B']);
  });

  it('exemples orthographiés', () => {
    const n = (s: string) => interpretChord(s).notes;
    expect(n('F#')).toEqual(['F#', 'A#', 'C#']);
    expect(n('Gb')).toEqual(['Gb', 'Bb', 'Db']);
    expect(n('Bbm7')).toEqual(['Bb', 'Db', 'F', 'Ab']);
    expect(n('F#m7b5')).toEqual(['F#', 'A', 'C', 'E']);
    expect(n('Bdim7')).toEqual(['B', 'D', 'F', 'Ab']);
    expect(n('Cadd9')).toEqual(['C', 'E', 'G', 'D']);
    expect(n('Dsus2')).toEqual(['D', 'E', 'A']);
    expect(n('Esus4')).toEqual(['E', 'A', 'B']);
    expect(n('G7')).toEqual(['G', 'B', 'D', 'F']);
    expect(n('E5')).toEqual(['E', 'B']);
  });

  it('degrés', () => {
    expect(interpretChord('Cm7b5').degrees).toEqual(['1', 'b3', 'b5', 'b7']);
    expect(interpretChord('Cdim7').degrees).toEqual(['1', 'b3', 'b5', 'bb7']);
    expect(interpretChord('Cmaj7').degrees).toEqual(['1', '3', '5', '7']);
  });

  it('slash : basse déclarée', () => {
    const c = interpretChord('G/B');
    expect(c.bass).toBe('B');
    expect(c.notes).toEqual(['G', 'B', 'D']);
  });

  it('une note par lettre pour toutes les qualités, sur les 12×(♯,♭,♮) fondamentales usuelles', () => {
    const roots = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    for (const r of roots) {
      for (const q of CHORD_QUALITIES) {
        const notes = interpretChord(`${r}${q.suffix}`).notes;
        expect(hasOneNotePerLetter(notes), `${r}${q.suffix}`).toBe(true);
      }
    }
  });

  it('erreurs explicites', () => {
    expect(() => interpretChord('Cfoo')).toThrow();
    expect(() => interpretChord('H7')).toThrow();
  });
});
