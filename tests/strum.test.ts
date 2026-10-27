import { describe, expect, it } from 'vitest';
import { TUNINGS, generatePositions } from '../src/core/theory';
import { VOICINGS } from '../src/data/voicings';
import {
  MAX_STRUM_FRACTION, PPQ, arpeggioToScore, chordToScore, defaultSustain, progressionToScore, scaleToScore,
  scoreToPlayEvents, seeded, ticksToSeconds, type TabScore,
} from '../src/core/tab';
import { rhythmScore } from './helpers/fixtures';

const v = (id: string) => VOICINGS.find((x) => x.id === id)!;
const std = TUNINGS.standard!;
const displayed = (s: TabScore) =>
  s.measures.flatMap((m) => m.events.flatMap((e) => e.notes.filter((n) => !n.muted).map((n) => `${n.string}:${n.fret}:${n.midi}`))).sort();

const SCORES = (): TabScore[] => [
  scaleToScore('dorian', 'D', std, { direction: 'updown' }),
  scaleToScore('blues-minor', 'A', TUNINGS.standard7!, {}),
  chordToScore(v('G-320003')),
  chordToScore(v('F-133211'), { pattern: 'eighths' }),
  progressionToScore(['G-320003', 'D-xx0232', 'Em-022000', 'C-x32010'].map(v), { pattern: 'universal' }),
  arpeggioToScore(generatePositions('ionian', 'C', std, '3nps')[0]!, 'Cmaj7', std, { direction: 'updown' }),
  rhythmScore(),
];

