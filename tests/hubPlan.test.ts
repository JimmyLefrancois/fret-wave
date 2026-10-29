/**
 * Accueil : la seule action proposée vient du journal. Une révision due passe en premier, puis le
 * dernier module touché ; un journal vide propose de commencer.
 */
import { describe, expect, it } from 'vitest';
import { dailyActivity, dayGoalText, heroAction, heroSteps, hubPlan, learnedScaleForms, regressedScaleForms, isHeroShortcut, tuneStepDone, micHeardBefore, reviewSummary, scaleStep } from '../src/app/hubPlan';
import { nextStreakMilestone } from '../src/modules/gammes/accomplishments';
import { dueNow, summarizeDay, type Attempt, type Card } from '../src/core/progress';

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

  it('accord inconnu des données : on propose le suivant du parcours, sinon la gamme', () => {
    const j = [mk(T0, { module: 'accords', chordId: 'Zz-999999' })];
    const known = (id: string) => id !== 'Zz-999999';
    expect(hubPlan(j, [], none, 'Em-022000', known).resume).toEqual({ kind: 'chord', voicingId: 'Em-022000' });
    expect(hubPlan(j, [], none, null, known).resume).toEqual({ kind: 'scale' });
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

describe('micHeardBefore', () => {
  it('une écoute, un QCM ou un grattage déclaré ne prouvent pas que le micro marche', () => {
    expect(micHeardBefore([])).toBe(false);
    expect(micHeardBefore([mk(T0, { kind: 'listen', correct: null, total: null })])).toBe(false);
    expect(micHeardBefore([mk(T0, { kind: 'qcm', module: 'accords', chordId: 'Em-022000' })])).toBe(false);
    expect(micHeardBefore([mk(T0, { kind: 'strum', module: 'accords', chordId: 'Em-022000' })])).toBe(false);
  });

  it('une série vérifiée au micro suffit', () => {
    expect(micHeardBefore([mk(T0)])).toBe(true);
  });
});


describe('scaleStep', () => {
  it('gamme jamais touchée : écouter d’abord', () => {
    expect(scaleStep([], 'pentatonic-minor', 'A')).toBe('listen');
  });

  it('après une écoute seule, l’étape suivante est de jouer au micro', () => {
    const j = [mk(T0, { kind: 'listen', correct: null, total: null })];
    expect(scaleStep(j, 'pentatonic-minor', 'A')).toBe('play');
  });

  it('une autre tonique ou une autre gamme repart de l’écoute', () => {
    const j = [mk(T0, { kind: 'listen', correct: null, total: null })];
    expect(scaleStep(j, 'pentatonic-minor', 'E')).toBe('listen');
    expect(scaleStep(j, 'major', 'A')).toBe('listen');
  });

  it('un accord sur la même tonique ne compte pas comme une écoute de la gamme', () => {
    const j = [mk(T0, { module: 'accords', chordId: 'Am-x02210', scaleId: 'pentatonic-minor' })];
    expect(scaleStep(j, 'pentatonic-minor', 'A')).toBe('listen');
  });
});

describe('reviewSummary', () => {
  it('dit l’exercice (en mots d’élève, sans code N2) et le score du dernier passage', () => {
    expect(reviewSummary({ lastLevel: 2, lastScore: 0.85 })).toBe('Dernier passage : exercice à trous, 85\u00a0%');
    expect(reviewSummary({ lastLevel: 3, lastScore: 1 })).toBe('Dernier passage : de mémoire, 100\u00a0%');
  });
});

describe('dailyActivity', () => {
  it('ne compte que les exercices vérifiés : ni une écoute, ni un grattage déclaré', () => {
    const j = [
      mk(T0, { kind: 'listen', correct: null, total: null }),
      mk(T0 + 1000),
      mk(T0 + 2000, { module: 'accords', kind: 'strum', chordId: 'Em-022000', correct: null, total: null }),
    ];
    const day = summarizeDay(j, new Date(T0 + 3000));
    expect(day.selfAssessed).toBe(1);
    expect(day.listens).toBe(1);
    expect(dailyActivity(day)).toBe(1);
  });
});

describe('isHeroShortcut', () => {
  const body = { tagName: 'BODY' };
  it('Espace et Entrée sur la page lancent le héros', () => {
    expect(isHeroShortcut({ key: ' ' }, body)).toBe(true);
    expect(isHeroShortcut({ key: 'Enter' }, body)).toBe(true);
    expect(isHeroShortcut({ key: 'Enter' }, null)).toBe(true);
  });

  it('un contrôle focalisé garde son propre geste', () => {
    for (const tagName of ['BUTTON', 'A', 'INPUT', 'SUMMARY', 'select']) {
      expect(isHeroShortcut({ key: ' ' }, { tagName })).toBe(false);
    }
    expect(isHeroShortcut({ key: ' ' }, { tagName: 'DIV', isContentEditable: true })).toBe(false);
  });

  it('autres touches, répétition et modificateurs ne déclenchent rien', () => {
    expect(isHeroShortcut({ key: 'a' }, body)).toBe(false);
    expect(isHeroShortcut({ key: ' ', repeat: true }, body)).toBe(false);
    expect(isHeroShortcut({ key: 'Enter', ctrlKey: true }, body)).toBe(false);
    expect(isHeroShortcut({ key: ' ', shiftKey: true }, body)).toBe(false);
  });
});

describe('étapes du premier pas', () => {
  it('« Accorder » n’est franchie que sur un fait observé', () => {
    expect(tuneStepDone('granted', false)).toBe(true);
    expect(tuneStepDone(null, true)).toBe(true);
    expect(tuneStepDone('prompt', false)).toBe(false);
    expect(tuneStepDone('denied', false)).toBe(false);
    expect(tuneStepDone(null, false)).toBe(false);
  });

  it('le primaire porte l’étape en cours : accorder d’abord, puis la suivante', () => {
    expect(heroSteps('listen', false).current).toBe('tune');
    expect(heroSteps('listen', true).current).toBe('listen');
    expect(heroSteps('play', true)).toEqual({
      steps: [{ id: 'tune', done: true }, { id: 'play', done: false }],
      current: 'play',
    });
  });
});

describe('learnedScaleForms', () => {
  const DAY = 86_400_000;
  it('une forme compte une fois apprise (2 réussites sur 2 jours, dont une forte), pas avant', () => {
    // réussite forte : la position entière, de mémoire
    const strong = (ts: number, id: string) => ({ ...mk(ts, { level: 3, kind: 'recall', strings: 6 }), id });
    expect(learnedScaleForms([])).toBe(0);
    expect(learnedScaleForms([mk(T0)])).toBe(0);
    // deux réussites sur deux jours, mais sur un segment de trous : plus assez depuis le lot « mémoire et vitesse »
    expect(learnedScaleForms([mk(T0), { ...mk(T0 + DAY), id: 'b' }])).toBe(0);
    expect(learnedScaleForms([mk(T0), strong(T0 + DAY, 'b')])).toBe(1);
  });

  it('les accords et l’impro ne comptent pas comme formes de gamme', () => {
    const chords = [mk(T0, { module: 'accords', chordId: 'Em-022000' }), { ...mk(T0 + DAY, { module: 'accords', chordId: 'Em-022000' }), id: 'c' }];
    const forms = [mk(T0), { ...mk(T0 + DAY, { level: 3, kind: 'recall', strings: 6 }), id: 'b' }];
    expect(learnedScaleForms(forms, 'pentatonic-minor', 'boxes')).toBe(1);
    expect(learnedScaleForms(forms, 'major', 'boxes')).toBe(0);
    const impro = [mk(T0, { kind: 'impro', level: 4 }), { ...mk(T0 + DAY, { kind: 'impro', level: 4 }), id: 'i' }];
    expect(learnedScaleForms([...chords, ...impro])).toBe(0);
  });
});

describe('regressedScaleForms', () => {
  const DAY = 86_400_000;
  it('compte les formes apprises selon les anciennes règles et plus aujourd’hui', () => {
    const weak = [mk(T0), { ...mk(T0 + DAY), id: 'b' }];
    expect(regressedScaleForms(weak)).toBe(1);
    expect(regressedScaleForms([mk(T0), { ...mk(T0 + DAY, { level: 3, kind: 'recall' }), id: 'b' }])).toBe(0);
    expect(regressedScaleForms([])).toBe(0);
  });
});

describe('dayGoalText', () => {
  it('compte tant que l’objectif n’est pas atteint', () => {
    expect(dayGoalText(0, 3)).toEqual({ text: '0 / 3 exercices aujourd’hui', reached: false });
    expect(dayGoalText(2, 3).reached).toBe(false);
  });

  it('le dit quand il est atteint, et garde le vrai compte au-delà', () => {
    expect(dayGoalText(3, 3)).toEqual({ text: 'Objectif du jour atteint (3)', reached: true });
    expect(dayGoalText(5, 3).text).toBe('Objectif du jour atteint (5)');
  });
});

describe('révisions dues et impro (D96)', () => {
  it('une prise d’impro ne crée jamais de révision due, même ratée il y a des semaines', () => {
    // un taux de notes d'accord à 40 % : en carte Leitner, un « échec » en boîte 1, dû à jamais
    const impro = mk(T0 - 30 * 86_400_000, { kind: 'impro', level: 4, correct: 12, total: 30, id: 'i' });
    expect(dueNow([impro], T0)).toEqual([]);
    expect(hubPlan([impro], dueNow([impro], T0), new Set(), null).review).toBeNull();
  });

  it('la forme jouée note à note garde sa révision', () => {
    const holes = mk(T0 - 30 * 86_400_000, { correct: 2, total: 3 });
    const impro = mk(T0 - 29 * 86_400_000, { kind: 'impro', level: 4, correct: 12, total: 30, id: 'i' });
    expect(dueNow([holes, impro], T0).map((c) => c.nodeId)).toEqual(['gam:lecture:pentatonic-minor:boxes:0']);
  });
});

describe('heroAction (porte unique, D97)', () => {
  it('le bouton de l’accueil ouvre la séance', () => {
    const plan = hubPlan([mk(T0)], [card], none, null);
    expect(heroAction(plan, { step: 'play', firstStep: null })).toEqual({ route: 'review' });
    // même au tout premier pas : une révision due passe avant
    expect(heroAction(plan, { step: 'listen', firstStep: 'tune' })).toEqual({ route: 'review' });
  });

  it('sans révision : l’accord repris, le premier pas, puis la gamme', () => {
    const chord = hubPlan([mk(T0, { module: 'accords', chordId: 'Em-022000' })], [], none, null);
    expect(heroAction(chord, { step: 'play', firstStep: null })).toEqual({ route: 'chord', voicingId: 'Em-022000' });
    const start = hubPlan([], [], none, null);
    expect(heroAction(start, { step: 'listen', firstStep: 'tune' })).toEqual({ route: 'tuner' });
    expect(heroAction(start, { step: 'listen', firstStep: 'listen' })).toEqual({ route: 'scale' });
    const scale = hubPlan([mk(T0)], [], none, null);
    expect(heroAction(scale, { step: 'play', firstStep: 'play' })).toEqual({ route: 'training' });
    expect(heroAction(scale, { step: 'play', firstStep: null })).toEqual({ route: 'training' });
    expect(heroAction(scale, { step: 'listen', firstStep: null })).toEqual({ route: 'scale' });
  });
});
