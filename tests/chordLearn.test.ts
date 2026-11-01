import { describe, expect, it } from 'vitest';
import { NO_MARKS, type ChordMarks } from '../src/core/progress/chordMarks';
import { VOICINGS } from '../src/data/voicings';
import { BASIC_CHORDS, chordSuggestions, nextChordSuggestion } from '../src/modules/accords/learn';

const marksFor = (...chords: string[]): ChordMarks => ({ ...NO_MARKS, known: chords.map(c => VOICINGS.find(v => v.chord === c)!.id) });
const names = (marks: ChordMarks) => chordSuggestions(VOICINGS, marks).map(s => s.voicing.chord);

describe('découverte des accords', () => {
  it('commence par Em et propose les huit bases avant tout enrichissement', () => {
    expect(names(NO_MARKS)).toEqual(BASIC_CHORDS);
  });
  it('avec trois bases, privilégie les bases manquantes et exclut Cadd9 et les barrés', () => {
    const result = names(marksFor('Em', 'Am', 'C'));
    expect(result.slice(0, 5)).toEqual(expect.arrayContaining(['E', 'A', 'D', 'Dm', 'G']));
    expect(result).not.toContain('Cadd9');
    expect(result).not.toContain('F');
    expect(result).not.toContain('Bm');
    expect(result).toContain('Em7');
  });
  it('explique le petit pas de Em vers E', () => {
    const result = chordSuggestions(VOICINGS, marksFor('Em'));
    expect(result[0]?.voicing.chord).toBe('E');
    expect(result[0]?.reason).toContain('un doigt supplémentaire');
  });
  it('Cadd9 demande six bases distinctes et C', () => {
    expect(names(marksFor('Em', 'Am', 'E', 'A', 'D', 'Dm'))).not.toContain('Cadd9');
    expect(names(marksFor('Em', 'Am', 'E', 'A', 'D', 'C'))).toContain('Cadd9');
    const duplicate: ChordMarks = { ...marksFor('Em', 'Am', 'C', 'G', 'D'), known: [...marksFor('Em', 'Am', 'C', 'G', 'D').known, 'G-320033'] };
    expect(names(duplicate)).not.toContain('Cadd9');
  });
  it('ne repropose pas un symbole connu sous une autre forme', () => {
    const marks = { ...NO_MARKS, known: ['G-320033', 'Em7-022030'] };
    expect(names(marks)).not.toContain('G');
    expect(names(marks)).not.toContain('Em7');
  });
  it('respecte les exclusions et ne remplace pas le mini-barré par un barré complet', () => {
    const marks = { ...marksFor(...BASIC_CHORDS, 'Fmaj7'), noReview: ['F-xx3211'] };
    expect(names(marks)).not.toContain('F');
    expect(chordSuggestions(VOICINGS, { ...marks, noReview: [] }).find(s => s.voicing.chord === 'F')?.voicing.id).toBe('F-xx3211');
  });
  it('impose les marchepieds des barrés', () => {
    expect(names(marksFor(...BASIC_CHORDS))).not.toContain('Bm');
    expect(names(marksFor(...BASIC_CHORDS, 'Bm7'))).toContain('Bm');
  });
  it('ignore les identifiants inconnus et ne modifie pas les coches', () => {
    const marks = { ...NO_MARKS, known: ['inconnu'] };
    const before = JSON.stringify(marks);
    expect(names(marks)[0]).toBe('Em');
    expect(JSON.stringify(marks)).toBe(before);
  });
  it('termine proprement lorsque le catalogue est connu', () => {
    const all = { ...NO_MARKS, known: VOICINGS.map(v => v.id) };
    expect(names(all)).toEqual([]);
    expect(nextChordSuggestion([], [])).toBeNull();
  });
  it('change de proposition sans répétition immédiate et sans écrire dans les coches', () => {
    const suggestions = chordSuggestions(VOICINGS, NO_MARKS);
    const first = suggestions[0]!.voicing.id;
    expect(nextChordSuggestion(suggestions, [first])?.voicing.id).not.toBe(first);
    const seen = suggestions.map(s => s.voicing.id);
    expect(nextChordSuggestion(suggestions, seen)?.voicing.id).not.toBe(seen.at(-1));
    expect(nextChordSuggestion([suggestions[0]!], [first])?.voicing.id).toBe(first);
  });
});
