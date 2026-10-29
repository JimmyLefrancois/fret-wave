/**
 * Parcours des gammes (D98) : l'étape suivante sur une forme, puis le défi suivant de l'arbre §3.2.
 */
import { describe, expect, it } from 'vitest';
import { nextCap, nextFormStep, scaleLearned } from '../src/modules/gammes/curriculum';
import type { Attempt } from '../src/core/progress';
import { TUNINGS, generatePositions, type NoteName, type PositionSystem } from '../src/core/theory';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 27, 18, 0).getTime();
const at = (daysAgo: number) => NOW - daysAgo * DAY;
const FROM = { scaleId: 'pentatonic-minor', tonic: 'A' as NoteName, system: 'boxes' as PositionSystem };

let n = 0;
function a(patch: Partial<Attempt> = {}): Attempt {
  const scaleId = patch.scaleId ?? 'pentatonic-minor';
  const tonic = (patch.tonic ?? 'A') as NoteName;
  const system = (patch.system ?? 'boxes') as PositionSystem;
  const formIndex = patch.formIndex ?? 0;
  const pos = generatePositions(scaleId, tonic, TUNINGS.standard!, system).find((p) => (p.formIndex ?? p.index) === formIndex)!;
  return {
    id: `c-${n++}`, ts: at(1), kind: 'holes', scaleId, tonic, tuningId: 'standard', system, positionId: pos.id,
    formIndex, level: 2, strings: 6, fullPosition: true, correct: 10, total: 10, seconds: 60, fretMin: pos.fretMin,
    missedStrings: [], tempoOk: false, ...patch,
  };
}
/** Forme apprise : deux rappels N3 réussis sur la position entière, deux jours. */
const learned = (patch: Partial<Attempt> = {}) => [
  a({ ts: at(3), kind: 'recall', level: 3, ...patch }),
  a({ ts: at(2), kind: 'recall', level: 3, ...patch }),
];
const allFive = () => [0, 1, 2, 3, 4].flatMap((formIndex) => learned({ formIndex }));

describe('nextFormStep', () => {
  it('journal vide : écouter la position 1', () => {
    const s = nextFormStep([], 'pentatonic-minor', 'A', 'boxes', 'standard', NOW)!;
    expect(s.level).toBe(1);
    expect(s.selection.positionIndex).toBe(0);
    expect(s.label).toBe('Position 1 · écouter');
  });

  it('écoutée, jamais jouée : exercice à trous sur la position entière (D91)', () => {
    const s = nextFormStep([a({ kind: 'listen', level: 1, correct: null, total: null })], 'pentatonic-minor', 'A', 'boxes', 'standard', NOW)!;
    expect(s.level).toBe(2);
    expect(s.segment).toBe('updown');
    expect(s.label).toBe('Position 1 · exercice à trous');
    expect(s.why).toContain('il manque');
  });

  it('deux N2 réussis sans réussite forte, sans micro : de mémoire (N3)', () => {
    const j = [a({ kind: 'listen', level: 1, correct: null, total: null }), a({ ts: at(3) }), a({ ts: at(2) })];
    const s = nextFormStep(j, 'pentatonic-minor', 'A', 'boxes', 'standard', NOW)!;
    expect(s.level).toBe(3);
    expect(s.label).toBe('Position 1 · de mémoire');
    expect(s.why).toBe('il manque une réussite sur la position entière, de mémoire (N3) ou au micro');
  });

  it('au micro : la réussite forte se fait en N2 au micro', () => {
    // l'élève a déjà joué au micro (une série ratée) ; deux N2 réussis au pavé
    const j = [a({ kind: 'listen', level: 1, correct: null, total: null }), a({ ts: at(4), correct: 3, mic: true }), a({ ts: at(3) }), a({ ts: at(2) })];
    const s = nextFormStep(j, 'pentatonic-minor', 'A', 'boxes', 'standard', NOW)!;
    expect(s.level).toBe(2);
    expect(s.label).toBe('Position 1 · exercice à trous, au micro');
  });

  it('il ne manque qu’un second jour, déjà réussie aujourd’hui : reviens demain (null)', () => {
    const j = [a({ ts: NOW - 3_600_000, kind: 'recall', level: 3 }), a({ ts: NOW - 1_800_000, kind: 'recall', level: 3 })];
    expect(nextFormStep(j, 'pentatonic-minor', 'A', 'boxes', 'standard', NOW)).toBeNull();
    expect(scaleLearned(j, 'pentatonic-minor', 'A', 'boxes', 'standard')).toBe(false);
  });

  it('première forme apprise : on passe à la position 2', () => {
    const s = nextFormStep(learned(), 'pentatonic-minor', 'A', 'boxes', 'standard', NOW)!;
    expect(s.selection.positionIndex).toBe(1);
    expect(s.label).toBe('Position 2 · écouter');
  });

  it('5 formes apprises : plus d’étape, la gamme est apprise', () => {
    expect(nextFormStep(allFive(), 'pentatonic-minor', 'A', 'boxes', 'standard', NOW)).toBeNull();
    expect(scaleLearned(allFive(), 'pentatonic-minor', 'A', 'boxes', 'standard')).toBe(true);
  });
});

describe('nextCap (arbre MUSIC_DESIGN §3.2)', () => {
  it('5 formes apprises : blues mineur, même tonique, position 1', () => {
    const c = nextCap(allFive(), FROM)!;
    expect(c).toMatchObject({ scaleId: 'blues-minor', tonic: 'A', kind: 'scale', title: 'blues mineur, position 1' });
    expect(c.why).toBe('Une note de plus (la ♭5) sur le dessin que tu connais.');
  });

  it('blues appris : position 1 en Mi m', () => {
    const j = [...allFive(), ...learned({ scaleId: 'blues-minor' })];
    const c = nextCap(j, FROM)!;
    expect(c).toMatchObject({ scaleId: 'pentatonic-minor', tonic: 'E', kind: 'tonic', title: 'Mi m, position 1' });
    expect(c.why).toBe('Même dessin, presque à vide : Mi mineur.');
  });

  it('Mi m appris : transposition dans une zone non couverte', () => {
    const j = [...allFive(), ...learned({ scaleId: 'blues-minor' }), ...learned({ tonic: 'E' })];
    const c = nextCap(j, FROM)!;
    expect(c).toMatchObject({ scaleId: 'pentatonic-minor', tonic: 'D', kind: 'transpose', title: 'Ré m, position 1' });
    expect(c.why).toBe('Même dessin, autre case : Ré m, cases 10–13.');
  });

  it('3 zones couvertes : pentatonique majeure (relative)', () => {
    const j = [...allFive(), ...learned({ scaleId: 'blues-minor' }), ...learned({ tonic: 'E' }), ...learned({ tonic: 'D' })];
    const c = nextCap(j, FROM)!;
    expect(c).toMatchObject({ scaleId: 'pentatonic-major', tonic: 'C', kind: 'scale', title: 'pentatonique majeure, position 1' });
  });
});
