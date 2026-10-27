import { describe, expect, it } from 'vitest';
import { voicingById } from '../src/data/voicings';
import {
  BOX_METRICS, THEME_SYNTHWAVE, BufferSurface, drawChordBox, intervalStyle, layoutChordBox,
} from '../src/core/tab';
import type { Voicing } from '../src/core/theory/voicings';

function v(id: string): Voicing {
  const found = voicingById(id);
  if (!found) throw new Error(`voicing absent : ${id}`);
  return found;
}

function render(voicing: Voicing, opts: { highlight?: number | null; pending?: number[] } = {}) {
  const layout = layoutChordBox(voicing, opts);
  const s = new BufferSurface(layout.width, layout.height, THEME_SYNTHWAVE.panel);
  drawChordBox(s, layout, THEME_SYNTHWAVE);
  return { layout, s };
}

describe('boîte d’accord — géométrie et rendu', () => {
  it('un accord ouvert montre toutes ses cordes : pastilles, cordes à vide, rien d’étouffé', () => {
    const l = layoutChordBox(v('Em-022000'));
    expect(l.nut).toBe(true);
    expect(l.baseFret).toBe(1);
    expect(l.dots.map((d) => [d.string, d.fret, d.fn])).toEqual([[1, 2, '5'], [2, 2, '1']]);
    expect(l.open.map((o) => o.string)).toEqual([0, 3, 4, 5]);
    expect(l.muted).toEqual([]);
    expect(l.fretLabel).toBeNull();
  });

  it('les numéros de doigts sont ceux de la base, pas une déduction', () => {
    const l = layoutChordBox(v('Em-022000'));
    expect(l.dots.find((d) => d.string === 1)?.finger).toBe(2);
    expect(l.dots.find((d) => d.string === 2)?.finger).toBe(3);
  });

  it('une forme déplacée ouvre une fenêtre et affiche le repère de case', () => {
    const l = layoutChordBox(v('G5-355xxx'));
    expect(l.nut).toBe(false);
    expect(l.baseFret).toBe(3);
    expect(l.fretLabel).toBe('3');
    expect(l.dots.map((d) => d.fret)).toEqual([3, 5, 5]);
    expect(l.muted.map((m) => m.string)).toEqual([3, 4, 5]);
    // la case 5 tombe sur la 3e ligne de frette de la fenêtre (0 = case 3)
    expect(l.dots[1]!.y).toBe(l.fretY[2]! + 2);
  });

  it('aucune pastille ne sort du cadre, quelle que soit la forme', () => {
    for (const id of ['Em-022000', 'C-x32010', 'Bm-x24432', 'F-133211', 'B7-x21202', 'triad-CoverE-xxx988']) {
      const l = layoutChordBox(v(id));
      for (const d of l.dots) {
        expect(d.x).toBeGreaterThanOrEqual(0);
        expect(d.y).toBeGreaterThanOrEqual(0);
        expect(d.x + d.w).toBeLessThanOrEqual(l.width);
        expect(d.y + d.h).toBeLessThanOrEqual(l.height);
      }
    }
  });

  it('le barré est dessiné sur les cordes qu’il couvre, à sa case', () => {
    const l = layoutChordBox(v('F-133211'));
    expect(l.barre).not.toBeNull();
    expect(l.barre!.fret).toBe(1);
    expect(l.barre!.x).toBe(l.stringX[0]);
    expect(l.barre!.w).toBe(l.stringX[5]! - l.stringX[0]!);
  });

  it('l’étape « Construire » ne masque que les doigts pas encore posés', () => {
    // Em : doigt 1 = corde de La (case 2), doigt 2 = corde de Ré (case 2). Les cordes à vide restent
    // visibles dès le début — un débutant doit voir tout de suite qu'il joue six cordes, dont quatre à vide.
    const afterFirst = layoutChordBox(v('Em-022000'), { pending: [2] });
    expect(afterFirst.dots.map((d) => d.string)).toEqual([1]);
    expect(afterFirst.open.map((o) => o.string)).toEqual([0, 3, 4, 5]);
    const afterBoth = layoutChordBox(v('Em-022000'), { pending: [] });
    expect(afterBoth.dots.map((d) => d.string)).toEqual([1, 2]);
    // une corde étouffée n'est jamais « en attente » : elle s'affiche en X tout de suite
    const am = layoutChordBox(v('Am-x02210'), { pending: [2, 3, 4] });
    expect(am.muted.map((m) => m.string)).toEqual([0]);
  });

  it('la mise en avant cerclée de blanc ne change pas la couleur de la pastille', () => {
    const plain = render(v('Em-022000'));
    const lit = render(v('Em-022000'), { highlight: 2 });
    expect(lit.s.count('#FFFFFF')).toBeGreaterThan(plain.s.count('#FFFFFF'));
    const fill = intervalStyle('1').fill.toUpperCase();
    // la fondamentale garde sa couleur malgré l'anneau
    expect(lit.s.count(fill)).toBeGreaterThan(0);
  });

  it('le rendu peint réellement les couleurs de fonction et les X', () => {
    const { layout, s } = render(v('Em-022000'));
    expect(layout.width).toBe(BOX_METRICS.padX + BOX_METRICS.labelW + 5 * BOX_METRICS.stringGap + BOX_METRICS.padRight);
    expect(s.count(THEME_SYNTHWAVE.panel)).toBeGreaterThan(0);
    expect(s.count(THEME_SYNTHWAVE.stringLine)).toBeGreaterThan(0);
    // corde de Mi grave à vide : un rond, pas une croix
    expect(s.count(THEME_SYNTHWAVE.label)).toBeGreaterThan(0);
    const withMuted = render(v('Am-x02210'));
    expect(withMuted.s.count(THEME_SYNTHWAVE.unplayed)).toBeGreaterThan(0);
  });
});
