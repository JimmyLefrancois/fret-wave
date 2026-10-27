/**
 * Rendu pixel art de la tablature : dessine un `ScoreLayout` sur une `Surface` (pixels logiques).
 *  - `drawScore`   : couche statique (panneau, cordes, mesures, pastilles, flèches, rythme, annotations) ;
 *  - `drawOverlay` : couche animée (glow des notes caractéristiques, notes passées estompées, curseur).
 * Aucune opération de lissage : seulement des rectangles entiers.
 */
import { intervalStyle, mix, type TabTheme } from './colors';
import { GLYPH_H, drawGlyph, drawText, glyph, sprite, textWidth } from './font';
import { METRICS, cursorAt, type ColumnLayout, type PillLayout, type ScoreLayout, type TextRole } from './layout';
import type { Surface } from './surface';

/** Rectangle à coins en escalier (rayon `c` pixels) : pastille nette, sans anticrénelage. */
function steppedRect(s: Surface, x: number, y: number, w: number, h: number, c: number, color: string, alpha = 1): void {
  for (let i = 0; i <= c; i++) s.fillRect(x + (c - i), y + i, w - 2 * (c - i), h - 2 * i, color, alpha);
}

export function drawPill(s: Surface, theme: TabTheme, p: PillLayout): void {
  if (p.muted) {
    drawUnplayed(s, theme, p.x + (p.w - 1) / 2, p.y + 6);
    return;
  }
  if (p.hidden) {
    // emplacement vide à compléter : fond du panneau, contour en pointillés
    s.fillRect(p.x, p.y, p.w, p.h, theme.panel);
    for (let i = 1; i < p.w - 1; i += 2) {
      s.fillRect(p.x + i, p.y, 1, 1, theme.textMuted);
      s.fillRect(p.x + i, p.y + p.h - 1, 1, 1, theme.textMuted);
    }
    for (let j = 1; j < p.h - 1; j += 2) {
      s.fillRect(p.x, p.y + j, 1, 1, theme.textMuted);
      s.fillRect(p.x + p.w - 1, p.y + j, 1, 1, theme.textMuted);
    }
    return;
  }
  const st = intervalStyle(p.fn);
  // Calque « notes de l'accord » : les notes étrangères s'effacent dans le panneau (pas d'alpha :
  // on mélange avec la couleur de fond, ce qui reste net en pixel art). Assez fort pour que la
  // différence se voie sur un téléphone : le chiffre reste lisible, la pastille perd sa couleur.
  const fade = (c: string, k: number) => (p.dim ? mix(c, theme.panel, k) : c);
  const c = st.root ? 2 : 1;
  steppedRect(s, p.x, p.y, p.w, p.h, c, fade(theme.outline, 0.7));
  steppedRect(s, p.x + 1, p.y + 1, p.w - 2, p.h - 2, c - 1, fade(st.fill, 0.78));
  drawText(s, p.x + 3, p.y + 3, p.text, fade(st.digit, 0.62));
  // encoche d'altération : bémol en bas à droite, dièse en haut à droite ; double = les deux côtés
  const right = p.x + p.w - 3;
  const left = p.x + 1;
  const bottom = p.y + p.h - 3;
  const top = p.y + 1;
  if (st.alt < 0) {
    s.fillRect(right, bottom, 2, 2, theme.outline);
    if (st.alt <= -2) s.fillRect(left, bottom, 2, 2, theme.outline);
  } else if (st.alt > 0) {
    s.fillRect(right, top, 2, 2, theme.outline);
    if (st.alt >= 2) s.fillRect(left, top, 2, 2, theme.outline);
  }
}

/** Corde non jouée / note étouffée : X sur un fond du panneau qui coupe la ligne de corde. */
export function drawUnplayed(s: Surface, theme: TabTheme, cx: number, y: number): void {
  s.fillRect(cx - 4, y - 5, 9, 11, theme.panel);
  drawGlyph(s, glyph('X'), cx - 2, y - 3, theme.unplayed);
}

