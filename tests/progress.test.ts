import { describe, expect, it } from 'vitest';
import {
  ATTEMPTS_KEY, ATTEMPT_CAP, appendAttempt, loadJournal, newAttemptId, nodeIdOf, normalizeAttempt, readAttempts,
  scoreOf, summarizeDay, writeAttempts, zoneOf, type Attempt,
} from '../src/core/progress/journal';
import { PRACTICE_KEY, logPractice } from '../src/core/progress/practiceLog';
import { BOX_INTERVALS_MS, cardsFrom, dueNow, leitner, outcomeFor } from '../src/core/progress/scheduler';
import { masteryOf, stateOf, stringWeakness, summarizeNodes, weakTonics } from '../src/core/progress/mastery';
import { DAILY_XP_CAP, badgeStatus, streak, xpForAttempt, xpSummary } from '../src/core/progress/rewards';
import { exportFilename, exportText, mergeAttempts, parseImport } from '../src/core/progress/exportData';

function fakeStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k]! : null),
    setItem: (k: string, v: string) => { data[k] = v; },
  };
}

const DAY = 86_400_000;
const today = new Date(2026, 9, 27, 18, 0).getTime();
const at = (daysAgo: number, hour = 10) => new Date(2026, 9, 27 - daysAgo, hour, 0).getTime();

let seq = 0;
function attempt(patch: Partial<Attempt> = {}): Attempt {
  const base: Attempt = {
    id: `t-${seq++}`,
    ts: at(0),
    kind: 'holes',
    scaleId: 'pentatonic-minor',
    tonic: 'A',
    tuningId: 'standard',
    system: 'boxes',
    positionId: 'boxes:0',
    formIndex: 0,
    level: 2,
    strings: 2,
    correct: 4,
    total: 5,
    seconds: 42,
    fretMin: 5,
    missedStrings: [],
    tempoOk: false,
  };
  return { ...base, ...patch };
}

