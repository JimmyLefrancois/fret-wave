/**
 * Calibration de l'entrée (phase 3) : détection d'attaque, plancher de bruit, latence mesurée,
 * et le masque des clics du métronome. Tout est pur, donc tout est chiffré ici.
 */
import { describe, expect, it } from 'vitest';
import { INITIAL_ONSET, onsetStep, rmsToDb, type OnsetState } from '../src/core/input/onset';
import { estimateLatency, noiseFloorDb, quantile, suggestThreshold } from '../src/core/input/calibration';
import { nearClick } from '../src/modules/gammes/exercise';

/** Bloc de 2,7 ms (128 échantillons à 48 kHz) : l'unité de temps du worklet. */
const BLOCK_MS = 2.667;

describe('détection d’attaque', () => {
  const opts = { floor: 0.005 };

  it('le silence ne déclenche rien', () => {
    let s: OnsetState = INITIAL_ONSET;
    for (let i = 0; i < 20; i++) {
      const r = onsetStep(s, 0, i * BLOCK_MS, opts);
      expect(r.onset).toBe(false);
      s = r.state;
    }
  });

  it('une attaque après le silence déclenche une fois, pas à chaque bloc', () => {
    let s: OnsetState = INITIAL_ONSET;
    let onsets = 0;
    let t = 0;
    for (let i = 0; i < 8; i++, t += BLOCK_MS) s = onsetStep(s, 0, t, opts).state;
    for (let i = 0; i < 40; i++, t += BLOCK_MS) {
      const r = onsetStep(s, 0.3, t, opts);
      if (r.onset) onsets++;
      s = r.state;
    }
    expect(onsets).toBe(1);
  });

  it('deux attaques à 40 ms d’écart sont une seule attaque (réfractaire 90 ms)', () => {
    let s: OnsetState = INITIAL_ONSET;
    let onsets = 0;
    const steps: number[] = [];
    // 0,1 s de silence, attaque, 40 ms plus tard nouvelle attaque
    for (let t = 0; t < 100; t += BLOCK_MS) steps.push(0);
    for (let i = 0; i < 15; i++) steps.push(0.3);
    for (let i = 0; i < 15; i++) steps.push(0.02);
    for (let i = 0; i < 20; i++) steps.push(0.3);
    let t = 0;
    for (const level of steps) {
      const r = onsetStep(s, level, t, opts);
      if (r.onset) onsets++;
      s = r.state;
      t += BLOCK_MS;
    }
    expect(onsets).toBe(1);
  });

  it('une seconde attaque plus de 90 ms après la première est bien vue', () => {
    let s: OnsetState = INITIAL_ONSET;
    let onsets = 0;
    let t = 0;
    const feed = (level: number, n: number) => {
      for (let i = 0; i < n; i++, t += BLOCK_MS) {
        const r = onsetStep(s, level, t, opts);
        if (r.onset) onsets++;
        s = r.state;
      }
    };
    feed(0, 10);
    feed(0.3, 10);
    feed(0.01, 40); // ~107 ms de décroissance
    feed(0.3, 10);
    expect(onsets).toBe(2);
  });

  it('un son sous le plancher de bruit ne déclenche pas', () => {
    let s: OnsetState = INITIAL_ONSET;
    let onsets = 0;
    let t = 0;
    for (let i = 0; i < 40; i++, t += BLOCK_MS) {
      const r = onsetStep(s, 0.002, t, opts);
      if (r.onset) onsets++;
      s = r.state;
    }
    expect(onsets).toBe(0);
  });

  it('amplitude → dBFS', () => {
    expect(rmsToDb(0.5)).toBeCloseTo(-6.02, 2);
    expect(rmsToDb(0)).toBe(-Infinity);
  });
});

describe('plancher de bruit et seuil', () => {
  it('la médiane résiste à un bruit parasite', () => {
    expect(noiseFloorDb([-55, -54, -56, -90, -12])).toBeCloseTo(-55, 0);
    expect(noiseFloorDb([])).toBe(-90);
    expect(noiseFloorDb([-Infinity, -60, -62])).toBeCloseTo(-61, 0);
  });

  it('le seuil suggéré est le plancher + 12 dB, borné au réglage', () => {
    expect(suggestThreshold(-66)).toBe(-54);
    expect(suggestThreshold(-60, 8)).toBe(-52);
    expect(suggestThreshold(-40, 40)).toBe(-10); // borné haut (0 dBFS n'existe pas)
    expect(suggestThreshold(-95, 5)).toBe(-80); // borné bas
  });

  it('quantile linéaire', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([5], 0.9)).toBe(5);
  });
});

describe('latence mesurée', () => {
  it('trois mesures proches donnent leur médiane', () => {
    const r = estimateLatency([
      { playedS: 1.0, detectedS: 1.02 },
      { playedS: 2.0, detectedS: 2.018 },
      { playedS: 3.0, detectedS: 3.025 },
    ]);
    expect(r.ms).toBe(20);
    expect(r.used).toBe(3);
    expect(r.rejected).toBe(0);
  });

  it('un écho de la pièce est écarté, pas moyenné', () => {
    const r = estimateLatency([
      { playedS: 1.0, detectedS: 1.021 },
      { playedS: 2.0, detectedS: 2.019 },
      { playedS: 3.0, detectedS: 3.020 },
      { playedS: 4.0, detectedS: 4.310 }, // 310 ms : un clic entendu deux fois, ou la pièce
    ]);
    expect(r.ms).toBe(20);
    expect(r.rejected).toBe(1);
    expect(r.raw).toContain(310);
  });

  it('une détection antérieure au son joué est impossible et rejetée', () => {
    const r = estimateLatency([{ playedS: 2.0, detectedS: 1.98 }]);
    expect(r.ms).toBe(0);
    expect(r.used).toBe(0);
    expect(r.rejected).toBe(1);
  });

  it('aucune mesure exploitable → 0 (et l’écran dira « non mesurée »)', () => {
    expect(estimateLatency([]).ms).toBe(0);
  });

  it('la médiane des retenues est arrondie au milliseconde', () => {
    const r = estimateLatency([
      { playedS: 0, detectedS: 0.0112 },
      { playedS: 0, detectedS: 0.0118 },
      { playedS: 0, detectedS: 0.0115 },
    ]);
    expect(r.ms).toBe(12);
  });
});

describe('masque des clics du métronome', () => {
  it('à 50 BPM (1,2 s par temps), ±90 ms autour du clic est ignoré', () => {
    expect(nearClick(0, 50)).toBe(true);
    expect(nearClick(0.089, 50)).toBe(true);
    expect(nearClick(0.2, 50)).toBe(false);
    expect(nearClick(0.6, 50)).toBe(false);
    expect(nearClick(1.19, 50)).toBe(true);
    expect(nearClick(1.2, 50)).toBe(true); // le temps suivant
    expect(nearClick(2.41, 50)).toBe(true);
  });

  it('à 120 BPM, la fenêtre reste une fraction du temps', () => {
    expect(nearClick(0.05, 120)).toBe(true);
    expect(nearClick(0.25, 120)).toBe(false);
  });
});
