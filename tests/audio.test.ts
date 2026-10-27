import { describe, expect, it } from 'vitest';
import {
  CHANNELS, DB_RANGE, DEFAULT_SETTINGS, DEFAULT_VOLUMES, SETTINGS_KEY, gainToSlider, loadSettings, saveSettings, sliderToDb, sliderToGain,
  type KeyValueStore,
} from '../src/core/audio/mixer';
import { droneMidis, droneRootMidi } from '../src/core/audio/drone';
import { isCompound, metronomeClicks } from '../src/core/audio/metronome';
import { CEILING, COMPRESSOR, HIGHPASS_HZ, LIMITER_DB, ceilingCurve, makeReverbIR } from '../src/core/audio/master';
import { scoreTonic } from '../src/core/audio/tabPlayer';
import { verifyTriggered } from '../src/core/audio/verify';
import { PPQ, chordToScore, progressionToScore, scaleToScore, scoreToPlayEvents, type TabScore } from '../src/core/tab';
import { TUNINGS } from '../src/core/theory';
import { VOICINGS } from '../src/data/voicings';

const v = (id: string) => VOICINGS.find((x) => x.id === id)!;
const std = TUNINGS.standard!;

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, val: string) { this.data.set(k, val); }
}

describe('mixage : courbe des curseurs', () => {
  it('0 coupe ; 1 = 0 dB ; linéaire en dB entre −50 dB et 0 dB', () => {
    expect(sliderToGain(0)).toBe(0);
    expect(sliderToDb(0)).toBe(-Infinity);
    expect(sliderToGain(1)).toBe(1);
    expect(sliderToDb(0.5)).toBeCloseTo(-DB_RANGE / 2, 12);
    expect(sliderToDb(0.9)).toBeCloseTo(-5, 12);
  });
  it('strictement croissante, jamais au-dessus de 1, aller-retour curseur → gain → curseur', () => {
    let prev = 0;
    for (let i = 1; i <= 100; i++) {
      const g = sliderToGain(i / 100);
      expect(g).toBeGreaterThan(prev);
      expect(g).toBeLessThanOrEqual(1);
      prev = g;
      expect(gainToSlider(g)).toBeCloseTo(i / 100, 9);
    }
    expect(sliderToGain(2)).toBe(1);
    expect(sliderToGain(-1)).toBe(0);
  });
  it('valeurs par défaut : curseurs valides, jamais à fond (marge de manœuvre vers le haut), pas plus de −12 dB sous le maximum', () => {
    for (const c of CHANNELS) {
      expect(DEFAULT_VOLUMES[c]).toBeGreaterThan(0);
      expect(DEFAULT_VOLUMES[c]).toBeLessThan(1);
      expect(sliderToDb(DEFAULT_VOLUMES[c])).toBeGreaterThan(-12);
    }
    // l'équilibre ENTRE sources (drone / métronome sous la guitare) se règle sur des niveaux mesurés, pas sur les curseurs :
    // voir MUSIC_DESIGN.md §11.4 (rendu hors ligne dans le navigateur).
  });
});

describe('réglages audio mémorisés', () => {
  it('aller-retour exact', () => {
    const store = new MemoryStore();
    const s = { ...DEFAULT_SETTINGS, volumes: { master: 0.4, guitar: 0.7, drone: 0.2, metronome: 0.9 }, instrument: 'electric', strumSpreadMs: 20, humanize: 0.25, reverb: 0.8 };
    saveSettings(store, s);
    expect(loadSettings(store)).toEqual(s);
  });
  it('absent, illisible, hors plage ou inconnu → défauts, sans exception', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(new MemoryStore())).toEqual(DEFAULT_SETTINGS);
    const store = new MemoryStore();
    store.setItem(SETTINGS_KEY, '{pas du json');
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    store.setItem(SETTINGS_KEY, JSON.stringify({ volumes: { master: 7, guitar: -2, drone: 'fort', metronome: null }, instrument: 'sitar', strumSpreadMs: 9999, humanize: NaN, reverb: 3 }));
    const s = loadSettings(store);
    expect(s.volumes.master).toBe(1);
    expect(s.volumes.guitar).toBe(0);
    expect(s.volumes.drone).toBe(DEFAULT_VOLUMES.drone);
    expect(s.volumes.metronome).toBe(DEFAULT_VOLUMES.metronome);
    expect(s.instrument).toBe('nylon');
    expect(s.strumSpreadMs).toBe(40);
    expect(s.reverb).toBe(1);
  });
  it('un stockage qui lève (quota, navigation privée) ne casse rien', () => {
    const boom: KeyValueStore = { getItem() { throw new Error('refusé'); }, setItem() { throw new Error('plein'); } };
    expect(loadSettings(boom)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(boom, DEFAULT_SETTINGS)).not.toThrow();
  });
  it('les défauts retournés ne sont pas partagés (modifier l\'un ne modifie pas DEFAULT_SETTINGS)', () => {
    const s = loadSettings(null);
    s.volumes.master = 0.1;
    expect(DEFAULT_SETTINGS.volumes.master).toBe(DEFAULT_VOLUMES.master);
  });
});

