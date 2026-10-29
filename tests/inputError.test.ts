import { describe, expect, it } from 'vitest';
import { describeInputError, stateFromMediaError } from '../src/core/input/engine';

describe('erreurs du micro', () => {
  it('le détail technique du navigateur ne sert jamais de titre', () => {
    const t = describeInputError('failed', 'Not supported');
    expect(t.message).toBe('le micro n’a pas pu s’ouvrir');
    expect(t.message).not.toContain('Not supported');
    expect(t.hint).toContain('(navigateur : Not supported)');
    expect(describeInputError('failed', null).hint).not.toContain('navigateur :');
  });

  it('nom d’erreur getUserMedia → état', () => {
    expect(stateFromMediaError('NotAllowedError')).toBe('denied');
    expect(stateFromMediaError('NotSupportedError')).toBe('unavailable');
    expect(stateFromMediaError('NotFoundError')).toBe('unavailable');
    expect(stateFromMediaError('NotReadableError')).toBe('busy');
    expect(stateFromMediaError('TypeError')).toBe('failed');
  });
});
