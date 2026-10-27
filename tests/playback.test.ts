import { describe, expect, it } from 'vitest';
import { TUNINGS, generatePositions, voicingMidis } from '../src/core/theory';
import { VOICINGS } from '../src/data/voicings';
import {
  DEFAULT_STRUM_SPREAD_MS, chordToScore, layoutScore, cursorAt, progressionToScore, scaleToScore, scoreDurationSeconds,
  scoreToPlayEvents, secondsToTicks, ticksToSeconds, totalTicks, positionToScore, type TabScore,
} from '../src/core/tab';
import { rhythmScore } from './helpers/fixtures';

const std = TUNINGS.standard!;
const v = (id: string) => VOICINGS.find((x) => x.id === id)!;

const displayed = (s: TabScore) =>
  s.measures.flatMap((m) => m.events.flatMap((e) => e.notes.filter((n) => !n.muted).map((n) => `${n.string}:${n.fret}:${n.midi}`))).sort();

describe('score → événements sonores', () => {
  it('l\'audio joue exactement les notes affichées (cordes, cases, hauteurs), pour tous les types de score', () => {
    const scores: TabScore[] = [
      scaleToScore('dorian', 'D', std, { direction: 'updown' }),
      scaleToScore('blues-minor', 'A', TUNINGS.standard7!, {}),
      chordToScore(v('G-320003')),
      chordToScore(v('F-133211'), { pattern: 'eighths' }),
      progressionToScore(['G-320003', 'D-xx0232', 'Em-022000', 'C-x32010'].map(v), { pattern: 'universal' }),
      rhythmScore(),
    ];
    for (const s of scores) {
      const played = scoreToPlayEvents(s).flatMap((e) => e.notes.map((n) => `${n.string}:${n.fret}:${n.midi}`)).sort();
      expect(played, s.id).toEqual(displayed(s));
    }
  });

  it('notes étouffées et silences ne produisent aucun son', () => {
    const s = rhythmScore();
    s.measures[0]!.events[0]!.notes[0]!.muted = true;
    const n = scoreToPlayEvents(s).flatMap((e) => e.notes).length;
    expect(n).toBe(displayed(s).length);
    expect(scoreToPlayEvents(s).every((e) => e.notes.length > 0)).toBe(true);
  });

  it('ticks absolus : mesure × durée de mesure + début de l\'événement', () => {
    const s = progressionToScore(['G-320003', 'D-xx0232'].map(v), { pattern: 'quarters' });
    const ticks = scoreToPlayEvents(s).map((e) => e.tick);
    expect(ticks).toEqual([0, 480, 960, 1440, 1920, 2400, 2880, 3360]);
    expect(scoreToPlayEvents(s).map((e) => [e.measureIndex, e.eventIndex])[4]).toEqual([1, 0]);
  });

  it('strum descendant : grave → aigu, décalage régulier ; montant : aigu → grave', () => {
    const s = chordToScore(v('Em-022000'), { style: 'strum', pattern: 'eighths' });
    const [down, upEv] = scoreToPlayEvents(s);
    expect(down!.notes.map((n) => n.string)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(down!.notes.map((n) => n.offsetMs)).toEqual([0, 1, 2, 3, 4, 5].map((i) => i * DEFAULT_STRUM_SPREAD_MS));
    expect(upEv!.notes.map((n) => n.string)).toEqual([5, 4, 3, 2, 1, 0]);
    expect(upEv!.notes[0]!.offsetMs).toBe(0);
    // le décalage total d'un strum reste dans la plage réaliste 8-25 ms par corde
    expect(DEFAULT_STRUM_SPREAD_MS).toBeGreaterThanOrEqual(8);
    expect(DEFAULT_STRUM_SPREAD_MS).toBeLessThanOrEqual(25);
  });

  it('écart de strum personnalisé par événement et par option ; arpège = aucun décalage', () => {
    const s = chordToScore(v('Em-022000'), { style: 'strum', pattern: 'quarters' });
    s.measures[0]!.events[0]!.strum!.spreadMs = 20;
    const ev = scoreToPlayEvents(s, { strumSpreadMs: 9 });
    expect(ev[0]!.notes[1]!.offsetMs).toBe(20);
    expect(ev[1]!.notes[1]!.offsetMs).toBe(9);
    const arp = scoreToPlayEvents(chordToScore(v('Em-022000'), { style: 'arpeggio' }));
    expect(arp.every((e) => e.notes.length === 1 && e.notes[0]!.offsetMs === 0)).toBe(true);
    expect(arp.map((e) => e.notes[0]!.midi)).toEqual(voicingMidis(v('Em-022000')));
  });

  it('une même note n\'est jamais jouée deux fois dans un événement', () => {
    for (const vc of VOICINGS) {
      for (const e of scoreToPlayEvents(chordToScore(vc))) {
        expect(new Set(e.notes.map((n) => n.string)).size).toBe(e.notes.length);
      }
    }
  });
});

describe('temps', () => {
  it('ticks ↔ secondes : une noire à 120 BPM = 0,5 s ; aller-retour exact', () => {
    expect(ticksToSeconds(480, 120)).toBe(0.5);
    expect(ticksToSeconds(1920, 60)).toBe(4);
    expect(secondsToTicks(ticksToSeconds(1234, 97), 97)).toBeCloseTo(1234, 9);
  });

  it('durée du morceau = nombre de mesures × 4 temps ÷ tempo', () => {
    const s = progressionToScore(['G-320003', 'D-xx0232'].map(v), { tempo: 120 });
    expect(scoreDurationSeconds(s)).toBe(4);
    expect(totalTicks(s)).toBe(3840);
  });
});

describe('synchronisation curseur ↔ horloge (horloge simulée)', () => {
  // Le curseur est une fonction PURE du tick de l'horloge : on simule le Transport par ticks = secondes × tempo × PPQ / 60.
  it('à chaque note jouée, le curseur est sur la colonne de cette note (à l\'instant du déclenchement)', () => {
    for (const s of [
      scaleToScore('pentatonic-minor', 'A', std, { direction: 'updown' }),
      progressionToScore(['G-320003', 'D-xx0232'].map(v), { pattern: 'universal' }),
    ]) {
      for (const mode of ['scroll', 'wrap'] as const) {
        const layout = layoutScore(s, { mode, maxWidth: 195, notes: 'fr', chords: 'en', annotation: 'none', stacks: 'change' });
        for (const ev of scoreToPlayEvents(s)) {
          const seconds = ticksToSeconds(ev.tick, s.tempo);
          const tick = secondsToTicks(seconds, s.tempo);
          const col = layout.columns[cursorAt(layout, tick).columnIndex]!;
          expect([col.measureIndex, col.eventIndex], `${s.id} ${mode} tick ${ev.tick}`).toEqual([ev.measureIndex, ev.eventIndex]);
          expect(cursorAt(layout, tick).x).toBe(col.cx);
        }
      }
    }
  });

  it('positions de gamme sur 12 toniques : le dernier événement est atteint et le curseur ne dépasse jamais la fin', () => {
    for (let pc = 0; pc < 12; pc++) {
      const pos = generatePositions('ionian', ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][pc]!, std, '3nps')[0]!;
      const s = positionToScore(pos, std, { direction: 'updown' });
      const layout = layoutScore(s, { mode: 'scroll', notes: 'fr', chords: 'en', annotation: 'none', stacks: 'change' });
      const end = cursorAt(layout, totalTicks(s) + 1000);
      expect(end.x).toBeLessThanOrEqual(layout.width);
      expect(end.columnIndex).toBe(layout.columns.length - 1);
    }
  });
});
