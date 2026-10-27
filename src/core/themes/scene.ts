/**
 * Scène pixel art du thème (PROJECT.md §5, §4.9) : ciel bandé, étoiles, soleil rayé, montagnes en
 * silhouette, lignes de grille qui avancent vers le spectateur. Dessin PUR sur une `Surface`
 * (pixels logiques) : testable sans canvas, aucun flou, uniquement des rectangles entiers.
 *
 * Deux couches, pour tenir 30 img/s sur un téléphone :
 *  - `drawSceneStill` : ciel, étoiles, soleil, montagnes, horizon (ne bouge pas) ;
 *  - `drawSceneMotion` : lignes horizontales de la grille qui avancent + scintillement de quelques étoiles.
 *
 * Les rayons verticaux de la grille ne sont **pas** dessinés : à 195 px logiques de large (téléphone,
 * S = 2), les rayons convergent en une hachure de quelques pixels autour du point de fuite. Les
 * horizontales qui se resserrent portent seules la perspective — plus propre et tout aussi lisible.
 */
import { mix } from '../tab/colors';
import type { Surface } from '../tab/surface';
import type { SceneTokens } from './tokens';

export interface SceneGeometry {
  width: number;
  height: number;
  /** Ligne d'horizon (y logique). */
  horizon: number;
  /** Bas de la grille (y logique). */
  gridBottom: number;
  sun: { cx: number; cy: number; r: number };
}

export interface GeometryOptions {
  /** Position de l'horizon, en fraction de la hauteur (0,6 par défaut). */
  horizonRatio?: number;
  /** Rayon du soleil, en fraction de la largeur (0,19 par défaut ; 0,26 pour un poster). */
  sunRatio?: number;
}

export function sceneGeometry(width: number, height: number, opts: GeometryOptions = {}): SceneGeometry {
  const w = Math.max(8, Math.round(width));
  const h = Math.max(8, Math.round(height));
  const horizon = Math.round(h * (opts.horizonRatio ?? 0.6));
  // le soleil est borné aussi par la HAUTEUR de l'écran : sinon, sur grand écran (largeur énorme),
  // il devient un disque géant qui passe derrière le titre du hub
  const r = Math.max(6, Math.round(Math.min(w * (opts.sunRatio ?? 0.19), horizon * 0.44, h * 0.11)));
  return {
    width: w,
    height: h,
    horizon,
    gridBottom: h,
    sun: { cx: Math.round(w / 2), cy: horizon - r - Math.round(h * 0.04), r },
  };
}

/** Générateur pseudo-aléatoire déterministe : les étoiles ne « sautent » pas d'un rendu à l'autre. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Star {
  x: number;
  y: number;
  /** 1 = simple pixel, 2 = croix de 5 pixels. */
  size: 1 | 2;
  alpha: number;
  accent: boolean;
  /** Phase de scintillement (0…1). */
  phase: number;
}

export function makeStars(geo: SceneGeometry, count = 90, seed = 1717): Star[] {
  const rnd = mulberry32(seed);
  const out: Star[] = [];
  for (let i = 0; i < count; i++) {
    const y = Math.floor(rnd() * Math.max(4, geo.horizon - geo.sun.r * 0.4));
    out.push({
      x: Math.floor(rnd() * geo.width),
      y,
      size: rnd() < 0.16 ? 2 : 1,
      alpha: 0.35 + rnd() * 0.65,
      accent: rnd() < 0.18,
      phase: rnd(),
    });
  }
  return out;
}

/** Ciel en bandes + tramage d'une ligne entre deux bandes (pas de dégradé lissé : pixel art assumé). */
function drawSky(s: Surface, t: SceneTokens, geo: SceneGeometry): void {
  const BANDS = Math.max(8, Math.round(geo.horizon / 7));
  const bandH = geo.horizon / BANDS;
  const colorAt = (k: number): string => {
    const p = k / (BANDS - 1);
    return p < 0.62 ? mix(t.skyTop, t.skyMid, p / 0.62) : mix(t.skyMid, t.skyLow, (p - 0.62) / 0.38);
  };
  for (let k = 0; k < BANDS; k++) {
    const y0 = Math.round(k * bandH);
    const y1 = Math.round((k + 1) * bandH);
    s.fillRect(0, y0, geo.width, y1 - y0, colorAt(k));
    // tramage : une ligne en damier avec la couleur de la bande suivante, dégradé « sale » voulu
    if (k < BANDS - 1 && y1 - 1 > y0) {
      const c = colorAt(k + 1);
      for (let x = k % 2 === 0 ? 0 : 1; x < geo.width; x += 2) s.fillRect(x, y1 - 1, 1, 1, c);
    }
  }
}

function drawStars(s: Surface, t: SceneTokens, stars: readonly Star[], time: number): void {
  for (const st of stars) {
    const tw = 0.55 + 0.45 * Math.abs(Math.sin((time * 0.6 + st.phase) * Math.PI));
    const a = st.alpha * tw;
    const c = st.accent ? t.starAccent : t.star;
    s.fillRect(st.x, st.y, 1, 1, c, a);
    if (st.size === 2) {
      s.fillRect(st.x - 1, st.y, 1, 1, c, a * 0.5);
      s.fillRect(st.x + 1, st.y, 1, 1, c, a * 0.5);
      s.fillRect(st.x, st.y - 1, 1, 1, c, a * 0.5);
      s.fillRect(st.x, st.y + 1, 1, 1, c, a * 0.5);
    }
  }
}

