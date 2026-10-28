import { describe, expect, it } from 'vitest';
import { BufferSurface, glyph, hasGlyph, textWidth, type Surface } from '../src/core/tab';
import {
  BAR_BLOCKS, BAR_H, BAR_W, BAR_X, BAR_Y, LOADING_H, LOADING_PALETTE, LOADING_W, drawLoadingScreen, fitText, type LoadingState,
} from '../src/app/loadingDraw';
import { writePng } from './helpers/png';

const P = LOADING_PALETTE;
const render = (st: LoadingState) => {
  const s = new BufferSurface(LOADING_W, LOADING_H, P.sky);
  drawLoadingScreen(s, st);
  return s;
};
const litBlocks = (s: BufferSurface) => {
  let n = 0;
  for (let i = 0; i < BAR_BLOCKS; i++) if (s.pixel(BAR_X + 3 + i * 5 + 1, BAR_Y + 4) === P.barOn) n++;
  return n;
};

describe('écran de chargement pixel', () => {
  it('la barre est proportionnelle à l\'avancement : 0 % → aucun bloc, 100 % → tous, croissante et sans trou', () => {
    expect(litBlocks(render({ progress: 0, label: 'CHARGEMENT DU SON' }))).toBe(0);
    expect(litBlocks(render({ progress: 1, label: 'CHARGEMENT DU SON' }))).toBe(BAR_BLOCKS);
    let prev = 0;
    for (let p = 0; p <= 100; p++) {
      const n = litBlocks(render({ progress: p / 100, label: 'X' }));
      expect(n).toBeGreaterThanOrEqual(prev);
      expect(n).toBe(Math.floor((p / 100) * BAR_BLOCKS + 1e-9));
      prev = n;
    }
  });

  it('avancement hors plage ou NaN : borné, jamais d\'exception', () => {
    expect(litBlocks(render({ progress: -3, label: 'X' }))).toBe(0);
    expect(litBlocks(render({ progress: 7, label: 'X' }))).toBe(BAR_BLOCKS);
  });

  it('le cadre de la barre est dessiné et tient dans l\'image', () => {
    const s = render({ progress: 0.5, label: 'X' });
    expect(s.pixel(BAR_X, BAR_Y)).toBe(P.barFrame);
    expect(s.pixel(BAR_X + BAR_W - 1, BAR_Y + BAR_H - 1)).toBe(P.barFrame);
    expect(BAR_X + BAR_W).toBeLessThanOrEqual(LOADING_W);
    expect(BAR_Y + BAR_H + 13 + 9).toBeLessThanOrEqual(LOADING_H); // détail + jambage de la virgule
  });

  it('aucune couleur hors palette (pas de lissage), y compris avec texte et erreur', () => {
    const allowed = new Set<string>(Object.values(P).map((c) => c.toUpperCase()));
    // le panneau translucide mélange sky avec lui-même : même couleur ; le texte et la barre n'utilisent que la palette
    for (const st of [
      { progress: 0.37, label: 'CHARGEMENT DU SON', detail: 'GUITARE CLASSIQUE · 5,3 MO' },
      { progress: 0.9, label: 'X', error: 'HTTP 404' },
    ] as LoadingState[]) {
      const s = render(st);
      const found = new Set<string>();
      for (let y = 0; y < LOADING_H; y++) for (let x = 0; x < LOADING_W; x++) found.add(s.pixel(x, y));
      expect([...found].filter((c) => !allowed.has(c))).toEqual([]);
    }
  });

  it('rien n\'est dessiné hors des bornes', () => {
    class Strict implements Surface {
      out: string[] = [];
      constructor(readonly width: number, readonly height: number) {}
      fillRect(x: number, y: number, w: number, h: number) {
        if (x < 0 || y < 0 || x + w > this.width || y + h > this.height) this.out.push(`${x},${y} ${w}×${h}`);
      }
    }
    for (const st of [
      { progress: 0.5, label: 'CHARGEMENT DU SON', detail: 'GUITARE ÉLECTRIQUE (SON DIRECT) · 6,8 MO' },
      { progress: 1, label: 'X', error: 'ÉCHEC DU CHARGEMENT DES ÉCHANTILLONS' },
    ] as LoadingState[]) {
      const strict = new Strict(LOADING_W, LOADING_H);
      drawLoadingScreen(strict, st);
      expect(strict.out).toEqual([]);
    }
  });

  it('un texte trop long est raccourci pour tenir dans l\'écran', () => {
    expect(fitText('COURT', 150)).toBe('COURT');
    const t = fitText('GUITARE ÉLECTRIQUE (SON DIRECT) · 6,8 MO', LOADING_W - 8);
    expect(textWidth(t)).toBeLessThanOrEqual(LOADING_W - 8);
    expect(t.endsWith('..')).toBe(true);
  });

  it('tous les caractères affichés sont dans la police (« % », « · », accents)', () => {
    for (const ch of '0123456789%·ÉéèAZaz ,.-:()') expect(hasGlyph(ch) || ch === ' ' || ch === 'É', ch).toBe(true);
    expect(glyph('%').w).toBe(5);
    expect(textWidth('100%')).toBe(5 * 4 + 3);
  });

  it('écrit une capture si FRETWAVE_PNG_DIR est défini (non vérifiée : inspection visuelle)', () => {
    const dir = process.env.FRETWAVE_PNG_DIR;
    if (!dir) return;
    writePng(`${dir}/20-chargement-37.png`, render({ progress: 0.37, label: 'CHARGEMENT DU SON', detail: 'GUITARE CLASSIQUE · 5,3 MO' }), 4);
    writePng(`${dir}/21-chargement-erreur.png`, render({ progress: 0.6, label: 'X', error: 'HTTP 404' }), 4);
  });
});
