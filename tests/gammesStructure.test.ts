import { describe, expect, it } from 'vitest';
import {
  SCALES, TUNINGS, degreeIndexOf, generatePositions, getScale, pitchClassOf, relabelPosition, relativeScale, stepFormula, systemsFor,
} from '../src/core/theory';
import { positionToScore } from '../src/core/tab';
import {
  compareChoices, counterpartPosition, differenceText, differingDegrees, markDegrees, relativeDegrees, samePlaceIndex,
} from '../src/modules/gammes/compare';
import { rulerSlots } from '../src/modules/gammes/resolve';

const std = TUNINGS.standard!;
const glowing = (s: ReturnType<typeof positionToScore>) =>
  [...new Set(s.measures.flatMap((m) => m.events.flatMap((e) => e.notes)).filter((n) => n.characteristic).map((n) => n.fn))];

describe('formule et règle d’une gamme', () => {
  it('les formules du cours : majeure, mineures, pentatonique', () => {
    expect(stepFormula(getScale('ionian'))).toEqual([2, 2, 1, 2, 2, 2, 1]);
    expect(stepFormula(getScale('aeolian'))).toEqual([2, 1, 2, 2, 1, 2, 2]);
    expect(stepFormula(getScale('harmonic-minor'))).toEqual([2, 1, 2, 2, 1, 3, 1]);
    expect(stepFormula(getScale('melodic-minor'))).toEqual([2, 1, 2, 2, 2, 2, 1]);
    expect(stepFormula(getScale('pentatonic-minor'))).toEqual([3, 2, 2, 3, 2]);
  });

  it('tout le catalogue : écarts positifs, 12 cases jusqu’à l’octave', () => {
    for (const def of SCALES) {
      const steps = stepFormula(def);
      expect(steps.every((s) => s > 0), def.id).toBe(true);
      expect(steps.reduce((a, b) => a + b, 0), def.id).toBe(12);
    }
  });

  it('la règle pose chaque note à sa case, l’octave reprend la fondamentale', () => {
    const slots = rulerSlots(getScale('pentatonic-minor'));
    expect(slots).toHaveLength(13);
    expect(slots.map((s) => s?.fn ?? null)).toEqual(['1', null, null, '♭3', null, '4', null, '5', null, null, '♭7', null, '1']);
  });
});

describe('comparer à une voisine', () => {
  it('naturelle ↔ harmonique ↔ mélodique : une seule note change', () => {
    expect(differingDegrees(getScale('aeolian'), getScale('harmonic-minor'))).toEqual({ onlyA: ['♭7'], onlyB: ['7'] });
    expect(differingDegrees(getScale('harmonic-minor'), getScale('melodic-minor'))).toEqual({ onlyA: ['♭6'], onlyB: ['6'] });
  });

  it('la phrase de différence dit ce que montrent les tablatures', () => {
    expect(differenceText(getScale('lydian'), getScale('ionian'))).toBe('♯4 devient 4');
    expect(differenceText(getScale('phrygian'), getScale('aeolian'))).toBe('♭2 devient 2');
    expect(differenceText(getScale('locrian'), getScale('phrygian'))).toBe('♭5 devient 5');
    expect(differenceText(getScale('pentatonic-minor'), getScale('blues-minor'))).toBe('la ♭5 en plus');
    expect(differenceText(getScale('blues-minor'), getScale('pentatonic-minor'))).toBe('sans la ♭5');
  });

  it('seuls les systèmes communs sont proposés', () => {
    const ids = (id: string, system: 'caged' | '3nps') => compareChoices(getScale(id), 'A', system).map((c) => c.id);
    expect(ids('aeolian', '3nps')).toEqual(['dorian', 'harmonic-minor', 'relative']);
    expect(ids('aeolian', 'caged')).not.toContain('harmonic-minor');
    for (const c of compareChoices(getScale('aeolian'), 'A', '3nps')) {
      expect(systemsFor(c.def.id).some((s) => s.system === '3nps' && s.available)).toBe(true);
    }
  });

  it('entre deux familles, la position équivalente est au même endroit du manche', () => {
    for (const [a, b] of [['aeolian', 'harmonic-minor'], ['harmonic-minor', 'aeolian'], ['harmonic-minor', 'melodic-minor']] as const) {
      const other = generatePositions(b, 'A', std, '3nps');
      for (const p of generatePositions(a, 'A', std, '3nps')) {
        const q = counterpartPosition(other, p)!;
        expect(Math.abs(q.fretMin - p.fretMin), `${a} → ${b}, forme ${p.formIndex}`).toBeLessThanOrEqual(2);
      }
    }
    const first = generatePositions('aeolian', 'A', std, '3nps')[0]!;
    expect(counterpartPosition(generatePositions('harmonic-minor', 'A', std, '3nps'), first)!.fretMin).toBe(first.fretMin);
  });

  it('une note altérée brille, et la note caractéristique ne brille plus à sa place', () => {
    const pos = generatePositions('aeolian', 'A', std, '3nps')[0]!;
    const score = positionToScore(pos, std, { direction: 'up' });
    expect(glowing(score)).toEqual(['b6']);
    expect(glowing(markDegrees(score, ['♭7']))).toEqual(['b7']);
  });
});

