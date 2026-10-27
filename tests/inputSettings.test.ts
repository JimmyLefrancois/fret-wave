/**
 * Réglages d'entrée (phase 3) : lecture tolérante, bornes, fusion partielle.
 * Un seuil hors plage ou un JSON cassé ne doit jamais empêcher l'écran de s'ouvrir.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  A4_MAX, A4_MIN, CENTS_MAX, CENTS_MIN, DEFAULT_INPUT_SETTINGS, INPUT_SETTINGS_KEY, THRESHOLD_MAX, THRESHOLD_MIN,
  getInputSettings, loadInputSettings, resetInputSettingsForTests, saveInputSettings, setInputSettings,
} from '../src/core/input/settings';

function fakeStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k]! : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe('réglages d’entrée', () => {
  it('sans stockage : les défauts, et le micro est la source par défaut', () => {
    const d = loadInputSettings(null);
    expect(d).toEqual(DEFAULT_INPUT_SETTINGS);
    expect(d.source).toBe('mic');
    expect(d.a4).toBe(440);
    // l'interface USB a un seuil plus haut (signal plus fort, bruit plus bas) — R3
    expect(d.thresholds.usb).toBeGreaterThan(d.thresholds.mic);
  });

  it('aller-retour', () => {
    const s = fakeStore();
    const custom = {
      ...DEFAULT_INPUT_SETTINGS,
      deviceId: 'abc',
      source: 'usb' as const,
      thresholds: { mic: -50, usb: -30 },
      latencies: { mic: 12, usb: 8 },
      clarityMin: 0.8,
      centsTolerance: 20,
      a4: 442,
    };
    saveInputSettings(s, custom);
    expect(loadInputSettings(s)).toEqual(custom);
  });

  it('valeurs hors plage ramenées dans les bornes, pas rejetées', () => {
    const bad = fakeStore({
      [INPUT_SETTINGS_KEY]: JSON.stringify({
        source: 'bluetooth',
        thresholds: { mic: -900, usb: 40 },
        latencies: { mic: -5, usb: 9999 },
        clarityMin: 4,
        centsTolerance: 500,
        a4: 200,
        deviceId: '',
      }),
    });
    const d = loadInputSettings(bad);
    expect(d.source).toBe('mic');
    expect(d.thresholds.mic).toBe(THRESHOLD_MIN);
    expect(d.thresholds.usb).toBe(THRESHOLD_MAX);
    expect(d.latencies.mic).toBe(0);
    expect(d.latencies.usb).toBe(500);
    expect(d.clarityMin).toBeLessThanOrEqual(0.98);
    expect(d.centsTolerance).toBe(CENTS_MAX);
    expect(d.a4).toBe(A4_MIN);
    expect(d.deviceId).toBeNull();
    expect(d.a4).toBeGreaterThanOrEqual(A4_MIN);
    expect(d.a4).toBeLessThanOrEqual(A4_MAX);
    expect(d.centsTolerance).toBeGreaterThanOrEqual(CENTS_MIN);
  });

  it('JSON cassé : défauts, aucune exception', () => {
    expect(loadInputSettings(fakeStore({ [INPUT_SETTINGS_KEY]: 'pas du json' }))).toEqual(DEFAULT_INPUT_SETTINGS);
    expect(loadInputSettings(fakeStore({ [INPUT_SETTINGS_KEY]: 'null' }))).toEqual(DEFAULT_INPUT_SETTINGS);
  });

  it('une modification partielle ne perd pas les seuils de l’autre source', () => {
    resetInputSettingsForTests();
    setInputSettings({ thresholds: { mic: -50, usb: -36 } });
    const next = setInputSettings({ thresholds: { mic: -46, usb: -36 } });
    expect(next.thresholds).toEqual({ mic: -46, usb: -36 });
    expect(next.latencies).toEqual({ mic: 0, usb: 0 });
    expect(getInputSettings().thresholds.mic).toBe(-46);
  });

  it('les bornes s’appliquent aussi à l’écriture', () => {
    resetInputSettingsForTests();
    const s = setInputSettings({ a4: 999, centsTolerance: 1, clarityMin: -3 });
    expect(s.a4).toBe(A4_MAX);
    expect(s.centsTolerance).toBe(CENTS_MIN);
    expect(s.clarityMin).toBe(0.5);
  });

  beforeEach(() => resetInputSettingsForTests());
});
