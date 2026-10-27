/**
 * Affichage d'un TabScore : deux canvas superposés en pixels logiques, mis à l'échelle ENTIÈRE.
 *  - couche statique : dessinée une fois par (layout, échelle) ;
 *  - couche animée   : glow des notes caractéristiques + curseur, redessinée par requestAnimationFrame
 *    pendant la lecture (curseur lu sur Tone.Transport via `player.getTick()`).
 * Échelle : S pixels CSS par pixel logique ; k = round(S × dpr) pixels PHYSIQUES par pixel logique (entier),
 * donc des pixels tous identiques même avec un devicePixelRatio non entier (R5).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChordNotation, NoteNotation } from '../core/theory';
import { fmtNote } from '../core/theory';
import {
  CanvasSurface, THEME_SYNTHWAVE, cursorAt, drawOverlay, drawScore, drawText, layoutScore,
  type AnnotationKind, type ScoreLayout, type TabScore,
} from '../core/tab';
import type { TabPlayer } from '../core/audio/tabPlayer';

export interface TabViewProps {
  score: TabScore;
  notes: NoteNotation;
  chords: ChordNotation;
  annotation: AnnotationKind;
  mode: 'scroll' | 'wrap';
  /** Pixels CSS par pixel logique, ou « auto » (formule de PROJECT.md §4.9). */
  scale: number | 'auto';
  reduceMotion: boolean;
  player: TabPlayer | null;
  /** État du transport, géré par la page : le curseur n'est affiché qu'en lecture ou en pause. */
  transport: 'stopped' | 'playing' | 'paused';
  /** Position du curseur (fraction de la largeur visible) en défilement continu. */
  cursorAnchor?: number;
  /** Calque « notes de l'accord » : estompe les notes qui n'appartiennent pas à l'accord. */
  emphasizeChordTones?: boolean;
  /** Mode « débutant » : masque hampes, ligatures et silences. */
  hideRhythm?: boolean;
  /** Met en évidence toutes les pastilles d'une fonction (correction d'exercice). */
  highlightFn?: string;
  /** Toucher une pastille (exercice « montre-moi la ♭3 »). */
  onPick?: (pick: TabPick) => void;
}

export interface TabPick {
  fn: string;
  fret: number;
  string: number;
  /** Coordonnées logiques du centre de la pastille (repère du canvas). */
  x: number;
  y: number;
}

export interface TabMetrics {
  S: number;
  k: number;
  dpr: number;
  logicalW: number;
  logicalH: number;
  canvasW: number;
  canvasH: number;
  staticMs: number;
  overlayMsAvg: number;
  overlayMsMax: number;
  frames: number;
  slowFrames: number;
  maxFrameGapMs: number;
  tooWide: boolean;
}

const MAX_CANVAS = 16000;

function autoScale(viewWidth: number, viewHeight: number): number {
  return Math.max(2, Math.min(4, Math.floor(Math.min(viewWidth / 190, (viewHeight * 0.38) / 144))));
}

function describe(score: TabScore, notation: NoteNotation): string {
  const names = score.measures
    .flatMap((m) => m.events.flatMap((e) => e.notes.map((n) => fmtNote(n.note, notation))))
    .slice(0, 24)
    .join(' ');
  const chords = [...new Set(score.measures.map((m) => m.label?.chord).filter(Boolean))].join(', ');
  return `Tablature ${score.stringCount} cordes, ${score.measures.length} mesures${chords ? `, accords ${chords}` : ''}. Notes : ${names}`;
}

