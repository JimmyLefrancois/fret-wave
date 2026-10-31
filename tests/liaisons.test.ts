import { describe, expect, it } from 'vitest';
import {
  TUNINGS, extendedPosition, generatePositions, linkedPair, positionsOnNeck, sharedNotes,
} from '../src/core/theory';
import { PPQ, isLiaison, layoutNeck, liaisonToScore, liaisonsFor, linkNeckNotes, validateScore, type TabScore } from '../src/core/tab';
import { isSpeedProof, type Attempt } from '../src/core/progress';

const std = TUNINGS.standard!;
const boxes = generatePositions('pentatonic-minor', 'A', std, 'boxes');
const first = boxes[0]!; // cases 5-8
const notesOf = (s: TabScore) => s.measures.flatMap((m) => m.events).filter((e) => e.kind === 'notes').map((e) => e.notes[0]!);

describe('positions voisines', () => {
  it('sur le manche, les boxes de La m se suivent et partagent une case sur chaque corde', () => {
    const neck = positionsOnNeck(boxes);
    expect(neck.map((p) => p.fretMin)).toEqual([0, 2, 5, 7, 9]);
    for (let i = 0; i + 1 < neck.length; i++) {
      expect(new Set(sharedNotes(neck[i]!, neck[i + 1]!).map((n) => n.string)).size).toBe(6);
    }
  });

  it('la voisine est la suivante ; tout en haut du manche, la précédente', () => {
    expect(linkedPair(boxes, first)!.map((p) => p.fretMin)).toEqual([5, 7]);
    const top = positionsOnNeck(boxes).at(-1)!;
    expect(linkedPair(boxes, top)!.map((p) => p.fretMin)).toEqual([7, 9]);
  });

  it('position étendue : seulement les deux cordes aiguës, rien de doublé', () => {
    const ext = extendedPosition(boxes, first)!;
    const added = ext.notes.filter((n) => !first.notes.some((m) => m.string === n.string && m.fret === n.fret));
    expect(added.map((n) => [n.string, n.fret])).toEqual([[4, 10], [5, 10]]);
    expect(extendedPosition(boxes, positionsOnNeck(boxes).at(-1)!)).toBeNull();
  });
});