describe('drone', () => {
  it('fondamentale entre Mi2 (40) et Ré♯3 (51), de la bonne classe de hauteur, pour les 12 toniques et leurs enharmoniques', () => {
    const pcs: Array<[string, number]> = [['C', 0], ['Db', 1], ['C#', 1], ['D', 2], ['Eb', 3], ['E', 4], ['F', 5], ['F#', 6], ['Gb', 6], ['G', 7], ['Ab', 8], ['A', 9], ['Bb', 10], ['B', 11]];
    for (const [n, pc] of pcs) {
      const m = droneRootMidi(n);
      expect(m % 12, n).toBe(pc);
      expect(m).toBeGreaterThanOrEqual(40);
      expect(m).toBeLessThanOrEqual(51);
    }
    expect(droneRootMidi('E')).toBe(40);
    expect(droneRootMidi('A')).toBe(45);
    expect(droneRootMidi('Eb')).toBe(51);
  });
  it('quinte juste + octave, jamais de tierce (le drone n\'annonce ni majeur ni mineur)', () => {
    expect(droneMidis('A')).toEqual([45, 52, 57]);
    expect(droneMidis('A', 'root')).toEqual([45, 57]);
    for (const t of ['C', 'F#', 'Bb']) {
      const r = droneRootMidi(t);
      for (const m of droneMidis(t)) expect([0, 7]).toContain((m - r) % 12);
    }
  });
  it('fondamentale du drone d\'un score : tonique de la gamme, fondamentale de l\'accord, rien pour une progression', () => {
    expect(scoreTonic(scaleToScore('dorian', 'D', std, {}))).toBe('D');
    expect(scoreTonic(scaleToScore('ionian', 'Bb', std, {}))).toBe('Bb');
    expect(scoreTonic(chordToScore(v('G-320003')))).toBe('G');
    expect(scoreTonic(chordToScore(v('F-133211')))).toBe('F');
    expect(scoreTonic(progressionToScore(['G-320003', 'D-xx0232'].map(v)))).toBeNull();
  });
});

describe('métronome', () => {
  const clicks = (s: TabScore, subdivide = false) => metronomeClicks(s, { subdivide });
  it('4/4 : un clic par noire, accent sur le premier temps de chaque mesure', () => {
    const s = progressionToScore(['G-320003', 'D-xx0232'].map(v));
    const c = clicks(s);
    expect(c.map((x) => x.tick)).toEqual([0, 480, 960, 1440, 1920, 2400, 2880, 3360]);
    expect(c.map((x) => x.accent)).toEqual(['bar', 'beat', 'beat', 'beat', 'bar', 'beat', 'beat', 'beat']);
  });
  it('subdivision : croches intercalées, jamais sur un temps', () => {
    const s = progressionToScore([v('G-320003')]);
    const c = clicks(s, true);
    expect(c).toHaveLength(8);
    expect(c.filter((x) => x.accent === 'sub').map((x) => x.tick)).toEqual([240, 720, 1200, 1680]);
    expect(c.map((x) => x.tick)).toEqual([...c.map((x) => x.tick)].sort((a, b) => a - b));
  });
  it('mesures composées (6/8, 9/8, 12/8) : un clic par groupe de trois croches ; 3/4 et 5/8 restent simples', () => {
    const score = (sig: [number, number]): TabScore => {
      const s = scaleToScore('ionian', 'C', std, {});
      return { ...s, timeSig: sig, measures: [{ events: [] }, { events: [] }] };
    };
    expect(isCompound([6, 8])).toBe(true);
    expect(isCompound([12, 8])).toBe(true);
    expect(isCompound([3, 8])).toBe(false);
    expect(isCompound([5, 8])).toBe(false);
    expect(isCompound([3, 4])).toBe(false);
    expect(clicks(score([6, 8])).map((x) => x.tick)).toEqual([0, 720, 1440, 2160]);
    expect(clicks(score([9, 8]))).toHaveLength(6);
    expect(clicks(score([3, 4])).map((x) => x.tick)).toEqual([0, 480, 960, 1440, 1920, 2400]);
    expect(clicks(score([5, 8])).map((x) => x.tick)).toEqual([0, 240, 480, 720, 960, 1200, 1440, 1680, 1920, 2160]);
    expect(clicks(score([6, 8]), true)).toHaveLength(12);
  });
  it('mesures de longueurs différentes : les clics suivent la mesure, pas le score', () => {
    const s = scaleToScore('ionian', 'C', std, {});
    const mixed: TabScore = { ...s, timeSig: [4, 4], measures: [{ events: [] }, { timeSig: [3, 4], events: [] }, { events: [] }] };
    expect(clicks(mixed).map((x) => x.tick)).toEqual([0, 480, 960, 1440, 1920, 2400, 2880, 3360, 3840, 4320, 4800]);
  });
  it('1 clic par temps : à 120 BPM, 2 clics par seconde', () => {
    const s = progressionToScore([v('G-320003')], { tempo: 120 });
    const c = clicks(s);
    const secs = c.map((x) => (x.tick / PPQ) * (60 / 120));
    expect(secs).toEqual([0, 0.5, 1, 1.5]);
  });
});

