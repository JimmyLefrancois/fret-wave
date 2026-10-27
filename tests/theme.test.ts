import { describe, expect, it } from 'vitest';
import { BufferSurface } from '../src/core/tab';
import { contrastRatio, relativeLuminance } from '../src/core/tab/colors';
import {
  DEFAULT_THEME, THEMES, THEME_LIST, applyTheme, cssVars, getTheme, SYNTHWAVE,
  drawSceneMotion, drawSceneStill, makeStars, sceneGeometry,
} from '../src/core/themes';

describe('thème : tokens', () => {
  it('le thème par défaut est enregistré et complet', () => {
    expect(getTheme(null).id).toBe(DEFAULT_THEME);
    expect(getTheme('nawak').id).toBe(DEFAULT_THEME);
    expect(THEMES.synthwave).toBe(SYNTHWAVE);
    expect(THEME_LIST.length).toBeGreaterThanOrEqual(1);
    for (const t of THEME_LIST) {
      expect(t.palette.bg).toMatch(/^#[0-9A-F]{6}$/i);
      expect(t.fonts.display).toContain('Press Start');
      expect(t.tab.panel).toMatch(/^#/);
      expect(Object.keys(t.scene).length).toBeGreaterThanOrEqual(10);
    }
  });

  it('contraste du texte : ≥ 4,5 sur le fond et sur les surfaces, dans tous les thèmes', () => {
    for (const t of THEME_LIST) {
      for (const [name, c] of Object.entries({ text: t.palette.text, muted: t.palette.muted })) {
        for (const [bgName, bg] of Object.entries({ bg: t.palette.bg, surface: t.palette.surface, surfaceHi: t.palette.surfaceHi })) {
          expect(contrastRatio(c, bg), `${t.id} ${name} sur ${bgName} = ${contrastRatio(c, bg).toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      // le texte est plus clair que le fond, et le fond plus sombre que la surface
      expect(relativeLuminance(t.palette.text)).toBeGreaterThan(relativeLuminance(t.palette.bg));
      expect(relativeLuminance(t.palette.surface)).toBeGreaterThan(relativeLuminance(t.palette.bg));
    }
  });

  it('cssVars ne dépend pas du thème (mêmes noms de variables pour tous)', () => {
    const keys = Object.values(THEMES).map((t) => Object.keys(cssVars(t)).sort().join(','));
    expect(new Set(keys).size).toBe(1);
    expect(cssVars(SYNTHWAVE)['--bg']).toBe(SYNTHWAVE.palette.bg);
    expect(cssVars(SYNTHWAVE)['--bw']).toBe('2px');
  });

  it('applyTheme pose les variables et gère l’attribut du thème par défaut', () => {
    const root = { style: { props: {} as Record<string, string>, setProperty(k: string, v: string) { this.props[k] = v; } }, dataset: {} as Record<string, string> };
    applyTheme(root as unknown as HTMLElement, 'synthwave');
    expect(root.style.props['--cyan']).toBe(SYNTHWAVE.palette.cyan);
    expect(root.dataset.theme).toBeUndefined();
    applyTheme(root as unknown as HTMLElement, 'inexistant');
    expect(root.dataset.theme).toBeUndefined();
  });
});

describe('scène synthwave (dessin pur, pixels logiques)', () => {
  const geo = sceneGeometry(195, 422);

  it('géométrie : horizon aux 60 %, soleil dans la moitié haute', () => {
    expect(geo.width).toBe(195);
    expect(geo.height).toBe(422);
    expect(geo.horizon).toBe(253);
    expect(geo.sun.cx).toBe(98);
    expect(geo.sun.cy).toBeLessThan(geo.horizon);
    expect(geo.sun.r).toBeGreaterThan(10);
    expect(geo.sun.r).toBeLessThan(geo.horizon / 2);
  });

  it('étoiles : déterministes (même graine → mêmes positions)', () => {
    const a = makeStars(geo, 40, 7);
    const b = makeStars(geo, 40, 7);
    expect(a).toEqual(b);
    expect(a.every((s) => s.y >= 0 && s.y < geo.horizon)).toBe(true);
  });

  it('le ciel s’éclaircit vers l’horizon (bandes + tramage, pas de dégradé lissé)', () => {
    const s = new BufferSurface(geo.width, geo.height, '#000000');
    drawSceneStill(s, SYNTHWAVE.scene, geo);
    const top = relativeLuminance(s.pixel(2, 1));
    const nearHorizon = relativeLuminance(s.pixel(2, geo.horizon - 4));
    expect(nearHorizon).toBeGreaterThan(top);
  });

  it('le soleil est rayé : des fentes laissent voir le ciel, le disque a deux couleurs', () => {
    const s = new BufferSurface(geo.width, geo.height, '#000000');
    drawSceneStill(s, SYNTHWAVE.scene, geo);
    const cx = geo.sun.cx;
    let sunRows = 0;
    for (let y = geo.sun.cy - geo.sun.r; y <= geo.sun.cy + geo.sun.r; y++) {
      if (s.pixel(cx, y).toUpperCase() === SYNTHWAVE.scene.sunCore.toUpperCase()) sunRows++;
    }
    expect(sunRows).toBeGreaterThan(5);
    expect(s.count(SYNTHWAVE.scene.sunOuter)).toBeGreaterThan(10);
    // au moins une fente : sur la colonne centrale, une ligne n'est ni cœur, ni milieu, ni bas du disque
    const sunColors = new Set([SYNTHWAVE.scene.sunCore, SYNTHWAVE.scene.sunMid, SYNTHWAVE.scene.sunOuter].map((c) => c.toUpperCase()));
    let gaps = 0;
    for (let y = geo.sun.cy; y <= geo.sun.cy + geo.sun.r; y++) if (!sunColors.has(s.pixel(cx, y).toUpperCase())) gaps++;
    expect(gaps).toBeGreaterThan(0);
  });

  it('la scène est déterministe et la grille animée ne touche que le bas', () => {
    const a = new BufferSurface(geo.width, geo.height, '#000000');
    const b = new BufferSurface(geo.width, geo.height, '#000000');
    drawSceneStill(a, SYNTHWAVE.scene, geo);
    drawSceneStill(b, SYNTHWAVE.scene, geo);
    expect(a.pixel(40, 30)).toBe(b.pixel(40, 30));
    expect(a.pixel(3, geo.horizon + 50)).toBe(b.pixel(3, geo.horizon + 50));

    const m0 = new BufferSurface(geo.width, geo.height, '#000000');
    const m1 = new BufferSurface(geo.width, geo.height, '#000000');
    drawSceneMotion(m0, SYNTHWAVE.scene, geo, 0);
    drawSceneMotion(m1, SYNTHWAVE.scene, geo, 0.6);
    let diff = 0;
    for (let y = 0; y < geo.horizon; y++) for (let x = 0; x < geo.width; x++) if (m0.pixel(x, y) !== m1.pixel(x, y)) diff++;
    expect(diff).toBeLessThan(200); // seulement quelques étoiles qui scintillent, pas la scène entière
    let below = 0;
    for (let y = geo.horizon; y < geo.height; y++) for (let x = 0; x < geo.width; x++) if (m0.pixel(x, y) !== m1.pixel(x, y)) below++;
    expect(below).toBeGreaterThan(100);
  });
});
