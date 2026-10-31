import { describe, expect, it } from 'vitest';
import { resumedStart } from '../src/modules/gammes/exercise';

describe('reprise du chrono après une pause', () => {
  it('ne compte pas la pause', () => {
    const start = resumedStart(1000, 5000, 9000);
    expect(9000 - start).toBe(5000 - 1000);
  });
  it('ne recule pas si l’horloge revient en arrière', () => {
    expect(resumedStart(1000, 5000, 4000)).toBe(1000);
  });
});