const TEXT_COLOR: Record<TextRole, (t: TabTheme) => string> = {
  chord: (t) => t.chord,
  roman: (t) => t.roman,
  label: (t) => t.label,
  annotation: (t) => t.annotation,
  string: (t) => t.label,
  tempo: (t) => t.textMuted,
};

function drawColumn(s: Surface, theme: TabTheme, c: ColumnLayout): void {
  if (c.barre) {
    const { x, y0, y1 } = c.barre;
    s.fillRect(x, y0 + 2, 1, y1 - y0 - 3, theme.barre);
    s.fillRect(x, y0 + 2, 3, 1, theme.barre);
    s.fillRect(x, y1 - 2, 3, 1, theme.barre);
  }
  for (const u of c.unplayed) drawUnplayed(s, theme, u.cx, u.y);
  for (const p of c.pills) drawPill(s, theme, p);
  if (c.arrow) drawGlyph(s, glyph(c.arrow.dir === 'D' ? '↓' : '↑'), c.arrow.x, c.arrow.y, c.arrow.dir === 'D' ? theme.arrowDown : theme.arrowUp);
  for (const a of c.sideAnnotations) {
    // fond du panneau derrière le texte : la ligne de corde ne le traverse pas
    s.fillRect(a.x - 1, a.y - 1, textWidth(a.text) + 2, METRICS.glyphH + 2, theme.panel);
    drawText(s, a.x, a.y, a.text, theme.annotation);
  }
}

/** Couche statique : tout sauf le glow, le curseur et l'estompage des notes passées. */
export function drawScore(s: Surface, layout: ScoreLayout, theme: TabTheme): void {
  s.fillRect(0, 0, layout.width, layout.height, theme.panel);
  for (const sys of layout.systems) {
    const top = sys.stringYs[0]!;
    const bottom = sys.stringYs[sys.stringYs.length - 1]!;
    // lignes de cordes (fines, néon)
    const lastBar = sys.bars[sys.bars.length - 1]!;
    const end = lastBar.x + (lastBar.kind === 'thick' ? 4 : 1);
    for (const y of sys.stringYs) s.fillRect(sys.x0, y, end - sys.x0, 1, theme.stringLine);
    // barres de mesure
    for (const b of sys.bars) {
      s.fillRect(b.x, top, 1, bottom - top + 1, theme.barLine);
      if (b.kind === 'thick') s.fillRect(b.x + 2, top, 2, bottom - top + 1, theme.barLine);
    }
    for (const t of sys.texts) drawText(s, t.x, t.y, t.text, TEXT_COLOR[t.role](theme));
    if (sys.timeSig) {
      // Signature rythmique **empilée** (4 au-dessus de 4), comme sur une portée : un chiffre de large,
      // donc elle ne mord jamais sur la première pastille d'un accord. Petite, en tête de portée.
      const num = String(sys.timeSig.num);
      const den = String(sys.timeSig.den);
      const w = Math.max(textWidth(num), textWidth(den));
      s.fillRect(sys.timeSig.x - 1, sys.timeSig.y - 1, w + 2, GLYPH_H * 2 + 3, theme.panel);
      drawText(s, sys.timeSig.x, sys.timeSig.y, num, theme.textMuted);
      drawText(s, sys.timeSig.x, sys.timeSig.y + GLYPH_H + 1, den, theme.textMuted);
    }
    for (const r of sys.rhythm) {
      if (r.kind === 'rect') s.fillRect(r.x, r.y, r.w, r.h, theme.stem);
      else if (r.kind === 'sprite') drawGlyph(s, sprite(r.name), r.x, r.y, theme.stem);
      else drawText(s, r.x, r.y, r.text, theme.textMuted);
    }
  }
  for (const c of layout.columns) drawColumn(s, theme, c);
}

