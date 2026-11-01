import { describe, expect, it } from 'vitest';
import { ACTIVE_ROUTE, parseRoute, ROUTE_HREF } from '../src/app/router';

describe('routes des accords', () => {
  it('le dictionnaire a sa propre page', () => {
    expect(ROUTE_HREF.dictionary).toBe('#/accords/dictionnaire');
    expect(parseRoute('#/accords/dictionnaire')).toBe('dictionary');
    expect(parseRoute('#/accords')).toBe('accords');
  });
  it('le dictionnaire reste sous l’onglet Accords', () => {
    expect(ACTIVE_ROUTE.dictionary).toBe('accords');
  });
});
