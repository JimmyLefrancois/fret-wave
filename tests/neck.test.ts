import { describe, expect, it } from 'vitest';
import {
  BufferSurface, NECK_METRICS, THEME_SYNTHWAVE, drawNeck, intervalStyle, layoutNeck, neckNotes,
  neckRange, type NeckNote,
} from '../src/core/tab';
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadAppSettings } from '../src/app/settings';
import { TUNINGS, generatePositions, type Position } from '../src/core/theory';

const std = TUNINGS.standard!;

function notesOf(p: Position): NeckNote[] {
  return p.notes.map((n) => ({ string: n.string, fret: n.fret, degree: n.degree }));
}

/** La mineur pentatonique, position 1 (cases 5-8). */
const box1 = generatePositions('pentatonic-minor', 'A', std, 'boxes')[0]!;
const zone1 = { from: box1.fretMin, to: box1.fretMax };

describe('vue manche — cadrage', () => {
  it('manche entier : du sillet à la 15e case, plus loin si la position dépasse', () => {
    expect(neckRange({ from: 5, to: 8 }, 'full')).toEqual({ from: 0, to: 15 });
    expect(neckRange({ from: 14, to: 17 }, 'full')).toEqual({ from: 0, to: 18 });
    expect(neckRange({ from: 22, to: 24 }, 'full')).toEqual({ from: 0, to: 24 });
  });

  it('fenêtre : une case d’air de chaque côté, collée au sillet en bas du manche', () => {
    expect(neckRange({ from: 5, to: 8 }, 'window')).toEqual({ from: 4, to: 9 });
    expect(neckRange({ from: 2, to: 5 }, 'window')).toEqual({ from: 0, to: 6 });
    expect(neckRange({ from: 0, to: 3 }, 'window')).toEqual({ from: 0, to: 4 });
  });
});

describe('vue manche — géométrie', () => {
  const l = layoutNeck(std, notesOf(box1), { range: neckRange(zone1, 'full'), zone: zone1 });

  it('une pastille par note de la position, aucune perdue', () => {
    expect(box1.fretMin).toBe(5);
    expect(l.pills).toHaveLength(box1.notes.length);
  });

  it('orientation de la tablature : corde aiguë en haut, cases croissantes vers la droite', () => {
    expect(l.stringY[5]!).toBeLessThan(l.stringY[0]!);
    const onLow = l.pills.filter((p) => p.string === 0).sort((a, b) => a.fret - b.fret);
    expect(onLow.map((p) => p.fret)).toEqual([5, 8]);
    expect(onLow[0]!.x).toBeLessThan(onLow[1]!.x);
    // la pastille est dans sa case : entre la frette précédente et la suivante
    const p5 = onLow[0]!;
    expect(p5.x).toBeGreaterThan(l.wireX[4]!);
    expect(p5.x + p5.w).toBeLessThan(l.wireX[5]!);
  });

  it('le chiffre de la pastille est le degré (la case est dite par sa place)', () => {
    const root = l.pills.find((p) => p.string === 0 && p.fret === 5)!;
    expect(root.fn).toBe('1');
    expect(root.text).toBe('1');
    const flat3 = l.pills.find((p) => p.string === 0 && p.fret === 8)!;
    expect(flat3.fn).toBe('b3');
    expect(flat3.text).toBe('3');
  });

  it('la zone de la position couvre ses cases, rien de plus', () => {
    expect(l.zone).not.toBeNull();
    expect(l.zone!.x).toBeGreaterThan(l.wireX[4]!);
    expect(l.zone!.x + l.zone!.w).toBeLessThanOrEqual(l.wireX[8]!);
  });

  it('repères : incrustations et numéros aux cases 3, 5, 7, 9, 12 (double), 15', () => {
    expect(l.numbers.map((n) => n.text)).toEqual(['3', '5', '7', '9', '12', '15']);
    expect(l.inlays).toHaveLength(7);
  });

  it('une note hors cadrage n’est pas dessinée ailleurs', () => {
    const w = layoutNeck(std, [{ string: 0, fret: 12, degree: '1' }], { range: { from: 4, to: 9 } });
    expect(w.pills).toHaveLength(0);
  });

  it('une fenêtre sans sillet dit où elle commence', () => {
    const w = layoutNeck(std, notesOf(box1), { range: neckRange(zone1, 'window'), zone: zone1 });
    expect(w.nut).toBe(false);
    expect(w.numbers[0]!.text).toBe('4');
    expect(w.width).toBeLessThan(l.width);
    expect(w.width).toBe(w.wireX[w.wireX.length - 1]! + NECK_METRICS.padR);
  });
});