export interface OverlayState {
  /** Tick absolu du curseur, ou null (pas de lecture). */
  tick: number | null;
  /** Numéro d'image de l'animation (pulsation 4 images, ≈ 5 Hz). */
  frame: number;
  /** Pas d'animation : glow fixe. */
  reduceMotion?: boolean;
}

const PULSE = [0.85, 0.55, 0.3, 0.55] as const;

function ring(s: Surface, p: PillLayout, d: number, color: string, alpha: number): void {
  s.fillRect(p.x - d, p.y - d, p.w + 2 * d, 1, color, alpha);
  s.fillRect(p.x - d, p.y + p.h + d - 1, p.w + 2 * d, 1, color, alpha);
  s.fillRect(p.x - d, p.y - d + 1, 1, p.h + 2 * d - 2, color, alpha);
  s.fillRect(p.x + p.w + d - 1, p.y - d + 1, 1, p.h + 2 * d - 2, color, alpha);
}

/** Couche animée. L'appelant efface la surface avant l'appel (`CanvasSurface.begin()`). */
export function drawOverlay(s: Surface, layout: ScoreLayout, theme: TabTheme, state: OverlayState): void {
  const a = state.reduceMotion ? 0.7 : PULSE[state.frame % PULSE.length]!;
  for (const c of layout.columns) {
    for (const p of c.pills) {
      if (p.active) {
        // trou désigné : anneau du curseur, visible même sur un emplacement vide
        ring(s, p, 1, theme.cursorCore, 0.95);
        ring(s, p, 2, theme.cursor, 0.55);
        if (p.hidden) continue;
      }
      if (p.hidden || p.muted) continue;
      if (p.highlight) {
        // exercice « montre-moi la ♭3 » : anneau blanc continu, indépendant du mode
        ring(s, p, 1, theme.glow, 0.95);
        ring(s, p, 2, theme.glow, 0.5);
        continue;
      }
      if (!p.characteristic) continue;
      const color = intervalStyle(p.fn).fill;
      ring(s, p, 1, color, a);
      ring(s, p, 2, color, a * 0.45);
    }
  }
  if (state.tick === null) return;
  const cur = cursorAt(layout, state.tick);
  const sysCur = layout.systems[cur.systemIndex]!;
  // notes passées estompées (lignes précédentes entièrement, ligne courante jusqu'au curseur)
  for (const sys of layout.systems) {
    if (sys.index > cur.systemIndex) break;
    const y = sys.tabTop;
    const h = (sys.noRhythm ? sys.rhythmY : sys.rhythmY + METRICS.rhythmH) - y;
    const x = sys.x0 + 1;
    const w = sys.index < cur.systemIndex ? sys.width - x - 1 : Math.round(cur.x) - x - 1;
    if (w > 0) s.fillRect(x, y, w, h, theme.panel, 0.5);
  }
  // événement en cours : anneau blanc autour de ses pastilles
  const col = layout.columns[cur.columnIndex]!;
  if (col.kind === 'notes' && state.tick < col.absTick + col.durTick) {
    for (const p of col.pills) if (!p.hidden && !p.muted) ring(s, p, 1, theme.glow, 0.9);
  }
  // curseur : cœur blanc, halo magenta, triangle en tête
  const x = Math.round(cur.x);
  const y0 = sysCur.tabTop;
  const h = sysCur.rhythmY + 9 - y0;
  s.fillRect(x - 2, y0, 1, h, theme.cursor, 0.25);
  s.fillRect(x + 2, y0, 1, h, theme.cursor, 0.25);
  s.fillRect(x - 1, y0, 1, h, theme.cursor, 0.7);
  s.fillRect(x + 1, y0, 1, h, theme.cursor, 0.7);
  s.fillRect(x, y0, 1, h, theme.cursorCore);
  s.fillRect(x - 2, y0 - 3, 5, 1, theme.cursor);
  s.fillRect(x - 1, y0 - 2, 3, 1, theme.cursor);
  s.fillRect(x, y0 - 1, 1, 1, theme.cursorCore);
}
