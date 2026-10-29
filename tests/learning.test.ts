import { describe, expect, it } from 'vitest';
import {
  TUNINGS, filterPosition, generatePositions, getScale, type Position,
} from '../src/core/theory';
import { intervalStyle, layoutScore, positionToScore } from '../src/core/tab';
import { counterpartPosition, differingDegrees, markDegrees, neighbourMode } from '../src/modules/gammes/compare';
import { legendFor } from '../src/modules/gammes/resolve';

const std = TUNINGS.standard!;
const [box1] = generatePositions('pentatonic-minor', 'A', std, 'boxes', {}) as [Position];

describe('mode « fondamentales d’abord » et découpage par cordes', () => {
  it('ne garde que la fondamentale et la quinte, cases recalculées', () => {
    const sub = filterPosition(box1, (n) => n.degree === '1' || n.degree === '5');
    expect(sub.notes.length).toBeGreaterThan(0);
    expect(sub.notes.length).toBeLessThan(box1.notes.length);
    expect(sub.notes.every((n) => n.degree === '1' || n.degree === '5')).toBe(true);
    expect(sub.fretMin).toBe(Math.min(...sub.notes.map((n) => n.fret)));
    expect(sub.fretMax).toBe(Math.max(...sub.notes.map((n) => n.fret)));
    // l'ordre de lecture est conservé
    for (let i = 1; i < sub.notes.length; i++) {
      const a = sub.notes[i - 1]!, b = sub.notes[i]!;
      expect(b.string > a.string || (b.string === a.string && b.fret > a.fret)).toBe(true);
    }
  });

  it('découpe par nombre de cordes : les deux cordes graves d’abord', () => {
    const two = filterPosition(box1, (n) => n.string < 2);
    expect(two.notes.every((n) => n.string < 2)).toBe(true);
    expect(two.notes.length).toBe(4); // La m pent box 1 : 2 notes sur chacune des cordes 6 et 5
    const score = positionToScore(two, std, { direction: 'up' });
    expect(layoutScore(score, { mode: 'wrap', maxWidth: 190, notes: 'fr', chords: 'en', annotation: 'degree', stacks: 'change' }).systems.length).toBe(1);
  });

  it('une position vide reste sûre (aucune exception, aucune case négative)', () => {
    const empty = filterPosition(box1, () => false);
    expect(empty.notes).toEqual([]);
    expect(empty.fretMin).toBe(0);
  });
});

describe('layout : mode débutant et mise en évidence', () => {
  const opts = { mode: 'wrap' as const, maxWidth: 190, notes: 'fr' as const, chords: 'en' as const, annotation: 'degree' as const, stacks: 'change' as const };
  const score = positionToScore(box1, std, { direction: 'updown' });

  it('sans rythme : la tablature est plus courte et aucune hampe n’est dessinée', () => {
    const normal = layoutScore(score, opts);
    const noRhythm = layoutScore(score, { ...opts, hideRhythm: true });
    expect(noRhythm.height).toBeLessThan(normal.height);
    expect(normal.systems[0]!.rhythm.length).toBeGreaterThan(0);
    expect(noRhythm.systems[0]!.rhythm.length).toBe(0);
    expect(noRhythm.systems[0]!.noRhythm).toBe(true);
  });

  it('highlightFn marque toutes les pastilles de la fonction', () => {
    const l = layoutScore(score, { ...opts, highlightFn: 'b3' });
    const pills = l.columns.flatMap((c) => c.pills).filter((p) => p.highlight);
    expect(pills.length).toBeGreaterThan(0);
    expect(pills.every((p) => p.fn === 'b3')).toBe(true);
    const none = layoutScore(score, opts).columns.flatMap((c) => c.pills).filter((p) => p.highlight);
    expect(none.length).toBe(0);
  });
});

describe('comparaison de deux modes voisins', () => {
  it('les voisinages proposés sont réciproques et d’une seule note', () => {
    for (const [a, b] of [['dorian', 'aeolian'], ['ionian', 'lydian'], ['mixolydian', 'ionian'], ['phrygian', 'aeolian'], ['locrian', 'phrygian']] as const) {
      expect(neighbourMode(a)).toBe(b);
      const diff = differingDegrees(getScale(a), getScale(b));
      expect(diff.onlyA.length, `${a} vs ${b}`).toBe(1);
      expect(diff.onlyB.length, `${a} vs ${b}`).toBe(1);
    }
    expect(neighbourMode('pentatonic-minor')).toBe('blues-minor');
    expect(neighbourMode('whole-tone')).toBeNull();
  });

  it('dorien vs éolien : 6 contre ♭6', () => {
    const diff = differingDegrees(getScale('dorian'), getScale('aeolian'));
    expect(diff).toEqual({ onlyA: ['6'], onlyB: ['♭6'] });
  });

  it('position équivalente : même forme (CAGED) ou même formIndex (3NPS)', () => {
    const mine = generatePositions('dorian', 'D', std, '3nps');
    const other = generatePositions('aeolian', 'D', std, '3nps');
    const pos = counterpartPosition(other, mine[2]!);
    expect(pos).not.toBeNull();
    expect(pos!.formIndex).toBe(mine[2]!.formIndex);

    const caged = generatePositions('ionian', 'C', std, 'caged');
    const cagedOther = generatePositions('lydian', 'C', std, 'caged');
    const eShape = caged.find((p) => p.shape === 'E')!;
    expect(counterpartPosition(cagedOther, eShape)!.shape).toBe('E');
  });

  it('markDegrees met le glow sur la seule note qui change', () => {
    const myPos = generatePositions('dorian', 'D', std, '3nps')[2]!;
    const score = positionToScore(myPos, std, { direction: 'up' });
    const marked = markDegrees(score, ['6']);
    const notes = marked.measures.flatMap((m) => m.events.flatMap((e) => e.notes));
    const glow = notes.filter((n) => n.characteristic);
    expect(glow.length).toBeGreaterThan(0);
    expect(glow.every((n) => n.fn === '6')).toBe(true);
    // le score d'origine n'est pas modifié
    expect(score.measures.flatMap((m) => m.events.flatMap((e) => e.notes)).some((n) => n.characteristic)).toBe(notes.some((n) => n.characteristic));
  });
});

describe('légende des couleurs', () => {
  it('une ligne par fonction, nom français, note caractéristique seulement pour le mode', () => {
    const dorian = legendFor(getScale('dorian'));
    expect(dorian.map((d) => d.fn)).toEqual(['1', '2', '♭3', '4', '5', '6', '♭7']);
    expect(dorian.find((d) => d.fn === '♭3')!.name).toBe('tierce mineure');
    expect(dorian.filter((d) => d.characteristic).map((d) => d.fn)).toEqual(['6']);
    const pent = legendFor(getScale('pentatonic-minor'));
    expect(pent.filter((d) => d.characteristic).length).toBe(0);
  });

  it('les degrés altérés ont la même couleur que dans la tablature (pas le gris de secours)', () => {
    const pent = legendFor(getScale('pentatonic-minor'));
    for (const [shown, ascii] of [['♭3', 'b3'], ['♭7', 'b7']] as const) {
      const item = pent.find((d) => d.fn === shown)!;
      expect(item.fill).toBe(intervalStyle(ascii).fill);
      expect(item.fill).not.toBe(intervalStyle('?').fill);
    }
    const lydian = legendFor(getScale('lydian'));
    expect(lydian.find((d) => d.fn === '♯4')!.fill).toBe(intervalStyle('#4').fill);
  });
});
