/**
 * Accueil : la seule action proposée vient du journal. Une révision due passe en premier, puis le
 * dernier module touché ; un journal vide propose de commencer.
 */
import { describe, expect, it } from 'vitest';
import { dailyActivity, dailySession, dayGoalText, heroAction, heroSteps, hubPlan, pathCounts, pathCountText, sessionMinutes, streakText, type DailySession, learnedScaleForms, regressedScaleForms, isHeroShortcut, tuneStepDone, micHeardBefore, scaleStep, reviewLine, whenLabel, absenceDays, returnLines } from '../src/app/hubPlan';
import { nextStreakMilestone } from '../src/modules/gammes/accomplishments';
import { dueReviewCards, dueToday } from '../src/modules/gammes/review';
import { cardsFrom, dueNow, summarizeDay, type Attempt, type Card } from '../src/core/progress';

const T0 = new Date(2026, 9, 20, 19, 0, 0).getTime();

function mk(ts: number, patch: Partial<Attempt> = {}): Attempt {
  return {
    id: `${ts}`, ts, kind: 'holes', scaleId: 'pentatonic-minor', tonic: 'A', tuningId: 'standard',
    system: 'boxes', positionId: 'p0', formIndex: 0, level: 2, strings: 6, correct: 3, total: 3,
    seconds: 42, fretMin: 5, missedStrings: [], tempoOk: false, ...patch,
  };
}

const card: Card = { nodeId: 'gam:x', box: 2, due: T0, lastTs: T0, lapses: 0, reps: 1, lastLevel: 2, lastScore: 1, slowStreak: 0 };
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

describe('reviewLine (carte de révision, lot 3)', () => {
  const NB = '\u00a0';
  const card = (j: Attempt[]) => cardsFrom(j).find((c) => c.nodeId === 'gam:lecture:pentatonic-minor:boxes:0')!;

  it('une seule preuve : l’âge, l’état de la boîte avec le seuil, et « premier essai »', () => {
    const j = [recall(T0 - 3 * D, { correct: 10, total: 12 })];
    expect(reviewLine(card(j), j, T0)).toEqual({
      reason: `vue il y a 3 j · encore fragile : à 80${NB}% elle s’espace`,
      trend: `premier essai : 83${NB}%`,
    });
  });

  it('la boîte se lit en mots, jamais en numéro', () => {
    const j = [recall(T0 - 3 * D, { correct: 10, total: 12 })];
    const c = card(j);
    expect(reviewLine({ ...c, box: 3 }, j, T0).reason).toBe('vue il y a 3 j · elle s’installe');
    expect(reviewLine({ ...c, box: 6 }, j, T0).reason).toBe('vue il y a 3 j · presque acquise, elle revient rarement');
  });

  it('deux, puis trois preuves et plus : la tendance des trois dernières', () => {
    const two = [recall(T0 - 4 * D, { correct: 5 }), recall(T0 - 3 * D, { correct: 15, total: 20 })];
    expect(reviewLine(card(two), two, T0).trend).toBe(`tes 2 derniers essais : 50${NB}% → 75${NB}%`);
    const four = [recall(T0 - 9 * D, { correct: 1 }), ...two, recall(T0 - 2 * D, { correct: 10, total: 12 })];
    expect(reviewLine(card(four), four, T0).trend).toBe(`tes 3 derniers essais : 50${NB}% → 75${NB}% → 83${NB}%`);
  });

  it('série de moins de 5 trous : le compte, pas un pourcentage', () => {
    const j = [mk(T0 - 2 * D, { correct: 1, total: 2 })];
    expect(reviewLine(card(j), j, T0).trend).toBe('premier essai : 1 trou juste sur 2');
  });

  it('au-delà de 14 jours : « il y a 5 sem. », pas une date', () => {
    const j = [recall(T0 - 35 * D)];
    expect(reviewLine(card(j), j, T0).reason).toBe(`vue il y a 5 sem. · encore fragile : à 80${NB}% elle s’espace`);
    expect(whenLabel(T0 - 10 * D, T0)).toBe('il y a 10 j');
    expect(whenLabel(T0 - D, T0)).toBe('hier');
  });
});

