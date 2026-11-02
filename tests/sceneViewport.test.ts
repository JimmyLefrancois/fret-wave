import { describe, expect, it } from 'vitest';
import { sceneViewport } from '../src/core/themes/sceneViewport';

describe('couverture du décor', () => {
  for (const dpr of [1, 1.25, 1.5, 2, 2.625, 2.75, 3, 3.5]) {
    for (const [width, height] of [[393, 851], [412, 915], [915, 412], [1440, 900]]) {
      it(`couvre ${width} × ${height} au DPR ${dpr}`, () => {
        const v = sceneViewport(width!, height!, dpr);
        expect(v.cssWidth).toBeGreaterThanOrEqual(width!);
        expect(v.cssHeight).toBeGreaterThanOrEqual(height!);
        expect(v.cssWidth - width!).toBeLessThan(v.pixelScale / dpr);
        expect(v.cssHeight - height!).toBeLessThan(v.pixelScale / dpr);
        expect(Number.isInteger(v.pixelScale)).toBe(true);
        expect(v.cssWidth * dpr).toBeCloseTo(v.logicalWidth * v.pixelScale);
      });
    }
  }
});
