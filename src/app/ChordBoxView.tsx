/**
 * Affichage de la boîte d'accord en pixels logiques mis à l'échelle ENTIÈRE (jamais de lissage).
 * Une seule couche, dessinée une fois par (mise en page, échelle) : la boîte est statique — l'anneau
 * de l'étape « Construire » fait partie du dessin, il n'a pas besoin d'animation.
 *
 * Composant séparé du reste de la leçon pour la même raison que `MicStrip` : il porte un canvas, et
 * seul son contenu doit changer quand l'accord change.
 */
import { useEffect, useRef, useState } from 'react';
import { CanvasSurface, THEME_SYNTHWAVE, drawChordBox, layoutChordBox } from '../core/tab';
import type { Voicing } from '../core/theory/voicings';

export interface ChordBoxViewProps {
  voicing: Voicing;
  /** Corde mise en avant (étape « Construire »), ou `null`. */
  highlight?: number | null;
  /** Cordes pas encore posées (étape « Construire ») : ni pastille, ni X, ni rond. */
  pending?: readonly number[];
  /** Échelle maximale (pixels CSS par pixel logique). */
  maxScale?: number;
}

export function ChordBoxView({ voicing, highlight = null, pending, maxScale = 4 }: ChordBoxViewProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(3);
  const [dpr, setDpr] = useState(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);

  const layout = layoutChordBox(voicing, { highlight, ...(pending ? { pending } : {}) });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const update = () => {
      setDpr(window.devicePixelRatio || 1);
      // largeur disponible → plus grande échelle ENTIÈRE qui tient, bornée par maxScale
      const avail = el.clientWidth || layout.width * 3;
      setScale(Math.max(2, Math.min(maxScale, Math.floor(avail / layout.width))));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout.width, maxScale]);

  const k = Math.max(1, Math.round(scale * dpr));
  const cssW = layout.width * scale;
  const cssH = layout.height * scale;

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    c.width = layout.width * k;
    c.height = layout.height * k;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const s = new CanvasSurface(ctx, layout.width, layout.height, k);
    s.begin();
    s.fillRect(0, 0, layout.width, layout.height, THEME_SYNTHWAVE.panel);
    drawChordBox(s, layout, THEME_SYNTHWAVE);
  }, [layout, k]);

  const openCount = layout.open.length;
  const mutedCount = layout.muted.length;
  return (
    <div ref={wrap} className="chordbox" style={{ width: cssW }}>
      <canvas
        ref={canvas}
        className="chordbox-canvas"
        style={{ width: cssW, height: cssH }}
        role="img"
        aria-label={`Boîte d'accord ${voicing.chord}, frettes ${voicing.frets.map((f) => (f === null ? 'x' : String(f))).join(' ')}${openCount ? `, ${openCount} cordes à vide` : ''}${mutedCount ? `, ${mutedCount} cordes non jouées` : ''}`}
      />
    </div>
  );
}