export function TabView(props: TabViewProps) {
  const { score, notes, chords, annotation, mode, scale, reduceMotion, player, transport, cursorAnchor = 0.3, emphasizeChordTones = false, hideRhythm = false, highlightFn, onPick } = props;
  const playing = transport === 'playing';
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const staticRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 360, h: 800 });
  const [dpr, setDpr] = useState(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  const metrics = useRef<TabMetrics>({
    S: 2, k: 2, dpr: 1, logicalW: 0, logicalH: 0, canvasW: 0, canvasH: 0, staticMs: 0, overlayMsAvg: 0, overlayMsMax: 0,
    frames: 0, slowFrames: 0, maxFrameGapMs: 0, tooWide: false,
  });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      setBox({ w: el.clientWidth, h: window.innerHeight });
      setDpr(window.devicePixelRatio || 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const S = scale === 'auto' ? autoScale(box.w, box.h) : scale;
  const k = Math.max(1, Math.round(S * dpr));
  const cssPerLogical = k / dpr;
  const viewLogical = Math.max(60, Math.floor(box.w / cssPerLogical));

  const layout: ScoreLayout = useMemo(
    () => layoutScore(score, {
      mode, maxWidth: viewLogical, notes, chords, annotation, stacks: 'change',
      emphasizeChordTones, hideRhythm, ...(highlightFn ? { highlightFn } : {}),
    }),
    [score, mode, viewLogical, notes, chords, annotation, emphasizeChordTones, hideRhythm, highlightFn],
  );

  const cssW = layout.width * cssPerLogical;
  const cssH = layout.height * cssPerLogical;

  // --- couche statique
  useEffect(() => {
    const c = staticRef.current;
    if (!c) return;
    c.width = layout.width * k;
    c.height = layout.height * k;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const t0 = performance.now();
    const s = new CanvasSurface(ctx, layout.width, layout.height, k);
    s.begin();
    drawScore(s, layout, THEME_SYNTHWAVE);
    const m = metrics.current;
    m.staticMs = performance.now() - t0;
    Object.assign(m, {
      S, k, dpr, logicalW: layout.width, logicalH: layout.height, canvasW: c.width, canvasH: c.height,
      tooWide: c.width > MAX_CANVAS || c.height > MAX_CANVAS,
    });
  }, [layout, k, S, dpr]);

  // --- étiquettes de cordes FIXES en défilement continu (elles ne partent pas avec la tablature)
  const labelW = layout.systems[0]?.x0 ?? 0;
  useEffect(() => {
    const c = labelsRef.current;
    if (!c || mode !== 'scroll') return;
    c.width = labelW * k;
    c.height = layout.height * k;
    const ctx = c.getContext('2d');
    const sys = layout.systems[0];
    if (!ctx || !sys) return;
    const s = new CanvasSurface(ctx, labelW, layout.height, k);
    s.begin();
    s.fillRect(0, 0, labelW, layout.height, THEME_SYNTHWAVE.panel);
    for (const y of sys.stringYs) s.fillRect(0, y, labelW, 1, THEME_SYNTHWAVE.stringLine);
    s.fillRect(labelW - 1, sys.stringYs[0]!, 1, sys.stringYs[sys.stringYs.length - 1]! - sys.stringYs[0]! + 1, THEME_SYNTHWAVE.barLine);
    for (const t of sys.texts) if (t.role === 'string') drawText(s, t.x, t.y, t.text, THEME_SYNTHWAVE.label);
  }, [layout, k, mode, labelW]);

  // --- couche animée
  const paint = useCallback(
    (tick: number | null, frame: number) => {
      const c = overlayRef.current;
      if (!c) return;
      if (c.width !== layout.width * k || c.height !== layout.height * k) {
        c.width = layout.width * k;
        c.height = layout.height * k;
      }
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const t0 = performance.now();
      const s = new CanvasSurface(ctx, layout.width, layout.height, k);
      s.begin();
      drawOverlay(s, layout, THEME_SYNTHWAVE, { tick, frame, reduceMotion });
      const dt = performance.now() - t0;
      const m = metrics.current;
      m.overlayMsAvg = m.frames === 0 ? dt : m.overlayMsAvg * 0.98 + dt * 0.02;
      m.overlayMsMax = Math.max(m.overlayMsMax, dt);
    },
    [layout, k, reduceMotion],
  );

  const lastSystem = useRef(-1);
  const scrollTo = useCallback(
    (tick: number | null) => {
      const stage = stageRef.current;
      if (!stage) return;
      if (mode === 'scroll') {
        let offset = 0;
        if (tick !== null) {
          const x = cursorAt(layout, tick).x;
          offset = Math.max(0, Math.min(layout.width - viewLogical, Math.floor(x - cursorAnchor * viewLogical)));
        }
        stage.style.transform = `translate3d(${-offset * cssPerLogical}px,0,0)`;
      } else {
        stage.style.transform = '';
        if (tick !== null) {
          const cur = cursorAt(layout, tick);
          if (cur.systemIndex !== lastSystem.current) {
            lastSystem.current = cur.systemIndex;
            const wrap = wrapRef.current;
            if (wrap) {
              const top = wrap.getBoundingClientRect().top + window.scrollY + layout.systems[cur.systemIndex]!.y * cssPerLogical;
              const bottom = top + layout.rows.systemH * cssPerLogical;
              if (top < window.scrollY + 60 || bottom > window.scrollY + window.innerHeight - 20) window.scrollTo({ top: Math.max(0, top - 80) });
            }
          }
        }
      }
    },
    [mode, layout, viewLogical, cssPerLogical, cursorAnchor],
  );

  useEffect(() => {
    let raf = 0;
    let timer = 0;
    let last = 0;
    const m = metrics.current;
    if (playing && player) {
      m.frames = 0;
      m.slowFrames = 0;
      m.maxFrameGapMs = 0;
      m.overlayMsMax = 0;
      const loop = (now: number) => {
        if (last) {
          const gap = now - last;
          m.maxFrameGapMs = Math.max(m.maxFrameGapMs, gap);
          if (gap > 25) m.slowFrames++;
        }
        last = now;
        const tick = player.state === 'stopped' ? null : player.getTick();
        paint(tick, Math.floor(now / 200));
        scrollTo(tick);
        m.frames++;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } else {
      lastSystem.current = -1;
      const idle = () => {
        const tick = player && transport === 'paused' ? player.getTick() : null;
        paint(tick, Math.floor(performance.now() / 200));
        scrollTo(tick);
      };
      idle();
      // pulsation du glow à ≈ 5 Hz seulement si la partition a une note caractéristique et si le mouvement est permis
      const hasGlow = layout.columns.some((c) => c.pills.some((p) => p.characteristic));
      if (hasGlow && !reduceMotion) timer = window.setInterval(idle, 200);
    }
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
    };
  }, [playing, transport, player, paint, scrollTo, layout, reduceMotion]);

  // --- crochets de vérification (développement uniquement)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // une seule instance de référence : celle qui joue (les tablatures de comparaison ont player = null)
    if (!player) return;
    (window as unknown as { __fretwave?: unknown }).__fretwave = {
      layout, score, player, metrics: () => ({ ...metrics.current }), cursorAt: (t: number) => cursorAt(layout, t), cssPerLogical,
      viewLogical,
    };
  }, [layout, score, player, cssPerLogical, viewLogical]);

  // --- toucher une pastille (exercice) : conversion CSS → pixels logiques, tolérance tactile
  const onPointer = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onPick) return;
    const stage = stageRef.current;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const lx = (e.clientX - r.left) / cssPerLogical;
    const ly = (e.clientY - r.top) / cssPerLogical;
    const hit = layout.columns
      .flatMap((c) => c.pills)
      .find((p) => lx >= p.x - 4 && lx <= p.x + p.w + 4 && ly >= p.y - 3 && ly <= p.y + p.h + 3);
    if (hit) onPick({ fn: hit.fn, fret: hit.fret, string: hit.string, x: hit.x + hit.w / 2, y: hit.y + hit.h / 2 });
  };

  return (
    <div
      ref={wrapRef}
      className={`tabview ${mode} ${onPick ? 'pickable' : ''}`}
      role={onPick ? 'group' : 'img'}
      aria-label={describe(score, notes)}
      style={{ height: cssH }}
      onClick={onPointer}
    >
      <div ref={stageRef} className="tabview-stage" style={{ width: cssW, height: cssH }}>
        <canvas ref={staticRef} className="pix" style={{ width: cssW, height: cssH }} />
        <canvas ref={overlayRef} className="pix" style={{ width: cssW, height: cssH }} />
      </div>
      {mode === 'scroll' && (
        <canvas ref={labelsRef} className="pix labels" style={{ width: labelW * cssPerLogical, height: cssH }} />
      )}
    </div>
  );
}
