import { describe, expect, it } from 'vitest';
import { getScale } from '../src/core/theory';
import { degreeNotes } from '../src/modules/gammes/resolve';

describe('degreeNotes', () => {
  it('associe chaque degré à sa note sur la tonique', () => {
    const rows = degreeNotes(getScale('pentatonic-minor'), 'A', 'fr');
    expect(rows.map((r) => r.item.fn)).toEqual(['1', '♭3', '4', '5', '♭7']);
    expect(rows.map((r) => r.note)).toEqual(['La', 'Do', 'Ré', 'Mi', 'Sol']);
  });

  it('suit la notation choisie et l’orthographe de la tonalité', () => {
    const rows = degreeNotes(getScale('ionian'), 'F', 'en');
    expect(rows.map((r) => r.note)).toEqual(['F', 'G', 'A', 'B♭', 'C', 'D', 'E']);
  });
});
