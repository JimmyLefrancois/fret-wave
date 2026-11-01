import { describe, expect, it } from 'vitest';
import { CHORD_QUALITIES } from '../src/core/theory/chords';
import { findVoicings, lowFret } from '../src/core/theory/chordFinder';
import { validateFingers } from '../src/core/theory/chordFingers';
import { validateVoicing } from '../src/core/theory/voicings';
import { VOICINGS } from '../src/data/voicings';
import { DICT_ADVANCED, DICT_BASIC, DICT_TONICS, dictionaryForms } from '../src/modules/accords/list';

const SYMBOLS = DICT_TONICS.flatMap((r) => [...DICT_BASIC, ...DICT_ADVANCED].map((t) => `${r}${t.suffix}`));

describe('doigtés calculés', () => {
  it('propose les 50 types du site, sus sous le nom sus4', () => {
    expect(DICT_BASIC.length + DICT_ADVANCED.length).toBe(50);
  });

  it('chaque tonique et chaque type ont au moins une forme, deux hors maj13(#11)', () => {
    const poor = SYMBOLS.filter((s) => findVoicings(s).length < (s.endsWith('maj13(#11)') ? 1 : 2));
    expect(poor).toEqual([]);
  }, 300_000);

  it('chaque forme passe les règles des formes saisies', () => {
    const errs = SYMBOLS.flatMap((s) => findVoicings(s).flatMap((v) => [...validateVoicing(v), ...validateFingers(v)]));
    expect(errs).toEqual([]);
  }, 300_000);

  it('retrouve le barré classique de Fa♯m', () => {
    expect(findVoicings('F#m').map((v) => v.frets.join())).toContain('2,4,4,2,2,2');
  });

  it('écarte ce qui est juste en théorie mais absurde sous la main', () => {
    for (const s of SYMBOLS) {
      for (const v of findVoicings(s)) {
        if (v.frets.includes(0)) expect(Math.max(...v.frets.map((f) => f ?? 0))).toBeLessThanOrEqual(5);
      }
    }
    expect(findVoicings('C5').every((v) => v.frets[0] !== null || v.frets[1] !== null || v.frets[2] !== null)).toBe(true);
  }, 300_000);

  it('va de la plus basse à la plus haute, sans doublon', () => {
    const lows = findVoicings('Bb').map((v) => Math.min(...v.frets.filter((f): f is number => !!f)));
    expect(lows).toEqual([...lows].sort((a, b) => a - b));
    const keys = findVoicings('Bb').map((v) => v.frets.join());
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('une forme par zone du manche', () => {
  it('deux formes partent à deux cases d’écart au moins', () => {
    for (const s of SYMBOLS) {
      const lows = findVoicings(s).map(lowFret);
      lows.forEach((l, i) => { if (i > 0) expect(l - lows[i - 1]!).toBeGreaterThanOrEqual(2); });
    }
  }, 300_000);

  it('Do majeur donne ses cinq positions, dont le barré de la case 3 et celui de la case 8', () => {
    const forms = dictionaryForms('C', VOICINGS);
    expect(forms).toHaveLength(5);
    expect(forms.map((v) => v.frets.join())).toEqual(expect.arrayContaining([',3,5,5,5,3', '8,10,10,9,8,8']));
  });
});

describe('familles de types', () => {
  it('chaque type de la théorie est dans une seule famille', () => {
    const suffixes = [...DICT_BASIC, ...DICT_ADVANCED].map((t) => t.suffix).sort();
    expect(suffixes).toEqual(CHORD_QUALITIES.map((q) => q.suffix).sort());
  });
});

describe('variantes du dictionnaire', () => {
  it('les formes saisies passent d’abord, sans être répétées', () => {
    const forms = dictionaryForms('C', VOICINGS);
    expect(forms[0]!.id).toBe('C-x32010');
    expect(forms.filter((v) => v.frets.join() === forms[0]!.frets.join())).toHaveLength(1);
  });
});
