import { describe, expect, it } from 'vitest';
import { coldNext, countsAsProof, lookRemaining, LOOK_SECONDS, DEFAULT_LOOK_SECONDS } from '../src/modules/gammes/coldReview';

describe('rappel à froid : enchaînement des écrans', () => {
  it('réussi à froid (≥ 80 %) : forme suivante, sans observation', () => {
    expect(coldNext('cold', { type: 'finished', accuracy: 0.8 })).toBe('next');
    expect(coldNext('cold', { type: 'finished', accuracy: 1 })).toBe('next');
  });

  it('manqué (< 80 %) : regarder la forme, puis rattrapage, puis suivante', () => {
    const look = coldNext('cold', { type: 'finished', accuracy: 0.79 });
    expect(look).toBe('look');
    const retry = coldNext(look, { type: 'lookOver' });
    expect(retry).toBe('retry');
    // le rattrapage se termine toujours sur la forme suivante, réussi ou non : on ne boucle pas
    expect(coldNext(retry, { type: 'finished', accuracy: 0.2 })).toBe('next');
    expect(coldNext(retry, { type: 'finished', accuracy: 1 })).toBe('next');
  });

  it('« Passer » mène à la forme suivante depuis n’importe quelle étape', () => {
    for (const s of ['cold', 'look', 'retry', 'next'] as const) expect(coldNext(s, { type: 'skip' })).toBe('next');
  });

  it('un événement hors de propos ne change rien', () => {
    expect(coldNext('cold', { type: 'lookOver' })).toBe('cold');
    expect(coldNext('look', { type: 'finished', accuracy: 1 })).toBe('look');
  });

  it('seul l’essai à froid vaut preuve', () => {
    expect(countsAsProof('cold')).toBe(true);
    expect(countsAsProof('retry')).toBe(false);
    expect(countsAsProof('look')).toBe(false);
  });

  it('compte à rebours : arrondi au supérieur, jamais négatif ; défaut 20 s', () => {
    expect(DEFAULT_LOOK_SECONDS).toBe(20);
    expect(LOOK_SECONDS).toEqual([10, 20, 30]);
    expect(lookRemaining(0, 0, 20)).toBe(20);
    expect(lookRemaining(0, 100, 20)).toBe(20);
    expect(lookRemaining(0, 19_500, 20)).toBe(1);
    expect(lookRemaining(0, 25_000, 20)).toBe(0);
  });
});
