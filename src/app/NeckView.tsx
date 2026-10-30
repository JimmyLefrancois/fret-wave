/**
 * Vue manche d'une position de gamme, en pixels logiques mis à l'échelle ENTIÈRE (jamais de lissage).
 * Une seule couche statique, comme la boîte d'accord : rien ne bouge sur le manche.
 *
 * Cadrage : le manche entier dès qu'il tient à l'échelle 2, sinon une fenêtre autour de la position
 * (téléphone). Sous l'échelle 2, le conteneur défile plutôt que de rendre des pastilles illisibles.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CanvasSurface, drawNeck, layoutNeck, neckRange, type NeckNote, type NeckRange } from '../core/tab';
import type { NoteNotation } from '../core/theory/types';
import type { Tuning } from '../core/theory/tunings';
import { useThemeTokens } from './settings';

export interface NeckViewProps {
  tuning: Tuning;
  notes: readonly NeckNote[];
  /** Cases de la position entière (fond de la zone), même quand `notes` n'en montre qu'une partie. */
  zone: NeckRange;
  notation: NoteNotation;
  /** Description lue par les lecteurs d'écran (« Position 2, cases 4 à 8 »). */
  label: string;
  maxScale?: number;
}

const MIN_SCALE = 2;

export function NeckView({ tuning, notes, zone, notation, label, maxScale = 3 }: NeckViewProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [avail, setAvail] = useState(0);
  const [dpr, setDpr] = useState(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const update = () => {
      setDpr(window.devicePixelRatio || 1);
      setAvail(el.clientWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const full = layoutNeck(tuning, notes, { range: neckRange(zone, 'full'), zone, notation });
    if (!avail || avail >= full.width * MIN_SCALE) return full;
    return layoutNeck(tuning, notes, { range: neckRange(zone, 'window'), zone, notation });
  }, [tuning, notes, zone, notation, avail]);

  const scale = Math.max(MIN_SCALE, Math.min(maxScale, Math.floor((avail || layout.width * MIN_SCALE) / layout.width)));
  const tabTheme = useThemeTokens().tab;
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
    s.fillRect(0, 0, layout.width, layout.height, tabTheme.panel);
    drawNeck(s, layout, tabTheme);
  }, [layout, k, tabTheme]);

  return (
    <div ref={wrap} className="neck">
      <canvas
        ref={canvas}
        style={{ width: cssW, height: cssH }}
        role="img"
        aria-label={`Manche : ${label}, ${notes.length} notes${layout.range.from > 0 ? `, vue des cases ${layout.range.from} à ${layout.range.to}` : ''}`}
      />
    </div>
  );
}
