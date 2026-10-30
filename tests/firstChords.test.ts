import { describe, expect, it } from 'vitest';
import { voicingById } from '../src/data/voicings';
import {
  FIRST_CHORDS, FIRST_CHORDS_MORE, FIRST_CHORDS_PLAN, allChordIds, mainlineChordIds, palierOfVoicing,
} from '../src/modules/accords/curriculum';
import { chordProgress, firstChordsProgress } from '../src/modules/accords/recommend';
import { pivotFingers, pivotSentence } from '../src/modules/accords/transitions';
import { arpeggioCheck, mutedAdvice } from '../src/modules/accords/lesson';
import { progressionById, progressionVoicings } from '../src/modules/accords/progressions';

const v = (id: string) => voicingById(id)!;

describe('« Mes premiers accords » (D105)', () => {
  it('huit essentiels et deux extras, tous déjà dans un palier du parcours', () => {
    expect(FIRST_CHORDS).toHaveLength(8);
    const ids = [...FIRST_CHORDS, ...FIRST_CHORDS_MORE].map((c) => c.voicingId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(voicingById(id), id).toBeDefined();
      expect(allChordIds(), id).toContain(id);
      expect(palierOfVoicing(id), id).not.toBeNull();
    }
    expect(FIRST_CHORDS_PLAN).toHaveLength(3);
  });

  it('la sélection ne double aucun accord du parcours : les compteurs ne changent pas', () => {
    const ids = mainlineChordIds();
    expect(new Set(ids).size).toBe(ids.length);
    expect(chordProgress(new Set()).total).toBe(ids.length);
  });

  it('les mineurs d’abord, Do et Sol en dernier, marqués difficiles', () => {
    const chords = FIRST_CHORDS.map((c) => v(c.voicingId).chord);
    expect(chords.slice(0, 3)).toEqual(['Em', 'Am', 'Dm']);
    expect(chords.slice(-2)).toEqual(['C', 'G']);
    expect(FIRST_CHORDS.filter((c) => c.hard).map((c) => v(c.voicingId).chord)).toEqual(['C', 'G']);
  });

  it('la progression compte les huit essentiels seulement', () => {
    expect(firstChordsProgress(new Set())).toEqual({ done: 0, total: 8 });
    expect(firstChordsProgress(new Set(['Em-022000', 'Am-x02210', 'Fmaj7-xx3210']))).toEqual({ done: 2, total: 8 });
  });
});

describe('doigt pivot', () => {
  it('Do → La mineur : l’index et le majeur restent posés, seul l’annulaire bouge', () => {
    expect(pivotFingers(v('C-x32010'), v('Am-x02210'))).toEqual([1, 2]);
    expect(pivotSentence(v('C-x32010'), v('Am-x02210'))).toBe('L’index et le majeur restent posés : seul l’annulaire bouge.');
  });

  it('même case, autre doigt : ce n’est pas un pivot (Em → Am)', () => {
    expect(pivotFingers(v('Em-022000'), v('Am-x02210'))).toEqual([]);
    expect(pivotSentence(v('Em-022000'), v('Am-x02210'))).toContain('Aucun doigt ne reste posé');
  });

  it('Ré → Sol : aucun pivot, le conseil est de former l’accord en l’air', () => {
    expect(pivotSentence(v('D-xx0232'), v('G-320003'))).toContain('en l’air');
  });

  it('un doigt absent de la forme de départ « se pose », il ne « bouge » pas (Cmaj7 → Do)', () => {
    expect(pivotSentence(v('Cmaj7-x32000'), v('C-x32010'))).toBe('Le majeur et l’annulaire restent posés : il suffit de poser l’index.');
  });

  it('vers un accord plus petit : on lève seulement (Do → Cmaj7)', () => {
    expect(pivotSentence(v('C-x32010'), v('Cmaj7-x32000'))).toBe('Le majeur et l’annulaire restent posés : il suffit de lever les autres doigts.');
  });
});

describe('corde étouffée : la cause probable', () => {
  it('nomme le doigt couché de la corde voisine quand on le connaît', () => {
    const checks = arpeggioCheck(v('Am-x02210'));
    const g = checks.find((c) => c.fret === 0 && c.string === 3)!; // corde de Sol à vide
    const t = mutedAdvice(g, { stringLabel: 'Sol' }, { finger: 3, stringLabel: 'Ré' }).text;
    expect(t).toContain('corde de Sol');
    expect(t).toContain('annulaire posé sur la corde de Ré');
    expect(t).toContain('perpendiculaire');
  });

  it('sans voisin connu : la consigne de posture, et rejouer la corde seule', () => {
    const checks = arpeggioCheck(v('Em-022000'));
    const t = mutedAdvice(checks[1]!, { stringLabel: 'La' }).text;
    expect(t).toContain('bout du doigt');
    expect(t).toContain('Rejoue-la seule');
  });
});

describe('progression « Mineurs en La »', () => {
  it('La mineur, Mi, Ré mineur, La mineur : trois accords de la sélection', () => {
    const p = progressionById('minor-Am')!;
    expect(progressionVoicings(p).map((x) => x.chord)).toEqual(['Am', 'E', 'Dm', 'Am']);
    const first = new Set(FIRST_CHORDS.map((c) => c.voicingId));
    expect(p.voicingIds.every((id) => first.has(id))).toBe(true);
  });
});
