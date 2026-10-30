import { describe, expect, it } from 'vitest';
import { generatePositions, TUNINGS } from '../src/core/theory';
import { PPQ, SEQUENCE_PATTERNS, sequenceToScore, validateScore, type SequencePattern } from '../src/core/tab';
import { targetsFor } from '../src/core/input/match';
import {
  LADDER_START, judgePass, ladderStart, ladderStep, pauseDue, startTempo,
} from '../src/modules/gammes/sequence';
import { normalizeAttempt, nodeIdOf, type Attempt } from '../src/core/progress/journal';
import { cardsFrom } from '../src/core/progress/scheduler';
import { isSpeedProof, summarizeNodes } from '../src/core/progress/mastery';
import { xpForAttempt } from '../src/core/progress/rewards';

const std = TUNINGS.standard!;
const box = generatePositions('pentatonic-minor', 'A', std, 'boxes')[0]!;
const nps = generatePositions('ionian', 'G', std, '3nps')[0]!;
const notesOf = (pattern: SequencePattern, pos = box) =>
  sequenceToScore(pos, std, pattern).measures.flatMap((m) => m.events).filter((e) => e.kind === 'notes').map((e) => e.notes[0]!);

describe('séquences : générateur', () => {
  it('tous les motifs, sur une box et une position 3NPS : partitions valides, en croches, mesures pleines', () => {
    for (const pos of [box, nps]) {
      for (const p of SEQUENCE_PATTERNS) {
        const s = sequenceToScore(pos, std, p);
        expect(s.kind).toBe('exercise');
        expect(validateScore(s)).toEqual([]);
        const evs = s.measures.flatMap((m) => m.events);
        expect(evs.filter((e) => e.kind === 'notes').every((e) => e.durTick === PPQ / 2 && e.notes.length === 1)).toBe(true);
      }
    }
  });

  it('nombre de notes : groupes de k sur n notes = k × (n − span), montée puis descente sans le sommet répété', () => {
    const n = box.notes.length; // 12
    expect(n).toBe(12);
    expect(notesOf('g3').length).toBe(3 * (n - 2) + 3 * (n - 3)); // 30 + 27
    expect(notesOf('g4').length).toBe(4 * (n - 3) + 4 * (n - 4));
    expect(notesOf('thirds').length).toBe(2 * (n - 2) + 2 * (n - 3));
    expect(notesOf('fourths').length).toBe(2 * (n - 3) + 2 * (n - 4));
  });

  it('ordre des hauteurs : par 3 = 1-2-3, 2-3-4… puis la descente en miroir', () => {
    const sorted = [...box.notes].sort((a, b) => a.midi - b.midi).map((x) => x.midi);
    const seq = notesOf('g3').map((x) => x.midi);
    expect(seq.slice(0, 6)).toEqual([sorted[0], sorted[1], sorted[2], sorted[1], sorted[2], sorted[3]]);
    const rev = [...sorted].reverse();
    const up = 3 * (sorted.length - 2);
    // la descente repart de l'avant-dernière note : pas de sommet répété au demi-tour
    expect(seq.slice(up, up + 3)).toEqual([rev[1], rev[2], rev[3]]);
    expect(seq[up - 1]).toBe(rev[0]);
    expect(seq[up]).not.toBe(seq[up - 1]);
    expect(seq[seq.length - 1]).toBe(sorted[0]);
    // tierces : 1-3, 2-4…
    const thirds = notesOf('thirds').map((x) => x.midi);
    expect(thirds.slice(0, 4)).toEqual([sorted[0], sorted[2], sorted[1], sorted[3]]);
    // aucune note n'est jouée deux fois de suite, quel que soit le motif
    for (const p of SEQUENCE_PATTERNS) {
      const m = notesOf(p).map((x) => x.midi);
      for (let i = 1; i < m.length; i++) expect(m[i]).not.toBe(m[i - 1]);
    }
  });

  it('saut de corde : chaque corde puis celle d’après la suivante, retour en miroir', () => {
    const notes = notesOf('skip');
    const low = [...box.notes].sort((a, b) => a.midi - b.midi);
    const strings = [...new Set(low.map((n) => n.string))];
    expect(strings).toHaveLength(6);
    expect(notes.slice(0, 16).map((n) => n.string)).toEqual([0, 2, 1, 3, 2, 4, 3, 5].flatMap((i) => [strings[i], strings[i]]));
    expect(notes.length).toBe(31);
    expect(notes.map((n) => n.midi)).toEqual([...notes].reverse().map((n) => n.midi));
  });

  it('tour : part du degré choisi, passe par les deux extrémités, revient au départ', () => {
    const sorted = [...box.notes].sort((a, b) => a.midi - b.midi);
    const seq = sequenceToScore(box, std, 'cycle', { startDegree: 'b3' }).measures.flatMap((m) => m.events)
      .filter((e) => e.kind === 'notes').map((e) => e.notes[0]!);
    const first = sorted.find((n) => n.degree === 'b3')!;
    expect(seq[0]!.midi).toBe(first.midi);
    expect(seq[seq.length - 1]!.midi).toBe(first.midi);
    expect(seq.length).toBe(2 * sorted.length - 1);
    expect(Math.max(...seq.map((n) => n.midi))).toBe(sorted[sorted.length - 1]!.midi);
    expect(Math.min(...seq.map((n) => n.midi))).toBe(sorted[0]!.midi);
    for (let i = 1; i < seq.length; i++) expect(seq[i]!.midi).not.toBe(seq[i - 1]!.midi);
    // sans degré, ou degré absent de la position : on part d'en bas plutôt que d'échouer
    expect(notesOf('cycle')[0]!.midi).toBe(sorted[0]!.midi);
  });

  it('doigtés de la position présents sur chaque note (box : 1-3 / 1-4)', () => {
    for (const p of SEQUENCE_PATTERNS) expect(notesOf(p).every((x) => x.finger !== undefined)).toBe(true);
  });
});

