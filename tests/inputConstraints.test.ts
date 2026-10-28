/**
 * Contraintes de `getUserMedia` : traitements du navigateur coupés, périphérique exact s'il est
 * mémorisé, et **jamais** `channelCount` (Firefox + interface stéréo → flux quasi muet).
 */
import { describe, expect, it } from 'vitest';
import { inputConstraints } from '../src/core/input/engine';

describe('inputConstraints', () => {
  it('coupe réduction de bruit, annulation d’écho et gain automatique', () => {
    const c = inputConstraints({ deviceId: null });
    expect(c.echoCancellation).toBe(false);
    expect(c.noiseSuppression).toBe(false);
    expect(c.autoGainControl).toBe(false);
  });

  it('ne demande pas de nombre de voies (le worklet mixe en mono)', () => {
    expect(inputConstraints({ deviceId: null })).not.toHaveProperty('channelCount');
    expect(inputConstraints({ deviceId: 'abc' })).not.toHaveProperty('channelCount');
  });

  it('exige le périphérique mémorisé, sinon laisse celui par défaut', () => {
    expect(inputConstraints({ deviceId: 'abc' }).deviceId).toEqual({ exact: 'abc' });
    expect(inputConstraints({ deviceId: null })).not.toHaveProperty('deviceId');
  });
});
