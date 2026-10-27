/**
 * Le processeur AudioWorklet (`public/worklets/fretwave-input.js`) tourne hors navigateur.
 *
 * Pourquoi ce test existe : ce fichier est du JS pur qu'aucun `tsc` ne vérifie et qu'aucun bundler ne
 * traverse. Il contient pourtant deux choses qui cassent tout en silence si elles sont fausses :
 *  - **l'ordre de la fenêtre** envoyée (du plus ancien au plus récent). Inversé, `pitchy` lirait une
 *    hauteur plausible mais fausse — et aucune erreur ne s'afficherait ;
 *  - **la règle d'attaque**, dupliquée de `core/input/onset.ts`. Ce test les compare bloc par bloc :
 *    les deux copies ne peuvent pas diverger sans que le test échoue.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { INITIAL_ONSET, onsetStep, rmsToDb, type OnsetState } from '../src/core/input/onset';

const SRC = readFileSync('public/worklets/fretwave-input.js', 'utf8');
const BLOCK = 128;
const SR = 48000;

interface Posted {
  buf: Float32Array;
  rms: number;
  peak: number;
  t: number;
  onset: boolean;
  onsetT: number;
}

interface Sandbox {
  currentTime: number;
  __name?: string;
  __cls?: new (opts: { processorOptions?: Record<string, number> }) => {
    process: (inputs: Float32Array[][]) => boolean;
    port: { posted: Posted[] };
  };
}

function loadSandbox(): Sandbox {
  const posted: Posted[] = [];
  class AudioWorkletProcessor {
    port = { posted, postMessage: (msg: Posted) => posted.push(msg) };
  }
  const sandbox: Record<string, unknown> = {
    AudioWorkletProcessor,
    registerProcessor: (name: string, cls: unknown) => {
      sandbox.__name = name;
      sandbox.__cls = cls;
    },
    currentTime: 0,
    sampleRate: SR,
    Math,
    Float32Array,
    Number,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'fretwave-input.js' });
  return sandbox as unknown as Sandbox;
}

/** Bloc de 128 échantillons : une sinusoïde à `amp`, ou du silence. */
function block(amp: number, freq = 110, phase = 0, offset = 0): Float32Array {
  const b = new Float32Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) b[i] = amp === 0 ? 0 : amp * Math.sin((2 * Math.PI * freq * (offset + i)) / SR + phase);
  return b;
}

function instance(opts: Record<string, number> = {}) {
  const sb = loadSandbox();
  const Cls = sb.__cls!;
  const proc = new Cls({ processorOptions: { windowSize: 1024, hop: 512, floor: 0.005, ...opts } });
  const feed = (b: Float32Array, tMs: number): void => {
    sb.currentTime = tMs / 1000;
    proc.process([[b], [b]]);
  };
  return { sb, proc, feed, posted: proc.port.posted };
}

describe('processeur AudioWorklet d’entrée', () => {
  it('s’enregistre sous le nom attendu par le moteur', () => {
    const { sb } = instance();
    expect(sb.__name).toBe('fretwave-input');
  });

  it('envoie une fenêtre par saut, de la taille demandée', () => {
    const { feed, posted } = instance({ windowSize: 1024, hop: 512 });
    for (let i = 0; i < 16; i++) feed(block(0.3, 110, 0, i * BLOCK), (i * BLOCK * 1000) / SR);
    // 16 blocs × 128 = 2048 échantillons → 4 sauts de 512
    expect(posted.length).toBe(4);
    for (const p of posted) expect(p.buf.length).toBe(1024);
  });

  it('la fenêtre est ordonnée du plus ancien au plus récent (une rampe reste croissante)', () => {
    const { feed, posted } = instance({ windowSize: 512, hop: 128 });
    let v = 0;
    for (let i = 0; i < 8; i++) {
      const b = new Float32Array(BLOCK);
      for (let k = 0; k < BLOCK; k++) b[k] = v = v + 1e-4;
      feed(b, (i * BLOCK * 1000) / SR);
    }
    const last = posted[posted.length - 1]!;
    for (let i = 1; i < last.buf.length; i++) expect(last.buf[i]!).toBeGreaterThan(last.buf[i - 1]!);
    // et le dernier échantillon de la fenêtre est bien le dernier arrivé
    expect(last.buf[last.buf.length - 1]!).toBeCloseTo(v, 4);
  });

  it('mesure le niveau du bloc (RMS d’une sinusoïde d’amplitude 0,4)', () => {
    const { feed, posted } = instance({ windowSize: 512, hop: 128 });
    for (let i = 0; i < 6; i++) feed(block(0.4, 110, 0, i * BLOCK), (i * BLOCK * 1000) / SR);
    const p = posted[posted.length - 1]!;
    expect(rmsToDb(p.rms)).toBeCloseTo(-11, 0); // 0,4/√2 ≈ −11 dBFS
    expect(p.peak).toBeLessThanOrEqual(0.4 + 1e-3);
    expect(p.peak).toBeGreaterThan(0.35);
  });

  it('une attaque est vue une fois, au bon instant du contexte audio', () => {
    const { feed, posted } = instance({ windowSize: 512, hop: 128 });
    let t = 0;
    const step = (ms: number) => {
      t += ms;
      return t;
    };
    for (let i = 0; i < 8; i++) feed(block(0), step((BLOCK * 1000) / SR));
    for (let i = 0; i < 16; i++) feed(block(0.35, 110, 0, i * BLOCK), step((BLOCK * 1000) / SR));
    const onsets = posted.filter((p) => p.onset);
    expect(onsets.length).toBe(1);
    // l'instant rapporté est compris entre le début de l'attaque et la fin de la fenêtre envoyée
    expect(onsets[0]!.onsetT).toBeGreaterThan(0);
    expect(onsets[0]!.onsetT).toBeLessThanOrEqual(onsets[0]!.t + 1e-6);
  });

  it('la règle d’attaque du worklet est exactement celle de `onset.ts`', () => {
    const { feed, posted } = instance({ windowSize: 512, hop: 512, floor: 0.005 });
    // séquence réaliste : silence, attaque, tenue, décroissance, nouvelle attaque, silence
    const levels = [
      ...Array(6).fill(0),
      ...Array(10).fill(0.3),
      ...Array(12).fill(0.05),
      ...Array(10).fill(0.3),
      ...Array(6).fill(0),
    ] as number[];
    let t = 0;
    const expected: boolean[] = [];
    let s: OnsetState = INITIAL_ONSET;
    for (const level of levels) {
      // le niveau attendu par `onsetStep` est le RMS du bloc envoyé au worklet
      // bloc constant : le RMS est exactement `level`, les deux règles reçoivent la même entrée
      feed(new Float32Array(BLOCK).fill(level), t);
      const r = onsetStep(s, level, t, { floor: 0.005 });
      s = r.state;
      expected.push(r.onset);
      t += (BLOCK * 1000) / SR;
    }
    // le worklet n'envoie qu'un message par saut : on compare les blocs de saut
    const hopBlocks = 512 / BLOCK;
    const got: boolean[] = posted.map((p) => p.onset);
    const want: boolean[] = [];
    for (let i = 0; i < expected.length; i += hopBlocks) {
      // une attaque survenue dans les hopBlocks blocs est rapportée par le message du saut
      want.push(expected.slice(i, i + hopBlocks).some(Boolean));
    }
    expect(got).toEqual(want);
  });
});
