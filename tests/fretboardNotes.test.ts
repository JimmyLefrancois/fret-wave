import { describe, expect, it } from 'vitest';
import { getScale, TUNINGS } from '../src/core/theory';
import { fretboardNotes, layoutNeck, outerStrings, scaleSpellings } from '../src/core/tab';

const all = new Set(Array.from({ length: 12 }, (_, i) => i));

describe('fretboardNotes', () => {
  it('toutes les notes : chaque case de chaque corde', () => {
    const notes = fretboardNotes(TUNINGS.standard!, { pitchClasses: all, reference: 0, spelling: 'sharp', notation: 'fr', maxFret: 12 });
    expect(notes).toHaveLength(6 * 13);
  });

  it('seulement les notes choisies, bien placées', () => {
    // Mi (4) en accordage standard, cases 0 à 12
    const notes = fretboardNotes(TUNINGS.standard!, { pitchClasses: new Set([4]), reference: 4, spelling: 'sharp', notation: 'fr', maxFret: 12 });
    const at = notes.map((n) => `${n.string}:${n.fret}`).sort();
    expect(at).toEqual(['0:0', '0:12', '1:7', '2:2', '3:9', '4:5', '5:0', '5:12'].sort());
    expect(notes.every((n) => n.label === 'Mi' && n.degree === '1')).toBe(true);
  });

  it('orthographe et degré suivent les réglages', () => {
    const [n] = fretboardNotes(TUNINGS.standard!, { pitchClasses: new Set([10]), reference: 0, spelling: 'flat', notation: 'en', maxFret: 6 });
    expect(n).toMatchObject({ string: 0, fret: 6, label: 'B♭', degree: 'b7' });
    const [m] = fretboardNotes(TUNINGS.standard!, { pitchClasses: new Set([10]), reference: 0, spelling: 'sharp', notation: 'fr', maxFret: 6 });
    expect(m!.label).toBe('La♯');
  });
});

describe('layoutNeck : voile hors des cases choisies', () => {
  const notes = fretboardNotes(TUNINGS.standard!, { pitchClasses: all, reference: 0, spelling: 'sharp', notation: 'fr', maxFret: 15 });
  const range = { from: 0, to: 15 };

  it('sans choix de cases, rien ne s’assombrit', () => {
    expect(layoutNeck(TUNINGS.standard!, notes, { range }).veil).toEqual([]);
  });

  it('cases 5 à 8 : un voile de chaque côté, aucune pastille choisie dessous', () => {
    const l = layoutNeck(TUNINGS.standard!, notes, { range, zone: { from: 5, to: 8 }, shade: { from: 5, to: 8 } });
    expect(l.veil).toHaveLength(2);
    const covered = (x: number) => l.veil.some((v) => x >= v.x && x < v.x + v.w);
    for (const p of l.pills) {
      const centre = p.x + Math.floor(p.w / 2);
      expect(covered(centre)).toBe(p.fret < 5 || p.fret > 8);
    }
    // les bornes sont numérotées
    expect(l.numbers.map((n) => n.text)).toEqual(expect.arrayContaining(['5', '8']));
  });

  it('depuis la case 0 : seulement le voile de droite', () => {
    const l = layoutNeck(TUNINGS.standard!, notes, { range, zone: { from: 0, to: 4 }, shade: { from: 0, to: 4 } });
    expect(l.veil).toHaveLength(1);
    const open = l.pills.find((p) => p.fret === 0)!;
    expect(l.veil[0]!.x).toBeGreaterThan(open.x + open.w);
  });
});

describe('cordes extrêmes assombries', () => {
  it('standard : les deux Mi, même note', () => {
    expect(outerStrings(TUNINGS.standard!)).toEqual({ strings: [0, 5], pcs: [4, 4], same: true });
    expect(outerStrings(TUNINGS.dropD!).same).toBe(false);
  });

  it('une bande par corde, centrée sur sa corde, sans toucher les voisines', () => {
    const notes = fretboardNotes(TUNINGS.standard!, { pitchClasses: all, reference: 0, spelling: 'sharp', notation: 'fr', maxFret: 15 });
    const l = layoutNeck(TUNINGS.standard!, notes, { range: { from: 0, to: 15 }, dimStrings: [0, 5] });
    expect(l.stringVeil).toHaveLength(2);
    // la référence (Do) n'est plus cerclée sur les cordes assombries, elle l'est ailleurs
    expect(l.pills.filter((p) => p.highlight).every((p) => p.string !== 0 && p.string !== 5)).toBe(true);
    expect(l.pills.some((p) => p.highlight)).toBe(true);
    l.stringVeil.forEach((r, i) => {
      const st = [0, 5][i]!;
      const y = l.stringY[st]!;
      expect(r.y).toBeLessThan(y);
      expect(r.y + r.h).toBeGreaterThan(y);
      const neighbour = l.stringY[st === 0 ? 1 : 4]!;
      expect(neighbour < r.y || neighbour >= r.y + r.h).toBe(true);
    });
  });
});

describe('gamme sur le manche', () => {
  it('Fa majeur : Si♭ garde son nom et son degré, même réglé en dièses', () => {
    const def = getScale('ionian');
    const sp = scaleSpellings(def, 'F');
    expect([...sp.keys()].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 10]);
    const notes = fretboardNotes(TUNINGS.standard!, { pitchClasses: new Set(sp.keys()), reference: 5, spelling: 'sharp', notation: 'fr', maxFret: 6, spellings: sp });
    const bb = notes.find((n) => n.string === 0 && n.fret === 6)!;
    expect(bb).toMatchObject({ label: 'Si♭', degree: '4' });
    expect(notes.find((n) => n.string === 0 && n.fret === 1)).toMatchObject({ label: 'Fa', degree: '1' });
  });

  it('La mineure pentatonique : cinq notes, la tierce mineure en b3', () => {
    const sp = scaleSpellings(getScale('pentatonic-minor'), 'A');
    expect(sp.size).toBe(5);
    expect(sp.get(0)).toEqual({ note: 'C', degree: 'b3' });
  });
});

describe('notes mises en avant', () => {
  const base = { pitchClasses: all, reference: 0, spelling: 'sharp' as const, notation: 'fr' as const, maxFret: 12 };

  it('sans mise en avant, rien ne s’estompe', () => {
    expect(fretboardNotes(TUNINGS.standard!, { ...base, focus: new Set() }).some((n) => n.dim)).toBe(false);
  });

  it('Do et Sol en avant : les autres notes restent affichées mais estompées', () => {
    const notes = fretboardNotes(TUNINGS.standard!, { ...base, focus: new Set([0, 7]) });
    expect(notes).toHaveLength(6 * 13);
    for (const n of notes) expect(Boolean(n.dim)).toBe(!['Do', 'Sol'].includes(n.label!));
  });

  it('une note estompée n’est plus cerclée comme référence', () => {
    const notes = fretboardNotes(TUNINGS.standard!, { ...base, focus: new Set([7]) });
    const l = layoutNeck(TUNINGS.standard!, notes, { range: { from: 0, to: 12 } });
    expect(l.pills.some((p) => p.highlight)).toBe(false);
  });
});
