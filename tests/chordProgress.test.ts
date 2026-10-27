import { describe, expect, it } from 'vitest';
import {
  isChordNode, chordIdOfNode, nodeIdOf, normalizeAttempt, summarizeDay, xpForAttempt, type Attempt,
} from '../src/core/progress';
import { CHORD_SUCCESSES, summarizeNodes } from '../src/core/progress/mastery';
import { cardsFrom } from '../src/core/progress/scheduler';
import { learnedChordIds, startedChordIds } from '../src/modules/accords/recommend';

const DAY = 86_400_000;
const today = new Date(2026, 9, 27, 18, 0).getTime();
const at = (daysAgo: number, hour = 10) => new Date(2026, 9, 27 - daysAgo, hour, 0).getTime();

let seq = 0;
/** Tentative d'accord, au format exact que produit la leçon. */
function chordAttempt(patch: Partial<Attempt> = {}): Attempt {
  return {
    id: `acc-${seq++}`,
    ts: at(0),
    kind: 'arpeggio',
    scaleId: '',
    tonic: '',
    tuningId: 'standard',
    system: 'accord',
    positionId: 'Em-022000',
    formIndex: 0,
    level: 1,
    strings: 6,
    correct: 6,
    total: 6,
    seconds: 30,
    fretMin: 0,
    missedStrings: [],
    tempoOk: false,
    module: 'accords',
    chordId: 'Em-022000',
    ...patch,
  };
}

describe('journal : les accords entrent dans le même modèle que les gammes', () => {
  it('un nœud d’accord a son identifiant propre, indépendant de la forme de gamme', () => {
    expect(nodeIdOf(chordAttempt())).toBe('acc:accord:Em-022000');
    expect(isChordNode('acc:accord:Em-022000')).toBe(true);
    expect(isChordNode('gam:lecture:pentatonic-minor:boxes:1')).toBe(false);
    expect(chordIdOfNode('acc:accord:C-x32010')).toBe('C-x32010');
    expect(chordIdOfNode('gam:lecture:x:y:1')).toBeNull();
  });

  it('la normalisation conserve le module et le voicing d’une tentative relue du stockage', () => {
    const round = normalizeAttempt(JSON.parse(JSON.stringify(chordAttempt())))!;
    expect(round.module).toBe('accords');
    expect(round.chordId).toBe('Em-022000');
    expect(round.kind).toBe('arpeggio');
  });

  it('les anciennes tentatives (sans module) restent des gammes', () => {
    const legacy = normalizeAttempt({ ...chordAttempt(), module: undefined, chordId: undefined, scaleId: 'major', system: 'caged' })!;
    expect(legacy.module).toBeUndefined();
    expect(nodeIdOf(legacy)).toBe('gam:lecture:major:caged:0');
  });

  it('un plaqué déclaré n’est jamais vérifié : il compte comme activité, pas comme preuve', () => {
    const strum = chordAttempt({ kind: 'strum', correct: null, total: null, seconds: 5 });
    expect(xpForAttempt(strum)).toBe(0);
    expect(summarizeNodes([strum])).toHaveLength(0);
    const day = summarizeDay([strum], new Date(today));
    expect(day.selfAssessed).toBe(1);
    expect(day.exercises).toBe(0);
  });

  it('un arpège vérifié rapporte de l’XP proportionnellement à la justesse', () => {
    expect(xpForAttempt(chordAttempt({ correct: 6, total: 6 }))).toBe(15); // 10 + 5 (≥ 95 %)
    expect(xpForAttempt(chordAttempt({ correct: 3, total: 6 }))).toBe(5);
  });
});

describe('« appris » pour un accord : trois vérifications propres sur deux jours', () => {
  it('deux réussites ne suffisent pas (contrairement à une forme de gamme)', () => {
    const two = [
      chordAttempt({ ts: at(1), correct: 6, total: 6 }),
      chordAttempt({ ts: at(0), correct: 6, total: 6 }),
    ];
    const node = summarizeNodes(two)[0]!;
    expect(node.module).toBe('accords');
    expect(node.chordId).toBe('Em-022000');
    expect(node.successes).toBe(CHORD_SUCCESSES - 1);
    expect(node.state).toBe('learning');
  });

  it('trois réussites sur deux jours : appris', () => {
    const three = [
      chordAttempt({ ts: at(1, 9), correct: 6, total: 6 }),
      chordAttempt({ ts: at(1, 20), correct: 6, total: 6 }),
      chordAttempt({ ts: at(0), correct: 6, total: 6 }),
    ];
    const node = summarizeNodes(three)[0]!;
    expect(node.successes).toBe(3);
    expect(node.successDays).toBe(2);
    expect(node.state).toBe('learned');
    expect(learnedChordIds(three).has('Em-022000')).toBe(true);
  });

  it('trois jours différents valent mieux que trois leçons le même soir', () => {
    const sameEvening = [
      chordAttempt({ ts: at(0, 9), correct: 6, total: 6 }),
      chordAttempt({ ts: at(0, 12), correct: 6, total: 6 }),
      chordAttempt({ ts: at(0, 20), correct: 6, total: 6 }),
    ];
    expect(summarizeNodes(sameEvening)[0]!.state).toBe('learning');
  });

  it('un accord raté n’entre pas dans le pool des connus, mais reste « commencé »', () => {
    const failed = chordAttempt({ correct: 3, total: 6, missedStrings: [2] });
    expect(learnedChordIds([failed]).size).toBe(0);
    expect(startedChordIds([failed]).has('Em-022000')).toBe(true);
    expect(summarizeNodes([failed])[0]!.last).toBeCloseTo(0.5, 6);
  });

  it('la répétition espacée s’applique aux accords sans code dédié', () => {
    const cards = cardsFrom([chordAttempt({ ts: today - 30 * DAY, correct: 6, total: 6 })]);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.nodeId).toBe('acc:accord:Em-022000');
    expect(cards[0]!.box).toBeGreaterThanOrEqual(2);
  });

  it('deux accords différents font deux nœuds : on ne confond pas deux formes', () => {
    const nodes = summarizeNodes([
      chordAttempt({ chordId: 'Em-022000' }),
      chordAttempt({ chordId: 'Am-x02210' }),
    ]);
    expect(nodes.map((n) => n.chordId).sort()).toEqual(['Am-x02210', 'Em-022000']);
  });
});
