/** Écran de chargement : canvas pixel (voir loadingScreen.ts), mis à l'échelle ENTIÈRE, centré. */
import { useEffect, useRef, useState } from 'react';
import { CanvasSurface } from '../core/tab';
import { LOADING_H, LOADING_W, drawLoadingScreen, type LoadingState } from './loadingDraw';
import type { ThemeTokens } from '../core/themes';

export function LoadingScreen(props: LoadingState & { theme: ThemeTokens; onRetry?: () => void; onSkip?: () => void }) {
  const { theme, onRetry, onSkip, ...state } = props;
  const ref = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 360, h: 640, dpr: 1 });

  useEffect(() => {
    const on = () => setBox({ w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 });
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  // k = pixels physiques par pixel logique (entier) ; taille CSS = (LOADING × k) / dpr
  const k = Math.max(1, Math.floor(Math.min((box.w * box.dpr) / LOADING_W, (box.h * box.dpr) / LOADING_H)));
  const width = Math.max(LOADING_W, Math.ceil(box.w * box.dpr / k));
  const height = Math.max(LOADING_H, Math.ceil(box.h * box.dpr / k));
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = width * k;
    c.height = height * k;
    const ctx = c.getContext('2d')!;
    const surface = new CanvasSurface(ctx, width, height, k);
    surface.begin();
    drawLoadingScreen(surface, state, theme);
  }, [k, width, height, theme, state.progress, state.label, state.detail, state.error]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="loading" role="status" aria-live="polite" aria-label={`${state.label} ${Math.round(state.progress * 100)} %`}>
      <canvas ref={ref} className="pix-loading" />
      {state.error && (
        <div className="loading-actions">
          {onRetry && <button onClick={onRetry}>Réessayer</button>}
          {onSkip && <button onClick={onSkip}>Continuer sans le son</button>}
        </div>
      )}
    </div>
  );
}
