/**
 * Thème « Aube » (jour) — même monde que Synthwave Neon, en clair.
 *
 * Le décor ne change pas de nature : ciel dégradé, soleil rayé, montagnes, grille en perspective.
 * Ce qui change, c'est la **lumière** — un ciel d'aube (rose pâle vers l'orange), des montagnes en
 * silhouettes claires, et une encre prune presque noire pour que tout reste lisible sur du papier.
 *
 * Trois règles ont guidé les valeurs :
 *  1. **l'encre d'abord** : `text` / `muted` / `dim` tiennent ≥ 7:1 sur `surface` et `bg` (mesuré par
 *     `tests/theme.test.ts`), parce qu'un thème clair pardonne moins les gris trop pâles ;
 *  2. **les accents sont assombris, pas délavés** : le magenta passe de `#FF2A6D` à `#C2185B`, le cyan
 *     à `#0B6E7A` — même famille, assez profonde pour être lue comme du texte (≥ 4,5:1) ;
 *  3. **la pastille garde son aplat saturé** : les couleurs d'intervalle ne dépendent pas du thème
 *     (core/tab/colors) — seul le **panneau** de la tablature s'éclaircit, avec une encre sombre.
 */
import { DIGIT_COLOR, type TabTheme } from '../tab/colors';
import type { ThemeTokens } from './tokens';

/** Panneau de tablature clair : l'encre passe en prune, le contour des chiffres en couleur papier. */
const TAB_DAWN: TabTheme = {
  panel: '#FFFBF5',
  panelEdge: '#E7A9BF',
  stringLine: '#8A6470',
  barLine: '#9C6B84',
  text: '#2B0B2E',
  textMuted: '#6E4462',
  chord: '#B4530A',
  roman: '#5B2A9E',
  label: '#0B6E7A',
  stem: '#5B2A9E',
  arrowDown: '#0B6E7A',
  arrowUp: '#C2185B',
  // sur fond clair, le contour des chiffres prend la couleur du papier (et non plus le noir du ciel)
  outline: '#FFFBF5',
  digit: DIGIT_COLOR,
  unplayed: '#B3122F',
  annotation: '#5B2A9E',
  cursor: '#C2185B',
  cursorCore: '#2B0B2E',
  glow: '#4A1B3E',
  barre: '#8A6A00',
};

export const DAWN: ThemeTokens = {
  id: 'dawn',
  name: 'Aube (jour)',
  scheme: 'light',
  palette: {
    bgDeep: '#FFDCC7',
    bg: '#FFF3E8',
    surface: '#FFFBF5',
    surfaceHi: '#FFE7D6',
    line: '#B23A6B',
    lineSoft: '#F3C3D3',
    text: '#2B0B2E',
    muted: '#5E2C52',
    dim: '#6E4462',
    magenta: '#C2185B',
    cyan: '#0B6E7A',
    orange: '#B4530A',
    // 4,98:1 sur surfaceHi (4,26 avec #8A6A00) : la ★ d'un sans-faute se lit sur sa pastille
    yellow: '#7D6000',
    violet: '#5B2A9E',
    green: '#1C6B36',
    danger: '#B3122F',
    ok: '#14683A',
    // accents profonds : l'encre posée dessus doit être claire
    onAccent: '#FFF8F2',
  },
  scene: {
    skyTop: '#FFE9F2',
    skyMid: '#FFD0DF',
    skyLow: '#FFB3C7',
    horizon: '#E23E77',
    sunOuter: '#FF7BA8',
    sunMid: '#FFA33D',
    sunCore: '#FFD84D',
    gridLine: '#E23E77',
    gridFar: '#FFC2D4',
    mountainFar: '#F6B9CC',
    mountainNear: '#DE9AB8',
    mountainRim: '#E23E77',
    // sur un ciel clair, les étoiles sont des points d'encre, pas des lumières
    star: '#7A2B58',
    starAccent: '#0B6E7A',
  },
  tab: TAB_DAWN,
  fonts: {
    display: "'Press Start 2P', monospace",
    label: "'Silkscreen', 'Press Start 2P', monospace",
    body: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  ui: { border: 2, shadow: 4, corner: 2 },
  // les scanlines noires sur un fond clair salissent plus qu'elles n'habillent
  scanlines: false,
};
