import { describe, expect, it } from 'vitest';
import { TUNINGS, generatePositions } from '../src/core/theory';
import { VOICINGS } from '../src/data/voicings';
import {
  BufferSurface, DIGIT_COLOR, PPQ, THEME_SYNTHWAVE, chordToScore, cursorAt, drawOverlay, drawScore, glyph,
  intervalStyle, layoutScore, positionToScore, progressionToScore, scaleToScore,
  type LayoutOptions, type Surface, type TabScore,
} from '../src/core/tab';
import { ev, note, rhythmScore } from './helpers/fixtures';
import { renderToBuffer } from './helpers/png';

const std = TUNINGS.standard!;
const T = THEME_SYNTHWAVE;
const base: LayoutOptions = { mode: 'wrap', maxWidth: 195, notes: 'fr', chords: 'en', annotation: 'none', stacks: 'change' };
const up = (h: string) => h.toUpperCase();

function single(fret: number, fn: string, string = 1, extra = {}): TabScore {
  return {
    id: 'fixture:single', kind: 'exercise', tuning: std, stringCount: 6, ppq: PPQ, tempo: 80, timeSig: [4, 4],
    measures: [{ events: [ev(0, 1920, [note(string, fret, fn, extra)])] }],
  };
}

describe('pastille pixel par pixel', () => {
  it('1 chiffre : 11×13, contour 1 px, coins arrondis, remplissage = couleur d\'intervalle, chiffre 5×7 exact', () => {
    const { surface: s, layout } = renderToBuffer(single(5, '3'), base);
    const p = layout.columns[0]!.pills[0]!;
    expect([p.w, p.h]).toEqual([11, 13]);
    const fill = up(intervalStyle('3').fill);
    expect(s.pixel(p.x, p.y)).toBe(up(T.panel)); // coin coupé
    expect(s.pixel(p.x + 1, p.y)).toBe(up(T.outline)); // contour
    expect(s.pixel(p.x, p.y + 1)).toBe(up(T.outline));
    expect(s.pixel(p.x + 1, p.y + 1)).toBe(fill); // remplissage
    expect(s.pixel(p.x + p.w - 2, p.y + p.h - 2)).toBe(fill);
    expect(s.pixel(p.x + p.w - 1, p.y + 6)).toBe(up(T.outline));
    // glyphe « 5 » : exactement ses pixels en couleur de chiffre, le reste en remplissage
    const g = glyph('5');
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        expect(s.pixel(p.x + 3 + c, p.y + 3 + r), `(${c},${r})`).toBe(g.rows[r]![c] === '#' ? up(intervalStyle('3').digit) : fill);
      }
    }
  });

  it('2 chiffres : 17×13, « 12 » = deux glyphes 5×7 séparés d\'1 pixel', () => {
    const { surface: s, layout } = renderToBuffer(single(12, '5'), base);
    const p = layout.columns[0]!.pills[0]!;
    expect([p.w, p.h]).toEqual([17, 13]);
    const fill = up(intervalStyle('5').fill);
    const digit = up(intervalStyle('5').digit);
    for (const [k, off] of [['1', 0], ['2', 6]] as const) {
      const g = glyph(k);
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 5; c++) expect(s.pixel(p.x + 3 + off + c, p.y + 3 + r)).toBe(g.rows[r]![c] === '#' ? digit : fill);
      }
    }
    // colonne de séparation entre les deux chiffres : tout en remplissage
    for (let r = 0; r < 7; r++) expect(s.pixel(p.x + 3 + 5, p.y + 3 + r)).toBe(fill);
  });

  it('fondamentale : coins coupés sur 2 px (marqueur de forme)', () => {
    const { surface: s, layout } = renderToBuffer(single(5, '1'), base);
    const p = layout.columns[0]!.pills[0]!;
    expect(s.pixel(p.x + 1, p.y)).toBe(up(T.panel));
    expect(s.pixel(p.x + 2, p.y)).toBe(up(T.outline));
    expect(s.pixel(p.x + 1, p.y + 1)).toBe(up(T.outline));
    expect(s.pixel(p.x, p.y + 2)).toBe(up(T.outline));
    expect(s.pixel(p.x + 2, p.y + 1)).toBe(up(intervalStyle('1').fill));
  });

  it('bémol : encoche 2×2 en bas à droite ; dièse : en haut à droite ; naturel : aucune', () => {
    const notch = (fn: string, where: 'top' | 'bottom') => {
      const { surface: s, layout } = renderToBuffer(single(5, fn), base);
      const p = layout.columns[0]!.pills[0]!;
      const y = where === 'top' ? p.y + 1 : p.y + p.h - 3;
      return s.pixel(p.x + p.w - 3, y) === up(T.outline) && s.pixel(p.x + p.w - 2, y + 1) === up(T.outline);
    };
    expect(notch('b3', 'bottom')).toBe(true);
    expect(notch('b3', 'top')).toBe(false);
    expect(notch('#4', 'top')).toBe(true);
    expect(notch('#4', 'bottom')).toBe(false);
    expect(notch('3', 'top') || notch('3', 'bottom')).toBe(false);
  });

  it('la ligne de corde passe derrière la pastille, jamais devant le chiffre', () => {
    const { surface: s, layout } = renderToBuffer(single(7, '5'), base);
    const p = layout.columns[0]!.pills[0]!;
    const y = p.y + 6;
    expect(s.pixel(p.x - 1, y)).toBe(up(T.stringLine));
    expect(s.pixel(p.x + p.w, y)).toBe(up(T.stringLine));
    expect(s.pixel(p.x + 1, y)).not.toBe(up(T.stringLine));
  });
});