describe('journal de tentatives', () => {
  it('identifiant de nœud : la forme et le mode, jamais la tonique', () => {
    expect(nodeIdOf(attempt({ tonic: 'A' }))).toBe('gam:lecture:pentatonic-minor:boxes:0');
    expect(nodeIdOf(attempt({ tonic: 'F#' }))).toBe(nodeIdOf(attempt({ tonic: 'A' })));
    expect(nodeIdOf(attempt({ formIndex: 1 }))).not.toBe(nodeIdOf(attempt({ formIndex: 0 })));
  });

  it('normalise : entrées invalides rejetées, précision bornée', () => {
    expect(normalizeAttempt({ id: 'x' })).toBeNull();
    expect(normalizeAttempt(null)).toBeNull();
    const a = normalizeAttempt({ ...attempt(), correct: 99, total: 5, level: 9, seconds: -4 });
    expect(a).not.toBeNull();
    expect(a!.correct).toBe(5);
    expect(a!.level).toBe(1);
    expect(a!.seconds).toBe(0);
    expect(scoreOf(a!)).toBe(1);
  });

  it('écrit, relit et borne le journal', () => {
    const s = fakeStore();
    appendAttempt(s, attempt());
    appendAttempt(s, attempt({ kind: 'recall', level: 3 }));
    expect(readAttempts(s).length).toBe(2);
    // le plafond se teste en une écriture (2 000 ajouts un par un = 2 000 re-sérialisations, test lent et inutile)
    writeAttempts(s, Array.from({ length: ATTEMPT_CAP + 5 }, (_, i) => attempt({ id: `cap-${i}` })));
    expect(readAttempts(s).length).toBe(ATTEMPT_CAP);
    expect(JSON.parse(s.data[ATTEMPTS_KEY]!).v).toBe(1);
  });

  it('stockage absent ou corrompu : journal vide, jamais d’exception', () => {
    expect(readAttempts(null)).toEqual([]);
    expect(readAttempts(fakeStore({ [ATTEMPTS_KEY]: 'nope' }))).toEqual([]);
    expect(readAttempts(fakeStore({ [ATTEMPTS_KEY]: JSON.stringify({ attempts: [{ id: 1 }] }) }))).toEqual([]);
  });

  it('migre une seule fois le journal d’écoute de la phase 1d', () => {
    const s = fakeStore();
    logPractice(s, { ts: at(1), scaleId: 'pentatonic-minor', tonic: 'A', system: 'boxes', positionId: 'boxes:0', seconds: 20 });
    logPractice(s, { ts: at(1, 11), scaleId: 'dorian', tonic: 'D', system: '3nps', positionId: '3nps:2', seconds: 30 });
    const first = loadJournal(s);
    expect(first.length).toBe(2);
    expect(first.every((a) => a.kind === 'listen' && a.correct === null)).toBe(true);
    expect(first[1]!.scaleId).toBe('dorian');
    // deuxième lecture : pas de doublon
    expect(loadJournal(s).length).toBe(2);
    // la clé d'origine est conservée
    expect(s.data[PRACTICE_KEY]).toBeTruthy();
  });

  it('résumé du jour : écoutes, exercices, précision', () => {
    const list = [
      attempt({ ts: at(1), kind: 'listen', correct: null, total: null }),
      attempt({ ts: at(0, 9), correct: 3, total: 4 }),
      attempt({ ts: at(0, 10), kind: 'recall', level: 3, correct: 2, total: 2 }),
      attempt({ ts: at(0, 11), kind: 'listen', correct: null, total: null, seconds: 10 }),
    ];
    const d = summarizeDay(list, new Date(today));
    expect(d.listens).toBe(1);
    expect(d.exercises).toBe(2);
    expect(d.correct).toBe(5);
    expect(d.holes).toBe(6);
    expect(d.accuracy).toBeCloseTo(5 / 6, 6);
    expect(d.seconds).toBe(42 + 42 + 10);
    expect(d.nodes).toBe(1); // même forme, même mode
  });

  it('le rappel (N3) pèse plus que les trous (N2) dans la maîtrise', () => {
    // même journal sauf le niveau de la meilleure tentative : le poids 1,5 du N3 doit tirer la moyenne
    const asHoles = [
      attempt({ ts: at(4), correct: 3, total: 5, level: 2 }),
      attempt({ ts: at(1), correct: 5, total: 5, level: 2 }),
    ];
    const asRecall = [
      attempt({ ts: at(4), correct: 3, total: 5, level: 2 }),
      attempt({ ts: at(1), correct: 5, total: 5, level: 3, kind: 'recall' }),
    ];
    const a = summarizeNodes(asHoles)[0]!;
    const b = summarizeNodes(asRecall)[0]!;
    expect(b.recent).toBeGreaterThan(a.recent);
    expect(b.mastery).toBeGreaterThan(a.mastery);
    // à scores égaux, la pondération ne change rien
    expect(masteryOf([0.8, 0.8], 2, [1, 1.5])).toBeCloseTo(masteryOf([0.8, 0.8], 2), 6);
  });

  it('tempoOk survit à la normalisation, faux par défaut', () => {
    expect(normalizeAttempt(attempt())!.tempoOk).toBe(false);
    expect(normalizeAttempt({ ...attempt(), tempoOk: true })!.tempoOk).toBe(true);
    expect(normalizeAttempt({ ...attempt(), tempoOk: 'oui' })!.tempoOk).toBe(false);
  });

  it('diagnostic par corde : valeurs invalides écartées, doublons fusionnés', () => {
    const a = normalizeAttempt({ ...attempt(), missedStrings: [3, 3, 9, -1, 1.5] });
    expect(a!.missedStrings).toEqual([3]);
    expect(normalizeAttempt(attempt())!.missedStrings).toEqual([]);
    const list = [
      attempt({ missedStrings: [1, 1] }),
      attempt({ missedStrings: [1, 4] }),
      attempt({ kind: 'listen', correct: null, total: null, missedStrings: [0] }),
    ];
    expect(stringWeakness(list)).toEqual([
      { string: 1, attempts: 2, misses: 3 },
      { string: 4, attempts: 1, misses: 1 },
    ]);
  });

  it('zone du manche : 5 cases par zone, bornée à la 5e', () => {
    expect(zoneOf(0)).toBe(0);
    expect(zoneOf(4)).toBe(0);
    expect(zoneOf(5)).toBe(1);
    expect(zoneOf(12)).toBe(2);
    expect(zoneOf(23)).toBe(4);
  });

  it('newAttemptId est stable et court', () => {
    expect(newAttemptId(1, 'a', 2)).toBe(newAttemptId(1, 'a', 2));
    expect(newAttemptId(1, 'a', 2)).not.toBe(newAttemptId(1, 'b', 2));
  });
});