describe('séquences : jugement d’une passe', () => {
  const score = sequenceToScore(box, std, 'thirds');
  const holes = score.measures.flatMap((m) => m.events).filter((e) => e.kind === 'notes').map((e, i) => ({ ...e.notes[0]!, key: `${i}:${e.notes[0]!.string}`, columnIndex: i }));
  const targets = targetsFor(holes, std);
  const at = (bpm: number, shift = 0, jitter: (i: number) => number = () => 0) =>
    targets.map((t, i) => ({ midi: t.midi, t: shift + i * (30 / bpm) + jitter(i) }));

  it('juste et en place : réussie, même avec un décalage constant (latence)', () => {
    const r = judgePass(targets, at(80, 0.12), 80, { centsTolerance: 35 });
    expect(r.accuracy).toBe(1);
    expect(r.inTime).toBe(true);
    expect(r.ok).toBe(true);
  });

  it('juste mais qui traîne (joué à 72 sur une grille à 80) : pas en place', () => {
    const r = judgePass(targets, at(72), 80, { centsTolerance: 35 });
    expect(r.accuracy).toBe(1);
    expect(r.inTime).toBe(false);
    expect(r.ok).toBe(false);
  });

  it('une note fausse sur 40 : 97,5 %, réussie ; trois fausses : ratée', () => {
    const one = at(80).map((h, i) => (i === 5 ? { ...h, midi: h.midi + 1 } : h));
    expect(judgePass(targets, one, 80, { centsTolerance: 35 }).ok).toBe(true);
    const three = at(80).map((h, i) => (i === 5 || i === 12 || i === 20 ? { ...h, midi: h.midi + 1 } : h));
    const r = judgePass(targets, three, 80, { centsTolerance: 35 });
    expect(r.ok).toBe(false);
    expect(r.missedStrings.length).toBeGreaterThan(0);
  });

  it('rien entendu : 0 %, ratée', () => {
    const r = judgePass(targets, [], 80, { centsTolerance: 35 });
    expect(r.correct).toBe(0);
    expect(r.ok).toBe(false);
  });
});

