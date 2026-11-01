import { describe, expect, it } from 'vitest';
import { exerciseOrigin } from '../src/app/router';

describe('retour vers l’exercice depuis l’accordeur', () => {
  it('garde une page d’exercice', () => {
    expect(exerciseOrigin('review')).toBe('review');
    expect(exerciseOrigin('sequences')).toBe('sequences');
    expect(exerciseOrigin('impro')).toBe('impro');
  });
  it('ignore les autres pages et l’arrivée directe', () => {
    expect(exerciseOrigin('gammes')).toBeNull();
    expect(exerciseOrigin('accords')).toBeNull();
    expect(exerciseOrigin(null)).toBeNull();
  });
});
