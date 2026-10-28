import { describe, expect, it } from 'vitest';
import { buildReviewQueue, REVIEW_MAX } from '../src/modules/gammes/review';
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
    strings: 2,
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

  it('les cartes dues passent en premier, par échéance croissante', () => {
    const list = [
      ionian(at(2), { correct: 4, total: 5 }),                       // boîte 1, due depuis 2 jours
      attempt({ ts: at(6), correct: 5, total: 5 }),                  // boîte 2
      attempt({ ts: at(3), correct: 5, total: 5 }),                  // boîte 3 → due maintenant
      dorian(NOW, { correct: 3, total: 5 }),                         // échec : due dans 10 min
    ];
    const due = dueCards(cardsFrom(list), NOW);
    expect(due.length).toBe(2);
    // rappel à froid désactivé : le choix de niveau de la phase 2
    const q = buildReviewQueue(list, NOW, REVIEW_MAX, { cold: false });
    expect(q.length).toBe(3);
    // les cartes dues ouvrent la file, dans l'ordre du planificateur
    due.forEach((c, i) => expect(q[i]!.nodeId).toBe(c.nodeId));
    expect(q[0]!.reason).toContain('due');
    expect(q.every((t) => t.mode === 'practice' && t.segment === 'strings2')).toBe(true);
    // une carte à boîte ≥ 3 se révise de mémoire (N3), une boîte 1 avec les notes visibles (N2)
    const pent = q.find((t) => t.nodeId === 'gam:lecture:pentatonic-minor:boxes:0')!;
    const box = cardsFrom(list).find((c) => c.nodeId === pent.nodeId)!.box;
    expect(pent.level).toBe(box >= 3 ? 3 : 2);
    expect(q.find((t) => t.nodeId === 'gam:lecture:ionian:caged:0')!.level).toBe(2);
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
    const list = Array.from({ length: 8 }, (_, i) => attempt({ ts: at(3), correct: 5, total: 5, formIndex: i % 4 }));
    expect(buildReviewQueue(list, NOW).length).toBeLessThanOrEqual(REVIEW_MAX);
    expect(buildReviewQueue(list, NOW, 2).length).toBe(2);
  });

  it('rappel à froid (défaut) : une carte due se révise en N3 sur la position entière', () => {
    const list = [
      ionian(at(2), { correct: 4, total: 5 }),           // boîte 1, due
      attempt({ ts: at(3), correct: 5, total: 5 }),      // due
      dorian(NOW, { correct: 5, total: 5 }),             // pas due : forme fragile, exercice ordinaire
    ];
    const q = buildReviewQueue(list, NOW);
    const due = dueCards(cardsFrom(list), NOW).map((c) => c.nodeId);
    expect(due.length).toBe(2);
    for (const t of q) {
      if (due.includes(t.nodeId)) {
        expect(t.mode).toBe('cold');
        expect(t.level).toBe(3);
        expect(t.segment).toBe('all');
        expect(t.reason).toContain('rappel à froid');
      } else {
        expect(t.mode).toBe('practice');
        expect(t.level).toBe(2);
        expect(t.segment).toBe('strings2');
      }
    }
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