describe('rendu net : aucun lissage', () => {
  it('la couche statique n\'emploie que les couleurs du thème et des intervalles (pas de demi-teintes)', () => {
    const allowed = new Set<string>(Object.values(T).map(up));
    for (const l of ['1', 'b2', '2', '#2', 'b3', '3', '4', '#4', 'b5', '5', '#5', 'b6', '6', 'b7', '7', 'bb7', '9', '#11', 'b13']) {
      allowed.add(up(intervalStyle(l).fill));
      allowed.add(up(intervalStyle(l).digit));
    }
    allowed.add(up(DIGIT_COLOR));
    const scores: TabScore[] = [
      scaleToScore('dorian', 'D', std, { direction: 'updown' }),
      chordToScore(VOICINGS.find((v) => v.id === 'D-xx0232')!),
      progressionToScore(['G-320003', 'C-x32010'].map((id) => VOICINGS.find((v) => v.id === id)!), { pattern: 'universal' }),
      rhythmScore(),
    ];
    for (const s of scores) {
      const layout = layoutScore(s, { ...base, annotation: 'degree' });
      const surface = new BufferSurface(layout.width, layout.height, T.panel);
      drawScore(surface, layout, T);
      const found = new Set<string>();
      for (let y = 0; y < layout.height; y++) for (let x = 0; x < layout.width; x++) found.add(surface.pixel(x, y));
      const extra = [...found].filter((c) => !allowed.has(c));
      expect(extra, s.id).toEqual([]);
    }
  });

  it('tout est dessiné dans les limites : aucun rectangle ne dépasse du tampon (statique + curseur + glow)', () => {
    class Strict implements Surface {
      out: string[] = [];
      constructor(readonly width: number, readonly height: number) {}
      fillRect(x: number, y: number, w: number, h: number) {
        if (x < 0 || y < 0 || x + w > this.width || y + h > this.height) this.out.push(`${x},${y} ${w}×${h}`);
      }
    }
    const scores: TabScore[] = [
      scaleToScore('locrian', 'B', std, { direction: 'updown' }),
      scaleToScore('pentatonic-minor', 'A', TUNINGS.standard7!, {}),
      chordToScore(VOICINGS.find((v) => v.id === 'F-133211')!),
      rhythmScore(),
      positionToScore(generatePositions('pentatonic-minor', 'A', std, 'boxes', { register: 1 })[3]!, std),
    ];
    for (const s of scores) {
      for (const mode of ['scroll', 'wrap'] as const) {
        const layout = layoutScore(s, { ...base, mode, annotation: 'degree' });
        const strict = new Strict(layout.width, layout.height);
        drawScore(strict, layout, T);
        for (const tick of [null, 0, 700, 1900]) drawOverlay(strict, layout, T, { tick, frame: 1 });
        expect(strict.out, `${s.id} ${mode}`).toEqual([]);
      }
    }
  });
});

