import { describe, expect, it } from 'vitest';
import { generatePositions, TUNINGS } from '../src/core/theory';
import { PPQ, SEQUENCE_PATTERNS, sequenceToScore, validateScore, type MotifPattern } from '../src/core/tab';
import { targetsFor } from '../src/core/input/match';
import {
  LADDER_MAX, LADDER_START, judgePass, ladderStart, ladderStep, loopCountBeat, loopLeft, loopNoteIndex, loopRises, loopStep, pauseDue, startTempo,
  TOURS_START, formatTourLog, heardInTour, judgeTour, loopBilan, playedTours, tourDecides, tourRaise, tourRecord, type TourResult,
} from '../src/modules/gammes/sequence';
import { loopHistory, playerStopped, sessionRuns, type TourRow } from '../src/modules/gammes/sequence';
import { COUNT_IN_TICKS as LOOP_COUNT_TICKS } from '../src/modules/gammes/blind';
import { normalizeAttempt, nodeIdOf, type Attempt } from '../src/core/progress/journal';
import { cardsFrom } from '../src/core/progress/scheduler';
import { summarizeNodes } from '../src/core/progress/mastery';

const std = TUNINGS.standard!;
const box = generatePositions('pentatonic-minor', 'A', std, 'boxes')[0]!;
const nps = generatePositions('ionian', 'G', std, '3nps')[0]!;
const notesOf = (pattern: MotifPattern, pos = box) =>
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
});

describe('séquences : gamme en boucle', () => {
  const session = (every: number, reps: number, bpm = 60) => {
    let s = ladderStart(bpm);
    for (let i = 0; i < reps; i++) s = loopStep(s, every);
    return s;
  };

  it('monte et descend sans répéter le sommet ni la note du bas : le nombre de notes reste pair', () => {
    for (const pos of [box, nps]) {
      const score = sequenceToScore(pos, std, 'scale');
      expect(validateScore(score)).toEqual([]);
      const midis = score.measures.flatMap((m) => m.events).filter((e) => e.kind === 'notes').map((e) => e.notes[0]!.midi);
      expect(midis.length).toBe(2 * pos.notes.length - 2);
      expect(midis.length % 2).toBe(0);
      const looped = [...midis, midis[0]!];
      expect(looped.slice(1).every((m, i) => m !== looped[i])).toBe(true);
    }
  });

  it('+5 BPM toutes les N répétitions, au début de la répétition suivante', () => {
    expect(session(3, 2).bpm).toBe(60);
    expect(session(3, 3).bpm).toBe(65);
    expect(session(3, 6).bpm).toBe(70);
    expect(session(1, 4).bpm).toBe(80);
  });

  it('tempo fixe : les répétitions comptent, le tempo ne bouge pas', () => {
    const s = session(0, 12, 85);
    expect(s).toMatchObject({ bpm: 85, start: 85, passes: 12, best: null });
    expect(loopLeft(s, 0)).toBeNull();
  });

  it('jamais au-dessus de la borne du tempo, et plus rien à annoncer une fois atteinte', () => {
    const s = session(1, 5, 195);
    expect(s.bpm).toBe(LADDER_MAX);
    expect(loopLeft(s, 1)).toBeNull();
  });

  it('annonce les répétitions restantes avant la hausse', () => {
    expect(loopLeft(session(3, 0), 3)).toBe(3);
    expect(loopLeft(session(3, 2), 3)).toBe(1);
    expect(loopLeft(session(3, 3), 3)).toBe(3);
  });

  it('le curseur attend la fin du décompte, puis revient à la première note à chaque tour', () => {
    expect(loopNoteIndex(LOOP_COUNT_TICKS - 1, 10)).toBeNull();
    expect(loopNoteIndex(LOOP_COUNT_TICKS, 10)).toBe(0);
    expect(loopNoteIndex(LOOP_COUNT_TICKS + 3 * (PPQ / 2), 10)).toBe(3);
    expect(loopNoteIndex(LOOP_COUNT_TICKS + 10 * (PPQ / 2), 10)).toBe(0);
  });

  it('le décompte ne revient qu’après la répétition qui fait monter le tempo', () => {
    // répétitions déjà finies → la répétition en cours se termine-t-elle sur une hausse ?
    expect([0, 1, 2, 3, 4, 5].map((n) => loopRises(session(3, n), 3))).toEqual([false, false, true, false, false, true]);
    expect([0, 1, 2].map((n) => loopRises(session(1, n), 1))).toEqual([true, true, true]);
    expect(loopRises(session(0, 7), 0)).toBe(false);
    expect(loopRises(session(1, 0, LADDER_MAX), 1)).toBe(false); // tempo au maximum : plus de hausse, plus de décompte
  });

  it('le décompte affiche 4, 3, 2, 1 puis s’efface', () => {
    expect([0, PPQ, 2 * PPQ, 3 * PPQ, 4 * PPQ - 1].map(loopCountBeat)).toEqual([4, 3, 2, 1, 1]);
    expect(loopCountBeat(LOOP_COUNT_TICKS)).toBeNull();
  });

  it('au journal : le motif survit à la relecture, sans XP ni preuve de vitesse', () => {
    const a: Attempt = {
      id: 'x', ts: 1, kind: 'sequence', scaleId: 'pentatonic-minor', tonic: 'A', tuningId: 'standard', system: 'boxes',
      positionId: 'p', formIndex: 0, level: 4, strings: 6, correct: null, total: null, seconds: 300, fretMin: 5,
      missedStrings: [], tempoOk: false, pattern: 'scale', bpmStart: 60, passes: 20, fullPosition: true,
    };
    expect(normalizeAttempt(a)?.pattern).toBe('scale');
  });
});