describe('répétition espacée (Leitner)', () => {
  it('seuils de résultat', () => {
    expect(outcomeFor(1)).toBe('clean');
    expect(outcomeFor(0.95)).toBe('clean');
    expect(outcomeFor(0.9)).toBe('slow');
    expect(outcomeFor(0.8)).toBe('slow');
    expect(outcomeFor(0.79)).toBe('fail');
  });

  it('une réussite nette démarre en boîte 2 à ~1 jour, un échec en boîte 1', () => {
    const clean = leitner.next(null, 'n', 'clean', today, 2, 1);
    expect(clean.box).toBe(2);
    const target = BOX_INTERVALS_MS[1]!;
    expect(clean.due - today).toBeGreaterThanOrEqual(Math.round(target * 0.85));
    expect(clean.due - today).toBeLessThanOrEqual(Math.round(target * 1.15));
    const fail = leitner.next(null, 'n', 'fail', today, 2, 0.2);
    expect(fail.box).toBe(1);
    expect(fail.lapses).toBe(1);
  });

  it('rejoue le journal : même journal → mêmes cartes, mêmes échéances', () => {
    const list = [
      attempt({ ts: at(10), correct: 5, total: 5 }),
      attempt({ ts: at(4), correct: 5, total: 5 }),
      attempt({ ts: at(1), correct: 4, total: 5 }),
    ];
    const a = cardsFrom(list);
    const b = cardsFrom([...list].reverse());
    expect(a).toEqual(b);
    expect(a.length).toBe(1);
    expect(a[0]!.reps).toBe(3);
    expect(a[0]!.box).toBeGreaterThan(2);
  });

  it('les écoutes ne créent pas de carte', () => {
    expect(cardsFrom([attempt({ kind: 'listen', correct: null, total: null })])).toEqual([]);
  });

  it('échec : la boîte recule de 2 sans descendre sous 1', () => {
    let card = leitner.next(null, 'n', 'clean', today, 2, 1);
    card = leitner.next(card, 'n', 'clean', today + 2 * DAY, 2, 1);
    card = leitner.next(card, 'n', 'clean', today + 5 * DAY, 2, 1);
    expect(card.box).toBe(4);
    card = leitner.next(card, 'n', 'fail', today + 6 * DAY, 2, 0.3);
    expect(card.box).toBe(2);
    card = leitner.next(card, 'n', 'fail', today + 7 * DAY, 2, 0.1);
    expect(card.box).toBe(1);
  });

  it('plafonne les cartes dues à 8 par session, la plus ancienne d’abord', () => {
    const list: Attempt[] = [];
    for (let i = 0; i < 12; i++) {
      list.push(attempt({ ts: at(10) + i * 1000, formIndex: i, correct: 1, total: 5 }));
    }
    const due = dueNow(list, today + 30 * DAY);
    expect(due.length).toBe(8);
    expect(due[0]!.due).toBeLessThanOrEqual(due[due.length - 1]!.due);
  });
});

describe('maîtrise', () => {
  it('formule bornée, 0 sans tentative', () => {
    expect(masteryOf([], 0)).toBe(0);
    expect(masteryOf([1], 3)).toBe(1);
    expect(masteryOf([0], 0)).toBeLessThan(0.2);
    const m = masteryOf([1, 0.6], 1);
    expect(m).toBeGreaterThan(0.3);
    expect(m).toBeLessThan(1);
  });

  it('états : disponible → en apprentissage → apprise → maîtrisée', () => {
    expect(stateOf({ attempts: 0, successes: 0, successDays: 0, last: 0, box: null })).toBe('available');
    expect(stateOf({ attempts: 2, successes: 0, successDays: 0, last: 0.5, box: 1 })).toBe('learning');
    expect(stateOf({ attempts: 2, successes: 2, successDays: 1, last: 1, box: 3 })).toBe('learning');
    expect(stateOf({ attempts: 3, successes: 2, successDays: 2, last: 0.9, box: 3 })).toBe('learned');
    expect(stateOf({ attempts: 3, successes: 2, successDays: 2, last: 0.9, box: 5 })).toBe('mastered');
    // apprise mais dernière tentative ratée : pas maîtrisée
    expect(stateOf({ attempts: 4, successes: 2, successDays: 2, last: 0.4, box: 5 })).toBe('learned');
  });

  it('agrège par nœud, ignore les écoutes et garde les toniques', () => {
    const list = [
      attempt({ ts: at(6), tonic: 'A', correct: 5, total: 5 }),
      attempt({ ts: at(3), tonic: 'A', correct: 4, total: 5 }),
      attempt({ ts: at(0), tonic: 'C', correct: 4, total: 5, fretMin: 12 }),
      attempt({ ts: at(0, 12), kind: 'listen', correct: null, total: null, tonic: 'G' }),
    ];
    const nodes = summarizeNodes(list);
    expect(nodes.length).toBe(1);
    const n = nodes[0]!;
    expect(n.attempts).toBe(3);
    expect(n.successes).toBe(3);
    expect(n.tonics.sort()).toEqual(['A', 'C']);
    expect(n.zones).toEqual([1, 2]);
    expect(n.state).toBe('learned');
    expect(n.box).toBe(2); // 1 réussite nette puis 2 réussites « lentes » : la boîte ne monte plus
    expect(n.mastery).toBeGreaterThan(0.8);
  });

  it('weakTonics : les formes vues dans une seule zone du manche', () => {
    const a = attempt({ ts: at(1), correct: 5, total: 5, fretMin: 5 });
    const nodes = summarizeNodes([a]);
    expect(weakTonics(nodes).length).toBe(1);
  });
});