describe('cordes non jouées, notes masquées, annotations', () => {
  it('X sur une corde non jouée, en couleur dédiée, sur fond de panneau (la ligne est coupée)', () => {
    const { surface: s, layout } = renderToBuffer(chordToScore(VOICINGS.find((v) => v.id === 'D-xx0232')!, { style: 'strum' }), base);
    const u = layout.columns[0]!.unplayed[0]!;
    expect(s.count(up(T.unplayed), u.cx - 2, u.y - 3, 5, 7)).toBeGreaterThanOrEqual(9);
    expect(s.pixel(u.cx - 4, u.y)).toBe(up(T.panel)); // la ligne de corde est coupée autour du X
  });

  it('note masquée (niveau 2) : emplacement en pointillés, aucun chiffre ni couleur d\'intervalle', () => {
    const sc = single(7, '5', 1, { hidden: true });
    const { surface: s, layout } = renderToBuffer(sc, base);
    const p = layout.columns[0]!.pills[0]!;
    expect(s.count(up(intervalStyle('5').fill), p.x, p.y, p.w, p.h)).toBe(0);
    expect(s.count(up(T.textMuted), p.x, p.y, p.w, p.h)).toBeGreaterThan(8);
    // et l'annotation ne révèle rien
    const l = layoutScore(sc, { ...base, annotation: 'degree' });
    expect(l.columns[0]!.sideAnnotations).toEqual([]);
  });

  it('flèches ↓ (cyan) et ↑ (rose) alignées sur l\'axe de la pile', () => {
    const { surface: s, layout } = renderToBuffer(chordToScore(VOICINGS.find((v) => v.id === 'Em-022000')!, { style: 'strum', pattern: 'eighths' }), base);
    const [d, u] = [layout.columns[0]!, layout.columns[1]!];
    expect(d.arrow!.dir).toBe('D');
    expect(u.arrow!.dir).toBe('U');
    expect(s.pixel(d.cx, d.arrow!.y + 6)).toBe(up(T.arrowDown)); // pointe du ↓ en bas de l'axe
    expect(s.pixel(u.cx, u.arrow!.y)).toBe(up(T.arrowUp)); // pointe du ↑ en haut
  });
});

