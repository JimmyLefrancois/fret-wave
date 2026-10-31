import { describe, expect, it } from 'vitest';
import { canAutoOpenMic } from '../src/core/input/autoOpen';

describe('ouverture automatique du micro', () => {
  it('s’ouvre seul avec l’autorisation et un geste antérieur', () => {
    expect(canAutoOpenMic('granted', true)).toBe(true);
  });

  it('laisse le bouton sans geste antérieur (rechargement, arrivée directe)', () => {
    expect(canAutoOpenMic('granted', false)).toBe(false);
  });

  it('laisse le bouton sans autorisation acquise', () => {
    expect(canAutoOpenMic('prompt', true)).toBe(false);
    expect(canAutoOpenMic('denied', true)).toBe(false);
  });
});