describe('vue manche — rendu', () => {
  it('les pastilles portent les couleurs de fonction de la tablature', () => {
    const l = layoutNeck(std, notesOf(box1), { range: neckRange(zone1, 'full'), zone: zone1 });
    const s = new BufferSurface(l.width, l.height, THEME_SYNTHWAVE.panel);
    drawNeck(s, l, THEME_SYNTHWAVE);
    const root = l.pills.find((p) => p.fn === '1')!;
    expect(s.count(intervalStyle('1').fill, root.x, root.y, root.w, root.h)).toBeGreaterThan(20);
    const b3 = l.pills.find((p) => p.fn === 'b3')!;
    expect(s.count(intervalStyle('b3').fill, b3.x, b3.y, b3.w, b3.h)).toBeGreaterThan(20);
  });
});

describe('vue manche — étiquettes de l’annotation sous la tablature', () => {
  const at = (notes: NeckNote[], string: number, fret: number) => notes.find((n) => n.string === string && n.fret === fret)!;

  it('notes, degrés, intervalles, doigts : la même note se lit des quatre façons', () => {
    expect(at(neckNotes(box1, 'note', 'fr'), 0, 8).label).toBe('Do');
    expect(at(neckNotes(box1, 'note', 'en'), 0, 8).label).toBe('C');
    expect(at(neckNotes(box1, 'degree'), 0, 8).label).toBe('3'); // l'altération est dans l'encoche
    expect(at(neckNotes(box1, 'interval'), 0, 8).label).toBe('m3');
    expect(at(neckNotes(box1, 'finger'), 0, 5).label).toBe('1');
    expect(at(neckNotes(box1, 'finger'), 0, 8).label).toBe('4');
    expect(neckNotes(box1, 'none').every((n) => n.label === '')).toBe(true);
  });

  it('une étiquette large élargit les cases, sans qu’une pastille touche une frette', () => {
    const range = neckRange(zone1, 'full');
    const narrow = layoutNeck(std, neckNotes(box1, 'degree'), { range });
    const wide = layoutNeck(std, neckNotes(box1, 'note', 'fr'), { range });
    expect(narrow.fretW).toBe(NECK_METRICS.fretW);
    expect(wide.fretW).toBeGreaterThan(narrow.fretW);
    for (const p of wide.pills) {
      expect(p.x).toBeGreaterThan(wide.wireX[p.fret - 1 - wide.wireStart]!);
      expect(p.x + p.w).toBeLessThan(wide.wireX[p.fret - wide.wireStart]!);
    }
  });
});

describe('vue manche — tonique en avant', () => {
  it('seules les fondamentales sont cerclées, d’un anneau à l’encre du thème', () => {
    const l = layoutNeck(std, notesOf(box1), { range: neckRange(zone1, 'full'), zone: zone1 });
    expect(l.pills.filter((p) => p.highlight).map((p) => p.fn)).toEqual(['1', '1', '1']);
    const s = new BufferSurface(l.width, l.height, THEME_SYNTHWAVE.panel);
    drawNeck(s, l, THEME_SYNTHWAVE);
    // fondamentale de la corde grave : rien sous elle, l'anneau du bas est entier
    const root = l.pills.find((p) => p.highlight && p.string === 0)!;
    expect(s.count(THEME_SYNTHWAVE.text, root.x, root.y + root.h + 1, root.w, 1)).toBe(root.w);
    const other = l.pills.find((p) => !p.highlight && p.string === 0)!;
    expect(s.count(THEME_SYNTHWAVE.text, other.x, other.y + other.h + 1, other.w, 1)).toBe(0);
  });
});

describe('vue manche — réglage', () => {
  it('masquée par défaut, l’interrupteur la retient', () => {
    expect(DEFAULT_SETTINGS.showNeck).toBe(false);
    const store = new Map<string, string>();
    const kv = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    kv.setItem(SETTINGS_KEY, JSON.stringify({ showNeck: true }));
    expect(loadAppSettings(kv).showNeck).toBe(true);
  });
});
