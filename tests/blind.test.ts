import { describe, expect, it } from 'vitest';
import { blindGrid, countInBeat, scoreBlind, type HeardNote } from '../src/modules/gammes/blind';
import { insideGrid } from '../src/modules/gammes/exercise';
import type { Target } from '../src/core/input/match';

// La mineure pentatonique, box 1, deux cordes graves : La2 Do3 | Ré3 Mi3 (cases 5-8)
const T: Target[] = [
  { key: '0:0', columnIndex: 0, string: 0, fret: 5, midi: 45, note: 'A', fn: '1' },
  { key: '1:0', columnIndex: 1, string: 0, fret: 8, midi: 48, note: 'C', fn: 'b3' },
  { key: '2:1', columnIndex: 2, string: 1, fret: 5, midi: 50, note: 'D', fn: '4' },
  { key: '3:1', columnIndex: 3, string: 1, fret: 7, midi: 52, note: 'E', fn: '5' },
];
const OPTS = { centsTolerance: 35 };
const play = (...midis: number[]): HeardNote[] => midis.map((midi, i) => ({ midi, t: 0.5 * i }));

describe('série à l’aveugle : notation', () => {
  it('parfaite : toutes justes, dernière attaque retenue', () => {
    const s = scoreBlind(T, play(45, 48, 50, 52), OPTS);
    expect(s.correct).toBe(4);
    expect(s.consumed).toBe(4);
    expect(s.missedStrings).toEqual([]);
    expect(s.lastAttack).toBe(1.5);
  });

  it('une fausse (un demi-ton à côté) : comptée fausse, on avance', () => {
    const s = scoreBlind(T, play(45, 49, 50, 52), OPTS);
    expect(s.marks['1:0']).toBe('wrong');
    expect(s.correct).toBe(3);
    expect(s.missedStrings).toEqual([0]);
  });

  it('octave d’écart (détecteur sur corde grave) : tolérée', () => {
    const s = scoreBlind(T, play(57, 48, 50, 52), OPTS);
    expect(s.marks['0:0']).toBe('right');
    expect(s.correct).toBe(4);
  });

  it('note très loin (bruit, corde à vide) : ignorée, sans erreur', () => {
    const s = scoreBlind(T, [{ midi: 64, t: 0 }, ...play(45, 48, 50, 52).map((h) => ({ ...h, t: h.t + 0.2 }))], OPTS);
    expect(s.correct).toBe(4);
  });

  it('une note oubliée : manquée, la suivante juste', () => {
    const s = scoreBlind(T, play(45, 50, 52), OPTS);
    expect(s.marks['1:0']).toBe('missed');
    expect(s.marks['2:1']).toBe('right');
    expect(s.correct).toBe(3);
    expect(s.missedStrings).toEqual([0]);
  });

  it('un rebond du détecteur sur la même note n’est pas une seconde note', () => {
    const s = scoreBlind(T, [{ midi: 45, t: 0 }, { midi: 45.1, t: 0.15 }, { midi: 48, t: 0.5 }], OPTS);
    expect(s.consumed).toBe(2);
    expect(s.correct).toBe(2);
  });

  it('« Terminer » avant la fin : les notes restantes sont manquées', () => {
    const open = scoreBlind(T, play(45, 48), OPTS);
    expect(open.consumed).toBe(2);
    const done = scoreBlind(T, play(45, 48), { ...OPTS, finished: true });
    expect(done.consumed).toBe(4);
    expect(done.marks['3:1']).toBe('missed');
    expect(done.correct).toBe(2);
    expect(done.missedStrings).toEqual([1]);
  });

  it('grille : décompte d’une mesure, puis la série juge le tempo', () => {
    const g = blindGrid(4, 60, 1);
    expect(g.countIn).toBe(4);
    expect(g.score.measures.length).toBe(1 + g.grid.score.measures.length);
    expect(countInBeat(0, g)).toBe(4);
    expect(countInBeat(3.5, g)).toBe(1);
    expect(countInBeat(4, g)).toBeNull();
    const fast = scoreBlind(T, play(45, 48, 50, 52), OPTS);
    expect(insideGrid(fast.lastAttack!, g.grid)).toBe(true);
    const slow = scoreBlind(T, [45, 48, 50, 52].map((midi, i) => ({ midi, t: 2 * i })), OPTS);
    expect(insideGrid(slow.lastAttack!, g.grid)).toBe(false);
  });
});
