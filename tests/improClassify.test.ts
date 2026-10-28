import { describe, expect, it } from 'vitest';
import {
  CHORD_INTERVALS, judgeNote, ROLE_LABEL, scoreOf, summarizeImpro, type ImproNote, type NoteRole,
} from '../src/core/impro/classify';

/** E mineur pentatonique : E G A B D (pas de tierce majeure, pas de sixte). */
const EM_PENTA = [4, 7, 9, 11, 2];
/** E mineur naturelle : E F# G A B C D. */
const EM_NAT = [4, 6, 7, 9, 11, 0, 2];
const midiOf = (pc: number): number => 60 + pc;

describe('rôles harmoniques', () => {
  it('reconnaît les notes de l’accord, avec leur degré', () => {
    const em = { root: 4, quality: 'min' as const };
    expect(judgeNote(midiOf(4), em, EM_NAT)).toMatchObject({ role: 'chord', chordDegree: 1 });
    expect(judgeNote(midiOf(7), em, EM_NAT)).toMatchObject({ role: 'chord', chordDegree: 3 });
    expect(judgeNote(midiOf(11), em, EM_NAT)).toMatchObject({ role: 'chord', chordDegree: 5 });
  });

  it('nomme les tensions consonantes comme des couleurs, et la sixte comme un passage', () => {
    const em7 = { root: 4, quality: 'min7' as const };
    // Fa♯ (9 de Em7) : couleur
    expect(judgeNote(midiOf(6 + 12), em7, EM_NAT).role).toBe('color');
    // Do (♭6 de Em) : dans la gamme, mais pas une tension consonante du mineur — c'est un passage.
    // C'est le choix assumé de la table : sur un mineur, la ♭6 colore l'éolien mais frotte la quinte.
    expect(judgeNote(midiOf(0), em7, EM_NAT).role).toBe('passing');
    // septième mineure : note d'accord
    expect(judgeNote(midiOf(2), em7, EM_NAT)).toMatchObject({ role: 'chord', chordDegree: 7 });
  });

  it('marque la quarte comme note à éviter sur un accord majeur, jamais sur un mineur', () => {
    const c = { root: 0, quality: 'maj' as const };
    // Fa sur Do : quarte, à éviter
    expect(judgeNote(midiOf(5), c, [0, 2, 4, 5, 7, 9, 11]).role).toBe('avoid');
    // La même quarte sur un accord **mineur** est une onzième consonne : Do m7
    const cm7 = { root: 0, quality: 'min7' as const };
    expect(judgeNote(midiOf(5), cm7, [0, 2, 3, 5, 7, 10]).role).toBe('color');
  });

  it('distingue « passage » (dans la gamme) et « hors gamme »', () => {
    const em = { root: 4, quality: 'min' as const };
    // Ré (♭7) : dans la gamme, ni accord ni tension → passage
    expect(judgeNote(midiOf(2), em, EM_NAT)).toMatchObject({ role: 'passing' });
    // Fa (♭2) : hors de la mineure naturelle de Mi
    expect(judgeNote(midiOf(5), em, EM_NAT).role).toBe('out');
    // et dans la pentatonique, Sol♯ n'existe pas non plus
    expect(judgeNote(midiOf(8), em, EM_PENTA).role).toBe('out');
  });

  it('donne un libellé lisible pour chaque rôle', () => {
    for (const role of Object.keys(ROLE_LABEL) as NoteRole[]) {
      expect(ROLE_LABEL[role].length).toBeGreaterThan(2);
    }
  });
});

describe('score et conseil', () => {
  const note = (role: NoteRole, beatPhase: number): ImproNote => ({
    midi: 60,
    at: 0,
    beatPhase,
    chord: { root: 0, quality: 'maj' },
    judgement: { role, chordDegree: null, scaleOffset: null, label: role },
  });

  it('un solo qui dit l’accord sur les temps forts score haut', () => {
    const notes = [note('chord', 0), note('chord', 0.5), note('passing', 0.25), note('chord', 1), note('color', 0.75), note('chord', 0.5)];
    const s = summarizeImpro(notes);
    expect(s.chordRate).toBeCloseTo(4 / 6, 3);
    expect(s.strongChordRate).toBe(1);
    expect(s.score).toBeGreaterThan(65);
  });

  it('un solo hors gamme score bas, même s’il tombe juste', () => {
    const notes = Array.from({ length: 8 }, (_, i) => note(i % 2 === 0 ? 'out' : 'chord', i % 4 === 0 ? 0 : 0.25));
    const s = summarizeImpro(notes);
    expect(s.inScaleRate).toBeLessThan(0.6);
    expect(s.score).toBeLessThan(45);
    expect(s.advice).toMatch(/hors gamme/);
  });

  it('le conseil vise la première faiblesse, pas toutes à la fois', () => {
    const few = summarizeImpro([note('chord', 0), note('chord', 0)]);
    expect(few.advice).toMatch(/quelques notes/);
    const passing = Array.from({ length: 10 }, (_, i) => note('passing', i % 4 === 0 ? 0 : 0.25));
    expect(summarizeImpro(passing).advice).toMatch(/visites peu l'accord|temps 1/);
  });

  it('scoreOf rend 0 sur une prise vide et ne dépasse jamais 100', () => {
    expect(scoreOf({ chord: 0, color: 0, passing: 0, avoid: 0, out: 0 }, 0)).toBe(0);
    // 10 notes d'accord + 2 couleurs, tout sur les temps forts : 93, jamais 100 (deux notes ne disent pas l'accord)
    expect(scoreOf({ chord: 10, color: 2, passing: 0, avoid: 0, out: 0 }, 1)).toBe(93);
    expect(scoreOf({ chord: 12, color: 0, passing: 0, avoid: 0, out: 0 }, 1)).toBe(100);
  });

  it('les intervalles d’accord sont ceux de la théorie (majeur = 0 4 7)', () => {
    expect([...CHORD_INTERVALS.maj]).toEqual([0, 4, 7]);
    expect([...CHORD_INTERVALS.min7]).toEqual([0, 3, 7, 10]);
  });
});