describe('XP, série et badges', () => {
  it('seuls les exercices vérifiés rapportent de l’XP', () => {
    expect(xpForAttempt(attempt({ kind: 'listen', correct: null, total: null }))).toBe(0);
    expect(xpForAttempt(attempt({ kind: 'holes', correct: 5, total: 5 }))).toBe(10 + 5);
    expect(xpForAttempt(attempt({ kind: 'holes', correct: 4, total: 5 }))).toBe(8);
    expect(xpForAttempt(attempt({ kind: 'holes', correct: 3, total: 5 }))).toBe(6);
    expect(xpForAttempt(attempt({ kind: 'recall', level: 3, correct: 5, total: 5 }))).toBe(15 + 5);
    expect(xpForAttempt(attempt({ kind: 'recall', level: 3, correct: 1, total: 5 }))).toBe(3);
  });

  it('l’XP est plafonnée par jour', () => {
    const list: Attempt[] = [];
    for (let i = 0; i < 20; i++) list.push(attempt({ ts: at(0, 10) + i * 1000, correct: 5, total: 5 }));
    const xp = xpSummary(list, new Date(today));
    expect(xp.today).toBe(DAILY_XP_CAP);
    expect(xp.total).toBe(DAILY_XP_CAP);
  });

  it('série : jours consécutifs, vivante tant que la veille compte', () => {
    expect(streak([], new Date(today)).days).toBe(0);
    expect(streak([attempt({ ts: at(0) })], new Date(today))).toEqual({ days: 1, today: true });
    const two = [attempt({ ts: at(0) }), attempt({ ts: at(1) }), attempt({ ts: at(2) })];
    expect(streak(two, new Date(today)).days).toBe(3);
    // rien aujourd'hui, mais hier : la série tient encore
    expect(streak([attempt({ ts: at(1) }), attempt({ ts: at(2) })], new Date(today))).toEqual({ days: 2, today: false });
    // trou : la série casse
    expect(streak([attempt({ ts: at(2) }), attempt({ ts: at(3) })], new Date(today)).days).toBe(0);
  });

  it('badges : chacun dérivé du journal, avec sa raison', () => {
    const empty = badgeStatus([], new Date(today));
    expect(empty.length).toBeGreaterThanOrEqual(8);
    expect(empty.every((b) => !b.earned)).toBe(true);

    const list = [
      attempt({ ts: at(2), kind: 'listen', correct: null, total: null }),
      attempt({ ts: at(2), correct: 5, total: 5 }),
      attempt({ ts: at(1), correct: 5, total: 5, tonic: 'C' }),
      attempt({ ts: at(0), kind: 'recall', level: 3, correct: 4, total: 4 }),
    ];
    const got = badgeStatus(list, new Date(today)).filter((b) => b.earned).map((b) => b.id);
    expect(got).toContain('first-listen');
    expect(got).toContain('first-holes');
    expect(got).toContain('holes-clean');
    expect(got).toContain('first-recall');
    expect(got).toContain('clean-recall');
    expect(got).toContain('two-tonics');
    expect(got).toContain('three-days');
    expect(got).not.toContain('week');
  });
});

describe('export / import', () => {
  it('aller-retour fidèle', () => {
    const list = [attempt({ ts: at(2) }), attempt({ ts: at(1), kind: 'recall', level: 3 })];
    const text = exportText(list, new Date(today));
    const back = parseImport(text);
    expect(back.error).toBeNull();
    expect(back.rejected).toBe(0);
    expect(back.attempts).toEqual(list.sort((a, b) => a.ts - b.ts));
    expect(JSON.parse(text).app).toBe('fretwave');
    expect(exportFilename(new Date(today))).toBe('fretwave-progression-2026-10-27.json');
  });

  it('refuse proprement : JSON cassé, mauvaise version, autre app', () => {
    expect(parseImport('{oops').error).toContain('JSON');
    expect(parseImport(JSON.stringify({ v: 2, attempts: [] })).error).toContain('version');
    expect(parseImport(JSON.stringify({ app: 'autre', attempts: [] })).error).toContain('Fretwave');
    expect(parseImport(JSON.stringify({ attempts: 'x' })).error).toContain('journal');
  });

  it('compte les entrées refusées sans rejeter le fichier', () => {
    const payload = { v: 1, app: 'fretwave', exportedAt: 'x', attempts: [attempt(), { id: 3 }, null] };
    const r = parseImport(JSON.stringify(payload));
    expect(r.attempts.length).toBe(1);
    expect(r.rejected).toBe(2);
  });

  it('fusion par identifiant : importer deux fois ne double rien', () => {
    const a = [attempt({ id: 'x' }), attempt({ id: 'y' })];
    const b = [attempt({ id: 'x' }), attempt({ id: 'z' })];
    const merged = mergeAttempts(a, b);
    expect(merged.map((m) => m.id)).toEqual(['x', 'y', 'z']);
  });
});
