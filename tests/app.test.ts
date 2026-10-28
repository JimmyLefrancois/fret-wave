import { describe, expect, it } from 'vitest';
import { parseRoute, ROUTE_HREF, hrefOf } from '../src/app/router';
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadAppSettings, saveAppSettings } from '../src/app/settings';
import {
  PRACTICE_KEY, PRACTICE_CAP, dayKey, lastEntry, logPractice, readLog, startOfDay, summarizeDay,
  type PracticeEntry,
} from '../src/core/progress/practiceLog';

function fakeStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k]! : null),
    setItem: (k: string, v: string) => { data[k] = v; },
  };
}

describe('routeur par hash', () => {
  it('route les URLs de la 1d et les anciennes URLs de la 1a-1c', () => {
    expect(parseRoute('')).toBe('hub');
    expect(parseRoute('#')).toBe('hub');
    expect(parseRoute('#/hub')).toBe('hub');
    expect(parseRoute('#/gammes')).toBe('gammes');
    expect(parseRoute('#/gammes/jouer')).toBe('scale');
    expect(parseRoute('#/gammes/jouer/')).toBe('scale');
    expect(parseRoute('#/reglages')).toBe('settings');
    expect(parseRoute('#tab')).toBe('tab');
    expect(parseRoute('#audio')).toBe('audio');
    expect(parseRoute('#theorie')).toBe('theory');
  });

  it('une URL inconnue retombe sur le hub, jamais sur une page blanche', () => {
    expect(parseRoute('#/nimporte-quoi')).toBe('hub');
    expect(parseRoute('#/gammes/xyz')).toBe('hub');
  });

  it('chaque route a un href stable', () => {
    for (const [name, href] of Object.entries(ROUTE_HREF)) {
      expect(hrefOf(name as keyof typeof ROUTE_HREF)).toBe(href);
      expect(parseRoute(href)).toBe(name);
    }
  });
});

describe('réglages globaux', () => {
  it('défauts sans stockage', () => {
    expect(loadAppSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('aller-retour, et valeurs hors plage → défauts', () => {
    const s = fakeStore();
    const custom = { ...DEFAULT_SETTINGS, theme: 'synthwave', noteNotation: 'en' as const, reduceMotion: true, scanlines: false };
    saveAppSettings(s, custom);
    expect(loadAppSettings(s)).toEqual(custom);
    expect(JSON.parse(s.data[SETTINGS_KEY]!).noteNotation).toBe('en');

    const bad = fakeStore({
      [SETTINGS_KEY]: JSON.stringify({ theme: 'inconnu', noteNotation: 'de', reduceMotion: 'oui', scanlines: 3 }),
    });
    const loaded = loadAppSettings(bad);
    expect(loaded.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(loaded.noteNotation).toBe(DEFAULT_SETTINGS.noteNotation);
    expect(loaded.reduceMotion).toBe(DEFAULT_SETTINGS.reduceMotion);
    expect(loaded.scanlines).toBe(DEFAULT_SETTINGS.scanlines);
  });

  it('réglages d’exercice : taux de trous borné aux trois crans, tempo borné 30-200', () => {
    const s = fakeStore({ [SETTINGS_KEY]: JSON.stringify({ holeRate: 0.5, trainingTempo: 500 }) });
    const loaded = loadAppSettings(s);
    expect(loaded.holeRate).toBe(0.5);
    expect(loaded.trainingTempo).toBe(200);
    const bad = loadAppSettings(fakeStore({ [SETTINGS_KEY]: JSON.stringify({ holeRate: 0.42, trainingTempo: 10 }) }));
    expect(bad.holeRate).toBe(DEFAULT_SETTINGS.holeRate);
    expect(bad.trainingTempo).toBe(30);
  });

  it('mémoire et vitesse : rappel à froid, observation, subdivision et tempo cible lus avec tolérance', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ coldReview: true, lookSeconds: 20, gridSubdivision: 1, speedTargetBpm: 80 });
    const ok = loadAppSettings(fakeStore({ [SETTINGS_KEY]: JSON.stringify({ coldReview: false, lookSeconds: 30, gridSubdivision: 2, speedTargetBpm: 999 }) }));
    expect(ok).toMatchObject({ coldReview: false, lookSeconds: 30, gridSubdivision: 2, speedTargetBpm: 160 });
    const bad = loadAppSettings(fakeStore({ [SETTINGS_KEY]: JSON.stringify({ coldReview: 'non', lookSeconds: 15, gridSubdivision: 3, speedTargetBpm: 'vite' }) }));
    expect(bad).toMatchObject({ coldReview: true, lookSeconds: 20, gridSubdivision: 1, speedTargetBpm: 80 });
  });

  it('JSON cassé : aucun exception', () => {
    expect(loadAppSettings(fakeStore({ [SETTINGS_KEY]: '{oops' }))).toEqual(DEFAULT_SETTINGS);
  });
});

describe('journal de pratique', () => {
  const at = (day: number, hour: number) => new Date(2026, 9, day, hour, 30).getTime();
  const entry = (ts: number, scaleId = 'pentatonic-minor', tonic = 'A', positionId = '0'): PracticeEntry =>
    ({ ts, scaleId, tonic, system: 'boxes', positionId, seconds: 20 });

  it('écrit, relit et borne le journal', () => {
    const s = fakeStore();
    logPractice(s, entry(at(27, 10)));
    logPractice(s, entry(at(27, 11), 'dorian', 'D'));
    const log = readLog(s);
    expect(log.length).toBe(2);
    expect(lastEntry(log)!.scaleId).toBe('dorian');

    for (let i = 0; i < PRACTICE_CAP + 10; i++) logPractice(s, entry(at(27, 12) + i));
    expect(readLog(s).length).toBe(PRACTICE_CAP);
  });

  it('résume la journée locale : écoutes, gammes distinctes, secondes', () => {
    const now = new Date(2026, 9, 27, 18, 0);
    const entries = [
      entry(at(26, 22)), // hier
      entry(at(27, 9)),
      entry(at(27, 10)), // même gamme/position : une seule distincte
      entry(at(27, 11), 'dorian', 'D'),
    ];
    const sum = summarizeDay(entries, now);
    expect(sum.count).toBe(3);
    expect(sum.distinct).toBe(2);
    expect(sum.seconds).toBe(60);
    expect(sum.keys[0]).toBe('dorian@D:0'); // la plus récente en tête
  });

  it('minuit local et clé de jour', () => {
    const d = new Date(2026, 9, 27, 23, 59);
    expect(startOfDay(d)).toBe(new Date(2026, 9, 27, 0, 0).getTime());
    expect(dayKey(d.getTime())).toBe('2026-10-27');
  });

  it('stockage absent ou corrompu : journal vide, jamais d’exception', () => {
    expect(readLog(null)).toEqual([]);
    expect(readLog(fakeStore({ [PRACTICE_KEY]: 'nope' }))).toEqual([]);
    expect(readLog(fakeStore({ [PRACTICE_KEY]: JSON.stringify({ v: 1, entries: [{ ts: 'x' }] }) }))).toEqual([]);
  });
});
