import { describe, expect, it } from 'vitest';
import { TUNINGS, generatePositions, type Position } from '../src/core/theory';
import { describeScore, positionToScore, type TabScore } from '../src/core/tab';

const [box1] = generatePositions('pentatonic-minor', 'A', TUNINGS.standard!, 'boxes', {}) as [Position];

describe('nom accessible de la tablature', () => {
  it('ne lit pas les notes des emplacements vides (sinon la réponse fuit au lecteur d’écran)', () => {
    const score = positionToScore(box1, TUNINGS.standard!);
    const full = describeScore(score, 'en');
    expect(full).not.toContain('?');
    expect(full).not.toContain('à compléter');

    let first = '';
    const holed: TabScore = {
      ...score,
      measures: score.measures.map((m, mi) => ({
        ...m,
        events: m.events.map((e, ei) => ({
          ...e,
          notes: e.notes.map((n) => {
            if (mi === 0 && ei === 0) { first = n.note; return { ...n, hidden: true }; }
            return n;
          }),
        })),
      })),
    };
    const text = describeScore(holed, 'en');
    expect(text).toContain('1 emplacement à compléter');
    expect(text.split('Notes : ')[1]!.split(' ')[0]).toBe('?');
    expect(first).not.toBe('');
  });
});