describe('strum réaliste (pur)', () => {
  it('quelle que soit l\'humanisation, l\'audio joue exactement les notes affichées (cordes, cases, hauteurs)', () => {
    for (const s of SCORES()) {
      for (const humanize of [0, 0.5, 1]) {
        for (const sustain of ['auto', 'ring', 'legato', 'damp'] as const) {
          const played = scoreToPlayEvents(s, { humanize, sustain, seed: 3 }).flatMap((e) => e.notes.map((n) => `${n.string}:${n.fret}:${n.midi}`)).sort();
          expect(played, `${s.id} h=${humanize} ${sustain}`).toEqual(displayed(s));
        }
      }
    }
  });

  it('déterministe : mêmes options → mêmes événements ; une autre graine → un autre jeu (mais les mêmes notes)', () => {
    const s = chordToScore(v('Em-022000'), { pattern: 'universal' });
    const a = scoreToPlayEvents(s, { humanize: 0.8, seed: 1 });
    const b = scoreToPlayEvents(s, { humanize: 0.8, seed: 1 });
    const c = scoreToPlayEvents(s, { humanize: 0.8, seed: 2 });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('descendant : la corde par laquelle arrive la main est la plus forte (vélocités décroissantes grave → aigu)', () => {
    const [down] = scoreToPlayEvents(chordToScore(v('Em-022000'), { pattern: 'eighths' }));
    const vel = down!.notes.map((n) => n.velocity);
    for (let i = 1; i < vel.length; i++) expect(vel[i]!).toBeLessThan(vel[i - 1]!);
    expect(down!.strumDir).toBe('D');
  });

  it('montant : aigu → grave, la première corde (aiguë) est la plus forte, et l\'ensemble est plus doux que le descendant', () => {
    const [down, up] = scoreToPlayEvents(chordToScore(v('Em-022000'), { pattern: 'eighths' }));
    const vu = up!.notes.map((n) => n.velocity);
    expect(up!.notes.map((n) => n.string)).toEqual([5, 4, 3, 2, 1, 0]);
    for (let i = 1; i < vu.length; i++) expect(vu[i]!).toBeLessThan(vu[i - 1]!);
    const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
    expect(mean(vu)).toBeLessThan(mean(down!.notes.map((n) => n.velocity)));
  });

  it('accents du strum : début de mesure > temps > contretemps', () => {
    const s = chordToScore(v('Em-022000'), { pattern: 'eighths', style: 'strum' });
    s.measures[0]!.events[3]!.strum!.dir = 'D'; // ↓ sur un contretemps (tick 720)
    const ev = scoreToPlayEvents(s);
    const first = ev[0]!.notes[0]!.velocity; // début de mesure, ↓
    const onBeat = ev[2]!.notes[0]!.velocity; // ↓ sur le temps 2 (tick 480... ) — événement 2
    const offBeat = ev[3]!.notes[0]!.velocity; // ↓ sur contretemps
    expect(ev[2]!.tick % PPQ).toBe(0);
    expect(ev[3]!.tick % PPQ).not.toBe(0);
    expect(first).toBeGreaterThan(onBeat);
    expect(onBeat).toBeGreaterThan(offBeat);
  });

  it('décalages : croissants, 1ère corde à 0, écart moyen = réglage sans humanisation ; dans la plage 8-25 ms par défaut', () => {
    const [ev] = scoreToPlayEvents(chordToScore(v('Em-022000'), { pattern: 'quarters' }), { strumSpreadMs: 18 });
    const o = ev!.notes.map((n) => n.offsetMs);
    expect(o[0]).toBe(0);
    for (let i = 1; i < o.length; i++) expect(o[i]!).toBeGreaterThan(o[i - 1]!);
    expect((o[o.length - 1]! - o[0]!) / (o.length - 1)).toBeCloseTo(18, 9);
  });

  it('humanisation : le geste accélère en moyenne (premiers écarts plus longs que les derniers) et reste borné', () => {
    const first: number[] = [], last: number[] = [], gaps: number[] = [];
    for (let seed = 0; seed < 60; seed++) {
      const evs = scoreToPlayEvents(chordToScore(v('Em-022000'), { pattern: 'quarters', style: 'strum' }), { humanize: 1, seed, strumSpreadMs: 14 });
      for (const e of evs) {
        const d = e.notes.slice(1).map((n, i) => n.offsetMs - e.notes[i]!.offsetMs);
        first.push(d[0]!);
        last.push(d[d.length - 1]!);
        gaps.push(...d);
      }
    }
    const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
    expect(mean(first)).toBeGreaterThan(mean(last) + 4);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(1); // jamais d'écart nul ou négatif
    expect(Math.max(...gaps)).toBeLessThan(30);
    expect(mean(gaps)).toBeGreaterThan(11);
    expect(mean(gaps)).toBeLessThan(17);
  });

  it('tempo rapide : le balayage du strum n\'occupe jamais plus de 35 % de la durée de l\'événement', () => {
    const s = chordToScore(v('Em-022000'), { pattern: 'eighths', style: 'strum', tempo: 200 });
    const eighthMs = ticksToSeconds(PPQ / 2, 200) * 1000; // 150 ms
    for (const humanize of [0, 1]) {
      for (const ev of scoreToPlayEvents(s, { humanize, strumSpreadMs: 40 })) {
        const span = ev.notes[ev.notes.length - 1]!.offsetMs;
        expect(span).toBeLessThanOrEqual(eighthMs * MAX_STRUM_FRACTION + 1e-6);
      }
    }
    // et rien n'est compressé quand il y a la place (80 BPM)
    const slow = scoreToPlayEvents(chordToScore(v('Em-022000'), { pattern: 'quarters', style: 'strum' }), { strumSpreadMs: 14 });
    expect(slow[0]!.notes[5]!.offsetMs).toBeCloseTo(70, 9);
  });

  it('un strum garde UNE couche d\'échantillons : même vélocité de couche pour toutes ses cordes', () => {
    for (const s of SCORES()) {
      for (const e of scoreToPlayEvents(s, { humanize: 1, seed: 4 })) {
        expect(new Set(e.notes.map((n) => n.layerVelocity)).size, `${s.id} tick ${e.tick}`).toBe(1);
      }
    }
  });

  it('vélocités toujours dans ]0 ; 1], même avec humanisation maximale et vélocité de base élevée', () => {
    for (const s of SCORES()) {
      for (const e of scoreToPlayEvents(s, { humanize: 1, baseVelocity: 1, seed: 9 })) for (const n of e.notes) {
        expect(n.velocity).toBeGreaterThan(0);
        expect(n.velocity).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gamme : dynamique égale, seule la fondamentale est très légèrement appuyée', () => {
    const s = scaleToScore('pentatonic-minor', 'A', std, { direction: 'up' });
    const evs = scoreToPlayEvents(s);
    const notes = s.measures.flatMap((m) => m.events.flatMap((e) => e.notes));
    const vel = evs.map((e) => e.notes[0]!.velocity);
    const inner = vel.map((x, i) => [x, notes[i]!.fn, evs[i]!.eventIndex] as const).filter(([, , ei]) => ei > 0);
    const rootV = inner.filter(([, fn]) => fn === '1').map(([x]) => x);
    const otherV = inner.filter(([, fn]) => fn !== '1').map(([x]) => x);
    expect(rootV.length).toBeGreaterThan(0);
    expect(new Set(otherV).size).toBe(1); // aucune variation de dynamique entre les autres notes
    expect(Math.min(...rootV)).toBeGreaterThan(otherV[0]!);
    expect(Math.max(...rootV)).toBeLessThan(otherV[0]! * 1.12);
  });
});

describe('tenue des notes', () => {
  it('politique par défaut : accords et progressions sonnent jusqu\'à la fin de la mesure, arpèges en legato, gammes étouffées', () => {
    expect(defaultSustain('chord')).toBe('ring');
    expect(defaultSustain('progression')).toBe('ring');
    expect(defaultSustain('arpeggio')).toBe('legato');
    expect(defaultSustain('scale')).toBe('damp');
    expect(defaultSustain('position')).toBe('damp');
  });

  it('ring : le relâchement tombe à la fin de la mesure, quelle que soit la durée de la note', () => {
    const s = chordToScore(v('Em-022000'), { style: 'arpeggio' });
    for (const e of scoreToPlayEvents(s)) expect(e.tick + e.sustainTicks).toBe(e.measureEndTick);
    const prog = progressionToScore(['G-320003', 'D-xx0232'].map(v), { pattern: 'universal' });
    for (const e of scoreToPlayEvents(prog)) expect(e.tick + e.sustainTicks).toBe(e.measureEndTick);
  });

  it('damp : la note est relâchée à la fin de sa durée ; legato : deux fois sa durée, sans dépasser la mesure', () => {
    const sc = scaleToScore('dorian', 'D', std, { direction: 'up' });
    for (const e of scoreToPlayEvents(sc)) expect(e.sustainTicks).toBe(e.durTicks);
    const arp = arpeggioToScore(generatePositions('ionian', 'C', std, '3nps')[0]!, 'Cmaj7', std, { direction: 'up' });
    for (const e of scoreToPlayEvents(arp)) {
      expect(e.sustainTicks).toBe(Math.min(e.durTicks * 2, e.measureEndTick - e.tick));
      expect(e.tick + e.sustainTicks).toBeLessThanOrEqual(e.measureEndTick);
    }
    // forçage explicite
    for (const e of scoreToPlayEvents(sc, { sustain: 'ring' })) expect(e.tick + e.sustainTicks).toBe(e.measureEndTick);
  });

  it('le générateur à graine est un vrai PRNG : uniforme sur [0, 1[ et reproductible', () => {
    const a = seeded(5), b = seeded(5);
    const xs = Array.from({ length: 2000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 2000 }, () => b()));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(xs.reduce((s, x) => s + x, 0) / xs.length).toBeGreaterThan(0.47);
    expect(xs.reduce((s, x) => s + x, 0) / xs.length).toBeLessThan(0.53);
  });
});