describe('couche animée', () => {
  const sc = scaleToScore('dorian', 'D', std, { direction: 'up' });
  const L = layoutScore(sc, { ...base, mode: 'scroll', annotation: 'none' });
  const fresh = () => {
    const s = new BufferSurface(L.width, L.height, T.panel);
    drawScore(s, L, T);
    return s;
  };

  it('curseur : cœur blanc sur l\'abscisse exacte, halo magenta de chaque côté, triangle en tête', () => {
    const tick = L.columns[4]!.absTick;
    const s = fresh();
    drawOverlay(s, L, T, { tick, frame: 0 });
    const cur = cursorAt(L, tick);
    const x = Math.round(cur.x);
    const sys = L.systems[0]!;
    expect(s.pixel(x, sys.tabTop + 20)).toBe(up(T.cursorCore));
    expect(s.pixel(x, sys.rhythmY + 5)).toBe(up(T.cursorCore));
    expect(s.pixel(x - 1, sys.tabTop + 3)).not.toBe(up(T.panel));
    expect(s.pixel(x + 1, sys.tabTop + 3)).not.toBe(up(T.panel));
    expect(s.pixel(x - 2, sys.tabTop - 3)).toBe(up(T.cursor));
    expect(s.pixel(x + 2, sys.tabTop - 3)).toBe(up(T.cursor));
  });

  it('notes passées estompées à gauche du curseur, à droite inchangées', () => {
    const tick = L.columns[6]!.absTick;
    const before = fresh();
    const after = fresh();
    drawOverlay(after, L, T, { tick, frame: 0 });
    const sys = L.systems[0]!;
    const x = Math.round(cursorAt(L, tick).x);
    const y = sys.stringYs[5]!;
    expect(after.pixel(sys.x0 + 4, y)).not.toBe(before.pixel(sys.x0 + 4, y)); // à gauche : plus sombre
    expect(after.pixel(x + 30, y)).toBe(before.pixel(x + 30, y)); // à droite : intact
  });

  it('glow : 4 images de pulsation distinctes, fixe avec « réduire les animations »', () => {
    const ring = (frame: number, reduceMotion = false) => {
      const s = fresh();
      drawOverlay(s, L, T, { tick: null, frame, reduceMotion });
      const p = L.columns.find((x) => x.pills[0]?.characteristic)!.pills[0]!;
      return s.pixel(p.x - 1, p.y + 3);
    };
    expect(new Set([0, 1, 2, 3].map((f) => ring(f))).size).toBeGreaterThanOrEqual(3);
    expect(ring(0, true)).toBe(ring(2, true));
  });

  it('pas de glow sur une gamme sans note caractéristique (ionien)', () => {
    const l = layoutScore(scaleToScore('ionian', 'C', std, {}), { ...base, mode: 'scroll' });
    const a = new BufferSurface(l.width, l.height, T.panel);
    drawScore(a, l, T);
    const b = new BufferSurface(l.width, l.height, T.panel);
    drawScore(b, l, T);
    drawOverlay(b, l, T, { tick: null, frame: 0 });
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
  });

  it('événement en cours : anneau blanc autour de ses pastilles', () => {
    const c = L.columns[3]!;
    const s = fresh();
    drawOverlay(s, L, T, { tick: c.absTick + 10, frame: 0 });
    const p = c.pills[0]!;
    expect(s.pixel(p.x - 1, p.y + 5)).not.toBe(up(T.panel));
  });
});

describe('trou désigné (exercice de mémorisation)', () => {
  it('anneau du curseur autour de l’emplacement vide, sans révéler la case', () => {
    const sc = single(7, '5', 1, { hidden: true });
    const L = layoutScore(sc, { ...base, annotation: 'degree', activeHoleKey: '0:1' });
    const p = L.columns[0]!.pills[0]!;
    expect(p.active).toBe(true);
    expect(p.hidden).toBe(true);
    const s = new BufferSurface(L.width, L.height, T.panel);
    drawScore(s, L, T);
    drawOverlay(s, L, T, { tick: null, frame: 0 });
    // l'anneau est bien autour (pas dedans) et l'intérieur reste en pointillés
    expect(s.pixel(p.x - 1, p.y)).not.toBe(up(T.panel));
    expect(s.pixel(p.x - 2, p.y - 2)).not.toBe(up(T.panel));
    expect(s.count(up(intervalStyle('5').fill), p.x, p.y, p.w, p.h)).toBe(0);
    expect(s.count(up(T.textMuted), p.x, p.y, p.w, p.h)).toBeGreaterThan(8);
  });

  it('aucun anneau quand aucun trou n’est désigné', () => {
    const sc = single(7, '5', 1, { hidden: true });
    const L = layoutScore(sc, { ...base, annotation: 'degree' });
    const p = L.columns[0]!.pills[0]!;
    const s = new BufferSurface(L.width, L.height, T.panel);
    drawScore(s, L, T);
    drawOverlay(s, L, T, { tick: null, frame: 0 });
    expect(p.active).toBeUndefined();
    expect(s.pixel(p.x - 1, p.y)).toBe(up(T.panel));
  });
});
