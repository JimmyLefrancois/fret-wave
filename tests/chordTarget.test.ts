import { describe, expect, it } from 'vitest';
import { FIRST_CHORDS, allChordIds } from '../src/modules/accords/curriculum';
import { curriculumPartners, targetOptions, transitionTo } from '../src/modules/accords/transitions';
import { masteredChordIds } from '../src/modules/accords/recommend';

const firstIds = FIRST_CHORDS.map((c) => c.voicingId);
const none = new Set<string>();

describe('accord cible d’Enchaîner (D107)', () => {
  it('« Mes premiers accords » d’abord, sans l’accord de la leçon', () => {
    const t = targetOptions('Em-022000', none, none);
    expect(t.firstChordsFirst).toBe(true);
    expect(t.priority).toEqual(firstIds.filter((id) => id !== 'Em-022000'));
  });

  it('tous les autres accords restent choisissables, une seule fois chacun', () => {
    const t = targetOptions('Em-022000', none, none);
    const all = [...t.priority, ...t.others];
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(allChordIds().filter((id) => id !== 'Em-022000').sort());
  });

  it('depuis un accord hors sélection, les huit premiers sont proposés', () => {
    expect(targetOptions('Em7-020000', none, none).priority).toEqual(firstIds);
  });

  it('appris ne suffit pas : la priorité tombe quand les huit sont appris ET maîtrisés', () => {
    const all = new Set(firstIds);
    expect(targetOptions('Em-022000', all, none).firstChordsFirst).toBe(true);
    const t = targetOptions('Em-022000', all, all);
    expect(t.firstChordsFirst).toBe(false);
    // la priorité revient aux transitions du parcours pour cet accord
    expect(t.priority).toEqual(curriculumPartners('Em-022000'));
    expect(t.priority).toContain('Em7-020000');
  });

  it('une paire choisie est décrite comme une paire du parcours', () => {
    const c = transitionTo('C-x32010', 'Am-x02210', none)!;
    expect(c.pair).toMatchObject({ a: 'C-x32010', b: 'Am-x02210', shared: 2 });
    expect(c.tier).toBe('new');
    expect(transitionTo('C-x32010', 'Am-x02210', new Set(['C-x32010', 'Am-x02210']))!.reason).toContain('2 doigts en commun');
    expect(transitionTo('Em-022000', 'Em-022000', none)).toBeNull();
    expect(transitionTo('Em-022000', 'inconnu', none)).toBeNull();
  });

  it('seuls les nœuds de forme maîtrisés comptent', () => {
    const m = masteredChordIds([
      { nodeKind: 'accord', state: 'mastered', chordId: 'Em-022000' },
      { nodeKind: 'accord', state: 'learned', chordId: 'Am-x02210' },
      { nodeKind: 'transition', state: 'mastered', chordId: null },
    ]);
    expect([...m]).toEqual(['Em-022000']);
  });
});
