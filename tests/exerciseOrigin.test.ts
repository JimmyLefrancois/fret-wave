import { describe, expect, it } from 'vitest';
import { exerciseOrigin } from '../src/app/router';

describe('retour vers l’exercice depuis l’accordeur', () => {
  it('garde une page d’exercice', () => {
    expect(exerciseOrigin('training')).toBe('training');
    expect(exerciseOrigin('chord')).toBe('chord');
  });
  it('ignore les autres pages et l’arrivée directe', () => {
    expect(exerciseOrigin('hub')).toBeNull();
    expect(exerciseOrigin(null)).toBeNull();
  });
});
