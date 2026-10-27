/**
 * Thème « Synthwave Neon » (thème par défaut, PROJECT.md §5.1).
 * Toutes les valeurs sont ici : ajouter un thème = ajouter un fichier comme celui-ci + l'enregistrer
 * dans `registry.ts`. Aucune logique ne dépend de ce fichier.
 */
import { THEME_SYNTHWAVE } from '../tab/colors';
import type { ThemeTokens } from './tokens';

export const SYNTHWAVE: ThemeTokens = {
  id: 'synthwave',
  name: 'Synthwave Neon',
  palette: {
    bgDeep: '#06000F',
    bg: '#0D0221',
    surface: '#150A33',
    surfaceHi: '#201048',
    line: '#3A1C71',
    lineSoft: '#28124F',
    text: '#F6EEFF',
    muted: '#B3A3D9',
    dim: '#8C7CB8',
    magenta: '#FF2A6D',
    cyan: '#05D9E8',
    orange: '#FF9E3D',
    yellow: '#FFD23F',
    violet: '#A86BFF',
    green: '#7CFF6B',
    danger: '#FF5C7A',
    ok: '#4CFF9A',
  },
  scene: {
    skyTop: '#0A0126',
    skyMid: '#2B0A55',
    skyLow: '#7A1359',
    horizon: '#FF2A6D',
    sunOuter: '#FF2A6D',
    sunMid: '#FF9E3D',
    sunCore: '#FFE66D',
    gridLine: '#FF3D7F',
    gridFar: '#5B2A8C',
    mountainFar: '#2A0F4F',
    mountainNear: '#12042B',
    mountainRim: '#8A3BC9',
    star: '#F6EEFF',
    starAccent: '#05D9E8',
  },
  tab: THEME_SYNTHWAVE,
  fonts: {
    display: "'Press Start 2P', 'VT323', monospace",
    label: "'Silkscreen', 'VT323', monospace",
    body: "'VT323', ui-monospace, monospace",
  },
  ui: { border: 2, shadow: 4, corner: 2 },
  scanlines: true,
};
