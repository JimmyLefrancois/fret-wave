import { describe, expect, it } from 'vitest';
import {
  buildReviewQueue, formReviewTarget, moreDue, reviewCount, reviewDelayText, reviewSummary, sessionFact, REVIEW_MAX,
} from '../src/modules/gammes/review';
import { nodeIdOf, summarizeNodes, zoneOf } from '../src/core/progress';
import { DUE_CAP } from '../src/core/progress/scheduler';
import { resolveScale } from '../src/modules/gammes/resolve';
import type { Attempt } from '../src/core/progress/journal';
import { cardsFrom, dueCards } from '../src/core/progress/scheduler';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 27, 18, 0).getTime();
const at = (daysAgo: number) => NOW - daysAgo * DAY;

let n = 0;
function attempt(patch: Partial<Attempt> = {}): Attempt {
  const base: Attempt = {
    id: `r-${n++}`,
    ts: at(1),
    kind: 'holes',
    scaleId: 'pentatonic-minor',
    tonic: 'A',
    tuningId: 'standard',
    system: 'boxes',
    positionId: 'boxes:0',
    formIndex: 0,
    level: 2,
    // position entière : un segment de 1-3 cordes ne crée pas de carte (D97)
    strings: 6,
    correct: 4,
    total: 5,
    seconds: 30,
    fretMin: 5,
    missedStrings: [],
    tempoOk: false,
  };
  return { ...base, ...patch };
}

const dorian = (ts: number, patch: Partial<Attempt> = {}) =>
  attempt({ ts, scaleId: 'dorian', tonic: 'D', system: '3nps', positionId: '3nps:0', ...patch });
const ionian = (ts: number, patch: Partial<Attempt> = {}) =>
  attempt({ ts, scaleId: 'ionian', tonic: 'C', system: 'caged', positionId: 'caged:0', ...patch });

describe('session de révision mélangée', () => {
  it('journal vide : aucune forme proposée, pas d’exception', () => {
    expect(buildReviewQueue([], NOW)).toEqual([]);
    expect(buildReviewQueue([attempt({ kind: 'listen', correct: null, total: null })], NOW)).toEqual([]);
  });

  it('seules les cartes dues entrent, par échéance croissante', () => {
    const list = [
      ionian(at(2), { correct: 4, total: 5 }),                       // boîte 1, due depuis 2 jours
      attempt({ ts: at(6), correct: 5, total: 5 }),                  // boîte 2
      attempt({ ts: at(3), correct: 5, total: 5 }),                  // boîte 3 → due maintenant
      dorian(NOW, { correct: 3, total: 5 }),                         // échec : due dans 10 min, pas encore
    ];
    const due = dueCards(cardsFrom(list), NOW);
    expect(due.length).toBe(2);
    const q = buildReviewQueue(list, NOW);
    expect(q.map((t) => t.nodeId)).toEqual(due.map((c) => c.nodeId));
    expect(q.every((t) => /^palier \d sur 6$/.test(t.reason))).toBe(true);
  });

  it('une carte née d’un ancien exercice à trous reste due et se révise à froid', () => {
    const q = buildReviewQueue([attempt({ ts: at(6), kind: 'holes', level: 2, correct: 5, total: 5 })], NOW);
    expect(q).toHaveLength(1);
    expect(q[0]!.reason).toBe('palier 2 sur 6');
  });

  it('deux formes de la même gamme ne se suivent pas quand une alternative existe', () => {
    // entrée groupée par gamme (deux formes de chaque) : la file doit alterner les gammes
    const list = [
      attempt({ ts: at(6), correct: 5, total: 5, formIndex: 0 }),
      attempt({ ts: at(5), correct: 5, total: 5, formIndex: 1 }),
      dorian(at(6), { formIndex: 0, correct: 5, total: 5 }),
      dorian(at(4), { formIndex: 1, correct: 5, total: 5 }),
      ionian(at(6), { formIndex: 0, correct: 5, total: 5 }),
      ionian(at(3), { formIndex: 0, correct: 4, total: 5 }),
    ];
    const q = buildReviewQueue(list, NOW);
    expect(q.length).toBe(5);
    for (let i = 1; i < q.length; i++) {
      expect(`${q[i]!.selection.scaleId}|${q[i]!.selection.system}`)
        .not.toBe(`${q[i - 1]!.selection.scaleId}|${q[i - 1]!.selection.system}`);
    }
  });

  it('chaque cible rouvre la même forme dans une position réelle', () => {
    const list = [
      attempt({ ts: at(6), correct: 5, total: 5, formIndex: 0 }),
      dorian(at(4), { formIndex: 2, correct: 5, total: 5 }),
      ionian(at(3), { formIndex: 1, correct: 4, total: 5 }),
    ];
    const q = buildReviewQueue(list, NOW);
    expect(q.length).toBe(3);
    for (const t of q) {
      const r = resolveScale(t.selection);
      expect(r.position).not.toBeNull();
      expect(t.positionLabel.length).toBeGreaterThan(0);
      expect(t.title.length).toBeGreaterThan(0);
      const formIndex = r.position!.formIndex ?? r.position!.index;
      const fromNode = list.find((a) => `gam:lecture:${a.scaleId}:${a.system}:${a.formIndex}` === t.nodeId)!;
      expect(formIndex).toBe(fromNode.formIndex);
    }
  });

  it('plafond respecté, et une écoute ne crée pas de cible', () => {
    const list = Array.from({ length: 8 }, (_, i) => attempt({ ts: at(4), correct: 5, total: 5, formIndex: i % 4 }));
    expect(buildReviewQueue(list, NOW).length).toBeLessThanOrEqual(REVIEW_MAX);
    expect(buildReviewQueue(list, NOW, 2).length).toBe(2);
  });

  it('une prise d’impro ne sert pas de « dernière tentative » à une forme', () => {
    const impro = attempt({ ts: at(1), kind: 'impro', level: 4, tonic: 'E', correct: 3, total: 10 });
    const list = [attempt({ ts: at(3), correct: 5, total: 5, tonic: 'A' }), impro];
    const q = buildReviewQueue(list, NOW);
    const lecture = q.find((t) => t.nodeId === 'gam:lecture:pentatonic-minor:boxes:0')!;
    // la forme rouvre dans la tonique de la dernière série de lecture, pas dans celle de l'impro
    expect(lecture.selection.tonic).toBe('A');
  });
});

