import { describe, expect, it } from 'vitest';
import {
  ATTEMPTS_KEY, ATTEMPT_CAP, appendAttempt, isFullPosition, loadJournal, newAttemptId, nodeIdOf, normalizeAttempt, readAttempts,
  scoreOf, writeAttempts, zoneOf, type Attempt,
} from '../src/core/progress/journal';
import { PRACTICE_KEY, logPractice } from '../src/core/progress/practiceLog';
import { BOX_INTERVALS_MS, cardsFrom, dueNow, leitner, outcomeFor } from '../src/core/progress/scheduler';
import { isStrongSuccess, stateOf, summarizeNodes } from '../src/core/progress/mastery';
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
    // position entière : un échauffement sur 1-3 cordes ne touche pas la carte (D97)
    strings: 6,
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

  it('tempoOk survit à la normalisation, faux par défaut', () => {
    expect(normalizeAttempt(attempt())!.tempoOk).toBe(false);
    expect(normalizeAttempt({ ...attempt(), tempoOk: true })!.tempoOk).toBe(true);
    expect(normalizeAttempt({ ...attempt(), tempoOk: 'oui' })!.tempoOk).toBe(false);
  });

  it('diagnostic par corde : valeurs invalides écartées, doublons fusionnés', () => {
    const a = normalizeAttempt({ ...attempt(), missedStrings: [3, 3, 9, -1, 1.5] });
    expect(a!.missedStrings).toEqual([3]);
    expect(normalizeAttempt(attempt())!.missedStrings).toEqual([]);
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

  it('un échauffement sur 3 cordes ne crée ni ne déplace de carte', () => {
    // Q2 (D97) : seules les séries sur la position entière (ou de mémoire) touchent la carte
    const warm = (ts: number, correct = 5) => attempt({ ts, kind: 'holes', level: 2, strings: 3, correct, total: 5 });
    expect(cardsFrom([warm(at(3))])).toEqual([]);
    const full = attempt({ ts: at(4), kind: 'holes', level: 2, strings: 6, fullPosition: true, correct: 5, total: 5 });
    expect(cardsFrom([full, warm(at(3), 1), warm(at(2), 5)])).toEqual(cardsFrom([full]));
    // un rappel de mémoire sur un segment touche toujours la carte
    const recall = attempt({ ts: at(3), kind: 'recall', level: 3, strings: 3, correct: 5, total: 5 });
    expect(cardsFrom([full, recall])[0]!.reps).toBe(2);
  });

  it('les écoutes ne créent pas de carte', () => {
    expect(cardsFrom([attempt({ kind: 'listen', correct: null, total: null })])).toEqual([]);
  });

  it('réussite lente : une seule reste sur place, deux d’affilée au même palier montent d’un palier (D101)', () => {
    let card = leitner.next(null, 'n', 'clean', today, 2, 1);
    card = leitner.next(card, 'n', 'clean', today + 2 * DAY, 2, 1);
    expect(card.box).toBe(3);
    card = leitner.next(card, 'n', 'slow', today + 5 * DAY, 3, 0.9);
    expect(card.box).toBe(3);
    card = leitner.next(card, 'n', 'slow', today + 8 * DAY, 3, 0.94);
    expect(card.box).toBe(4);
    expect(card.slowStreak).toBe(0);
    // le compte repart à zéro après la montée : il faut deux nouvelles lentes au palier 4
    card = leitner.next(card, 'n', 'slow', today + 15 * DAY, 3, 0.9);
    expect(card.box).toBe(4);
  });

  it('réussite lente : un échec ou une réussite nette entre deux lentes remet le compte à zéro', () => {
    let card = leitner.next(null, 'n', 'slow', today, 2, 0.9);
    expect(card.box).toBe(1);
    expect(card.slowStreak).toBe(1);
    // première rencontre lente + une lente : deux d'affilée au palier 1 → palier 2
    expect(leitner.next(card, 'n', 'slow', today + DAY, 2, 0.9).box).toBe(2);
    card = leitner.next(card, 'n', 'fail', today + DAY, 2, 0.5);
    card = leitner.next(card, 'n', 'slow', today + 2 * DAY, 2, 0.9);
    expect(card.box).toBe(1);
    expect(card.slowStreak).toBe(1);
    card = leitner.next(card, 'n', 'clean', today + 3 * DAY, 2, 1);
    expect(card.box).toBe(2);
    expect(card.slowStreak).toBe(0);
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

describe('état d’une forme (sert à la révision, D97)', () => {
  it('états : en apprentissage → apprise → maîtrisée', () => {
    const base = { strongSuccesses: 1, last: 0.9, box: 3 };
    expect(stateOf({ ...base, successes: 0, successDays: 0, last: 0.5, box: 1 })).toBe('learning');
    expect(stateOf({ ...base, successes: 2, successDays: 1 })).toBe('learning');
    expect(stateOf({ ...base, successes: 2, successDays: 2 })).toBe('learned');
    expect(stateOf({ ...base, successes: 2, successDays: 2, box: 5 })).toBe('mastered');
    // apprise mais dernière tentative ratée : pas maîtrisée
    expect(stateOf({ ...base, successes: 2, successDays: 2, last: 0.4, box: 5 })).toBe('learned');
  });

  it('agrège par nœud, ignore les écoutes et garde les toniques', () => {
    const list = [
      attempt({ ts: at(6), tonic: 'A', correct: 5, total: 5 }),
      attempt({ ts: at(3), tonic: 'A', correct: 4, total: 5 }),
      attempt({ ts: at(0), tonic: 'C', correct: 4, total: 5, fretMin: 12, level: 3, kind: 'recall', strings: 6 }),
      attempt({ ts: at(0, 12), kind: 'listen', correct: null, total: null, tonic: 'G' }),
    ];
    const nodes = summarizeNodes(list);
    expect(nodes.length).toBe(1);
    const n = nodes[0]!;
    expect(n.tonics.sort()).toEqual(['A', 'C']);
    expect(n.zones).toEqual([1, 2]);
    expect(n.state).toBe('learned');
  });

  it('les tentatives d’accord de l’ancien journal ne font pas une forme, et restent lisibles', () => {
    const chord = attempt({ ts: at(1), module: 'accords', chordId: 'Em-022000', kind: 'arpeggio', correct: 6, total: 6 });
    expect(summarizeNodes([chord])).toEqual([]);
    expect(normalizeAttempt(chord)).toMatchObject({ module: 'accords', chordId: 'Em-022000', kind: 'arpeggio' });
    expect(nodeIdOf(chord)).toBe('acc:accord:Em-022000');
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

describe('essai après révélation (rattrapage du rappel à froid)', () => {
  const cold = attempt({ ts: at(2), level: 3, kind: 'recall', correct: 2, total: 10 });
  const retry = attempt({ ts: at(2, 11), level: 3, kind: 'recall', correct: 10, total: 10, afterReveal: true });

  it('lecture tolérante : le champ survit à la normalisation, une valeur bizarre est ignorée', () => {
    expect(normalizeAttempt(retry)!.afterReveal).toBe(true);
    expect(normalizeAttempt({ ...retry, afterReveal: 'oui' })!.afterReveal).toBeUndefined();
    expect('afterReveal' in normalizeAttempt(cold)!).toBe(false);
  });

  it('ne bouge ni la carte Leitner, ni l’état de la forme', () => {
    const before = cardsFrom([cold]);
    const after = cardsFrom([cold, retry]);
    expect(after).toEqual(before);
    expect(summarizeNodes([cold, retry])).toEqual(summarizeNodes([cold]));
  });
});

describe('« apprise » et « maîtrisée » plus exigeantes (lot mémoire et vitesse)', () => {
  const lecture = (list: Attempt[]) => summarizeNodes(list).find((n) => n.nodeId.startsWith('gam:lecture:'))!;
  const n2 = (daysAgo: number, patch: Partial<Attempt> = {}) => attempt({ ts: at(daysAgo), correct: 5, total: 5, ...patch });
  const full = { strings: 6, fullPosition: true as const };
  const n3 = (daysAgo: number, patch: Partial<Attempt> = {}) => n2(daysAgo, { level: 3, kind: 'recall', ...full, ...patch });

  it('2 jours de N2 au pavé, même sur la position entière : en apprentissage', () => {
    expect(lecture([n2(1, full), n2(0, full)]).state).toBe('learning');
  });

  it('une réussite N3 au pavé sur la position entière suffit (un élève sans guitare peut apprendre)', () => {
    expect(lecture([n2(1), n3(0)]).state).toBe('learned');
  });

  it('un N3 sur 2 cordes ne suffit pas : il faut la position entière', () => {
    const seg = n2(0, { level: 3, kind: 'recall', strings: 2 });
    expect(lecture([n2(1), seg]).state).toBe('learning');
  });

  it('un N2 validé au micro sur la position entière suffit ; au micro sur un segment, non', () => {
    expect(lecture([n2(1), n2(0, { ...full, mic: true })]).state).toBe('learned');
    expect(lecture([n2(1), n2(0, { strings: 2, mic: true })]).state).toBe('learning');
  });

  it('sans le champ `fullPosition` (ancien journal), la position entière se déduit du nombre de cordes', () => {
    expect(isFullPosition(n2(0, { strings: 6 }))).toBe(true);
    expect(isFullPosition(n2(0, { strings: 3 }))).toBe(false);
    expect(isFullPosition(n2(0, { strings: 6, tuningId: 'standard7' }))).toBe(false);
    expect(isFullPosition(n2(0, { strings: 3, fullPosition: true }))).toBe(true);
  });

  it('une réussite forte faite après révélation ne compte pas', () => {
    expect(lecture([n2(1), n3(0, { afterReveal: true })]).state).toBe('learning');
  });

  it('ancienne entrée sans `mic` : traitée comme non jouée ; valeurs bizarres écartées', () => {
    const legacy = normalizeAttempt({ ...n2(0, full), mic: 'yes', gridNpm: 9999 })!;
    expect(legacy.mic).toBeUndefined();
    expect(legacy.gridNpm).toBeUndefined();
    expect(isStrongSuccess(legacy)).toBe(false);
    const fresh = normalizeAttempt(n3(0, { mic: true, gridNpm: 160.4, blind: true }))!;
    expect(fresh).toMatchObject({ mic: true, gridNpm: 160, blind: true, fullPosition: true });
  });

  it('maîtrisée : 4 réussites nettes, dont une forte', () => {
    expect(lecture([n2(30), n3(20), n2(10), n2(0)]).state).toBe('mastered');
  });
});

describe('numérotation des niveaux', () => {
  const attempt = (kind: 'impro' | 'sequence', level: 1 | 2 | 3 | 4 | 5) => ({
    id: 'a', ts: 1, kind, scaleId: 'major', tonic: 'A', tuningId: 'standard', system: 'caged', positionId: '', formIndex: 0,
    level, strings: 6, correct: 8, total: 10, seconds: 30, fretMin: 5, missedStrings: [], tempoOk: false,
  });

  it('un journal écrit avant la renumérotation passe à Niv4 séquences et Niv5 impro', () => {
    expect(normalizeAttempt(attempt('impro', 4))!.level).toBe(5);
    expect(normalizeAttempt(attempt('sequence', 2))!.level).toBe(4);
  });
});
