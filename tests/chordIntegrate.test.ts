import { describe, expect, it } from 'vitest';
import {
  PROGRESSIONS, PROGRESSIONS as ALL, progressionById, progressionCandidates, progressionScore, progressionVoicings,
} from '../src/modules/accords/progressions';
import { voicingById } from '../src/data/voicings';
import { mainlineChordIds } from '../src/modules/accords/curriculum';
import { validateScore } from '../src/core/tab/model';
import { nodeIdOf, xpForAttempt, type Attempt } from '../src/core/progress';
import { summarizeNodes } from '../src/core/progress/mastery';
import { learnedChordIds } from '../src/modules/accords/recommend';

function attempt(patch: Partial<Attempt> = {}): Attempt {
  return {
    id: 'p1', ts: 1_700_000_000_000, kind: 'strum', scaleId: '', tonic: '', tuningId: 'standard', system: 'accord',
    positionId: '', formIndex: 0, level: 1, strings: 6, correct: null, total: null, seconds: 0,
    fretMin: 0, missedStrings: [], tempoOk: false, module: 'accords',
    ...patch,
  };
}

describe('Intégrer — les progressions proposées', () => {
  it('toutes les progressions sont jouables : accords du parcours, accordage unique, chiffrage complet', () => {
    const mainline = new Set(mainlineChordIds());
    for (const p of ALL) {
      expect(p.voicingIds.length).toBeGreaterThanOrEqual(3);
      expect(p.romans).toHaveLength(p.voicingIds.length);
      for (const id of p.voicingIds) {
        const v = voicingById(id);
        expect(v, `${p.id} → ${id}`).toBeDefined();
        expect(v!.tuningId).toBe('standard');
        expect(mainline.has(id), `${p.id} : ${id} n’est pas dans le parcours`).toBe(true);
      }
    }
  });

  it('aucune progression n’impose un barré complet', () => {
    for (const p of ALL) {
      for (const v of progressionVoicings(p)) {
        expect(v.difficulty, `${v.id}`).toBeLessThan(5);
      }
    }
  });

  it('les progressions jouables passent devant, et les accords manquants sont nommés', () => {
    const learned = new Set(['A-x02220', 'D-xx0232', 'E-022100']);
    const cands = progressionCandidates(learned);
    expect(cands[0]!.playable).toBe(true);
    expect(cands[0]!.progression.id).toBe('rock-A');
    expect(cands[0]!.missing).toEqual([]);
    const pop = cands.find((c) => c.progression.id === 'pop-Em')!;
    expect(pop.playable).toBe(false);
    expect(pop.missing).toEqual(['Em-022000', 'C-x32010', 'G-320003']);
    // le tri est croissant sur le nombre d'accords manquants
    const counts = cands.map((c) => c.missing.length);
    expect([...counts].sort((a, b) => a - b)).toEqual(counts);
  });

  it('la tablature est valide : une mesure par accord, un motif de strum', () => {
    const p = progressionById('pop-Em')!;
    const score = progressionScore(p, { tempo: 70, pattern: 'quarters' });
    expect(score.kind).toBe('progression');
    expect(score.measures).toHaveLength(4);
    expect(score.tempo).toBe(70);
    expect(() => validateScore(score)).not.toThrow();
    // le chiffrage romain est écrit au-dessus de chaque mesure
    expect(score.measures.map((m) => m.label?.roman)).toEqual(p.romans);
  });

  it('changer de motif change les frappes sans changer les accords', () => {
    const p = progressionById('folk-G')!;
    const quarters = progressionScore(p, { pattern: 'quarters' });
    const eighths = progressionScore(p, { pattern: 'eighths' });
    expect(quarters.measures[0]!.events.filter((e) => e.kind === 'notes')).toHaveLength(4);
    expect(eighths.measures[0]!.events.filter((e) => e.kind === 'notes')).toHaveLength(8);
    // mêmes hauteurs dans les deux : seul le rythme change
    const pitches = (s: typeof quarters) => s.measures[0]!.events[0]!.notes.map((n) => n.midi).join(',');
    expect(pitches(quarters)).toBe(pitches(eighths));
  });

  it('les progressions couvrent les tonalités faciles à la guitare', () => {
    const keys = new Set(PROGRESSIONS.map((p) => p.key));
    expect(keys.has('Sol majeur')).toBe(true);
    expect(keys.has('Do majeur')).toBe(true);
    expect(keys.has('La majeur')).toBe(true);
  });
});

describe('Intégrer — ce qui est écrit au journal', () => {
  it('une progression déclarée a son propre nœud, ne rapporte aucun XP et ne rend rien « appris »', () => {
    const a = attempt({ progressionId: 'pop-Em', correct: null, total: null });
    expect(nodeIdOf(a)).toBe('acc:progression:pop-Em');
    expect(xpForAttempt(a)).toBe(0);
    expect(summarizeNodes([a])).toHaveLength(0);
    expect(learnedChordIds([a]).size).toBe(0);
  });

  it('une transition vérifiée est un nœud distinct, entre la paire et le savoir', () => {
    const a = attempt({ kind: 'transition', chordId: 'Em-022000', chordIdB: 'Am-x02210', correct: 4, total: 5, changeMs: 1800 });
    expect(nodeIdOf(a)).toBe('acc:transition:Em-022000>Am-x02210');
    const node = summarizeNodes([a])[0]!;
    expect(node.nodeKind).toBe('transition');
    expect(node.pair).toEqual(['Em-022000', 'Am-x02210']);
    expect(node.chordId).toBeNull();
    expect(node.changeMs).toBe(1800);
    expect(node.last).toBeCloseTo(0.8, 6);
  });

  it('le QCM est un savoir : il ne rend jamais l’accord « appris »', () => {
    const q = attempt({ kind: 'qcm', chordId: 'Em-022000', correct: 1, total: 1 });
    expect(nodeIdOf(q)).toBe('acc:savoir:Em-022000');
    // deux bonnes réponses sur deux jours : le savoir est « appris », mais ce n'est pas la forme
    const node = summarizeNodes([
      { ...q, ts: q.ts - 86_400_000 },
      { ...q, id: 'q2' },
    ])[0]!;
    expect(node.state).toBe('learned');
    expect(node.nodeKind).toBe('savoir');
    expect(learnedChordIds([q])).toBeDefined();
    expect(learnedChordIds([q]).has('Em-022000')).toBe(false);
    // un QCM ne paie pas le bonus de vitesse : 6 XP, pas 11
    expect(xpForAttempt(q)).toBe(6);
  });

  it('une pose à froid paie comme un rappel (mémoire), pas comme une lecture', () => {
    const c = attempt({ kind: 'cold', chordId: 'Em-022000', correct: 6, total: 6, seconds: 4, limitSec: 8 });
    expect(xpForAttempt(c)).toBe(20); // 15 × 1 + 5
    expect(nodeIdOf(c)).toBe('acc:accord:Em-022000');
  });
});