/** Rappel N3 sur la position entière (ce qui fait une forme « apprise » ou « maîtrisée »). */
const recall = (ts: number, patch: Partial<Attempt> = {}) =>
  attempt({ ts, kind: 'recall', level: 3, strings: 6, fullPosition: true, correct: 10, total: 10, ...patch });

describe('révision honnête (D97)', () => {
  it('une forme maîtrisée non due n’entre pas dans la file', () => {
    // 4 réussites nettes sur 4 jours : palier 5 (16 j), donc maîtrisée et pas due
    const list = [recall(at(30)), recall(at(28)), recall(at(24)), recall(at(16))];
    const node = summarizeNodes(list)[0]!;
    expect(node.state).toBe('mastered');
    expect(dueCards(cardsFrom(list), NOW)).toEqual([]);
    expect(buildReviewQueue(list, NOW)).toEqual([]);
  });

  it('une forme en apprentissage attend son échéance, une forme rappelée à froid attend demain', () => {
    const list = [
      // en apprentissage, jouée il y a 2 h, palier 2 : pas due
      recall(NOW - 2 * 3_600_000, { formIndex: 2 }),
      // ratée il y a 2 h : Leitner la dit due (10 min), mais elle vient d'être rappelée à froid
      recall(NOW - 2 * 3_600_000, { formIndex: 3, correct: 2, total: 10 }),
    ];
    expect(buildReviewQueue(list, NOW)).toEqual([]);
    expect(dueCards(cardsFrom(list), NOW)).toHaveLength(1);
  });

  it('reviewCount plafonne à DUE_CAP, la séance à REVIEW_MAX', () => {
    // 8 formes dues sur 2 gammes (réussite nette il y a 2 jours : palier 2, due)
    const eight = [
      ...[0, 1, 2, 3, 4].map((formIndex) => recall(at(2), { formIndex })),
      ...[0, 1, 2].map((formIndex) => ionian(at(2), { kind: 'recall', level: 3, strings: 6, fullPosition: true, formIndex, correct: 10, total: 10 })),
    ];
    expect(reviewCount(eight, NOW)).toBe(8);
    expect(buildReviewQueue(eight, NOW)).toHaveLength(REVIEW_MAX);
    expect(moreDue(eight, NOW)).toBe(8);
    // 10 dues : la page Gammes en annonce 8
    const ten = [...eight, ...[0, 1].map((formIndex) => dorian(at(2), { kind: 'recall', level: 3, strings: 6, fullPosition: true, formIndex, correct: 10, total: 10 }))];
    expect(reviewCount(ten, NOW)).toBe(DUE_CAP);
    // après une séance de 5 rappels à froid réussis : il en reste 3 sur les 8 du jour
    const done = buildReviewQueue(eight, NOW).map((t, i) => {
      const base = eight.find((a) => `gam:lecture:${a.scaleId}:${a.system}:${a.formIndex}` === t.nodeId)!;
      return { ...base, id: `d-${i}`, ts: NOW + (i + 1) * 60_000 };
    });
    expect(moreDue([...eight, ...done], NOW + 10 * 60_000)).toBe(3);
    expect(moreDue([...ten, ...done], NOW + 10 * 60_000)).toBe(DUE_CAP - REVIEW_MAX);
  });

  it('une forme due dans une seule tonique n’est jamais transposée', () => {
    // apprise (2 réussites fortes, 2 jours), palier 3, due ; rang de révision pair
    const list = [recall(at(10)), recall(at(8))];
    expect(summarizeNodes(list)[0]!.state).toBe('learned');
    expect(cardsFrom(list)[0]!.reps % 2).toBe(0);
    const [t] = buildReviewQueue(list, NOW);
    expect(t!.selection.tonic).toBe('A');
    expect(t!.reason).toMatch(/^palier \d sur 6$/);
  });

  it('avec 2 toniques travaillées, un rappel sur deux change de zone', () => {
    // une 2e tonique travaillée sur la gamme (Mi m, position 2) : la transposition est débloquée (G1.4)
    const mi = attempt({ ts: at(9), tonic: 'E', formIndex: 1, fretMin: 3, correct: 5, total: 5 });
    // rang pair : transposée, dans une zone que la forme n'a jamais vue
    const even = [recall(at(10)), recall(at(8)), mi];
    const [t] = buildReviewQueue(even, NOW).filter((x) => x.nodeId.endsWith(':0'));
    expect(t!.selection.tonic).not.toBe('A');
    const pos = resolveScale(t!.selection).position!;
    expect(summarizeNodes(even).find((n) => n.nodeId === t!.nodeId)!.zones).not.toContain(zoneOf(pos.fretMin));
    expect(t!.reason).toMatch(/^même dessin, autre case : en .+, cases \d+–\d+$/);
    // rang impair : la tonique apprise
    const odd = [recall(at(14)), recall(at(12)), recall(at(9)), mi];
    expect(cardsFrom(odd).find((c) => c.nodeId.endsWith(':0'))!.reps % 2).toBe(1);
    const [u] = buildReviewQueue(odd, NOW).filter((x) => x.nodeId.endsWith(':0'));
    expect(u!.selection.tonic).toBe('A');
    expect(u!.reason).toMatch(/^palier \d sur 6$/);
  });
});