describe('bus master et réverbération', () => {
  it('réponse impulsionnelle : déterministe, finie, silencieuse avant le pré-retard, décroissante, énergie normalisée', () => {
    const [l, r] = makeReverbIR(48000);
    const [l2] = makeReverbIR(48000);
    expect(Array.from(l.slice(0, 2000))).toEqual(Array.from(l2.slice(0, 2000)));
    expect(l.length).toBe(Math.round(1.3 * 48000));
    expect(l.every(Number.isFinite) && r.every(Number.isFinite)).toBe(true);
    expect(Math.max(...l.slice(0, Math.round(0.012 * 48000)).map(Math.abs))).toBe(0);
    const rms = (a: Float32Array, from: number, n: number) => Math.sqrt(a.slice(from, from + n).reduce((s, x) => s + x * x, 0) / n);
    expect(rms(l, 48000 * 0.9, 4800)).toBeLessThan(rms(l, 48000 * 0.05, 4800) / 10);
    let e = 0;
    for (const ch of [l, r]) for (const x of ch) e += x * x;
    expect(e / 2).toBeCloseTo(1, 6);
    // canaux décorrélés (largeur stéréo)
    let dot = 0;
    for (let i = 0; i < l.length; i++) dot += l[i]! * r[i]!;
    expect(Math.abs(dot)).toBeLessThan(0.1);
  });
  it('plafond dur : identité sous le genou, strictement croissant, impair, borné par −1 dBFS, dérivée continue au genou', () => {
    const n = 4097;
    const c = ceilingCurve(n);
    const x = (i: number) => (i / (n - 1)) * 2 - 1;
    for (let i = 0; i < n; i++) {
      expect(Math.abs(c[i]!)).toBeLessThan(CEILING.ceiling);
      if (Math.abs(x(i)) <= CEILING.knee) expect(c[i]!).toBeCloseTo(x(i), 6);
      expect(c[i]!).toBeCloseTo(-c[n - 1 - i]!, 6);
      if (i > 0) expect(c[i]!).toBeGreaterThan(c[i - 1]!);
    }
    // pente de part et d'autre du genou : continue (≈ 1)
    const k = Math.round(((CEILING.knee + 1) / 2) * (n - 1));
    const slope = (i: number) => (c[i + 1]! - c[i]!) / (2 / (n - 1));
    expect(slope(k - 2)).toBeCloseTo(1, 1);
    expect(slope(k + 2)).toBeGreaterThan(0.97);
    expect(20 * Math.log10(CEILING.ceiling)).toBeCloseTo(-1, 9);
    // une entrée à pleine échelle sort sous le plafond
    expect(Math.abs(c[n - 1]!)).toBeLessThan(CEILING.ceiling);
  });
  it('réglages de la chaîne : plafond −1 dBFS, compresseur doux (ratio ≤ 4), passe-haut sous la guitare', () => {
    expect(LIMITER_DB).toBe(-1);
    expect(COMPRESSOR.ratio).toBeLessThanOrEqual(4);
    expect(COMPRESSOR.threshold).toBeLessThan(0);
    expect(HIGHPASS_HZ).toBeLessThan(82.41); // sous le Mi grave
  });
});

describe('vérification « son = tablature »', () => {
  const sc = chordToScore(v('Em-022000'), { pattern: 'eighths' });
  const expectedNotes = () => scoreToPlayEvents(sc).flatMap((e) => e.notes.map((n) => ({ string: n.string, midi: n.midi })));
  it('accepte exactement les notes du score ; refuse une note manquante, en trop ou sur la mauvaise corde', () => {
    const all = expectedNotes();
    expect(verifyTriggered(sc, all).ok).toBe(true);
    expect(verifyTriggered(sc, all).expected).toBe(all.length);
    const r1 = verifyTriggered(sc, all.slice(1));
    expect(r1.ok).toBe(false);
    expect(r1.missing).toHaveLength(1);
    const r2 = verifyTriggered(sc, [...all, { string: 0, midi: 41 }]);
    expect(r2.ok).toBe(false);
    expect(r2.extra).toEqual(['0:41']);
    const wrongString = all.map((n, i) => (i === 0 ? { ...n, string: 1 } : n));
    const r3 = verifyTriggered(sc, wrongString);
    expect(r3.ok).toBe(false);
    expect(r3.missing.length).toBe(1);
    expect(r3.extra.length).toBe(1);
  });
});
