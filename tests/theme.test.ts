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
    expect(THEME_LIST.length).toBeGreaterThanOrEqual(2);
    // un thème clair et un thème sombre, sélectionnables tous les deux
    expect(new Set(THEME_LIST.map((t) => t.scheme))).toEqual(new Set(['dark', 'light']));
    expect(getTheme('dawn').name).toContain('Aube');
    expect(getTheme('dawn').scheme).toBe('light');
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
      // le texte secondaire doit rester confortable en 14-15 px sur téléphone : 7:1 pour `muted`, 5,5:1 pour `dim`
      for (const [bgName, bg] of Object.entries({ bg: t.palette.bg, surface: t.palette.surface, surfaceHi: t.palette.surfaceHi })) {
        expect(contrastRatio(t.palette.muted, bg), `${t.id} muted sur ${bgName}`).toBeGreaterThanOrEqual(7);
        expect(contrastRatio(t.palette.dim, bg), `${t.id} dim sur ${bgName}`).toBeGreaterThanOrEqual(5.5);
      }
      // la polarité suit `scheme` : encre claire sur fond sombre, ou l'inverse — jamais l'ambiguïté
      const textLum = relativeLuminance(t.palette.text);
      const bgLum = relativeLuminance(t.palette.bg);
      if (t.scheme === 'dark') expect(textLum, `${t.id} : thème sombre`).toBeGreaterThan(bgLum);
      else expect(textLum, `${t.id} : thème clair`).toBeLessThan(bgLum);
      // la surface se détache du fond dans le sens de la lumière
      const surfLum = relativeLuminance(t.palette.surface);
      if (t.scheme === 'dark') expect(surfLum).toBeGreaterThan(bgLum);
      else expect(surfLum).toBeGreaterThan(bgLum);
      // encre posée SUR un aplat d'accent (bouton primaire, pastille pleine, segment actif)
      for (const accent of ['magenta', 'cyan', 'violet'] as const) {
        const r = contrastRatio(t.palette.onAccent, t.palette[accent]);
        expect(r, `${t.id} onAccent sur ${accent} = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
      // les accents servent d'encre (liens, étiquettes, chiffres) : ≥ 4,5:1 sur la surface
      for (const accent of ['magenta', 'cyan', 'orange', 'yellow', 'violet', 'green', 'danger', 'ok'] as const) {
        const r = contrastRatio(t.palette[accent], t.palette.surface);
        expect(r, `${t.id} ${accent} sur surface = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
      // la tablature : l'encre doit tenir sur SON panneau, pas sur celui du thème par défaut
      expect(contrastRatio(t.tab.text, t.tab.panel), `${t.id} tab.text`).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(t.tab.textMuted, t.tab.panel), `${t.id} tab.textMuted`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.tab.chord, t.tab.panel), `${t.id} tab.chord`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.tab.annotation, t.tab.panel), `${t.id} tab.annotation`).toBeGreaterThanOrEqual(4.5);
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
    // scintillement + éventuelle comète (une traînée fait moins de 120 pixels), jamais la scène entière
    expect(diff).toBeLessThan(900);
    let below = 0;
    for (let y = geo.horizon; y < geo.height; y++) for (let x = 0; x < geo.width; x++) if (m0.pixel(x, y) !== m1.pixel(x, y)) below++;
    expect(below).toBeGreaterThan(100);
  });

  it('une comète traverse le ciel sombre, jamais deux à la fois', () => {
    // un rendu « sans comète » sert de référence : la différence entre les deux EST la traînée
    const withComet = (t: number) => {
      const buf = new BufferSurface(geo.width, geo.height, '#000000');
      drawSceneMotion(buf, SYNTHWAVE.scene, geo, t);
      return buf;
    };
    const without = (t: number) => {
      const buf = new BufferSurface(geo.width, geo.height, '#000000');
      drawSceneMotion(buf, { ...SYNTHWAVE.scene, comet: undefined }, geo, t);
      return buf;
    };

    const lit: number[] = [];
    const heads: number[] = [];
    for (let t = 0; t < 40; t += 0.05) {
      const a = withComet(t);
      const b = without(t);
      const n = cometPixels(a, b, geo).count;
      if (n >= 6) {
        lit.push(t);
        heads.push(cometPixels(a, b, geo).firstX);
      } else if (lit.length > 0) {
        break;
      }
    }
    expect(lit.length).toBeGreaterThan(3);     // un passage dure ~1,15 s
    expect(new Set(heads).size).toBeGreaterThan(1); // la tête avance, elle ne clignote pas sur place
  });

  it('sans jeton de comète, le ciel n’en dessine aucune', () => {
    // c'est la règle qui protège le thème clair : le ciel décide, pas un réglage global
    expect(THEMES.dawn?.scene.comet).toBeUndefined();
    const plain = { ...SYNTHWAVE.scene, comet: undefined };
    // un instant où le ciel sombre a une comète…
    let cometTime: number | null = null;
    for (let t = 0; t < 40 && cometTime === null; t += 0.05) {
      const a = new BufferSurface(geo.width, geo.height, '#000000');
      const b = new BufferSurface(geo.width, geo.height, '#000000');
      drawSceneMotion(a, SYNTHWAVE.scene, geo, t);
      drawSceneMotion(b, plain, geo, t);
      if (cometPixels(a, b, geo).count >= 6) cometTime = t;
    }
    expect(cometTime).not.toBeNull();
    // …au même instant, retirer le jeton ne laisse rien : c'est lui, et lui seul, qui la dessine
    const withToken = new BufferSurface(geo.width, geo.height, '#000000');
    const withoutToken = new BufferSurface(geo.width, geo.height, '#000000');
    drawSceneMotion(withToken, SYNTHWAVE.scene, geo, cometTime!);
    drawSceneMotion(withoutToken, plain, geo, cometTime!);
    expect(cometPixels(withToken, withoutToken, geo).count).toBeGreaterThan(5);
    // et deux rendus sans jeton sont identiques à l'instant de la comète
    const again = new BufferSurface(geo.width, geo.height, '#000000');
    drawSceneMotion(again, plain, geo, cometTime!);
    expect(cometPixels(withoutToken, again, geo).count).toBe(0);
  });
});

/** Pixels du ciel qui diffèrent entre un rendu avec comète et le même sans : la traînée. */
function cometPixels(a: BufferSurface, b: BufferSurface, g: { horizon: number; width: number }): { count: number; firstX: number } {
  let count = 0;
  let firstX = -1;
  for (let y = 0; y < g.horizon; y++) {
    for (let x = 0; x < g.width; x++) {
      if (a.pixel(x, y) === b.pixel(x, y)) continue;
      count += 1;
      if (firstX < 0) firstX = x;
    }
  }
  return { count, firstX };
}
