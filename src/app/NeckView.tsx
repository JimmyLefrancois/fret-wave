/**
 * Vue manche d'une position de gamme, en pixels logiques mis à l'échelle ENTIÈRE (jamais de lissage).
 * Une couche statique, comme la boîte d'accord, et une seconde couche pour la note qui sonne pendant la
 * lecture, facultative : elle se repeint seulement quand la note change.
 *
 * Cadrage : le manche entier dès qu'il tient à l'échelle 2, sinon une fenêtre autour de la position
 * (téléphone). Sous l'échelle 2, le conteneur défile plutôt que de rendre des pastilles illisibles.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CanvasSurface, drawNeck, drawNeckPlayhead, eventIndexAt, layoutNeck, neckRange, scoreToPlayEvents, type NeckNote, type NeckRange, type TabScore } from '../core/tab';
import type { TabPlayer } from '../core/audio/tabPlayer';
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
  /** Cases choisies : le manche s'assombrit autour d'elles, et la vue défile jusqu'à elles. */
  shade?: NeckRange | null;
  /** Cordes assombries (index 0 = corde grave). */
  dimStrings?: readonly number[];
  /** Cadrage imposé (pas de fenêtre autour de la zone) : le conteneur défile s'il ne tient pas. */
  range?: NeckRange;
  /** Suivi de lecture : la note entendue est cadrée sur le manche. */
  playback?: { score: TabScore; player: TabPlayer; transport: 'stopped' | 'playing' | 'paused' };
}

const MIN_SCALE = 2;

export function NeckView({ tuning, notes, zone, notation, label, maxScale = 3, shade = null, range, dimStrings, playback }: NeckViewProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
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
    if (range) return layoutNeck(tuning, notes, { range, zone, notation, shade, dimStrings });
    const full = layoutNeck(tuning, notes, { range: neckRange(zone, 'full'), zone, notation, shade, dimStrings });
    if (!avail || avail >= full.width * MIN_SCALE) return full;
    return layoutNeck(tuning, notes, { range: neckRange(zone, 'window'), zone, notation, shade, dimStrings });
  }, [tuning, notes, zone, notation, avail, shade, range, dimStrings]);

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

  // cases choisies hors de vue (téléphone) : on amène leur début au bord gauche, avec une case d'air
  const shadeFrom = shade?.from ?? null;
  useEffect(() => {
    const el = wrap.current;
    if (!el || shadeFrom === null || el.scrollWidth <= el.clientWidth) return;
    const v = layout.veil;
    const leftVeil = shadeFrom > 0 && v.length > 0 && v[0]!.x <= layout.wireX[0]! ? v[0]! : null;
    const rightVeil = v.find((q) => q !== leftVeil) ?? null;
    const selLeft = (leftVeil ? leftVeil.x + leftVeil.w : 0) * scale;
    const selRight = (rightVeil ? rightVeil.x : layout.width) * scale;
    // déjà en vue : on ne bouge rien (sur un grand écran le manche entier tient presque)
    if (selLeft >= el.scrollLeft && selRight <= el.scrollLeft + el.clientWidth) return;
    el.scrollTo({ left: Math.max(0, selLeft - layout.fretW * scale), behavior: 'smooth' });
  }, [shadeFrom, layout, scale]);

  const score = playback?.score;
  const player = playback?.player;
  const transport = playback?.transport ?? 'stopped';
  const events = useMemo(() => (score ? scoreToPlayEvents(score) : []), [score]);

  useEffect(() => {
    const c = overlay.current;
    if (!c || !player) return;
    c.width = layout.width * k;
    c.height = layout.height * k;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const s = new CanvasSurface(ctx, layout.width, layout.height, k);
    let shown = -2;
    const paint = () => {
      const i = transport === 'stopped' ? -1 : eventIndexAt(events, player.getTick());
      if (i === shown) return;
      shown = i;
      s.begin();
      if (i >= 0) drawNeckPlayhead(s, layout, events[i]!.notes, tabTheme);
    };
    paint();
    if (transport !== 'playing') return;
    let raf = 0;
    const loop = () => {
      paint();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [player, transport, events, layout, k, tabTheme]);

  return (
    <div ref={wrap} className="neck">
      <div className="neck-stage" style={{ width: cssW, height: cssH }}>
      <canvas
        ref={canvas}
        style={{ width: cssW, height: cssH }}
        role="img"
        aria-label={`Manche : ${label}, ${notes.length} notes${layout.range.from > 0 ? `, vue des cases ${layout.range.from} à ${layout.range.to}` : ''}`}
      />
      {player && <canvas ref={overlay} className="neck-overlay" style={{ width: cssW, height: cssH }} aria-hidden="true" />}
      </div>
    </div>
  );
}
