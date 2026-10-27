import { describe, expect, it } from 'vitest';
import {
  COLD_LADDER, coldAttemptPayload, coldChecks, coldLimit, coldLimitFor, coldPassesOf, coldRequirement,
  coldSeconds, coldVerdict, newColdRun, noteSounded, startCold, tickCold,
} from '../src/modules/accords/fixer';
import { checkSummary, newCheck } from '../src/modules/accords/lesson';
import { coldChecks as _coldChecks } from '../src/modules/accords/fixer';
import { voicingById } from '../src/data/voicings';
import type { Attempt } from '../src/core/progress';

const Em = voicingById('Em-022000')!;

function coldAttempt(patch: Partial<Attempt> = {}): Attempt {
  return {
    id: 'c1', ts: 1_700_000_000_000, kind: 'cold', scaleId: '', tonic: '', tuningId: 'standard', system: 'accord',
    positionId: 'Em-022000', formIndex: 0, level: 1, strings: 6, correct: 6, total: 6, seconds: 4,
    fretMin: 0, missedStrings: [], tempoOk: false, module: 'accords', chordId: 'Em-022000', limitSec: 8,
    ...patch,
  };
}

describe('Fixer — temps accordé et resserrement', () => {
  it('le palier donne le plafond : 8 s au début, 5 s à P3, 3 s ensuite', () => {
    expect(coldLimitFor('P1')).toBe(8);
    expect(coldLimitFor('P2')).toBe(8);
    expect(coldLimitFor('P2b')).toBe(8);
    expect(coldLimitFor('P3')).toBe(5);
    expect(coldLimitFor('P4')).toBe(5);
    expect(coldLimitFor('P5')).toBe(3);
    expect(coldLimitFor(null)).toBe(3);
  });

  it('chaque pose à froid réussie resserre d’un cran, sans jamais descendre sous 3 s', () => {
    expect(coldLimit({ palierId: 'P1', passes: 0 })).toBe(8);
    expect(coldLimit({ palierId: 'P1', passes: 1 })).toBe(5);
    expect(coldLimit({ palierId: 'P1', passes: 2 })).toBe(3);
    expect(coldLimit({ palierId: 'P1', passes: 9 })).toBe(3);
    // un accord de P5 démarre déjà à 3 s : le palier ne se relâche jamais
    expect(coldLimit({ palierId: 'P5', passes: 0 })).toBe(3);
    expect(COLD_LADDER).toEqual([8, 5, 3]);
  });

  it('compte les poses réussies d’un accord, et seulement elles', () => {
    const ok = coldAttempt();
    const slow = coldAttempt({ seconds: 12 });
    const sloppy = coldAttempt({ correct: 3 });
    const other = coldAttempt({ chordId: 'Am-x02210' });
    expect(coldPassesOf([ok], 'Em-022000')).toBe(1);
    expect(coldPassesOf([slow, sloppy, other], 'Em-022000')).toBe(0);
  });
});

describe('Fixer — le chrono s’arrête à la première corde juste', () => {
  it('départ, première note, temps mesuré au dixième', () => {
    let run = startCold(8, 1000);
    expect(run.phase).toBe('running');
    expect(coldSeconds(run)).toBeNull();
    run = noteSounded(run, 4250);
    expect(coldSeconds(run)).toBe(3.3);
    // une deuxième corde juste ne déplace pas le chrono
    run = noteSounded(run, 6000);
    expect(coldSeconds(run)).toBe(3.3);
  });

  it('le temps écoulé est constaté par tickCold, une seule fois', () => {
    const run = startCold(5, 0);
    expect(tickCold(run, 4000).expired).toBe(false);
    const late = tickCold(run, 5200);
    expect(late.expired).toBe(true);
    // une corde juste arrivée trop tard ne redémarre pas le chrono
    expect(noteSounded(late, 5300).firstNoteAt).toBeNull();
    expect(coldSeconds(late)).toBe(5.1);
  });

  it('jamais démarré : aucune mesure (et pas zéro seconde)', () => {
    expect(coldSeconds(newColdRun(8))).toBeNull();
  });
});

describe('Fixer — le verdict exige le temps ET la propreté', () => {
  const allOk = (() => {
    const state = { index: 6, outcomes: {}, tries: {}, cents: {} } as ReturnType<typeof newCheck>;
    for (const c of coldChecks(Em)) state.outcomes[c.key] = 'ok';
    return checkSummary(state, coldChecks(Em));
  })();

  it('propre et dans le temps : la pose compte', () => {
    const v = coldVerdict({ seconds: 4.2, summary: allOk, limitSec: 8 });
    expect(v.passed).toBe(true);
    expect(v.status).toBe('clean');
    expect(v.headline).toContain('4,2 s');
  });

  it('propre mais lente : la main sait, le réflexe non', () => {
    const v = coldVerdict({ seconds: 9.5, summary: allOk, limitSec: 8 });
    expect(v.passed).toBe(false);
    expect(v.status).toBe('slow');
  });

  it('rapide mais sale : ce n’est pas une pose', () => {
    const half = { ...allOk, ok: 3, accuracy: 0.5, clean: false };
    const v = coldVerdict({ seconds: 2, summary: half, limitSec: 8 });
    expect(v.passed).toBe(false);
    expect(v.status).toBe('sloppy');
  });

  it('aucune corde dans le temps : rien n’est mesuré', () => {
    const v = coldVerdict({ seconds: null, summary: allOk, limitSec: 8 });
    expect(v.passed).toBe(false);
    expect(v.status).toBe('missed');
  });

  it('le journal reçoit la limite et le temps, arrondis au supérieur (jamais flatteur)', () => {
    const payload = coldAttemptPayload({ summary: allOk, seconds: 4.44, limitSec: 7.6 });
    expect(payload.seconds).toBe(5); // 4,44 s ne doit pas s'écrire 4 s
    expect(payload.limitSec).toBe(8);
    expect(payload.correct).toBe(6);
    expect(payload.total).toBe(6);
  });

  it('dit ce qui manque, en une phrase utilisable', () => {
    expect(coldRequirement({ successes: 3, coldPasses: 1 })).toContain('Toutes les preuves');
    expect(coldRequirement({ successes: 2, coldPasses: 0 })).toBe('Il manque 1 vérification propre et 1 pose à froid.');
    expect(coldRequirement({ successes: 1, coldPasses: 1 })).toBe('Il manque 2 vérifications propres.');
  });

  it('les cordes attendues sont celles de la forme, grave d’abord', () => {
    const checks = _coldChecks(Em);
    expect(checks).toHaveLength(6);
    expect(checks[0]!.string).toBe(0);
    expect(checks.every((c) => c.midi > 0)).toBe(true);
  });
});