describe('gamme en boucle : tours au micro', () => {
  const score = sequenceToScore(box, std, 'scale');
  const tgts = targetsFor(
    score.measures.flatMap((m) => m.events).filter((e) => e.kind === 'notes').map((e, i) => {
      const n = e.notes[0]!;
      return { key: `${i}:${n.string}`, columnIndex: i, string: n.string, fret: n.fret, note: n.note, fn: n.fn };
    }),
    std,
  );
  const n = tgts.length;
  const eighth = 0.25; // 120 BPM
  const played = (tour: number, shift = 0.04) => tgts.map((t, i) => ({ midi: t.midi, t: (tour * n + i) * eighth + shift }));
  const judge = (notes: { midi: number; t: number }[], tour = 0) =>
    judgeTour(tgts, heardInTour(notes, tour, n, 120), 120, { centsTolerance: 30 });
  const propre: TourResult = { correct: 4, total: 4, offTime: 0, errors: 0, missedStrings: [], clean: true, lag: null, notes: [] };
  const raté: TourResult = { ...propre, correct: 3, errors: 1, clean: false };

  it('un tour bien joué est propre, même avec un retard constant, et chaque tour reste dans sa fenêtre', () => {
    const notes = [...played(0, 0.12), ...played(1, 0.12), ...played(2, 0.12)];
    expect(judge(notes, 1)).toMatchObject({ correct: n, errors: 0, offTime: 0, clean: true });
  });

  it('un retard du micro plus long qu’une demi-croche ne fait pas déborder la dernière note sur le tour suivant', () => {
    const lag = 0.17;
    const notes = [...played(0, lag), ...played(1, lag), ...played(2, lag)];
    const premier = judgeTour(tgts, heardInTour(notes, 0, n, 120), 120, { centsTolerance: 30 });
    expect(premier.clean).toBe(true);
    expect(premier.lag).toBeCloseTo(lag, 5);
    for (const tour of [1, 2]) {
      expect(judgeTour(tgts, heardInTour(notes, tour, n, 120, premier.lag), 120, { centsTolerance: 30 }).clean).toBe(true);
    }
  });

  it('le détail dit, note à note, ce qui a été entendu', () => {
    const faux = played(0);
    faux[3] = { ...faux[3]!, midi: faux[3]!.midi + 1 };
    const heard = heardInTour(faux, 0, n, 120);
    const text = formatTourLog('Session', [{ tour: 0, bpm: 120, lag: null, result: judgeTour(tgts, heard, 120, { centsTolerance: 30 }), heard, masked: [] }]);
    expect(text).toContain('Tour 1 | 120 BPM');
    expect(text).toContain('non mesuré');
    expect(text).toMatch(/04 .* : FAUSSE/);
    expect(text).toMatch(/05 .* : juste \+40 ms/);
    expect(text).toContain(`entendu : ${heard[0]!.t.toFixed(3)} s`);
    expect(text).toContain('écarté (clic) : rien');
  });

  describe('fin de session', () => {
    const row = (notes: { midi: number; t: number }[]) => ({ bpm: 120, result: judge(notes) });
    const complet = row(played(0));
    const vide = row([]);
    const coupé = row(played(0).slice(0, 8));
    const fauteFinale = played(0);
    fauteFinale[n - 1] = { ...fauteFinale[n - 1]!, midi: fauteFinale[n - 1]!.midi + 1 };

    it('les tours joués après l’arrêt ne comptent pas, entiers ou commencés', () => {
      expect(playedTours([complet, complet, vide, vide])).toHaveLength(2);
      expect(playedTours([complet, coupé])).toHaveLength(1);
      expect(playedTours([vide])).toHaveLength(0);
    });

    it('un trou au milieu de la session reste une erreur, une fausse note finale aussi', () => {
      expect(playedTours([complet, vide, complet])).toHaveLength(3);
      expect(playedTours([complet, row(fauteFinale)])).toHaveLength(2);
    });

    it('le bilan : séries, tempos et cases à reprendre', () => {
      const lent = { ...row(fauteFinale), bpm: 120 };
      const vite = { ...complet, bpm: 125 };
      const b = loopBilan([complet, complet, lent, lent, vite])!;
      expect(b).toMatchObject({ tours: 5, clean: 3, errors: 2, bestStreak: 2, bpmStart: 120, bpmEnd: 125 });
      expect(b.strip).toEqual([true, true, false, false, true]);
      expect(b.byBpm).toEqual([{ bpm: 120, tours: 4, clean: 2, errors: 2 }, { bpm: 125, tours: 1, clean: 1, errors: 0 }]);
      expect(b.accuracy).toBeCloseTo((5 * n - 2) / (5 * n));
      expect(b.weak).toEqual([{ string: tgts[n - 1]!.string, fret: tgts[n - 1]!.fret, count: 2 }]);
      expect(loopBilan([])).toBeNull();
    });
  });

  it('une note fausse ou oubliée est une erreur, le tour suivant repart à zéro', () => {
    const faux = played(0);
    faux[3] = { ...faux[3]!, midi: faux[3]!.midi + 1 };
    expect(judge(faux).clean).toBe(false);
    expect(judge(faux).errors).toBe(1);
    const oubli = played(0).filter((_, i) => i !== 5);
    expect(judge(oubli).errors).toBe(1);
    expect(judge([...oubli, ...played(1)], 1).clean).toBe(true);
  });

  it('une note juste nettement hors de sa place n’est pas propre', () => {
    const notes = played(0);
    notes[6] = { ...notes[6]!, t: notes[6]!.t + 0.2 };
    expect(judge(notes)).toMatchObject({ errors: 0, offTime: 1, clean: false });
  });

  it('les séries : une erreur remet à zéro, le meilleur enchaînement reste', () => {
    const s = [propre, propre, raté, propre].reduce(tourRecord, TOURS_START);
    expect(s).toMatchObject({ clean: 3, errors: 1, streak: 1, bestStreak: 2, rise: 1 });
  });

  it('le tempo ne monte qu’après N tours propres d’affilée, sinon on relance au même tempo', () => {
    const deux = tourRecord(tourRecord(TOURS_START, propre), propre);
    expect(tourRaise(deux, 2, 100)).toMatchObject({ bpm: 105, stats: { rise: 0, streak: 2 } });
    const cassé = tourRecord(tourRecord(TOURS_START, propre), raté);
    expect(tourRaise(cassé, 2, 100)).toMatchObject({ bpm: 100, stats: { rise: 0 } });
    expect(tourRaise(deux, 0, 100).bpm).toBe(100);
  });

  it('seul le tour qui complète les N propres est décisif', () => {
    expect(tourDecides(TOURS_START, 2, 100)).toBe(false);
    expect(tourDecides(tourRecord(TOURS_START, propre), 2, 100)).toBe(true);
    expect(tourDecides(TOURS_START, 1, 100)).toBe(true);
    expect(tourDecides(TOURS_START, 0, 100)).toBe(false);
    expect(tourDecides(TOURS_START, 1, LADDER_MAX)).toBe(false);
  });
});

