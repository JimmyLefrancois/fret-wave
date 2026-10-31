import { describe, expect, it, vi } from 'vitest';
import { enterLandscape, exitLandscape } from '../src/app/landscape';

describe('plein écran paysage', () => {
  it('passe en plein écran avant de verrouiller', async () => {
    const order: string[] = [];
    await enterLandscape(
      { documentElement: { requestFullscreen: async () => { order.push('plein écran'); } } },
      { lock: async () => { order.push('verrou'); } },
    );
    expect(order).toEqual(['plein écran', 'verrou']);
  });

  it('ne lève rien sans ces fonctions ou si elles sont refusées', async () => {
    await expect(enterLandscape({})).resolves.toBeUndefined();
    await expect(enterLandscape(
      { documentElement: { requestFullscreen: () => Promise.reject(new Error('non')) } },
      { lock: () => Promise.reject(new Error('non')) },
    )).resolves.toBeUndefined();
  });

  it('rend le portrait en sortant, et ne quitte un plein écran que s’il existe', async () => {
    const unlock = vi.fn();
    const exitFullscreen = vi.fn(async () => {});
    await exitLandscape({ fullscreenElement: document_like(), exitFullscreen }, { unlock });
    expect(unlock).toHaveBeenCalledOnce();
    expect(exitFullscreen).toHaveBeenCalledOnce();
    await exitLandscape({ fullscreenElement: null, exitFullscreen }, { unlock });
    expect(exitFullscreen).toHaveBeenCalledOnce();
  });
});

function document_like(): Element {
  return {} as Element;
}