/** Soleil rayé : halo, disque en trois zones de couleur, fentes horizontales qui s'élargissent vers le bas. */
function drawSun(s: Surface, t: SceneTokens, geo: SceneGeometry): void {
  const { cx, cy, r } = geo.sun;
  s.fillRect(cx - r - 3, cy - r - 3, 2 * r + 7, 2 * r + 7, t.sunOuter, 0.07);
  s.fillRect(cx - r - 1, cy - r - 1, 2 * r + 3, 2 * r + 3, t.sunOuter, 0.12);
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= geo.horizon) continue;
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    if (half <= 0) continue;
    // fentes : à partir de 20 % du rayon vers le bas, une fente de 3 px toutes les 7 px
    const fy = dy - Math.round(r * 0.2);
    if (fy > 0 && fy % 7 >= 4) continue;
    const p = (dy + r) / (2 * r);
    const color = p < 0.42 ? t.sunCore : p < 0.72 ? t.sunMid : t.sunOuter;
    s.fillRect(cx - half, y, 2 * half, 1, color);
  }
}

/** Deux crêtes de montagne déterministes (somme de sinus), en silhouette. */
function ridgeY(x: number, width: number, base: number, amp: number, salt: number): number {
  const p = x / Math.max(1, width);
  const a = Math.sin(p * 7.3 + salt) * 0.55 + Math.sin(p * 17.1 + salt * 2.7) * 0.28 + Math.sin(p * 31.7 + salt * 0.9) * 0.17;
  return Math.round(base - amp * (0.55 + 0.45 * a));
}

function drawMountains(s: Surface, t: SceneTokens, geo: SceneGeometry): void {
  const far = { base: geo.horizon - 2, amp: Math.max(6, Math.round(geo.horizon * 0.2)) };
  const near = { base: geo.horizon, amp: Math.max(4, Math.round(geo.horizon * 0.13)) };
  for (let x = 0; x < geo.width; x++) {
    const yFar = ridgeY(x, geo.width, far.base, far.amp, 1.7);
    s.fillRect(x, yFar, 1, geo.horizon - yFar, t.mountainFar);
    const yNear = ridgeY(x, geo.width, near.base, near.amp, 4.1);
    s.fillRect(x, yNear, 1, geo.horizon - yNear, t.mountainNear);
    // liseré néon continu sur la crête proche (1 px)
    s.fillRect(x, yNear, 1, 1, t.mountainRim, 0.4);
  }
}

/** Ligne d'horizon : cœur clair + halo au-dessus et au-dessous. */
function drawHorizon(s: Surface, t: SceneTokens, geo: SceneGeometry): void {
  const y = geo.horizon;
  s.fillRect(0, y - 2, geo.width, 1, t.horizon, 0.18);
  s.fillRect(0, y - 1, geo.width, 1, t.horizon, 0.45);
  s.fillRect(0, y, geo.width, 1, mix(t.horizon, '#FFFFFF', 0.55), 0.95);
}

/** Couche immobile : ciel, étoiles fixes, soleil, montagnes, horizon. */
export function drawSceneStill(
  s: Surface, tokens: SceneTokens, geo: SceneGeometry, stars?: readonly Star[], kind: 'poster' | 'calm' = 'poster',
): void {
  drawSky(s, tokens, geo);
  drawStars(s, tokens, stars ?? makeStars(geo), 0);
  if (kind === 'calm') {
    // décor de travail : ciel + étoiles + une ligne d'horizon discrète, rien qui accroche l'œil
    s.fillRect(0, geo.horizon, geo.width, 1, tokens.horizon, 0.25);
    return;
  }
  drawSun(s, tokens, geo);
  drawMountains(s, tokens, geo);
  drawHorizon(s, tokens, geo);
}

/**
 * Couche animée : lignes horizontales de la grille qui avancent vers le spectateur.
 * `time` en secondes ; l'appelant ne l'appelle pas quand les animations sont réduites.
 */
export function drawSceneMotion(s: Surface, tokens: SceneTokens, geo: SceneGeometry, time: number): void {
  const { width: w, horizon, gridBottom } = geo;
  const N = 14;
  const phase = (time * 0.45) % 1;
  for (let i = 0; i < N; i++) {
    const d = (i + phase) / N;
    const y = Math.round(horizon + (gridBottom - horizon) * d * d * 1.02);
    if (y <= horizon || y >= gridBottom) continue;
    const a = 0.45 + 0.5 * d;
    const h = d > 0.25 ? 2 : 1;
    s.fillRect(0, y, w, h, mix(tokens.gridFar, tokens.gridLine, 0.55 + 0.45 * d), a);
  }
  // scintillement : quelques étoiles seulement (les autres sont dans la couche immobile)
  drawStars(s, tokens, makeStars(geo).filter((_, k) => k % 7 === 0), time);
}