describe('mêmes notes, autre tonique', () => {
  it('relatives et majeure parente', () => {
    expect(relativeScale(getScale('ionian'), 'C')).toEqual({ scaleId: 'aeolian', tonic: 'A' });
    expect(relativeScale(getScale('aeolian'), 'A')).toEqual({ scaleId: 'ionian', tonic: 'C' });
    expect(relativeScale(getScale('pentatonic-minor'), 'F#')).toEqual({ scaleId: 'pentatonic-major', tonic: 'A' });
    expect(relativeScale(getScale('blues-major'), 'C')).toEqual({ scaleId: 'blues-minor', tonic: 'A' });
    expect(relativeScale(getScale('dorian'), 'D')).toEqual({ scaleId: 'ionian', tonic: 'C' });
    expect(relativeScale(getScale('harmonic-minor'), 'A')).toBeNull();
  });

  it('douze toniques : la relative a exactement les mêmes notes, sur toute position', () => {
    for (const id of ['ionian', 'aeolian', 'dorian', 'pentatonic-minor', 'pentatonic-major', 'blues-minor', 'blues-major']) {
      const def = getScale(id);
      for (const tonic of ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F']) {
        const rel = relativeScale(def, tonic)!;
        const system = id.startsWith('p') || id.startsWith('b') ? 'boxes' : '3nps';
        for (const p of generatePositions(id, tonic, std, system)) {
          const q = relabelPosition(p, rel.scaleId, rel.tonic);
          expect(q.notes.map((n) => [n.string, n.fret, n.note])).toEqual(p.notes.map((n) => [n.string, n.fret, n.note]));
          expect(q.notes.filter((n) => n.degree === '1').every((n) => pitchClassOf(n.note) === pitchClassOf(rel.tonic))).toBe(true);
        }
      }
    }
  });

  it('La mineure pentatonique : le ♭3 d’ici est la fondamentale de Do, le 6 de Do est celle de La', () => {
    expect(relativeDegrees(getScale('pentatonic-minor'), 'A', getScale('pentatonic-major'), 'C')).toEqual({ onlyA: ['♭3'], onlyB: ['6'] });
    expect(degreeIndexOf(getScale('ionian'), 'C', pitchClassOf('F#'))).toBeNull();
  });

  it('ouvrir la relative retombe sur les mêmes cases', () => {
    const minor = generatePositions('pentatonic-minor', 'A', std, 'boxes');
    const major = generatePositions('pentatonic-major', 'C', std, 'boxes');
    for (const p of minor) {
      const q = major[samePlaceIndex(major, p)]!;
      expect(q.notes.map((n) => `${n.string}:${n.fret}`).sort()).toEqual(p.notes.map((n) => `${n.string}:${n.fret}`).sort());
    }
  });
});
