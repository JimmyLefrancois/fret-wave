import { describe, expect, it } from 'vitest';
import { MOBILE_SHAPES, VOICINGS } from '../src/data/voicings';
import { instantiateShape, validateVoicing, voicingMidis, voicingNotes } from '../src/core/theory/voicings';
import { MAJOR_KEYS } from '../src/core/theory/keys';
import { fmtNote } from '../src/core/theory/notation';

describe('base de voicings (accordage standard)', () => {
  it('43 formes, identifiants uniques', () => {
    expect(VOICINGS).toHaveLength(43);
    expect(new Set(VOICINGS.map((v) => v.id)).size).toBe(43);
  });

  it('chaque voicing produit exactement les notes de son accord', () => {
    for (const v of VOICINGS) expect(validateVoicing(v), v.id).toEqual([]);
  });

  it('notes orthographiées comme dans la base (Em, C7, Cmaj7, D/F#)', () => {
    const notes = (id: string) => voicingNotes(VOICINGS.find((v) => v.id === id)!);
    expect(notes('Em-022000')).toEqual(['E', 'B', 'E', 'G', 'B', 'E']);
    expect(notes('C7-x32310')).toEqual(['C', 'E', 'Bb', 'C', 'E']);
    expect(notes('Cmaj7-x32000')).toEqual(['C', 'E', 'G', 'B', 'E']);
    expect(notes('DoverFs-200232')).toEqual(['F#', 'A', 'D', 'A', 'D', 'F#']);
  });

  it('C7 x32310 : la quinte omise est déclarée', () => {
    expect(VOICINGS.find((v) => v.id === 'C7-x32310')!.omitted).toEqual(['5']);
  });

  it('G xx0003 serait G/D : une forme sans basse déclarée est refusée', () => {
    const bad = { ...VOICINGS.find((v) => v.id === 'G-320003')!, id: 'G-xx0003', frets: [null, null, 0, 0, 0, 3] };
    expect(validateVoicing(bad).join(' ')).toContain('basse');
    const good = { ...bad, chord: 'G/D' };
    expect(validateVoicing(good)).toEqual([]);
  });

  it('détecte les erreurs de transcription', () => {
    const base = VOICINGS.find((v) => v.id === 'Am-x02210')!;
    expect(validateVoicing({ ...base, frets: [null, 0, 2, 2, 2, 0] }), 'A au lieu de Am').not.toEqual([]); // C# étranger
    expect(validateVoicing({ ...base, frets: [null, 0, 2, 2, 1] }), 'mauvais nombre de cordes').not.toEqual([]);
    expect(validateVoicing({ ...base, frets: [0, 0, 2, 2, 1, 0] }), 'basse Mi au lieu de La').not.toEqual([]);
    expect(validateVoicing({ ...base, omitted: ['5'] }), 'omission déclarée mais présente').not.toEqual([]);
  });

  it('couvre les paliers P1 à P7, P2b (power), P6 (slash), P9 (triades)', () => {
    const paliers = new Set(VOICINGS.map((v) => v.palier));
    for (const p of ['P1', 'P2', 'P2b', 'P3', 'P4', 'P5', 'P6', 'P7', 'P9']) expect(paliers.has(p), p).toBe(true);
  });

  it('simplifiedOf pointe vers un voicing existant', () => {
    const ids = new Set(VOICINGS.map((v) => v.id));
    for (const v of VOICINGS) if (v.simplifiedOf) expect(ids.has(v.simplifiedOf), v.id).toBe(true);
  });

  it('les power chords sont en 1-5-8 (3 cordes, octave de la fondamentale)', () => {
    const powers = VOICINGS.filter((x) => x.family === 'power');
    expect(powers).toHaveLength(5);
    for (const v of powers) {
      const midis = voicingMidis(v);
      expect(midis, v.id).toHaveLength(3);
      expect(midis[2]! - midis[0]!, v.id).toBe(12);
      expect(midis[1]! - midis[0]!, v.id).toBe(7);
    }
  });
});

describe('formes mobiles (barrés)', () => {
  it('10 formes × 13 fondamentales (noms de la politique des tonalités) = 130 voicings valides', () => {
    expect(MOBILE_SHAPES).toHaveLength(10);
    let n = 0;
    for (const shape of MOBILE_SHAPES) {
      for (const root of MAJOR_KEYS) {
        const v = instantiateShape(shape, root);
        expect(validateVoicing(v), v.id).toEqual([]);
        n++;
      }
    }
    expect(n).toBe(130);
  });

  it('F barré = forme de Mi à la case 1 : 133211 ; Bb = forme de La case 1 : x13331', () => {
    const E = MOBILE_SHAPES.find((s) => s.id === 'E-maj')!;
    const A = MOBILE_SHAPES.find((s) => s.id === 'A-maj')!;
    expect(instantiateShape(E, 'F').frets).toEqual([1, 3, 3, 2, 1, 1]);
    expect(instantiateShape(A, 'Bb').frets).toEqual([null, 1, 3, 3, 3, 1]);
  });

  it('F♯ et G♭ : même case, orthographe différente', () => {
    const E = MOBILE_SHAPES.find((s) => s.id === 'E-maj')!;
    const a = instantiateShape(E, 'F#');
    const b = instantiateShape(E, 'Gb');
    expect(a.frets).toEqual(b.frets);
    expect(voicingNotes(a).map((n) => fmtNote(n, 'fr'))).toContain('Fa♯');
    expect(voicingNotes(b).map((n) => fmtNote(n, 'fr'))).toContain('Sol♭');
  });
});
