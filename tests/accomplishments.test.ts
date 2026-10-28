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

    // deux jours, mais aucune réussite forte (position entière, de mémoire ou au micro) : pas encore
    const twoDaysWeak = accomplishments([mk(T0, 3, 3), mk(T0 + DAY, 3, 3)]);
    expect(twoDaysWeak.filter((e) => e.kind === 'learned')).toHaveLength(0);

    const twoDays = accomplishments([mk(T0, 3, 3), mk(T0 + DAY, 3, 3, { level: 3, kind: 'recall', strings: 6 })]);
    const learned = twoDays.filter((e) => e.kind === 'learned');
    expect(learned).toHaveLength(1);
    expect(learned[0]?.detail).toBe('2 réussites sur 2 jours · position entière de mémoire ou au micro');
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

  it('une journée d’écoute seule ne fait pas durer la série', () => {
    const listen = mk(T0 + DAY, 0, 0, { kind: 'listen', correct: null, total: null });
    const withListen = accomplishments([mk(T0, 3, 3), listen, mk(T0 + 2 * DAY, 3, 3, { formIndex: 1 })])
      .filter((e) => e.kind === 'streak');
    expect(withListen).toHaveLength(0);
    const played = accomplishments([mk(T0, 3, 3), mk(T0 + DAY, 3, 3, { formIndex: 2 }), mk(T0 + 2 * DAY, 3, 3, { formIndex: 1 })])
      .filter((e) => e.kind === 'streak');
    expect(played).toHaveLength(1);
    expect(played[0]?.detail).toBe('au moins un exercice vérifié chaque jour');
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

  it('vocabulaire d’élève : « Passage réussi », pas de code de niveau, XP et grille en second', () => {
    const pass = accomplishments([mk(T0, 4, 5, { tempoOk: true })]).find((e) => e.kind === 'pass');
    expect(pass?.title).toBe('Passage réussi');
    expect(pass?.detail).toBe('80\u00a0% au premier essai · exercice à trous');
    expect(pass?.detail).not.toMatch(/N\d|XP|grille/);
    expect(pass?.extra).toContain('grille tenue');
    expect(pass?.extra).toMatch(/\+\d+ XP/);
  });

  it('un accord connu s’affiche par son nom, pas par l’identifiant de son doigté', () => {
    const a = mk(T0, 3, 3, { module: 'accords', kind: 'arpeggio', chordId: 'Em-022000', scaleId: '', tonic: 'E' });
    const [e] = accomplishments([a], { notation: 'en' });
    expect(e?.subject).toBe('Em');
  });

  it('les noms d’accords suivent leur propre réglage de notation', () => {
    const a = mk(T0, 3, 3, { module: 'accords', kind: 'arpeggio', chordId: 'Em-022000', scaleId: '', tonic: 'E' });
    expect(accomplishments([a], { notation: 'fr', chordNotation: 'en' })[0]?.subject).toBe('Em');
  });

  it('un exercice d’accord ne se dit jamais « à trous »', () => {
    const pluck = mk(T0, 5, 6, { module: 'accords', kind: 'pluck', chordId: 'Em-022000', scaleId: '', tonic: 'E' });
    const arp = mk(T0 + 1, 3, 3, { module: 'accords', kind: 'arpeggio', chordId: 'Em-022000', scaleId: '', tonic: 'E' });
    const details = accomplishments([pluck, arp]).map((e) => e.detail).join(' | ');
    expect(details).toContain('corde par corde');
    expect(details).toContain('arpège');
    expect(details).not.toContain('trous');
  });
});
