/**
 * Couleurs : fonction d'intervalle → pastille (MUSIC_DESIGN.md §2, PROJECT.md §5.2).
 * La TEINTE porte le degré (1…7), l'ALTÉRATION module la luminosité et ajoute une encoche.
 * Ces couleurs sont identiques dans tous les thèmes ; seul le panneau change (THEME_SYNTHWAVE).
 */
import { parseFn } from './model';

export type Hex = `#${string}`;

/** Couleur de base par famille de degré (9 → 2, 11 → 4, 13 → 6). */
export const FAMILY_COLORS: Readonly<Record<number, Hex>> = {
  1: '#FFD23F', // fondamentale : jaune
  2: '#FF8A3D', // 2 / 9 : orange
  3: '#FF3CAC', // 3 : magenta
  4: '#7CFF6B', // 4 / 11 : vert
  5: '#3CE6FF', // 5 : cyan
  6: '#A86BFF', // 6 / 13 : violet
  7: '#FF5C5C', // 7 : corail
};

export const DIGIT_COLOR: Hex = '#120A2A';

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex(r: number, g: number, b: number): Hex {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mix(a: string, b: string, t: number): Hex {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export const DIGIT_LIGHT: Hex = '#FFFFFF';

export interface IntervalStyle {
  fill: Hex;
  /** Couleur du chiffre : sombre ou blanc, selon le meilleur contraste (WCAG) avec le remplissage. */
  digit: Hex;
  /** −2…+2 : bémol(s) / dièse(s) → encoche. */
  alt: number;
  family: number;
  /** Fondamentale : pastille à coins coupés (marqueur de forme en plus de la couleur). */
  root: boolean;
}

const FLAT_DARKEN = 0.22;
const SHARP_LIGHTEN = 0.3;

export function intervalStyle(fn: string): IntervalStyle {
  const p = parseFn(fn);
  if (!p) return { fill: '#B8B0C8', digit: DIGIT_COLOR, alt: 0, family: 0, root: false };
  const base = FAMILY_COLORS[p.family]!;
  let fill: Hex = base;
  if (p.alt < 0) fill = mix(base, '#000000', FLAT_DARKEN * Math.min(2, -p.alt));
  if (p.alt > 0) fill = mix(base, '#FFFFFF', SHARP_LIGHTEN * Math.min(2, p.alt));
  return { fill, digit: digitColorFor(fill), alt: p.alt, family: p.family, root: p.family === 1 && p.alt === 0 };
}

/** Chiffre sombre ou blanc : celui qui contraste le plus avec le fond de la pastille. */
export function digitColorFor(fill: string): Hex {
  return contrastRatio(fill, DIGIT_COLOR) >= contrastRatio(fill, DIGIT_LIGHT) ? DIGIT_COLOR : DIGIT_LIGHT;
}

// --- mesures de lisibilité (WCAG 2.x, CIE Lab, simulation de daltonisme)

function lin(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export type Deficiency = 'protanopia' | 'deuteranopia' | 'tritanopia';

/** Matrices de simulation (Machado et al. 2009, sévérité 1.0) appliquées en RGB linéaire. */
const MACHADO: Record<Deficiency, number[][]> = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};

function toSrgb(v: number): number {
  const c = Math.max(0, Math.min(1, v));
  return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
}

export function simulateDeficiency(hex: string, kind: Deficiency): Hex {
  const [r, g, b] = hexToRgb(hex).map(lin) as [number, number, number];
  const m = MACHADO[kind];
  return rgbToHex(
    toSrgb(m[0]![0]! * r + m[0]![1]! * g + m[0]![2]! * b),
    toSrgb(m[1]![0]! * r + m[1]![1]! * g + m[1]![2]! * b),
    toSrgb(m[2]![0]! * r + m[2]![1]! * g + m[2]![2]! * b),
  );
}

export function labOf(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(lin) as [number, number, number];
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** Distance CIE76 (ΔE) : ≈ 2,3 = différence juste perceptible ; ≥ 10 : nettement distinct. */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = labOf(a);
  const [l2, a2, b2] = labOf(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

// --- thème du panneau de tablature (le fond change avec l'ambiance ; les couleurs d'intervalle, jamais)

export interface TabTheme {
  panel: Hex;
  panelEdge: Hex;
  stringLine: Hex;
  barLine: Hex;
  text: Hex;
  textMuted: Hex;
  chord: Hex;
  roman: Hex;
  label: Hex;
  stem: Hex;
  arrowDown: Hex;
  arrowUp: Hex;
  outline: Hex;
  digit: Hex;
  unplayed: Hex;
  annotation: Hex;
  cursor: Hex;
  cursorCore: Hex;
  glow: Hex;
  barre: Hex;
}

export const THEME_SYNTHWAVE: TabTheme = {
  panel: '#150A33',
  panelEdge: '#3A1C71',
  stringLine: '#2BA5C0',
  barLine: '#8E6FD8',
  text: '#F3E9FF',
  textMuted: '#A99AC9',
  chord: '#FF9E3D',
  roman: '#C9B8FF',
  label: '#7FD8E8',
  stem: '#D9C9FF',
  arrowDown: '#05D9E8',
  arrowUp: '#FF6FA8',
  outline: '#0D0221',
  digit: DIGIT_COLOR,
  unplayed: '#FF5C7A',
  annotation: '#C9B8FF',
  cursor: '#FF2A6D',
  cursorCore: '#FFFFFF',
  glow: '#FFFFFF',
  barre: '#F9F871',
};
