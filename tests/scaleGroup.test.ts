import { describe, expect, it } from 'vitest';
import { scaleGroupOf } from '../src/modules/gammes/resolve';
import { loadScaleSelection } from '../src/app/scaleSession';

describe('famille affichée dans le choix des gammes', () => {
  it('garde la famille choisie quand la gamme y figure (pentatonique mineure dans « Mineures »)', () => {
    expect(scaleGroupOf('pentatonic-minor', 'minor').id).toBe('minor');
    expect(scaleGroupOf('blues-minor', 'minor').id).toBe('minor');
  });

  it('sinon, la première famille qui contient la gamme', () => {
    expect(scaleGroupOf('pentatonic-minor').id).toBe('pent');
    expect(scaleGroupOf('dorian', 'minor').id).toBe('diatonic');
    expect(scaleGroupOf('pentatonic-minor', 'inconnue').id).toBe('pent');
  });

  it('la famille est relue du stockage, ignorée si elle est invalide', () => {
    const store = (v: object) => ({ getItem: () => JSON.stringify(v), setItem: () => {} });
    expect(loadScaleSelection(store({ scaleId: 'aeolian', groupId: 'minor' })).groupId).toBe('minor');
    expect(loadScaleSelection(store({ scaleId: 'aeolian', groupId: 3 })).groupId).toBeUndefined();
  });
});
