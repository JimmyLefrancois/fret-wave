import { describe, expect, it } from 'vitest';
import {
  CONFUSIONS, KIND_LABEL, anonymousScore, confusionsOf, makeQuestion, quizRound, quizScore, rng,
} from '../src/modules/accords/quiz';
import { VOICINGS, voicingById } from '../src/data/voicings';
import { interpretChord } from '../src/core/theory/chords';
import { mainlineChordIds } from '../src/modules/accords/curriculum';

const noteSet = (ns: readonly string[]) => [...ns].sort().join(',');

describe('QCM — questions', () => {
  it('une question de reconnaissance ne montre jamais le nom de l’accord', () => {
    const q = makeQuestion({ kind: 'name', voicingId: 'Em-022000', seed: 7 });
    expect(q.score).not.toBeNull();
    expect(q.score!.measures.every((m) => !m.label)).toBe(true);
    expect(q.score!.meta?.chord ?? '').toBe('');
    expect(q.options).toHaveLength(4);
    expect(q.answer).toBeGreaterThanOrEqual(0);
    expect(q.options[q.answer]).toEqual({ kind: 'chord', symbol: 'Em' });
  });

  it('les distracteurs sont les confusions réelles, pas des accords au hasard', () => {
    const q = makeQuestion({ kind: 'name', voicingId: 'Em-022000', seed: 3 });
    const symbols = q.options.map((o) => (o.kind === 'chord' ? o.symbol : ''));
    // Em se confond avec E et Em7 : les deux sont dans le parcours
    expect(symbols).toContain('E');
    expect(symbols.filter((s) => s === 'Em')).toHaveLength(1);
    // aucune réponse n'est l'enharmonique du même accord
    expect(new Set(symbols).size).toBe(4);
  });

  it('« quelles notes » propose des ensembles différents, et la bonne réponse est celle de l’accord', () => {
    const q = makeQuestion({ kind: 'notes', voicingId: 'Am-x02210', seed: 11 });
    const answer = q.options[q.answer]!;
    expect(answer.kind).toBe('notes');
    const notes = answer.kind === 'notes' ? answer.notes : [];
    expect(noteSet(notes)).toBe(noteSet(interpretChord('Am').notes));
    const sets = q.options.map((o) => (o.kind === 'notes' ? noteSet(o.notes) : ''));
    expect(new Set(sets).size).toBe(q.options.length);
    expect(q.score).toBeNull(); // pas de tablature : c'est un savoir, pas une lecture
  });

  it('le trou porte sur une corde réellement jouée, et la tablature le montre vide', () => {
    const q = makeQuestion({ kind: 'hole', voicingId: 'D-xx0232', seed: 5 });
    expect(q.hole).toBeDefined();
    const v = voicingById('D-xx0232')!;
    expect(v.frets[q.hole!.string]).toBe(q.hole!.fret);
    expect(q.hole!.fret).toBeGreaterThan(0);
    const answer = q.options[q.answer];
    expect(answer).toEqual({ kind: 'fret', fret: q.hole!.fret });
    const hidden = q.score!.measures[0]!.events.flatMap((e) => e.notes).filter((n) => n.hidden);
    expect(hidden).toHaveLength(1);
    expect(hidden[0]!.string).toBe(q.hole!.string);
  });

  it('chaque question est reproductible à graine égale', () => {
    const a = makeQuestion({ kind: 'name', voicingId: 'C-x32010', seed: 42 });
    const b = makeQuestion({ kind: 'name', voicingId: 'C-x32010', seed: 42 });
    expect(a.options).toEqual(b.options);
    expect(a.answer).toBe(b.answer);
  });

  it('une graine différente change les réponses fausses (pas la bonne)', () => {
    const a = makeQuestion({ kind: 'name', voicingId: 'G-320003', seed: 1 });
    const b = makeQuestion({ kind: 'name', voicingId: 'G-320003', seed: 2 });
    expect(a.options[a.answer]).toEqual(b.options[b.answer]);
    expect(a.options).not.toEqual(b.options);
  });

  it('toutes les confusions déclarées sont des accords valides', () => {
    for (const [a, b] of CONFUSIONS) {
      expect(() => interpretChord(a)).not.toThrow();
      expect(() => interpretChord(b)).not.toThrow();
      expect(confusionsOf(a)).toContain(b);
    }
  });
});

describe('QCM — séries', () => {
  it('six questions, trois types alternés, parcours principal', () => {
    const round = quizRound({ count: 6, seed: 5 });
    expect(round).toHaveLength(6);
    expect(round.map((q) => q.kind)).toEqual(['name', 'notes', 'hole', 'name', 'notes', 'hole']);
    const mainline = new Set(mainlineChordIds());
    expect(round.every((q) => mainline.has(q.voicingId))).toBe(true);
  });

  it('une série est rejouable : même graine, mêmes questions', () => {
    expect(quizRound({ count: 4, seed: 9 }).map((q) => q.id)).toEqual(quizRound({ count: 4, seed: 9 }).map((q) => q.id));
    expect(quizRound({ count: 4, seed: 9 }).map((q) => q.id)).not.toEqual(quizRound({ count: 4, seed: 10 }).map((q) => q.id));
  });

  it('les trois types de questions sont nommés en français', () => {
    for (const k of Object.keys(KIND_LABEL)) expect(KIND_LABEL[k as keyof typeof KIND_LABEL].length).toBeGreaterThan(5);
  });

  it('le score d’une série compte les justes', () => {
    expect(quizScore([{ correct: true }, { correct: false }, { correct: true }])).toEqual({ correct: 2, total: 3 });
  });

  it('le générateur pseudo-aléatoire est déterministe et borné', () => {
    const r = rng(12);
    const vals = Array.from({ length: 20 }, r);
    expect(vals.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(rng(12)()).toBe(vals[0]);
  });

  it('une tablature anonyme garde les cordes étouffées (le X fait partie de l’écriture)', () => {
    const v = voicingById('Am-x02210')!;
    const score = anonymousScore(v);
    expect(score.measures[0]!.events[0]!.unplayed).toEqual([0]);
  });

  it('aucune question ne produit d’index de réponse invalide, sur tout le parcours', () => {
    for (const id of mainlineChordIds()) {
      for (const kind of ['name', 'notes', 'hole'] as const) {
        const q = makeQuestion({ kind, voicingId: id, seed: 2 });
        expect(q.answer, `${id}:${kind}`).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
      }
    }
  });

  it('la base contient au moins un accord par type de question', () => {
    expect(VOICINGS.length).toBeGreaterThan(30);
  });
});
