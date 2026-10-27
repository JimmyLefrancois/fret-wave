import { describe, expect, it } from 'vitest';
import { SCALES, degreeLabels } from '../src/core/theory';
import {
  DIGIT_COLOR, FAMILY_COLORS, contrastRatio, deltaE, digitColorFor, intervalStyle, simulateDeficiency, type Deficiency,
} from '../src/core/tab';

const LABELS = ['1', 'b2', '2', '#2', 'b3', '3', '4', '#4', 'b5', '5', '#5', 'b6', '6', 'b7', '7', 'bb7', '9', 'b9', '#9', '11', '#11', '13', 'b13'];

describe('couleurs d\'intervalle', () => {
  it('la teinte porte le degré : 9 = 2, 11 = 4, 13 = 6 ; l\'altération module la couleur', () => {
    expect(intervalStyle('9').fill).toBe(intervalStyle('2').fill);
    expect(intervalStyle('11').fill).toBe(intervalStyle('4').fill);
    expect(intervalStyle('13').fill).toBe(intervalStyle('6').fill);
    expect(intervalStyle('b3').fill).not.toBe(intervalStyle('3').fill);
    expect(intervalStyle('3').fill).toBe(FAMILY_COLORS[3]);
    expect(intervalStyle('b3').alt).toBe(-1);
    expect(intervalStyle('#4').alt).toBe(1);
  });

  it('♯4 ≠ ♭5 et ♭3 ≠ ♯2 : la couleur est attachée à la FONCTION, pas à la touche', () => {
    expect(deltaE(intervalStyle('#4').fill, intervalStyle('b5').fill)).toBeGreaterThan(30);
    expect(deltaE(intervalStyle('b3').fill, intervalStyle('#2').fill)).toBeGreaterThan(30);
  });

  it('chaque degré de chaque gamme du catalogue a une couleur définie', () => {
    for (const def of SCALES) for (const d of degreeLabels(def)) expect(intervalStyle(d).family, d).toBeGreaterThan(0);
  });

  it('seule la fondamentale a la pastille à coins coupés (marqueur de forme)', () => {
    expect(LABELS.filter((l) => intervalStyle(l).root)).toEqual(['1']);
  });

  it('contraste chiffre / pastille ≥ 4,5 (WCAG AA) pour toutes les fonctions, altérées comprises', () => {
    for (const l of LABELS) {
      const st = intervalStyle(l);
      expect(contrastRatio(st.fill, st.digit), l).toBeGreaterThanOrEqual(4.5);
      expect(st.digit).toBe(digitColorFor(st.fill));
    }
    // le chiffre sombre reste le choix par défaut sur les couleurs claires
    expect(intervalStyle('1').digit).toBe(DIGIT_COLOR);
  });

  it('bémol et naturel de même degré restent distincts (ΔE ≥ 10) et les degrés voisins aussi', () => {
    for (const d of ['2', '3', '5', '6', '7']) {
      expect(deltaE(intervalStyle(d).fill, intervalStyle(`b${d}`).fill), d).toBeGreaterThanOrEqual(10);
    }
  });

  const MIN_DE: Record<Deficiency, number> = { protanopia: 12, deuteranopia: 17, tritanopia: 11 };
  it.each(['protanopia', 'deuteranopia', 'tritanopia'] as const)('simulation %s : les 7 familles restent séparées (ΔE ≥ seuil mesuré)', (kind) => {
    const fams = Object.keys(FAMILY_COLORS).map(Number);
    let min = Infinity;
    for (let i = 0; i < fams.length; i++) {
      for (let j = i + 1; j < fams.length; j++) {
        const a = simulateDeficiency(FAMILY_COLORS[fams[i]!]!, kind);
        const b = simulateDeficiency(FAMILY_COLORS[fams[j]!]!, kind);
        min = Math.min(min, deltaE(a, b));
      }
    }
    expect(min).toBeGreaterThanOrEqual(MIN_DE[kind]);
  });

  it('simulation : une personne sans déficience (couleur grise) ne change pas', () => {
    for (const kind of ['protanopia', 'deuteranopia', 'tritanopia'] as const) {
      const g = simulateDeficiency('#808080', kind);
      expect(deltaE(g, '#808080')).toBeLessThan(3);
    }
  });
});