describe('gamme en boucle : séries, historique, arrêt au silence', () => {
  const note = (mark: 'right' | 'missed') => ({ target: { string: 0, fret: 5 }, mark }) as unknown as TourRow['result']['notes'][number];
  const tour = (bpm: number, clean: boolean): TourRow => ({
    bpm,
    result: { correct: clean ? 4 : 3, total: 4, offTime: 0, errors: clean ? 0 : 1, missedStrings: [], clean, lag: 0, notes: [note('right')] },
  });
  const base = { id: 'a', ts: 1, kind: 'sequence', scaleId: 'pent', tonic: 'A', tuningId: 'standard', system: 'caged', positionId: 'p', formIndex: 2,
    level: 4, strings: 6, correct: null, total: null, seconds: 60, fretMin: 5, missedStrings: [], tempoOk: false, pattern: 'scale' } as Attempt;
  const form = { scaleId: 'pent', system: 'caged', formIndex: 2 };

  it('résume une session en une série compacte', () => {
    expect(sessionRuns([tour(60, true), tour(60, true), tour(60, false), tour(65, true)]))
      .toEqual([{ from: 60, to: 65, tours: 4, clean: 3, errors: 1, streak: 2 }]);
    expect(sessionRuns([])).toEqual([]);
  });

  it('garde les séries au journal et écarte celles qui sont incohérentes', () => {
    const run = { from: 60, to: 65, tours: 4, clean: 3, errors: 1, streak: 2 };
    expect(normalizeAttempt({ ...base, runs: [run, { ...run, clean: 9 }, { ...run, to: 500 }] })?.runs).toEqual([run]);
    expect(normalizeAttempt({ ...base, runs: 'x' })).not.toHaveProperty('runs');
  });

  it('l’historique ne lit que les gammes mesurées de cette forme, dans l’ordre', () => {
    const run = { from: 60, to: 70, tours: 5, clean: 4, errors: 1, streak: 3 };
    const journal: Attempt[] = [
      { ...base, ts: 20, runs: [run, { ...run, to: 80, streak: 1 }] },
      { ...base, ts: 10, runs: [run] },
      { ...base, ts: 30 }, // sans micro
      { ...base, ts: 40, formIndex: 3, runs: [run] },
      { ...base, ts: 50, pattern: 'g3', runs: [run] },
    ];
    expect(loopHistory(journal, form)).toEqual([
      { ts: 10, bpm: 70, streak: 3, tours: 5, clean: 4 },
      { ts: 20, bpm: 80, streak: 3, tours: 10, clean: 8 },
    ]);
  });

  it('s’arrête après 2 s sans attaque, comptées depuis le premier temps si rien n’a été joué', () => {
    expect(playerStopped(1999, 0, 0)).toBe(false);
    expect(playerStopped(2000, 0, 0)).toBe(true);
    expect(playerStopped(3000, 0, 1500)).toBe(false);
    expect(playerStopped(3500, 0, 1500)).toBe(true);
    expect(playerStopped(2500, 1000, 0)).toBe(false);
  });
});
