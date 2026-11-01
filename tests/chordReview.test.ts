import { describe, expect, it } from 'vitest';
import { cardsFrom, DAY, normalizeAttempt, type ChordMarks } from '../src/core/progress';
import type { KeyValueStore } from '../src/core/audio/mixer';
import { isReviewable, readChordMarks, toggleChordMark } from '../src/core/progress/chordMarks';
import type { Voicing } from '../src/core/theory';
import { VOICINGS } from '../src/data/voicings';
import { nextDay } from '../src/modules/gammes/review';
import { buildChordQueue, chordAttempt, chordHoles, chordNodeId, chordReviewSummary, dueChords, judgeChordNote, moreChordsDue } from '../src/modules/accords/chordReview';

const NOW = new Date(2026, 10, 1, 12).getTime();
const em = VOICINGS.find((v) => v.chord === 'Em')!;
const c = VOICINGS.find((v) => v.chord === 'C')!;
const pool = [em, c];
const known = (...ids: string[]): ChordMarks => ({ known: ids, noReview: [], stamps: {} });
const attempt = (v: Voicing, ts: number, correct: number, afterReveal = false) => {
  const total = chordHoles(v).length;
  return chordAttempt(v, { now: ts, seq: ts, correct: Math.min(correct, total), total, seconds: 9, missedStrings: [], afterReveal, mic: true });
};
const memoryStore = (): KeyValueStore => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) } as KeyValueStore;
};

describe('coches', () => {
  it('une coche s’inverse et survit à la relecture', () => {
    const s = memoryStore();
    expect(toggleChordMark(s, 'known', 'a', 1).known).toEqual(['a']);
    expect(readChordMarks(s).known).toEqual(['a']);
    expect(toggleChordMark(s, 'known', 'a', 1).known).toEqual([]);
  });

  it('un stockage illisible donne des coches vides', () => {
    const s = memoryStore();
    s.setItem('fretwave.chords.v1', '{pas du json');
    expect(readChordMarks(s)).toEqual({ known: [], noReview: [], stamps: {} });
  });

  it('seul « connu sans refus » se révise', () => {
    expect(isReviewable(known('a'), 'a')).toBe(true);
    expect(isReviewable({ ...known('a'), noReview: ['a'] }, 'a')).toBe(false);
    expect(isReviewable(known(), 'a')).toBe(false);
  });
});

describe('exercice', () => {
  it('une note par corde jouée, de la grave à l’aiguë, sans les cordes étouffées', () => {
    const holes = chordHoles(c);
    expect(holes).toHaveLength(c.frets.filter((f) => f !== null).length);
    expect(holes.map((h) => h.string)).toEqual([...holes.map((h) => h.string)].sort((a, b) => a - b));
    // Em ouvert : la corde 0 à vide est bien le Mi grave
    expect(chordHoles(em)[0]).toMatchObject({ string: 0, fret: em.frets[0], note: 'E' });
  });

  it('une note juste remplit sa corde, dans n’importe quel ordre', () => {
    const v = judgeChordNote(em, 40, new Set(), { centsTolerance: 30 }); // Mi2
    expect(v.kind).toBe('fill');
  });

  it('rejouer une note déjà trouvée n’est pas une erreur', () => {
    const v = judgeChordNote(em, 40, new Set([chordHoles(em)[0]!.key]), { centsTolerance: 30 });
    expect(v.kind).toBe('repeat');
  });

  it('un demi-ton à côté est une erreur', () => {
    expect(judgeChordNote(em, 41, new Set(), { centsTolerance: 30 }).kind).toBe('wrong');
  });
});

describe('file', () => {
  it('une forme non cochée n’est jamais proposée, même avec une carte due', () => {
    expect(dueChords(pool, [attempt(em, NOW - 9 * DAY, 99)], known(), NOW)).toEqual([]);
  });

  it('une forme cochée sans carte est due tout de suite', () => {
    const [t] = dueChords(pool, [], known(em.id), NOW);
    expect(t).toMatchObject({ reason: 'première vérification' });
    expect(t!.voicing.id).toBe(em.id);
  });

  it('« Ne pas réviser » retire la forme, et la carte n’est pas perdue', () => {
    const list = [attempt(em, NOW - 9 * DAY, 99)];
    expect(dueChords(pool, list, { ...known(em.id), noReview: [em.id] }, NOW)).toEqual([]);
    expect(dueChords(pool, list, known(em.id), NOW)).toHaveLength(1);
  });

  it('le calendrier est celui des gammes : réussite nette, palier 2, un jour', () => {
    const list = [attempt(em, NOW - 2 * 3_600_000, 99)];
    const card = cardsFrom(list).find((x) => x.nodeId === chordNodeId(em.id))!;
    expect(card.box).toBe(2);
    expect(dueChords(pool, list, known(em.id), NOW)).toEqual([]);
    expect(dueChords(pool, list, known(em.id), NOW + 2 * DAY)[0]).toMatchObject({ reason: 'palier 2 sur 6' });
  });

  it('un rappel raté d’aujourd’hui attend demain, même échu', () => {
    const list = [attempt(em, NOW - 3_600_000, 0)];
    expect(dueChords(pool, list, known(em.id), NOW)).toEqual([]);
    expect(dueChords(pool, list, known(em.id), NOW + DAY)).toHaveLength(1);
  });

  it('un rattrapage ne compte pas', () => {
    const list = [attempt(em, NOW - 3 * DAY, 0), attempt(em, NOW - 3 * DAY + 60_000, 99, true)];
    expect(cardsFrom(list).find((x) => x.nodeId === chordNodeId(em.id))).toMatchObject({ box: 1, reps: 1 });
  });

  it('une séance s’arrête à 5, l’accueil annonce 8 au plus', () => {
    const ids = VOICINGS.slice(0, 12).map((v) => v.id);
    expect(buildChordQueue(VOICINGS, [], known(...ids), NOW)).toHaveLength(5);
    const s = chordReviewSummary(VOICINGS, [], known(...ids), NOW);
    expect(s.chords).toHaveLength(5);
    expect(s.count).toBe(8);
  });

  it('la suite proposée respecte le plafond du jour', () => {
    const vs = VOICINGS.slice(0, 12);
    const done = vs.slice(0, 8).map((v) => attempt(v, NOW - 60_000, 99));
    expect(moreChordsDue(VOICINGS, done, known(...vs.map((v) => v.id)), NOW)).toBe(0);
  });

  it('rien de dû : la prochaine échéance est annoncée', () => {
    const list = [attempt(em, NOW - 3_600_000, 99)];
    const s = chordReviewSummary(pool, list, known(em.id), NOW);
    expect(s.chords).toEqual([]);
    expect(s.nextDue).toBeGreaterThan(NOW);
  });

  it('après un échec aujourd’hui, l’échéance annoncée est demain, pas dans 10 min', () => {
    const list = [attempt(em, NOW - 60_000, 0)];
    const s = chordReviewSummary(pool, list, known(em.id), NOW);
    expect(s.nextDue).toBe(nextDay(NOW));
  });

  it('une tentative d’accord passe la normalisation sans perdre son identité', () => {
    expect(normalizeAttempt(attempt(em, NOW, 3))).toMatchObject({ module: 'accords', chordId: em.id, kind: 'recall', level: 3 });
  });
});