describe('séquences : palier de tempo', () => {
  it('+4 après deux passes réussies d’affilée ; le tempo validé est retenu', () => {
    let s = ladderStart(60);
    s = ladderStep(s, true);
    expect(s.bpm).toBe(60);
    s = ladderStep(s, true);
    expect(s.bpm).toBe(64);
    expect(s.best).toBe(60);
    expect(s.passes).toBe(2);
  });

  it('une réussite isolée entre deux échecs ne monte rien et remet le compte à zéro', () => {
    let s = ladderStart(60);
    s = ladderStep(s, true);
    s = ladderStep(s, false);
    s = ladderStep(s, true);
    expect(s.bpm).toBe(60);
    expect(s.best).toBeNull();
  });

  it('−5 après deux échecs, jamais sous le départ', () => {
    let s = ladderStart(60);
    for (let i = 0; i < 4; i++) s = ladderStep(s, true); // 60 → 64 → 68
    expect(s.bpm).toBe(68);
    s = ladderStep(ladderStep(s, false), false);
    expect(s.bpm).toBe(63);
    s = ladderStep(ladderStep(s, false), false);
    expect(s.bpm).toBe(60); // 58 serait sous le départ
    s = ladderStep(ladderStep(s, false), false);
    expect(s.bpm).toBe(60);
  });

  it('bornes 40-200', () => {
    expect(ladderStart(10).bpm).toBe(40);
    let s = ladderStart(199);
    s = ladderStep(ladderStep(s, true), true);
    expect(s.bpm).toBe(200);
  });

  it('reprise au dernier tempo validé au micro pour cette forme et ce motif, sinon 60', () => {
    const form = { scaleId: 'pentatonic-minor', system: 'boxes', formIndex: 0 };
    const seq = (ts: number, patch: Partial<Attempt>): Attempt => ({
      id: `s${ts}`, ts, kind: 'sequence', scaleId: 'pentatonic-minor', tonic: 'A', tuningId: 'standard', system: 'boxes',
      positionId: 'boxes:0', formIndex: 0, level: 2, strings: 6, correct: 40, total: 40, seconds: 300, fretMin: 5,
      missedStrings: [], tempoOk: true, pattern: 'g3', mic: true, bpmStart: 60, bpmBest: 72, passes: 8, ...patch,
    });
    expect(startTempo([], form, 'g3')).toBe(LADDER_START);
    const j = [seq(1, { bpmBest: 68 }), seq(2, { bpmBest: 76 }), seq(3, { pattern: 'thirds', bpmBest: 100 }), seq(4, { mic: undefined, bpmBest: 120 })];
    expect(startTempo(j, form, 'g3')).toBe(76);
    expect(startTempo(j, form, 'thirds')).toBe(100);
    expect(startTempo(j, form, 'g4')).toBe(LADDER_START);
    expect(startTempo(j, { ...form, formIndex: 1 }, 'g3')).toBe(LADDER_START);
  });

  it('rappel de pause à 10 min', () => {
    expect(pauseDue(9 * 60_000)).toBe(false);
    expect(pauseDue(10 * 60_000)).toBe(true);
  });
});

describe('séquences : journal, vitesse, XP', () => {
  const base: Attempt = {
    id: 'q', ts: new Date(2026, 9, 27, 18).getTime(), kind: 'sequence', scaleId: 'pentatonic-minor', tonic: 'A', tuningId: 'standard',
    system: 'boxes', positionId: 'boxes:0', formIndex: 0, level: 2, strings: 6, correct: 39, total: 40, seconds: 300,
    fretMin: 5, missedStrings: [], tempoOk: true, pattern: 'g3', mic: true, bpmStart: 60, bpmBest: 80, passes: 6,
  };

  it('nœud à part, ni carte de révision ni état de forme', () => {
    expect(nodeIdOf(base)).toBe('gam:sequence:pentatonic-minor:boxes:0');
    expect(cardsFrom([base])).toEqual([]);
    expect(summarizeNodes([base])).toEqual([]);
  });

  it('lecture tolérante des champs de séquence', () => {
    const n = normalizeAttempt({ ...base, pattern: 'sixtes', bpmBest: 500, passes: -1 })!;
    expect(n.pattern).toBeUndefined();
    expect(n.bpmBest).toBeUndefined();
    expect(n.passes).toBeUndefined();
    expect(normalizeAttempt(base)).toMatchObject({ pattern: 'g3', bpmStart: 60, bpmBest: 80, passes: 6, kind: 'sequence' });
  });

  it('prouve la vitesse de la forme au tempo cible, au micro seulement', () => {
    expect(isSpeedProof(base)).toBe(true);
    expect(isSpeedProof({ ...base, bpmBest: 76 })).toBe(false);
    expect(isSpeedProof({ ...base, mic: undefined })).toBe(false);
    expect(isSpeedProof({ ...base, bpmBest: 64 }, 60)).toBe(true);
    // rattachée à la forme : la lecture N3 de la même forme la voit
    const recall: Attempt = { ...base, id: 'r', kind: 'recall', level: 3, pattern: undefined, bpmBest: undefined, correct: 12, total: 12, fullPosition: true, mic: undefined };
    const lecture = summarizeNodes([recall, base]).find((x) => x.nodeId.startsWith('gam:lecture:'))!;
    expect(lecture.speedVerified).toBe(true);
  });

  it('XP : barème d’une transition (10 × précision, +5 à ≥ 95 %) ; 0 sans micro (non vérifiée)', () => {
    expect(xpForAttempt(base)).toBe(Math.round(10 * 39 / 40) + 5);
    expect(xpForAttempt({ ...base, mic: undefined, correct: null, total: null })).toBe(0);
  });
});
