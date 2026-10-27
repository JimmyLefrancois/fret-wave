/**
 * Décor pixel de l'app (PROJECT.md §4.9, §5) : deux canvas superposés en pixels logiques mis à l'échelle
 * ENTIÈRE (k = S × dpr), comme la tablature — aucun flou.
 *  - `poster` (hub) : ciel, étoiles, soleil rayé, montagnes, grille en perspective qui défile ;
 *  - `calm` (écrans de travail) : ciel et étoiles seulement — le décor ne doit jamais concurrencer la tab.
 * Couche immobile redessinée au redimensionnement ; couche animée à 30 img/s maximum, arrêtée si l'onglet
 * est masqué ou si « réduire les animations » est actif. Parallaxe = décalage vertical borné au défilement.
 */
import { useEffect, useRef } from 'react';
import { CanvasSurface } from '../core/tab';
import { drawSceneMotion, drawSceneStill, makeStars, sceneGeometry } from '../core/themes';
import type { ThemeTokens } from '../core/themes';

const FPS = 30;

/** Pixels CSS par pixel logique du décor : 2 partout (même densité que la tablature), 3 sur très grand écran. */
function scaleFor(cssW: number, cssH: number): number {
  return Math.max(2, Math.min(3, Math.round(Math.min(cssW, cssH) / 500)));
}

export type SceneVariant = 'poster' | 'calm';

export function SceneBackground(props: {
  theme: ThemeTokens;
  reduceMotion: boolean;
  scanlines: boolean;
  variant: SceneVariant;
  /** Décalage horizontal du soleil (0,5 = centré) : sur les écrans de travail, il s'écarte du titre. */
  sunX?: number;
}) {
  const { theme, reduceMotion, scanlines, variant, sunX = 0.5 } = props;
  const stillRef = useRef<HTMLCanvasElement>(null);
  const motionRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const still = stillRef.current;
    const motion = motionRef.current;
    if (!still || !motion) return;

    let raf = 0;
    let timer = 0;
    let geo = sceneGeometry(1, 1);
    let stars = makeStars(geo);
    let k = 2;

    const paintMotion = (t = performance.now() / 1000) => {
      const c = motionRef.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      try {
        const s = new CanvasSurface(ctx, geo.width, geo.height, k);
        s.begin();
        if (!reduceMotion && variant === 'poster') drawSceneMotion(s, theme.scene, geo, t);
      } catch (e) {
        // le décor ne doit jamais casser l'app : on garde la dernière image et on note l'erreur
        (window as unknown as { __sceneError?: string }).__sceneError = (e as Error).message;
      }
    };

    const resize = () => {
      const cssW = window.innerWidth;
      const cssH = window.innerHeight;
      const S = scaleFor(cssW, cssH);
      const dpr = window.devicePixelRatio || 1;
      k = Math.max(1, Math.round(S * dpr));
      const lw = Math.ceil(cssW / S);
      const lh = Math.ceil(cssH / S);
      // grand écran : horizon plus bas pour que le soleil passe SOUS le titre du hub
      const wide = cssW >= 900;
      // le décor couvre tout l'écran : horizon bas, soleil dans la bande haute (l'affiche du hub, puis
      // les en-têtes), grille en perspective jusqu'en bas — c'est l'image « synthwave » de la 1re version
      geo = variant === 'poster'
        ? sceneGeometry(lw, lh, wide ? { horizonRatio: 0.34, sunRatio: 0.19, sunCx: sunX } : { horizonRatio: 0.33, sunRatio: 0.24, sunCx: sunX })
        : sceneGeometry(lw, lh, { horizonRatio: wide ? 0.34 : 0.3 });
      stars = makeStars(geo, variant === 'poster' ? 110 : 70);

      for (const c of [still, motion]) {
        c.width = lw * k;
        c.height = lh * k;
        c.style.width = `${lw * (k / dpr)}px`;
        c.style.height = `${lh * (k / dpr)}px`;
      }

      const ctx = still.getContext('2d');
      if (ctx) {
        try {
          const s = new CanvasSurface(ctx, geo.width, geo.height, k);
          s.begin();
          drawSceneStill(s, theme.scene, geo, stars, variant);
        } catch (e) {
          (window as unknown as { __sceneError?: string }).__sceneError = (e as Error).message;
        }
      }
      paintMotion();
    };

    const startMotion = () => {
      if (timer || reduceMotion || variant !== 'poster') return;
      // Le navigateur limite déjà les intervalles d'un onglet masqué (≈ 1 img/s) : pas de garde
      // `document.hidden` ici, qui laisserait la couche animée vide au retour sur l'onglet.
      timer = window.setInterval(() => paintMotion(), 1000 / FPS);
    };
    const stopMotion = () => {
      if (timer) window.clearInterval(timer);
      timer = 0;
    };

    resize();
    startMotion();
    window.addEventListener('resize', resize);

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!wrapRef.current) return;
        const y = reduceMotion ? 0 : Math.min(40, window.scrollY * 0.06);
        wrapRef.current.style.transform = `translate3d(0, ${-y}px, 0)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      stopMotion();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
    };
  }, [theme, reduceMotion, variant, sunX]);

  return (
    <div
      ref={wrapRef}
      className={`scene scene-${variant} ${scanlines ? 'scanlines' : ''}`}
      aria-hidden="true"
    >
      <canvas ref={stillRef} className="scene-canvas" />
      <canvas ref={motionRef} className="scene-canvas" />
      <div className="scene-veil" />
    </div>
  );
}
