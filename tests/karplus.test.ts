import { describe, expect, it } from 'vitest';
import { karplusStrong } from '../src/core/audio/karplus';

const SR = 44100;
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** f0 par autocorrélation normalisée (interpolation parabolique) sur [from, from + len[. */
function f0(x: Float32Array, from: number, len: number, fmin: number, fmax: number): number {
  const lo = Math.floor(SR / fmax), hi = Math.ceil(SR / fmin);
  const r = new Float64Array(hi + 2);
  let e0 = 0;
  for (let i = 0; i < len; i++) e0 += x[from + i]! ** 2;
  for (let l = lo - 1; l <= hi + 1; l++) {
    let s = 0, e1 = 0;
    for (let i = 0; i < len; i++) { s += x[from + i]! * x[from + i + l]!; e1 += x[from + i + l]! ** 2; }
    r[l] = s / Math.sqrt(e0 * e1 + 1e-12);
  }
  let best = lo;
  for (let l = lo; l <= hi; l++) if (r[l]! > r[best]!) best = l;
  let pick = best;
  for (let l = lo; l <= hi; l++) if (r[l]! > 0.93 * r[best]! && r[l]! >= r[l - 1]! && r[l]! >= r[l + 1]!) { pick = l; break; }
  const a = r[pick - 1]!, b = r[pick]!, c = r[pick + 1]!;
  return SR / (pick + (a - c) / (2 * (a - 2 * b + c)));
}

describe('repli Karplus-Strong', () => {
  it('la hauteur produite est juste à ±8 cents de E1 (28) à E7 (100)', () => {
    const worst: Array<[number, number]> = [];
    for (let m = 28; m <= 100; m += 3) {
      const x = karplusStrong(hz(m), SR, 0.5);
      const f = f0(x, 2000, 6000, hz(m) / 1.4, hz(m) * 1.4);
      worst.push([m, 1200 * Math.log2(f / hz(m))]);
    }
    for (const [m, c] of worst) expect(Math.abs(c), `midi ${m}`).toBeLessThan(8);
  });

  it('déterministe, borné, décroît, et se termine à zéro (pas de clic)', () => {
    const a = karplusStrong(hz(40), SR, 2, 7);
    const b = karplusStrong(hz(40), SR, 2, 7);
    expect(Array.from(a.slice(0, 500))).toEqual(Array.from(b.slice(0, 500)));
    expect(Math.max(...a.map(Math.abs))).toBeLessThanOrEqual(1);
    const rms = (from: number, n: number) => Math.sqrt(a.slice(from, from + n).reduce((s, v) => s + v * v, 0) / n);
    expect(rms(SR * 1.5, 2000)).toBeLessThan(rms(1000, 2000));
    expect(Math.abs(a[a.length - 1]!)).toBe(0);
    expect(a.every(Number.isFinite)).toBe(true);
  });
});