describe('retour après une absence (lot 3)', () => {
  const NB = ' ';
  it('absenceDays : jours calendaires depuis le dernier exercice vérifié, écoute ignorée', () => {
    const now = new Date(T0);
    expect(absenceDays([], now)).toBe(0);
    expect(absenceDays([mk(T0 - 3_600_000)], now)).toBe(0);
    expect(absenceDays([mk(T0 - 2 * D)], now)).toBe(2);
    expect(absenceDays([mk(T0 - 3 * D)], now)).toBe(3);
    expect(absenceDays([mk(T0 - 12 * D)], now)).toBe(12);
    expect(absenceDays([mk(T0 - 5 * D), mk(T0 - D, { kind: 'listen', correct: null, total: null })], now)).toBe(5);
  });

  it('jamais avant 3 jours, ni tant que la série de semaines tient (D101) ; une nouvelle série ; jamais de reproche', () => {
    expect(returnLines(2, 4, 6, 0, 0)).toEqual([]);
    // le joueur du week-end : 5 jours sans jouer chaque semaine, mais sa série de semaines tient
    expect(returnLines(5, 4, 6, 0, 5)).toEqual([]);
    expect(returnLines(12, 1, 2, 0, 0)).toEqual([
      `Content de te revoir. 1 forme à rafraîchir, environ 2 min${NB}: on reprend doucement.`,
      'Une nouvelle série commence aujourd’hui.',
    ]);
    expect(returnLines(12, 13, 14, 0, 0)).toEqual([
      `Content de te revoir. 8 formes à rafraîchir, environ 14 min${NB}: on reprend doucement.`,
      'Une nouvelle série commence aujourd’hui.',
      '8 aujourd’hui, les autres reviendront.',
    ]);
    expect(returnLines(5, 0, 0, 0, 0)[0]).toBe(`Content de te revoir${NB}: on reprend doucement.`);
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

/** Rappel N3 réussi sur la position entière (une forme qui devient « apprise » en deux jours). */
const recall = (ts: number, patch: Partial<Attempt> = {}) =>
  mk(ts, { kind: 'recall', level: 3, fullPosition: true, correct: 10, total: 10, seconds: 50, ...patch });
const SEL = { scaleId: 'pentatonic-minor', tonic: 'A' as const, system: 'boxes' as const, tuningId: 'standard' };
const D = 86_400_000;
const fiveLearned = () => [0, 1, 2, 3, 4].flatMap((formIndex) => [recall(T0 - 2 * D, { formIndex }), recall(T0 - D, { formIndex })]);

describe('séance du jour (D98)', () => {
  it('rien de dû : l’étape suivante seule', () => {
    const s = dailySession([], T0, SEL);
    expect(s.review).toEqual([]);
    expect(s.next?.level).toBe(1);
    expect(s.cap).toBeNull();
    expect(s.waiting).toBe(false);
  });

  it('une forme due et une étape : les deux, révision d’abord', () => {
    // position 1 apprise (palier 3, due), position 2 à apprendre
    const j = [recall(T0 - 6 * D), recall(T0 - 4 * D)];
    const plan = hubPlan(j, dueToday(j, T0), none, null);
    const s = dailySession(j, T0, SEL);
    expect(s.review.map((t) => t.nodeId)).toEqual(['gam:lecture:pentatonic-minor:boxes:0']);
    expect(s.next?.selection.positionIndex).toBe(1);
    expect(heroAction(plan, s)).toMatchObject({ route: 'review', label: '▶ Réviser (1 forme)' });
  });

  it('forme tentée à froid aujourd’hui : sortie de la séance jusqu’à demain (Q1), comptée comme rafraîchie', () => {
    const j = [recall(T0 - 6 * D), recall(T0 - 4 * D), recall(T0 - 3_600_000, { correct: 5 })];
    // l'échec la remet au palier 1 (10 min) : Leitner la dit due, la séance ne la rouvre pas
    expect(dueReviewCards(j, T0).length).toBe(1);
    const s = dailySession(j, T0, SEL);
    expect(s.review).toEqual([]);
    expect(s.reviewedToday).toBe(1);
  });

  it('toutes les formes apprises : un défi (cap)', () => {
    const s = dailySession(fiveLearned(), T0, SEL);
    expect(s.next).toBeNull();
    expect(s.cap?.scaleId).toBe('blues-minor');
    const plan = hubPlan(fiveLearned(), [], none, null);
    expect(heroAction(plan, s)).toMatchObject({ route: 'scale', label: '▶ Découvrir le blues mineur' });
  });

  it('il ne manque qu’un second jour : séance faite, la suite demain', () => {
    const j = [recall(T0 - 2 * 3_600_000), recall(T0 - 3_600_000)];
    const s = dailySession(j, T0, SEL);
    expect(s.next).toBeNull();
    expect(s.cap).toBeNull();
    expect(s.waiting).toBe(true);
    expect(heroAction(hubPlan(j, [], none, null), s)).toMatchObject({ route: 'training', label: 'Continuer quand même', quiet: true });
  });
});

describe('sessionMinutes', () => {
  const t = (n: number) => Array.from({ length: n }, () => ({}) as never);
  it('replis : 90 s par forme due, 60 s pour une écoute, 90 s pour une série', () => {
    expect(sessionMinutes([], null, [], 20)).toBe(0);
    expect(sessionMinutes(t(2), null, [], 20)).toBe(3);
    const listen = dailySession([], T0, SEL).next;
    expect(sessionMinutes([], listen, [], 20)).toBe(1);
  });

  it('médiane des rappels de l’élève, plus le taux d’échec × (regard + nouvel essai)', () => {
    const j = [recall(T0, { seconds: 40 }), recall(T0, { seconds: 60 }), recall(T0, { seconds: 200 }), recall(T0, { seconds: 60, correct: 2 })];
    // médiane 60 s, 1 échec sur 4 : 60 + 0,25 × (20 + 60) = 80 s par forme ; 3 formes = 240 s
    expect(sessionMinutes(t(3), null, j, 20)).toBe(4);
  });
});

describe('heroAction (porte unique D97, séance D98)', () => {
  const session = (patch: Partial<DailySession> = {}): DailySession =>
    ({ review: [], reviewedToday: 0, next: null, cap: null, waiting: false, minutes: 0, ...patch });

  it('le bouton de l’accueil ouvre la séance quand une forme est due', () => {
    const plan = hubPlan([mk(T0)], [card], none, null);
    const s = session({ review: [{} as never, {} as never, {} as never] });
    expect(heroAction(plan, s)).toEqual({ route: 'review', label: '▶ Réviser (3 formes)' });
    // même au tout premier pas : une révision due passe avant
    expect(heroAction(plan, s, 'tune').route).toBe('review');
  });

  it('sans révision : l’accord repris, puis le premier pas, puis l’étape de la séance', () => {
    const chord = hubPlan([mk(T0, { module: 'accords', chordId: 'Em-022000' })], [], none, null);
    expect(heroAction(chord, session())).toMatchObject({ route: 'chord', voicingId: 'Em-022000' });
    const start = hubPlan([], [], none, null);
    expect(heroAction(start, session(), 'tune')).toMatchObject({ route: 'tuner', label: '▶ Accordeur' });
    const next = dailySession([mk(T0 - D, { kind: 'listen', level: 1, correct: null, total: null })], T0, SEL).next!;
    const scale = hubPlan([mk(T0)], [], none, null);
    expect(heroAction(scale, session({ next }))).toMatchObject({ route: 'training', label: '▶ Avancer', level: 2, segment: 'updown' });
    const listen = dailySession([], T0, SEL).next!;
    expect(heroAction(scale, session({ next: listen }))).toMatchObject({ route: 'scale', label: '▶ Écouter la position 1' });
    // après 3 échecs d'affilée : revoir la forme
    expect(heroAction(scale, session({ next: { ...listen, again: true } }))).toMatchObject({ route: 'scale', label: '▶ Revoir la position 1' });
  });
});

describe('pathCountText (Parcours)', () => {
  it('apprises, maîtrisées, à rafraîchir', () => {
    expect(pathCountText(0, 0, 0, 5)).toBe('0 forme apprise sur 5');
    expect(pathCountText(5, 0, 3, 5)).toBe('5 formes apprises sur 5 · 3 à rafraîchir');
    expect(pathCountText(5, 2, 0, 5)).toBe('5 formes apprises sur 5, dont 2 maîtrisées');
    expect(pathCountText(1, 1, 1, 5)).toBe('1 forme apprise sur 5, dont 1 maîtrisée · 1 à rafraîchir');
  });

  it('pathCounts : une forme apprise due compte « à rafraîchir »', () => {
    const j = [recall(T0 - 6 * D), recall(T0 - 4 * D)];
    expect(pathCounts(j, T0, 'pentatonic-minor', 'boxes')).toEqual({ learned: 1, mastered: 0, due: 1 });
  });
});

describe('streakText (série de jours et de semaines, D99)', () => {
  it('jours et semaines, ou l’un des deux, jamais « 0 » ni « 1 jour »', () => {
    expect(streakText(5, 3)).toBe('Série : 5 jours · 3 semaines');
    expect(streakText(3, 1)).toBe('Série : 3 jours · 1 semaine');
    expect(streakText(5, 0)).toBe('Série : 5 jours d’affilée');
    expect(streakText(0, 5)).toBe('Série : 5 semaines');
    expect(streakText(1, 2)).toBe('Série : 2 semaines');
    expect(streakText(1, 0)).toBeNull();
    expect(streakText(0, 0)).toBeNull();
  });
});
