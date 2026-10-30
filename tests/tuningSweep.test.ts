import { describe, expect, it } from 'vitest';
import { GUIDE_HOLD_MS, IN_TUNE_CENTS, newSweep, sweepTick } from '../src/core/input/tuningGuide';

describe('sweepTick', () => {
  it('valide une corde tenue juste, une seule fois', () => {
    let s = sweepTick(newSweep(), { string: 2, cents: 1 }, 0);
    expect(s.done).toEqual([]);
    s = sweepTick(s, { string: 2, cents: -1 }, GUIDE_HOLD_MS);
    s = sweepTick(s, { string: 2, cents: 0 }, GUIDE_HOLD_MS + 100);
    expect(s.done).toEqual([2]);
  });

  it('accepte n’importe quel ordre', () => {
    let s = newSweep();
    for (const [i, string] of [5, 0].entries()) {
      s = sweepTick(s, { string, cents: 0 }, i * 10000);
      s = sweepTick(s, { string, cents: 0 }, i * 10000 + GUIDE_HOLD_MS);
    }
    expect(s.done).toEqual([5, 0]);
  });

  it('repart de zéro si la note sort de la tolérance ou s’arrête', () => {
    let s = sweepTick(newSweep(), { string: 1, cents: 0 }, 0);
    s = sweepTick(s, { string: 1, cents: IN_TUNE_CENTS + 1 }, 10);
    s = sweepTick(s, { string: 1, cents: 0 }, 20);
    s = sweepTick(s, { string: 1, cents: 0 }, GUIDE_HOLD_MS);
    expect(s.done).toEqual([]);
    expect(sweepTick(s, null, GUIDE_HOLD_MS + 50).string).toBeNull();
  });
});
