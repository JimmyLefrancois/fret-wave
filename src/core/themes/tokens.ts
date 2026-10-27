/**
 * Design tokens d'un thème (PROJECT.md §4.6, §5). Un thème = un fichier de config : palette, scène pixel,
 * police d'accent, ambiance. **Les couleurs d'intervalle ne sont PAS ici** : elles sont globales
 * (`core/tab/colors.ts`) pour que l'apprentissage visuel ne change jamais avec l'habillage.
 */
import type { TabTheme } from '../tab/colors';
import type { Hex } from '../tab/colors';

export type { Hex };

export interface SceneTokens {
  /** Ciel : haut, milieu, bas (proche de l'horizon). */
  skyTop: Hex;
  skyMid: Hex;
  skyLow: Hex;
  /** Lueur d'horizon (fine ligne + halo). */
  horizon: Hex;
  sunOuter: Hex;
  sunMid: Hex;
  sunCore: Hex;
  /** Grille en perspective. */
  gridLine: Hex;
  gridFar: Hex;
  /** Silhouettes de montagnes : lointaine (plus claire) et proche (plus sombre). */
  mountainFar: Hex;
  mountainNear: Hex;
  mountainRim: Hex;
  star: Hex;
  starAccent: Hex;
}

export interface UiTokens {
  /** Épaisseur de trait de l'UI DOM (pixels CSS) : 2 sur téléphone, jamais 1. */
  border: number;
  /** Ombre portée dure (décalage en pixels), look pixel art. */
  shadow: number;
  /** Rayon des coins en pixels (0 = angles vifs, 2 = coin « pixel »). */
  corner: number;
}

export interface ThemeTokens {
  id: string;
  name: string;
  palette: {
    bgDeep: Hex;
    bg: Hex;
    surface: Hex;
    surfaceHi: Hex;
    line: Hex;
    lineSoft: Hex;
    text: Hex;
    muted: Hex;
    dim: Hex;
    magenta: Hex;
    cyan: Hex;
    orange: Hex;
    yellow: Hex;
    violet: Hex;
    green: Hex;
    danger: Hex;
    ok: Hex;
  };
  scene: SceneTokens;
  /** Panneau de la tablature (couleurs du rendu canvas). */
  tab: TabTheme;
  /** Piles de polices auto-hébergées. */
  fonts: { display: string; label: string; body: string };
  ui: UiTokens;
  /** Scanlines CRT dessinées sur la scène (jamais sur les chiffres), désactivables. */
  scanlines: boolean;
}

/**
 * Tokens → variables CSS : un seul endroit, pas de hex en double dans la feuille de style.
 * Le nom des variables ne dépend pas du thème (un composant ignore le thème actif).
 */
export function cssVars(t: ThemeTokens): Record<string, string> {
  return {
    '--bg-deep': t.palette.bgDeep,
    '--bg': t.palette.bg,
    '--surface': t.palette.surface,
    '--surface-hi': t.palette.surfaceHi,
    '--line': t.palette.line,
    '--line-soft': t.palette.lineSoft,
    '--text': t.palette.text,
    '--muted': t.palette.muted,
    '--dim': t.palette.dim,
    '--magenta': t.palette.magenta,
    '--cyan': t.palette.cyan,
    '--orange': t.palette.orange,
    '--yellow': t.palette.yellow,
    '--violet': t.palette.violet,
    '--green': t.palette.green,
    '--danger': t.palette.danger,
    '--ok': t.palette.ok,
    '--font-display': t.fonts.display,
    '--font-label': t.fonts.label,
    '--font-body': t.fonts.body,
    '--bw': `${t.ui.border}px`,
    '--shadow': `${t.ui.shadow}px`,
    '--corner': `${t.ui.corner}px`,
  };
}
