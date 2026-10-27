import { describe, expect, it } from 'vitest';
import { voicingById } from '../src/data/voicings';
import {
  MAX_TRIES, adviceFor, applyVerdict, arpeggioCheck, attemptFromCheck, checkSummary, isDeadNote, judgeString,
  mutedAdvice, newCheck, type ArpeggioCheck, type CheckState,
} from '../src/modules/accords/lesson';
import type { Voicing } from '../src/core/theory/voicings';

function v(id: string): Voicing {
  const found = voicingById(id);
  if (!found) throw new Error(`voicing absent : ${id}`);
  return found;
}

const opts = { centsTolerance: 35 };

function check(vId: string, index = 0): ArpeggioCheck {
  return arpeggioCheck(v(vId))[index]!;
}

describe('mode arpège — ce qui est demandé, corde par corde', () => {
  it('les cordes sont demandées de la plus grave à la plus aiguë', () => {
    const checks = arpeggioCheck(v('Em-022000'));
    expect(checks.map((c) => c.string)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(checks.map((c) => c.fret)).toEqual([0, 2, 2, 0, 0, 0]);
    // fonctions d'intervalle par rapport à la fondamentale Mi
    // Mi mineur : 1 b3 5 — la tierce est bien mineure (corde de Sol, case 0)
    expect(checks.map((c) => c.fn)).toEqual(['1', '5', '1', 'b3', '5', '1']);
  });

  it('une corde étouffée n’est jamais demandée', () => {
    const checks = arpeggioCheck(v('Am-x02210'));
    expect(checks.map((c) => c.string)).toEqual([1, 2, 3, 4, 5]);
    expect(checks.every((c) => c.fret >= 0)).toBe(true);
    expect(arpeggioCheck(v('E5-022xxx'))).toHaveLength(3);
  });

  it('la hauteur attendue vient de l’accordage (E2 = 40, pas une constante inventée)', () => {
    const first = check('Em-022000', 0);
    expect(first.midi).toBe(40);
    expect(first.key).toBe('0:0');
    expect(check('Em-022000', 1).midi).toBe(47); // Si2
  });
});

describe('verdict par corde', () => {
  const e2 = check('Em-022000', 0);

  it('une note dans la tolérance valide la corde', () => {
    const r = judgeString(40.0, e2, opts);
    expect(r.kind).toBe('fill');
    if (r.kind === 'fill') expect(r.inTune).toBe(true);
  });

  it('juste mais à 20 cents : rempli, signalé comme pas parfaitement juste', () => {
    const r = judgeString(40.2, e2, opts);
    expect(r.kind).toBe('fill');
    if (r.kind === 'fill') {
      expect(r.cents).toBeCloseTo(20, 6);
      expect(r.inTune).toBe(false);
    }
  });

  it('à 45 cents, c’est l’accord de l’instrument, pas la mémoire de l’élève', () => {
    expect(judgeString(40.45, e2, opts).kind).toBe('tuning');
  });

  it('une octave d’écart n’est pas une faute', () => {
    const r = judgeString(52.0, e2, opts);
    expect(r.kind).toBe('octave');
  });

  it('un demi-ton d’écart est une mauvaise note ; six demi-tons, une autre corde', () => {
    expect(judgeString(41.0, e2, opts).kind).toBe('wrong');
    expect(judgeString(46.0, e2, opts).kind).toBe('outside');
  });
});

describe('progression de la vérification', () => {
  const checks = arpeggioCheck(v('Em-022000'));

  it('une corde juste avance, une corde désaccordée non', () => {
    const r1 = applyVerdict(newCheck(), checks[0]!, { kind: 'fill', cents: 3, inTune: true });
    expect(r1.advanced).toBe(true);
    expect(r1.state.index).toBe(1);
    expect(r1.state.outcomes[checks[0]!.key]).toBe('ok');

    const r2 = applyVerdict(r1.state, checks[1]!, { kind: 'tuning', cents: 40 });
    expect(r2.advanced).toBe(false);
    expect(r2.state.index).toBe(1);
    expect(r2.state.outcomes[checks[1]!.key]).toBeUndefined();
  });

  it('trois essais ratés révèlent la note et passent à la corde suivante', () => {
    let state = newCheck();
    const c = checks[1]!;
    for (let i = 0; i < MAX_TRIES - 1; i++) {
      const r = applyVerdict(state, c, { kind: 'wrong', deltaSemitones: 1, cents: 100 });
      expect(r.advanced).toBe(false);
      state = r.state;
    }
    const last = applyVerdict(state, c, { kind: 'wrong', deltaSemitones: 1, cents: 100 });
    expect(last.advanced).toBe(true);
    expect(last.message).toContain('révélée');
    expect(last.state.outcomes[c.key]).toBe('wrong');
  });

  it('le bilan compte les cordes justes, les cordes ratées et les cordes à retravailler', () => {
    const state: CheckState = {
      index: checks.length,
      outcomes: Object.fromEntries(checks.map((c) => [c.key, c.string === 3 ? 'wrong' : 'ok'])),
      tries: {},
      cents: {},
    };
    const s = checkSummary(state, checks);
    expect(s.total).toBe(6);
    expect(s.ok).toBe(5);
    expect(s.wrong).toBe(1);
    expect(s.done).toBe(true);
    expect(s.clean).toBe(false);
    expect(s.missedStrings).toEqual([3]);
    expect(s.accuracy).toBeCloseTo(5 / 6, 6);

    const a = attemptFromCheck(s, 42.4);
    expect(a).toEqual({ correct: 5, total: 6, missedStrings: [3], seconds: 42 });
  });
});

describe('diagnostic de note morte (P2 de la phase 3)', () => {
  const e2 = check('Em-022000', 0);
  const ctx = (cents: number, rmsDb: number) => ({ cents, rmsDb, thresholdDb: -42 });

  it('15 à 40 cents bas ET faible : doigt mal placé, pas guitare désaccordée', () => {
    expect(isDeadNote(ctx(-25, -52))).toBe(true);
    expect(isDeadNote(ctx(-15, -52))).toBe(true);
    expect(isDeadNote(ctx(-40, -50))).toBe(true);
  });

  it('une note pleine mais basse reste un problème d’accord', () => {
    expect(isDeadNote(ctx(-25, -20))).toBe(false);
  });

  it('une corde à vide ne reçoit jamais un conseil de frette', () => {
    // Mi grave à vide : « appuie derrière la frette 0 » n'a aucun sens (défaut vu sur une capture)
    expect(adviceFor({ kind: 'fill', cents: -25, inTune: true }, e2, ctx(-25, -52))).toBeNull();
    const wrong = adviceFor({ kind: 'wrong', deltaSemitones: 1, cents: 100 }, e2, ctx(100, -20));
    expect(wrong?.text).toContain('à vide');
    expect(wrong?.text).not.toContain('case 0');
  });

  it('le conseil parle la langue de l’élève quand l’écran la fournit', () => {
    const advice = adviceFor({ kind: 'wrong', deltaSemitones: 1, cents: 100 }, check('Em-022000', 1), ctx(100, -20), { stringLabel: 'La' });
    expect(advice?.text).toContain('corde de La');
    expect(advice?.text).toContain('case 2');
    expect(advice?.text).not.toContain('A2');
    expect(mutedAdvice(check('Em-022000', 1), { stringLabel: 'La' }).text).toContain('corde de La');
  });

  it('le conseil dit la cause et l’action, et ne renvoie pas vers l’accordeur', () => {
    // corde frettée (La, case 2) : c'est là qu'un doigt peut être trop loin de la frette
    const fretted = check('Em-022000', 1);
    const dead = adviceFor({ kind: 'fill', cents: -25, inTune: true }, fretted, ctx(-25, -52));
    expect(dead?.code).toBe('dead');
    expect(dead?.text).toContain('frette 2');
    expect(dead?.text).not.toContain('accorde');

    const tuning = adviceFor({ kind: 'tuning', cents: -25 }, fretted, ctx(-25, -20));
    expect(tuning?.code).toBe('tune');
    expect(tuning?.text).toContain('accordeur');

    // exactement juste : aucun conseil (on ne parle pas pour ne rien dire)
    expect(adviceFor({ kind: 'fill', cents: 2, inTune: true }, e2, ctx(2, -20))).toBeNull();
  });
});
