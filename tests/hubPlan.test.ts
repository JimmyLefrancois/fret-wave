/**
 * Accueil : la seule action proposée vient du journal. Une révision due passe en premier, puis le
 * dernier module touché ; un journal vide propose de commencer.
 */
import { describe, expect, it } from 'vitest';
import { hubPlan } from '../src/app/hubPlan';
import { nextStreakMilestone } from '../src/modules/gammes/accomplishments';
import type { Attempt, Card } from '../src/core/progress';

const T0 = new Date(2026, 9, 20, 19, 0, 0).getTime();

function mk(ts: number, patch: Partial<Attempt> = {}): Attempt {
  return {
    id: `${ts}`, ts, kind: 'holes', scaleId: 'pentatonic-minor', tonic: 'A', tuningId: 'standard',
    system: 'boxes', positionId: 'p0', formIndex: 0, level: 2, strings: 6, correct: 3, total: 3,
    seconds: 42, fretMin: 5, missedStrings: [], tempoOk: false, ...patch,
  };
}

const card: Card = { nodeId: 'gam:x', box: 2, due: T0, lastTs: T0, lapses: 0, reps: 1, lastLevel: 2, lastScore: 1 };
const none = new Set<string>();

describe('hubPlan', () => {
  it('journal vide : commencer, sans révision', () => {
    expect(hubPlan([], [], none, 'Em-022000')).toEqual({ review: null, resume: { kind: 'start' } });
  });

  it('dernière tentative de gamme : reprendre la gamme', () => {
    expect(hubPlan([mk(T0)], [], none, null).resume).toEqual({ kind: 'scale' });
  });

  it('dernier module touché = accords : reprendre cet accord', () => {
    const j = [mk(T0), mk(T0 + 1000, { module: 'accords', chordId: 'Am-x02210' })];
    expect(hubPlan(j, [], none, 'Em-022000').resume).toEqual({ kind: 'chord', voicingId: 'Am-x02210' });
  });

  it("l'ordre vient de l'horodatage, pas de la position dans le journal", () => {
    const j = [mk(T0 + 5000), mk(T0, { module: 'accords', chordId: 'Am-x02210' })];
    expect(hubPlan(j, [], none, null).resume).toEqual({ kind: 'scale' });
  });

  it('accord déjà appris : on propose le suivant du parcours', () => {
    const j = [mk(T0, { module: 'accords', chordId: 'Em-022000' })];
    expect(hubPlan(j, [], new Set(['Em-022000']), 'E-022100').resume).toEqual({ kind: 'chord', voicingId: 'E-022100' });
  });

  it('parcours fini : on garde le dernier accord plutôt que d’inventer', () => {
    const j = [mk(T0, { module: 'accords', chordId: 'Em-022000' })];
    expect(hubPlan(j, [], new Set(['Em-022000']), null).resume).toEqual({ kind: 'chord', voicingId: 'Em-022000' });
  });

  it('une révision due passe devant, la reprise reste calculée', () => {
    const p = hubPlan([mk(T0)], [card, { ...card, nodeId: 'gam:y' }], none, null);
    expect(p.review).toEqual({ count: 2, first: card });
    expect(p.resume).toEqual({ kind: 'scale' });
  });
});

describe('nextStreakMilestone', () => {
  it('donne le palier strictement au-dessus, puis null après le dernier', () => {
    expect(nextStreakMilestone(0)).toBe(3);
    expect(nextStreakMilestone(3)).toBe(7);
    expect(nextStreakMilestone(13)).toBe(14);
    expect(nextStreakMilestone(30)).toBeNull();
  });
});
