import { describe, expect, it } from 'vitest';
import {
  DEFAULT_METRONOME, METRO_KEY, MetronomeRun, loadMetronomeState, rampBpm, saveMetronomeState, type MetronomeConfig, type TempoRamp,
} from '../src/core/audio/metronomeRun';
import { parseRoute } from '../src/app/router';

const cfg = (patch: Partial<MetronomeConfig> = {}): MetronomeConfig => ({ ...DEFAULT_METRONOME, ...patch });
const ramp = (patch: Partial<TempoRamp>): TempoRamp => ({ ...DEFAULT_METRONOME.ramp, on: true, ...patch });
const take = (run: MetronomeRun, n: number) => Array.from({ length: n }, () => run.next());

function memoryStore(): { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

describe('MetronomeRun', () => {
  it('accentue le premier temps et compte temps et mesures', () => {
    const beats = take(new MetronomeRun(cfg({ beats: 3 })), 4);
    expect(beats.map((b) => b.accent)).toEqual(['bar', 'beat', 'beat', 'bar']);
    expect(beats.map((b) => b.bar)).toEqual([1, 1, 1, 2]);
    expect(beats.map((b) => b.total)).toEqual([1, 2, 3, 4]);
  });

  it('le décompte sonne mais ne compte ni dans les mesures ni dans le chrono', () => {
    const beats = take(new MetronomeRun(cfg({ beats: 2, countIn: 1, bpm: 60 })), 4);
    expect(beats.map((b) => b.phase)).toEqual(['count', 'count', 'play', 'play']);
    expect(beats[1]!.bar).toBe(0);
    expect(beats[2]).toMatchObject({ bar: 1, total: 1, elapsedS: 0 });
    expect(beats[3]!.elapsedS).toBe(1);
  });

  it('applique le tempo manuel au temps suivant, le nombre de temps à la mesure suivante', () => {
    const run = new MetronomeRun(cfg({ beats: 2, bpm: 100 }));
    run.next();
    run.setConfig(cfg({ beats: 3, bpm: 150 }));
    expect(run.next()).toMatchObject({ bpm: 150, beats: 2 });
    expect(run.next()).toMatchObject({ beat: 0, beats: 3 });
  });

  it('alterne mesures audibles et silencieuses', () => {
    const run = new MetronomeRun(cfg({ beats: 1, silence: { on: true, audible: 2, silent: 1, random: false } }));
    expect(take(run, 6).map((b) => b.audible)).toEqual([true, true, false, true, true, false]);
  });

  it('tire la longueur des séries au sort entre 1 et la valeur réglée', () => {
    const run = new MetronomeRun(cfg({ beats: 1, silence: { on: true, audible: 4, silent: 4, random: true } }), () => 0);
    expect(take(run, 4).map((b) => b.audible)).toEqual([true, false, true, false]);
  });

  it('monte par paliers de mesures', () => {
    const run = new MetronomeRun(cfg({ beats: 1, ramp: ramp({ from: 60, to: 70, step: 5, every: 2 }) }));
    expect(take(run, 7).map((b) => b.bpm)).toEqual([60, 60, 65, 65, 70, 70, 70]);
  });

  it('change de palier en secondes, à une barre de mesure', () => {
    const run = new MetronomeRun(cfg({ beats: 2, ramp: ramp({ from: 60, to: 80, step: 10, unit: 'seconds', every: 2 }) }));
    expect(take(run, 4).map((b) => b.bpm)).toEqual([60, 60, 70, 70]);
  });

  it('le décompte se joue au tempo de départ de l’automation', () => {
    const run = new MetronomeRun(cfg({ beats: 1, countIn: 1, bpm: 200, ramp: ramp({ from: 60, to: 120, every: 1 }) }));
    expect(take(run, 3).map((b) => b.bpm)).toEqual([60, 60, 65]);
  });
});

describe('rampBpm', () => {
  it('descend si la cible est plus basse et s’arrête dessus', () => {
    const r = ramp({ from: 100, to: 88, step: 5, every: 1 });
    expect([0, 1, 2, 3, 9].map((n) => rampBpm(r, n))).toEqual([100, 95, 90, 88, 88]);
  });

  it('en boucle, tient la cible un palier puis repart', () => {
    const r = ramp({ from: 60, to: 70, step: 5, every: 1, loop: true });
    expect([0, 1, 2, 3].map((n) => rampBpm(r, n))).toEqual([60, 65, 70, 60]);
  });

  it('reste au départ si départ et cible sont égaux', () => {
    expect(rampBpm(ramp({ from: 80, to: 80, loop: true }), 12)).toBe(80);
  });
});

describe('réglages et mémoires', () => {
  it('relit ce qui a été enregistré', () => {
    const store = memoryStore();
    const state = loadMetronomeState(store);
    state.config = cfg({ bpm: 96, sound: 'cloche' });
    state.slots[3] = cfg({ beats: 7 });
    saveMetronomeState(store, state);
    const back = loadMetronomeState(store);
    expect(back.config).toMatchObject({ bpm: 96, sound: 'cloche' });
    expect(back.slots[3]!.beats).toBe(7);
    expect(back.slots).toHaveLength(10);
    expect(back.slots[0]).toBeNull();
  });

  it('borne les valeurs et ignore les valeurs inconnues', () => {
    const store = memoryStore();
    store.setItem(METRO_KEY, JSON.stringify({ config: { bpm: 9999, beats: 0, sound: 'gong', ramp: { step: 0, every: 0 } } }));
    expect(loadMetronomeState(store).config).toMatchObject({ bpm: 300, beats: 1, sound: 'bois', ramp: { step: 1, every: 1 } });
  });

  it('retombe sur les défauts si le JSON est cassé', () => {
    const store = memoryStore();
    store.setItem(METRO_KEY, '{oups');
    expect(loadMetronomeState(store).config).toEqual(DEFAULT_METRONOME);
  });
});

describe('route', () => {
  it('ouvre la page Métronome', () => {
    expect(parseRoute('#/metronome')).toBe('metronome');
  });
});