describe('liaisons : partitions', () => {
  const cases = [
    ['pentatonic-minor', 'A', 'boxes'], ['pentatonic-minor', 'E', 'boxes'], ['pentatonic-major', 'C', 'boxes'],
    ['blues-minor', 'A', 'boxes'], ['ionian', 'C', '3nps'], ['aeolian', 'G', '3nps'], ['ionian', 'C', 'caged'],
  ] as const;

  it('partout : partition valide, en croches, jamais deux fois la même note, doigtés présents', () => {
    for (const [id, t, sys] of cases) {
      const ps = generatePositions(id, t, std, sys);
      for (const pos of ps) {
        for (const p of liaisonsFor(ps, pos)) {
          const s = liaisonToScore(ps, pos, std, p);
          expect(validateScore(s), `${id} ${t} ${sys} ${p}`).toEqual([]);
          const n = notesOf(s);
          expect(s.measures.flatMap((m) => m.events).filter((e) => e.kind === 'notes').every((e) => e.durTick === PPQ / 2)).toBe(true);
          for (let i = 1; i < n.length; i++) expect(n[i]!.midi, `${id} ${t} ${sys} ${p} rang ${i}`).not.toBe(n[i - 1]!.midi);
          expect(n.every((x) => x.finger !== undefined), `${id} ${sys} ${p}`).toBe(true);
        }
      }
    }
  });

  it('le préfixe remplace le nom de la liaison, les cases restent', () => {
    const label = (s: TabScore) => s.measures[0]!.label?.text;
    expect(label(liaisonToScore(boxes, first, std, 'link'))).toMatch(/^deux positions · cases/);
    expect(label(liaisonToScore(boxes, first, std, 'link', { labelPrefix: 'Position 1 vers 2' }))).toMatch(/^Position 1 vers 2 · cases/);
  });

  it('deux positions : part et revient au bas de la grave, atteint le haut de l’aiguë', () => {
    const [low, high] = linkedPair(boxes, first)!;
    const n = notesOf(liaisonToScore(boxes, first, std, 'link'));
    const lowMin = Math.min(...low.notes.map((x) => x.midi));
    expect(n[0]!.midi).toBe(lowMin);
    expect(n.at(-1)!.midi).toBe(lowMin);
    expect(Math.max(...n.map((x) => x.midi))).toBe(Math.max(...high.notes.map((x) => x.midi)));
  });

  it('les pivots, et eux seuls, brillent : ce sont des cases communes', () => {
    const [low, high] = linkedPair(boxes, first)!;
    const shared = sharedNotes(low, high).map((n) => `${n.string}:${n.fret}`);
    const glow = notesOf(liaisonToScore(boxes, first, std, 'link')).filter((n) => n.characteristic);
    expect(glow).toHaveLength(2);
    for (const n of glow) expect(shared).toContain(`${n.string}:${n.fret}`);
  });

  it('traversée : toutes les notes de toutes les positions, du bas au haut du manche', () => {
    const n = notesOf(liaisonToScore(boxes, first, std, 'traverse'));
    const played = new Set(n.map((x) => `${x.string}:${x.fret}`));
    const neck = positionsOnNeck(boxes);
    expect(n[0]!.fret).toBe(neck[0]!.fretMin);
    for (const p of neck) {
      const missing = p.notes.filter((x) => !played.has(`${x.string}:${x.fret}`));
      expect(missing, `cases ${p.fretMin}-${p.fretMax}`).toEqual([]);
    }
    expect(n.filter((x) => x.characteristic)).toHaveLength(neck.length - 1);
  });

  it('position étendue : aucune liaison proposée sans voisine, ni étendue hors des boxes', () => {
    const nps = generatePositions('ionian', 'C', std, '3nps');
    expect(liaisonsFor(nps, nps[0]!)).toEqual(['link', 'traverse']);
    expect(liaisonsFor(boxes, first)).toEqual(['link', 'traverse', 'extended']);
    expect(liaisonsFor(boxes, positionsOnNeck(boxes).at(-1)!)).toEqual(['link', 'traverse']);
  });
});

describe('vue manche de deux positions', () => {
  it('la voisine est estompée, les cases communes marquées, sans doublon', () => {
    const [low, high] = linkedPair(boxes, first)!;
    const notes = linkNeckNotes(low, high, 'degree');
    expect(notes.filter((n) => n.shared)).toHaveLength(6);
    expect(notes.filter((n) => n.dim)).toHaveLength(6);
    expect(new Set(notes.map((n) => `${n.string}:${n.fret}`)).size).toBe(notes.length);
    const pills = layoutNeck(std, notes, { range: { from: 0, to: 15 } }).pills;
    expect(pills.filter((p) => p.dim).every((p) => !p.highlight)).toBe(true);
    expect(pills.filter((p) => p.shared)).toHaveLength(6);
  });
});

describe('liaison et preuve de vitesse', () => {
  const attempt = (pattern: Attempt['pattern']): Attempt => ({
    id: 'x', ts: 1, kind: 'sequence', scaleId: 'pentatonic-minor', tonic: 'A', tuningId: 'standard', system: 'boxes',
    positionId: 'p', formIndex: 0, level: 2, strings: 6, correct: 30, total: 30, seconds: 60, fretMin: 5, missedStrings: [],
    tempoOk: true, pattern, bpmBest: 120, mic: true,
  });

  it('une séquence à tempo prouve la vitesse, une liaison non', () => {
    expect(isSpeedProof(attempt('thirds'))).toBe(true);
    for (const p of ['link', 'traverse', 'extended'] as const) {
      expect(isLiaison(p)).toBe(true);
      expect(isSpeedProof(attempt(p))).toBe(false);
    }
  });
});
