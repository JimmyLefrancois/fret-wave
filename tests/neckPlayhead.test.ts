import { describe, expect, it } from 'vitest';
import {
  BufferSurface, THEME_SYNTHWAVE, drawNeckPlayhead, eventIndexAt, layoutNeck, neckNotes, neckRange,
  positionToScore, scoreToPlayEvents,
} from '../src/core/tab';
import { TUNINGS, generatePositions } from '../src/core/theory';

const std = TUNINGS.standard!;
const box = generatePositions('pentatonic-minor', 'A', std, 'boxes')[0]!;

describe('suivi de lecture sur le manche', () => {
  const events = scoreToPlayEvents(positionToScore(box, std, { direction: 'up', tempo: 70 }));

  it('rend le dernier événement commencé, et garde la note entre deux', () => {
    expect(eventIndexAt(events, -1)).toBe(-1);
    expect(eventIndexAt(events, events[0]!.tick)).toBe(0);
    expect(eventIndexAt(events, events[3]!.tick)).toBe(3);
    expect(eventIndexAt(events, events[3]!.tick + 1)).toBe(3);
    expect(eventIndexAt(events, Number.MAX_SAFE_INTEGER)).toBe(events.length - 1);
    expect(eventIndexAt([], 10)).toBe(-1);
  });

  it('chaque note jouée a sa pastille sur le manche', () => {
    const l = layoutNeck(std, neckNotes(box, 'degree'), { range: neckRange({ from: box.fretMin, to: box.fretMax }, 'full') });
    for (const ev of events) for (const n of ev.notes) {
      expect(l.pills.some((p) => p.string === n.string && p.fret === n.fret)).toBe(true);
    }
  });

  it('cadre la pastille qui sonne et ignore une note hors du manche', () => {
    const l = layoutNeck(std, neckNotes(box, 'degree'), { range: neckRange({ from: box.fretMin, to: box.fretMax }, 'full') });
    const calls: unknown[] = [];
    const s = { fillRect: (...a: unknown[]) => calls.push(a) } as unknown as BufferSurface;
    drawNeckPlayhead(s, l, [{ string: 0, fret: 22 }], THEME_SYNTHWAVE);
    expect(calls).toHaveLength(0);
    drawNeckPlayhead(s, l, [events[0]!.notes[0]!], THEME_SYNTHWAVE);
    expect(calls).toHaveLength(4);
  });
});