describe('Réviser cette forme (D128)', () => {
  const selection = { scaleId: 'pentatonic-minor', tonic: 'A', tuningId: 'standard', system: 'boxes' as const, positionIndex: 2 };

  it('vise la forme ouverte, due ou non', () => {
    const t = formReviewTarget(selection)!;
    const r = resolveScale(selection);
    expect(t.asked).toBe(true);
    expect(t.selection).toMatchObject({ scaleId: 'pentatonic-minor', tonic: 'A', positionIndex: 2 });
    expect(t.nodeId).toBe(nodeIdOf({ scaleId: 'pentatonic-minor', system: 'boxes', formIndex: r.position!.formIndex ?? r.position!.index }));
    expect(t.reason).toBe('à ta demande');
  });

  it('sa première tentative crée la carte de la forme, sans règle à part', () => {
    const t = formReviewTarget(selection)!;
    const r = resolveScale(selection);
    const first = recall(NOW, { formIndex: r.position!.formIndex ?? r.position!.index });
    expect(cardsFrom([first]).map((c) => c.nodeId)).toEqual([t.nodeId]);
  });

  it('un système indisponible retombe sur celui de la gamme, comme à l’écran', () => {
    expect(formReviewTarget({ ...selection, system: 'symmetric' })!.selection.system).toBe('boxes');
  });
});

describe('bloc « À réviser » de la page Gammes', () => {
  it('journal vide : rien à afficher', () => {
    expect(reviewSummary([], NOW)).toEqual({ forms: [], count: 0, nextDue: null });
  });

  it('une forme due : la file, pas d’échéance suivante', () => {
    const s = reviewSummary([recall(at(10))], NOW);
    expect(s.forms).toHaveLength(1);
    expect(s.count).toBe(1);
    expect(s.nextDue).toBeNull();
  });

  it('rien de dû : la prochaine échéance', () => {
    const list = [recall(NOW - 3_600_000)];
    const s = reviewSummary(list, NOW);
    expect(s.forms).toEqual([]);
    expect(s.nextDue).toBe(cardsFrom(list)[0]!.due);
  });

  it('une forme due déjà rappelée à froid aujourd’hui revient demain', () => {
    const s = reviewSummary([recall(NOW - 3_600_000, { correct: 2, total: 10 })], NOW);
    expect(s.forms).toEqual([]);
    expect(new Date(s.nextDue!).getDate()).toBe(new Date(NOW).getDate() + 1);
    expect(new Date(s.nextDue!).getHours()).toBe(0);
  });

  it('délai lisible d’un coup d’œil', () => {
    expect(reviewDelayText(0)).toBe('à réviser maintenant');
    expect(reviewDelayText(10 * 60_000)).toBe('révision dans 10 min');
    expect(reviewDelayText(5 * 3_600_000)).toBe('révision dans 5 h');
    expect(reviewDelayText(DAY)).toBe('révision dans 1 jour');
    expect(reviewDelayText(3 * DAY)).toBe('révision dans 3 jours');
  });
});

describe('sessionFact (panneau « Exercice » en séance, constat 14)', () => {
  it('rang, position et nature de la forme en cours', () => {
    const due = [recall(at(10)), recall(at(8))];
    const [cold] = buildReviewQueue(due, NOW);
    expect(sessionFact(1, 5, cold!)).toBe('2 sur 5 · Position 1 · à rafraîchir');
    expect(sessionFact(0, 1, { ...cold!, asked: true })).toBe('1 sur 1 · Position 1 · à ta demande');
    const moved = { ...cold!, reason: 'même dessin, autre case : en Ré m, cases 10–13' };
    expect(sessionFact(0, 3, moved)).toBe('1 sur 3 · Position 1 · même dessin, autre case');
  });
});
