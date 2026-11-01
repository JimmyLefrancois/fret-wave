import { describe, expect, it } from 'vitest';
import {
  IN_TUNE_CENTS, TUNING_STORE_KEY, TUNING_STALE_DAYS, guideStatusOf, guideSteps, readTuningRecord, tuningFreshness, writeTuningRecord,
} from '../src/core/input/tuningGuide';
import { TUNINGS } from '../src/core/theory';
import type { KeyValueStore } from '../src/core/audio/mixer';

function fakeStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k]! : null),
    setItem: (k: string, v: string) => { data[k] = v; },
  } satisfies KeyValueStore & { data: Record<string, string> };
}

const std = TUNINGS.standard!;

describe('Accordage guidé — l’ordre des cordes', () => {
  it('commence par la plus grave et monte, un numéro par corde', () => {
    const steps = guideSteps(std, 440);
    expect(steps).toHaveLength(6);
    expect(steps.map((s) => s.number)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(steps.map((s) => s.string)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(steps[0]!.midi).toBe(40); // Mi grave, E2
    expect(steps[5]!.midi).toBe(64); // mi aigu, E4
    expect(steps[0]!.hz).toBeCloseTo(82.41, 1);
  });

  it('suit l’accordage choisi, pas une liste codée en dur', () => {
    const dropD = TUNINGS.dropD!;
    expect(guideSteps(dropD, 440)[0]!.midi).toBe(38); // Ré grave
    expect(guideSteps(TUNINGS.standard7!, 440)).toHaveLength(7);
    expect(guideSteps(TUNINGS.standard7!, 440)[0]!.midi).toBe(35); // Si grave d'une 7 cordes
  });
});

describe('Accordage guidé — « juste » veut dire juste', () => {
  const step = guideSteps(std, 440)[0]!; // Mi grave

  it('la tolérance est serrée (5 cents, pas 35)', () => {
    expect(IN_TUNE_CENTS).toBe(5);
    expect(guideStatusOf({ midi: step.midi, cents: 3 }, step).status).toBe('in-tune');
    expect(guideStatusOf({ midi: step.midi, cents: 12 }, step).status).toBe('high');
    expect(guideStatusOf({ midi: step.midi, cents: -40 }, step).status).toBe('low');
  });

  it('une autre corde n’est pas « un peu faux », c’est une autre note', () => {
    expect(guideStatusOf({ midi: step.midi + 5, cents: 0 }, step).status).toBe('far');
    expect(guideStatusOf(null, step).status).toBe('silent');
  });
});

describe('Accordage guidé — le souvenir du dernier accordage', () => {
  it('écrit et relit un accordage complet', () => {
    const store = fakeStore();
    writeTuningRecord(store, { at: 1_700_000_000_000, tuningId: 'standard', strings: 6 });
    const rec = readTuningRecord(store)!;
    expect(rec.strings).toBe(6);
    expect(store.data[TUNING_STORE_KEY]).toBeTruthy();
  });

  it('une valeur illisible n’est jamais une date inventée', () => {
    expect(readTuningRecord(fakeStore({ [TUNING_STORE_KEY]: '{oops' }))).toBeNull();
    expect(readTuningRecord(fakeStore({ [TUNING_STORE_KEY]: '{"at":"hier"}' }))).toBeNull();
    expect(readTuningRecord(null)).toBeNull();
  });

  it('dit l’âge en jours, et prévient au-delà de trois jours', () => {
    const now = new Date(2026, 9, 27, 18, 0);
    const at = (daysAgo: number) => new Date(2026, 9, 27 - daysAgo, 9, 0).getTime();
    expect(tuningFreshness(null, now)).toMatchObject({ days: null, stale: true });
    expect(tuningFreshness({ at: at(0), tuningId: 'standard', strings: 6 }, now).text).toBe('Dernier accordage : aujourd’hui');
    expect(tuningFreshness({ at: at(1), tuningId: 'standard', strings: 6 }, now).text).toBe('Dernier accordage : hier');
    const four = tuningFreshness({ at: at(4), tuningId: 'standard', strings: 6 }, now);
    expect(four.days).toBe(4);
    expect(four.stale).toBe(true);
    expect(four.text).toContain('4 jours');
    // trois jours : encore frais (le seuil est « plus de trois jours »)
    expect(tuningFreshness({ at: at(TUNING_STALE_DAYS), tuningId: 'standard', strings: 6 }, now).stale).toBe(false);
  });
});
