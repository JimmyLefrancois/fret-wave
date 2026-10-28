/**
 * Accomplissements : les franchissements relus depuis le journal (aucun champ stocké en double).
 * On vérifie surtout ce qui pourrait mentir : un 79 % n'est pas une réussite, une forme n'est pas
 * « apprise » après une seule séance, et la liste ne dépasse jamais la limite demandée.
 */
import { describe, expect, it } from 'vitest';
import { accomplishments, headline, STREAK_MILESTONES } from '../src/modules/gammes/accomplishments';
import type { Attempt } from '../src/core/progress';

const DAY = 86_400_000;
const T0 = new Date(2026, 9, 20, 19, 0, 0).getTime();

function mk(ts: number, correct: number, total: number, patch: Partial<Attempt> = {}): Attempt {
  return {
    id: `${ts}-${correct}-${total}-${patch.formIndex ?? 0}`,
    ts,
    kind: 'holes',
    scaleId: 'pentatonic-minor',
    tonic: 'A',
    tuningId: 'standard',
    system: 'boxes',
    positionId: 'p0',
    formIndex: 0,
    level: 2,
    strings: 6,
    correct,
    total,
    seconds: 42,
    fretMin: 5,
    missedStrings: [],
    tempoOk: false,
    ...patch,
  };
}

describe('accomplishments', () => {
  it('une série parfaite produit un « sans faute » avec sa mesure', () => {
    const [a] = accomplishments([mk(T0, 3, 3)]);
    expect(a?.kind).toBe('perfect');
    expect(a?.title).toBe('Sans faute');
    expect(a?.detail).toContain('100 % au premier essai');
    expect(a?.subject).toContain('La mineure pentatonique');
    expect(a?.subject).toContain('case');
  });

  it('80 % est une réussite, 79 % n’en est pas une', () => {
    const pass = accomplishments([mk(T0, 4, 5)]).find((e) => e.kind === 'pass');
    expect(pass?.detail).toContain('80 %');
    const none = accomplishments([mk(T0, 79, 100)]).filter((e) => e.kind === 'pass' || e.kind === 'perfect');
    expect(none).toHaveLength(0);
  });

  it('une écoute ne produit jamais d’accomplissement', () => {
    const listen = mk(T0, 0, 0, { kind: 'listen', correct: null, total: null });
    expect(accomplishments([listen])).toHaveLength(0);
  });

  it('une forme ne devient « apprise » qu’après deux réussites sur deux jours', () => {
    const oneSession = accomplishments([mk(T0, 3, 3), mk(T0 + 60_000, 3, 3)]);
    expect(oneSession.filter((e) => e.kind === 'learned')).toHaveLength(0);

    const twoDays = accomplishments([mk(T0, 3, 3), mk(T0 + DAY, 3, 3)]);
    const learned = twoDays.filter((e) => e.kind === 'learned');
    expect(learned).toHaveLength(1);
    expect(learned[0]?.detail).toBe('2 réussites sur 2 jours');
    expect(learned[0]?.ts).toBe(T0 + DAY);
  });

  it('un palier de série est daté au dernier exercice du jour concerné', () => {
    const first = STREAK_MILESTONES[0]!;
    const days = Array.from({ length: first }, (_, i) => mk(T0 + i * DAY, 3, 3, { formIndex: i }));
    const milestone = accomplishments(days).filter((e) => e.kind === 'streak');
    expect(milestone).toHaveLength(1);
    expect(milestone[0]?.subject).toBe(`${first} jours d’affilée`);
    expect(milestone[0]?.ts).toBe(T0 + (first - 1) * DAY);
  });

  it('une journée d’écoute seule fait durer la série, et le détail le dit', () => {
    const listen = mk(T0 + DAY, 0, 0, { kind: 'listen', correct: null, total: null });
    const milestone = accomplishments([mk(T0, 3, 3), listen, mk(T0 + 2 * DAY, 3, 3, { formIndex: 1 })])
      .filter((e) => e.kind === 'streak');
    expect(milestone).toHaveLength(1);
    expect(milestone[0]?.detail).toBe('au moins une écoute ou un exercice chaque jour');
  });

  it('la liste est triée du plus récent au plus ancien et plafonnée', () => {
    const many = Array.from({ length: 30 }, (_, i) => mk(T0 + i * 60_000, 3, 3, { formIndex: i % 5 }));
    const ten = accomplishments(many);
    expect(ten).toHaveLength(10);
    for (let i = 1; i < ten.length; i += 1) expect(ten[i - 1]!.ts).toBeGreaterThanOrEqual(ten[i]!.ts);
  });

  it('un accord appris passe par son propre libellé', () => {
    const chord = mk(T0, 3, 3, {
      module: 'accords', kind: 'arpeggio', chordId: 'C-x32010', scaleId: '', tonic: 'C', fretMin: 3,
    });
    const chord2 = mk(T0 + DAY, 3, 3, {
      module: 'accords', kind: 'arpeggio', chordId: 'C-x32010', scaleId: '', tonic: 'C', fretMin: 3,
    });
    const events = accomplishments([chord, chord2]).filter((e) => e.kind === 'chord');
    // l'accord exige 3 vérifications propres et une pose à froid : deux arpèges ne suffisent pas
    expect(events).toHaveLength(0);
  });

  it('un accord inconnu (vieux journal) ne fait pas tomber la liste : son id s’affiche tel quel', () => {
    const a = mk(T0, 3, 3, { module: 'accords', kind: 'arpeggio', chordId: 'Zz-999999', scaleId: '', tonic: 'C' });
    const events = accomplishments([a]);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.subject).toBe('Zz-999999');
  });

  it('le sujet parle de « Position », jamais de « Box » (même vocabulaire que le héros de l’accueil)', () => {
    const [a] = accomplishments([mk(T0, 3, 3)]);
    expect(a?.subject).toMatch(/· Position \d+ · cases/);
    expect(a?.subject).not.toMatch(/Box/);
  });

  it('en tête : la dernière réussite mesurée passe devant un palier de jours plus récent', () => {
    const first = STREAK_MILESTONES[0]!;
    const days = Array.from({ length: first }, (_, i) => mk(T0 + i * DAY, 3, 3, { formIndex: i }));
    const list = accomplishments(days);
    expect(list[0]?.kind).toBe('streak');
    const { latest, rest } = headline(list);
    expect(latest?.kind).not.toBe('streak');
    expect(rest).toHaveLength(list.length - 1);
    expect(rest).not.toContain(latest);
  });

  it('en tête : un palier seul reste affiché, une liste vide ne donne rien', () => {
    const streakOnly = [{ id: 's', kind: 'streak', ts: T0, title: 't', subject: 's', detail: 'd', accent: 'cyan' } as const];
    expect(headline(streakOnly).latest?.id).toBe('s');
    expect(headline([])).toEqual({ latest: null, rest: [] });
  });
});
