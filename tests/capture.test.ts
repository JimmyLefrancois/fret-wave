import { describe, expect, it } from 'vitest';
import { AudioRing } from '../src/core/input/capture';

/** Tampon de capture (phase 5) : ce que l'analyse polyphonique relit après coup. */
describe('tampon de capture', () => {
  it('refuse d’analyser moins de 150 ms', () => {
    const ring = new AudioRing(48000, 1.5);
    ring.push(new Float32Array(4800)); // 100 ms
    expect(ring.snapshot(520)).toBeNull();
  });

  it('rend les échantillons dans l’ordre, du plus ancien au plus récent', () => {
    const ring = new AudioRing(1000, 1, 1); // 1 s de capacité, 1 kHz pour lire les indices
    ring.push(Float32Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    ring.push(Float32Array.from([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]));
    const snap = ring.snapshot(10)!; // les 10 derniers échantillons
    expect([...snap]).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(ring.length).toBe(20);
  });

  it('boucle proprement quand le tampon est plein', () => {
    const ring = new AudioRing(1000, 0.2, 1); // 200 échantillons de capacité
    for (let block = 0; block < 5; block += 1) {
      const chunk = new Float32Array(100);
      for (let i = 0; i < 100; i += 1) chunk[i] = block * 100 + i;
      ring.push(chunk);
    }
    const snap = ring.snapshot(200)!;
    expect(snap.length).toBe(200);
    // les 200 derniers échantillons poussés : 300 → 499
    expect(snap[0]).toBe(300);
    expect(snap[199]).toBe(499);
  });

  it('garde la fin d’un bloc plus long que lui', () => {
    const ring = new AudioRing(1000, 0.05, 1); // 50 échantillons
    const chunk = new Float32Array(120);
    for (let i = 0; i < 120; i += 1) chunk[i] = i;
    ring.push(chunk);
    const snap = ring.snapshot(50)!;
    expect(snap[0]).toBe(70);
    expect(snap[49]).toBe(119);
  });
});
