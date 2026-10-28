/** Écran de chargement : canvas pixel (voir loadingScreen.ts), mis à l'échelle ENTIÈRE, centré. */
import { useEffect, useRef, useState } from 'react';
import { CanvasSurface } from '../core/tab';
import { LOADING_H, LOADING_W, drawLoadingScreen, type LoadingState } from './loadingDraw';

export function LoadingScreen(props: LoadingState & { onRetry?: () => void; onSkip?: () => void }) {
  const { onRetry, onSkip, ...state } = props;
  const ref = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 360, h: 640, dpr: 1 });

  useEffect(() => {
    const on = () => setBox({ w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 });
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  // k = pixels physiques par pixel logique (entier) ; taille CSS = (LOADING × k) / dpr
  const k = Math.max(1, Math.floor(Math.min((box.w * box.dpr) / LOADING_W, (box.h * box.dpr * 0.6) / LOADING_H)));
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = LOADING_W * k;
    c.height = LOADING_H * k;
    const ctx = c.getContext('2d')!;
    const surface = new CanvasSurface(ctx, LOADING_W, LOADING_H, k);
    surface.begin();
    drawLoadingScreen(surface, state);
  }, [k, state.progress, state.label, state.detail, state.error]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="loading" role="status" aria-live="polite" aria-label={`${state.label} ${Math.round(state.progress * 100)} %`}>
      <canvas ref={ref} className="pix-loading" style={{ width: (LOADING_W * k) / box.dpr, height: (LOADING_H * k) / box.dpr }} />
      {state.error && (
        <div className="loading-actions">
          {onRetry && <button onClick={onRetry}>Réessayer</button>}
          {onSkip && <button onClick={onSkip}>Continuer sans le son</button>}
        </div>
      )}
    </div>
  );
}
