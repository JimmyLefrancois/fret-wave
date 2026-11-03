/**
 * Écran de chargement pixel art (phase 1c) : fonction PURE sur une `Surface` (même police 5×7 et même pixel logique que
 * la tablature). Testée pixel par pixel (barre proportionnelle, rien hors des bornes, aucune couleur hors palette).
 */
import { drawText, drawTextScaled, textWidth, type Surface } from '../core/tab';
import { SYNTHWAVE, type ThemeTokens } from '../core/themes';

export const LOADING_W = 160;
export const LOADING_H = 90;

export function loadingPalette(theme: ThemeTokens) {
  const p = theme.palette, scene = theme.scene;
  return {
    sky: p.bg, skyLow: scene.skyMid,
    sunTop: scene.sunCore, sunMid: scene.sunMid, sunLow: scene.sunOuter,
    grid: scene.gridLine, gridFar: scene.gridFar,
    title: p.text, text: p.dim, barFrame: p.cyan,
    barOn: p.magenta, barOnHi: p.orange, barOff: p.surfaceHi,
    panel: p.surface, error: p.danger,
  };
}

export const LOADING_PALETTE = loadingPalette(SYNTHWAVE);

export interface LoadingState {
  /** 0-1. */
  progress: number;
  /** Ligne principale (« CHARGEMENT DU SON »). */
  label: string;
  /** Ligne secondaire (instrument, poids). */
  detail?: string;
  error?: string;
  /** Compteur d'images : fait clignoter le bord de la barre. */
  frame?: number;
}

export const BAR_X = 30;
export const BAR_Y = 52;
export const BAR_W = 100;
export const BAR_H = 9;
/** Nombre de blocs de la barre (4 px chacun, 1 px d'écart). */
export const BAR_BLOCKS = 19;

/** Raccourcit un texte (« .. » en fin) pour qu'il tienne dans la largeur de l'écran avec 4 px de marge de chaque côté. */
export function fitText(text: string, maxWidth: number): string {
  if (textWidth(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && textWidth(`${t}..`) > maxWidth) t = t.slice(0, -1);
  return `${t}..`;
}

const centered = (s: Surface, y: number, text: string, color: string) => {
  const t = fitText(text, s.width - 8);
  drawText(s, Math.max(0, Math.floor((s.width - textWidth(t)) / 2)), y, t, color);
};

export function drawLoadingScreen(target: Surface, st: LoadingState, theme: ThemeTokens = SYNTHWAVE): void {
  const P = loadingPalette(theme);
  let s = target;
  const W = s.width, H = s.height;
  const offsetX = Math.floor((W - LOADING_W) / 2);
  const offsetY = Math.floor((H - LOADING_H) / 2);
  s.fillRect(0, 0, W, H, P.sky);
  const horizon = offsetY + 36;
  s.fillRect(0, horizon - 14, W, 14, P.skyLow);

  // soleil rayé : demi-disque de rayon 18, bandes sombres de plus en plus épaisses vers le bas
  const cx = Math.floor(W / 2), r = 18;
  for (let dy = 0; dy < r; dy++) {
    const y = horizon - 1 - dy;
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    const stripe = dy < 12 && dy % 4 >= 4 - Math.floor((12 - dy) / 4); // bandes qui s'épaississent vers l'horizon
    if (stripe) continue;
    const color = dy > 11 ? P.sunTop : dy > 5 ? P.sunMid : P.sunLow;
    s.fillRect(cx - half, y, half * 2, 1, color);
  }

  // sol : grille en perspective
  s.fillRect(0, horizon, W, H - horizon, P.sky);
  let y = horizon + 1, step = 2;
  while (y < H) {
    s.fillRect(0, y, W, 1, step < 4 ? P.gridFar : P.grid);
    y += step;
    step += 1;
  }
  for (let i = -Math.ceil(W / 6); i <= Math.ceil(W / 6); i++) {
    let prevX: number | null = null;
    for (let yy = horizon + 1; yy < H; yy++) {
      const t = (yy - horizon) / (H - horizon);
      const x = Math.round(cx + i * (3 + t * 14));
      // segment continu entre la colonne de la rangée précédente et celle-ci (pas de pointillés dans les obliques)
      const x0 = prevX === null ? x : Math.min(prevX, x);
      const x1 = prevX === null ? x : Math.max(prevX, x);
      const a = Math.max(0, x0), b = Math.min(W - 1, x1);
      if (b >= a) s.fillRect(a, yy, b - a + 1, 1, t < 0.25 ? P.gridFar : P.grid);
      prevX = x;
    }
  }

  // Les éléments utiles gardent leur taille et restent centrés dans le décor étendu.
  s = {
    width: LOADING_W,
    height: LOADING_H,
    fillRect: (x, y, w, h, color, alpha) => target.fillRect(x + offsetX, y + offsetY, w, h, color, alpha),
  };
  // titre
  const title = 'FRETWAVE';
  const tw = title.length * 6 * 2 - 2;
  drawTextScaled(s, Math.floor((LOADING_W - tw) / 2) + 1, 6 + 1, title, P.barOn, 2);
  drawTextScaled(s, Math.floor((LOADING_W - tw) / 2), 6, title, P.title, 2);

  // panneau de la barre
  s.fillRect(BAR_X - 6, BAR_Y - 13, BAR_W + 12, 46, P.panel);
  centered(s, BAR_Y - 9, st.error ? 'ERREUR' : st.label, st.error ? P.error : P.title);
  // cadre + blocs
  const frame = P.barFrame;
  s.fillRect(BAR_X, BAR_Y, BAR_W, 1, frame);
  s.fillRect(BAR_X, BAR_Y + BAR_H - 1, BAR_W, 1, frame);
  s.fillRect(BAR_X, BAR_Y, 1, BAR_H, frame);
  s.fillRect(BAR_X + BAR_W - 1, BAR_Y, 1, BAR_H, frame);
  const p = Math.max(0, Math.min(1, st.progress));
  const on = Math.floor(p * BAR_BLOCKS + 1e-9);
  for (let i = 0; i < BAR_BLOCKS; i++) {
    const x = BAR_X + 3 + i * 5;
    const lit = i < on;
    s.fillRect(x, BAR_Y + 2, 4, BAR_H - 4, lit ? P.barOn : P.barOff);
    if (lit) s.fillRect(x, BAR_Y + 2, 4, 1, P.barOnHi);
  }
  const pct = `${Math.floor(p * 100 + 1e-9)}%`;
  centered(s, BAR_Y + BAR_H + 3, st.error ? st.error.toUpperCase() : pct, st.error ? P.error : P.title);
  if (st.detail && !st.error) centered(s, BAR_Y + BAR_H + 13, st.detail, P.text);
}
