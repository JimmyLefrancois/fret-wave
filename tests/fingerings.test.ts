import { describe, expect, it } from 'vitest';
import {
  SCALES, TUNINGS, compatibleSystems, fingeringsForPosition, fingersForFrets, generatePositions, tonicSpellings, getScale,
  type Position,
} from '../src/core/theory';
import { layoutScore, positionToScore, validateScore } from '../src/core/tab';

const std = TUNINGS.standard!;

function tonicsOf(scaleId: string): string[] {
  const def = getScale(scaleId);
  return Array.from({ length: 12 }, (_, pc) => tonicSpellings(def, pc)[0]!);
}

function allPositions(): Position[] {
  const out: Position[] = [];
  for (const def of SCALES) {
    for (const tonic of tonicsOf(def.id)) {
      for (const system of compatibleSystems(def.id)) {
        out.push(...generatePositions(def.id, tonic, std, system));
      }
    }
  }
  return out;
}

describe('doigtés de position (heuristique par corde)', () => {
  it('deux notes : 1-2 (demi-ton), 1-3 (ton), 1-4 (au-delà)', () => {
    expect(fingersForFrets([5, 6])).toEqual([1, 2]);
    expect(fingersForFrets([5, 7])).toEqual([1, 3]);
    expect(fingersForFrets([5, 8])).toEqual([1, 4]);
    expect(fingersForFrets([8, 5])).toEqual([1, 4]); // l'ordre des cordes n'importe pas
  });

  it('trois notes : 1-2-3 en cluster, 1-2-4 ou 1-3-4 selon l’espacement', () => {
    expect(fingersForFrets([5, 6, 7])).toEqual([1, 2, 3]);
    expect(fingersForFrets([5, 6, 8])).toEqual([1, 2, 4]);
    expect(fingersForFrets([5, 7, 8])).toEqual([1, 3, 4]);
    expect(fingersForFrets([5, 7, 9])).toEqual([1, 3, 4]);
  });

  it('quatre notes : 1-2-3-4 ; cinq notes : aucun doigté (démanché)', () => {
    expect(fingersForFrets([5, 6, 7, 8])).toEqual([1, 2, 3, 4]);
    expect(fingersForFrets([5, 6, 7, 8, 9])).toEqual([]);
  });

  it('box 1 de La mineur pentatonique : 1-4 sur les cordes 1 et 2, 1-3 sur les autres', () => {
    const [box1] = generatePositions('pentatonic-minor', 'A', std, 'boxes', {});
    expect(box1).toBeDefined();
    const f = fingeringsForPosition(box1!);
    expect(f.get('0:5')).toBe(1);
    expect(f.get('0:8')).toBe(4);
    expect(f.get('3:5')).toBe(1); // corde de Sol (index 3)
    expect(f.get('3:7')).toBe(3);
    expect(f.size).toBe(box1!.notes.length);
  });

  it('sur toutes les positions du catalogue : jamais plus de 4 doigts, index sur la note la plus basse d’une corde', () => {
    let checked = 0;
    for (const p of allPositions()) {
      const f = fingeringsForPosition(p);
      const byString = new Map<number, { fret: number; finger?: number }[]>();
      for (const n of p.notes) {
        const arr = byString.get(n.string) ?? [];
        arr.push({ fret: n.fret, finger: f.get(`${n.string}:${n.fret}`) });
        byString.set(n.string, arr);
      }
      for (const [string, notes] of byString) {
        notes.sort((a, b) => a.fret - b.fret);
        const assigned = notes.filter((n) => n.finger !== undefined);
        if (notes.length >= 5) expect(assigned.length, p.id).toBe(0);
        else expect(assigned.length, `${p.id} corde ${string}`).toBe(notes.length);
        for (const n of assigned) expect(n.finger).toBeGreaterThanOrEqual(1);
        for (const n of assigned) expect(n.finger).toBeLessThanOrEqual(4);
        expect(notes[0]!.finger, `${p.id} corde ${string}`).toBe(1);
        // pas de croisement : le doigt croît avec la case
        for (let i = 1; i < assigned.length; i++) expect(assigned[i]!.finger!).toBeGreaterThan(assigned[i - 1]!.finger!);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('les doigtés arrivent dans le TabScore et le score reste valide', () => {
    const [pos] = generatePositions('pentatonic-minor', 'A', std, 'boxes', {});
    const score = positionToScore(pos!, std, { fingers: true, chord: 'Am7' });
    expect(validateScore(score)).toEqual([]);
    const notes = score.measures.flatMap((m) => m.events.flatMap((e) => e.notes));
    expect(notes.every((n) => n.finger !== undefined)).toBe(true);
    expect(notes.some((n) => n.finger === 4)).toBe(true);
  });
});

describe('calque « notes de l’accord »', () => {
  it('marque 1-3-5-7 de l’accord et laisse les autres notes hors accord', () => {
    const [pos] = generatePositions('pentatonic-minor', 'A', std, 'boxes', {});
    const score = positionToScore(pos!, std, { chord: 'Am7', markChordTones: true });
    const notes = score.measures.flatMap((m) => m.events.flatMap((e) => e.notes));
    // Am7 = A C E G : 5 notes de la box sur 12 (les doublons d'octave compris)
    const tones = notes.filter((n) => n.chordTone);
    expect(tones.length).toBeGreaterThan(4);
    expect(notes.filter((n) => n.chordTone === false).length).toBe(notes.length - tones.length);
    const pcs = new Set(tones.map((n) => ((n.midi % 12) + 12) % 12));
    expect([...pcs].sort((a, b) => a - b)).toEqual([4, 7, 9, 0].sort((a, b) => a - b)); // E G A C
  });

  it('sans option, aucune note n’est marquée', () => {
    const [pos] = generatePositions('pentatonic-minor', 'A', std, 'boxes', {});
    const score = positionToScore(pos!, std, { chord: 'Am7' });
    const notes = score.measures.flatMap((m) => m.events.flatMap((e) => e.notes));
    expect(notes.every((n) => n.chordTone === undefined)).toBe(true);
  });
});

describe('layout : calque d’accord et signature rythmique', () => {
  it('estompe les notes hors accord et laisse les notes de l’accord intactes', () => {
    const [pos] = generatePositions('pentatonic-minor', 'A', std, 'boxes', {});
    const score = positionToScore(pos!, std, { chord: 'Am7', markChordTones: true });
    const off = layoutScore(score, { mode: 'wrap', maxWidth: 190, notes: 'fr', chords: 'en', annotation: 'degree', stacks: 'change' });
    const on = layoutScore(score, { mode: 'wrap', maxWidth: 190, notes: 'fr', chords: 'en', annotation: 'degree', stacks: 'change', emphasizeChordTones: true });
    const dimmed = (l: typeof off) => l.columns.flatMap((c) => c.pills).filter((p) => p.dim).length;
    expect(dimmed(off)).toBe(0);
    // La pentatonique mineure de La = A C D E G ; le seul degré hors Am7 est la 4te (D)
    expect(dimmed(on)).toBeGreaterThan(0);
    const dimFns = new Set(on.columns.flatMap((c) => c.pills).filter((p) => p.dim).map((p) => p.fn));
    expect([...dimFns]).toEqual(['4']);
  });

  it('la signature rythmique est en tête de portée, pas au milieu des cordes', () => {
    const [pos] = generatePositions('pentatonic-minor', 'A', std, 'boxes', {});
    const score = positionToScore(pos!, std, { direction: 'up' });
    const l = layoutScore(score, { mode: 'wrap', maxWidth: 190, notes: 'fr', chords: 'en', annotation: 'none', stacks: 'change' });
    const sys = l.systems[0]!;
    expect(sys.timeSig).toBeDefined();
    expect(sys.timeSig!.y).toBe(sys.stringYs[0]! - 3);
    expect(sys.timeSig!.y).toBeLessThan((sys.stringYs[0]! + sys.stringYs[sys.stringYs.length - 1]!) / 2);
  });
});
