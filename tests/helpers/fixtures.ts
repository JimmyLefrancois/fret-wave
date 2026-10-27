import { TUNINGS } from '../../src/core/theory';
import { PPQ, type TabEvent, type TabNote, type TabScore } from '../../src/core/tab';

const std = TUNINGS.standard!;

export function note(string: number, fret: number, fn = '1', extra: Partial<TabNote> = {}): TabNote {
  const open = [40, 45, 50, 55, 59, 64][string]!;
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midi = open + fret;
  return { string, fret, midi, note: names[midi % 12]!, fn, ...extra };
}

export function ev(start: number, dur: number, notes: TabNote[], extra: Partial<TabEvent> = {}): TabEvent {
  return { startTick: start, durTick: dur, kind: notes.length ? 'notes' : 'rest', notes, ...extra };
}

/** Score de test à la main : noires, croches, doubles croches, pointées, triolets, silences, ronde, blanche. */
export function rhythmScore(): TabScore {
  const e = PPQ / 2;
  const s = PPQ / 4;
  const t = PPQ / 3; // croche de triolet = 160
  const tp = { actual: 3, normal: 2 };
  return {
    id: 'fixture:rhythm',
    kind: 'exercise',
    tuning: std,
    stringCount: 6,
    ppq: PPQ,
    tempo: 100,
    timeSig: [4, 4],
    measures: [
      {
        // noire · 2 croches · 4 doubles croches · croche + 2 doubles croches (4 temps)
        events: [
          ev(0, PPQ, [note(1, 5, '1')]),
          ev(480, e, [note(2, 5, '4')]), ev(720, e, [note(2, 7, '5')]),
          ev(960, s, [note(3, 5, '1')]), ev(1080, s, [note(3, 7, '2')]), ev(1200, s, [note(3, 9, '3')]), ev(1320, s, [note(3, 10, '4')]),
          ev(1440, e, [note(4, 10, '3')]), ev(1680, s, [note(4, 12, '5')]), ev(1800, s, [note(4, 13, 'b6')]),
        ],
      },
      {
        // noire pointée + croche · blanche · (puis) triolet de croches + noire + demi-soupir
        events: [
          ev(0, 720, [note(1, 12, '1')]), ev(720, e, [note(1, 15, 'b3')]),
          ev(960, 960, [note(2, 14, '5', { characteristic: true })]),
        ],
      },
      {
        events: [
          ev(0, t, [note(3, 12, '1')], { tuplet: tp }), ev(160, t, [note(3, 14, '2')], { tuplet: tp }), ev(320, t, [note(3, 16, '3')], { tuplet: tp }),
          ev(480, PPQ, [note(4, 15, '5')]),
          ev(960, PPQ, []), ev(1440, e, []), ev(1680, s, []), ev(1800, s, [note(5, 17, '7')]),
        ],
      },
      { events: [ev(0, 1920, [note(0, 3, '1')])] },
      { events: [ev(0, 960, []), ev(960, PPQ, []), ev(1440, e, []), ev(1680, s, []), ev(1800, s, [note(5, 24, '1')])] },
    ],
  };
}
