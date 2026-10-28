import { describe, expect, it } from 'vitest';
import { TUNINGS, generatePositions, getScale, pitchClassOf, tonicSpellings } from '../src/core/theory';
import { layoutScore, positionToScore, validateScore } from '../src/core/tab';
import {
  HOLES_RATIO, SEGMENTS, buildExercise, checkAnswer, holeKey, insideGrid, mulberry32, segmentPlan, starsFor,
  tempoGrid, withRevealed, clickMasked, isClickPitch,
} from '../src/modules/gammes/exercise';
import { unseenTonic } from '../src/modules/gammes/transpose';

const std = TUNINGS.standard!;
const box1 = generatePositions('pentatonic-minor', 'A', std, 'boxes')[0]!;
const score = positionToScore(box1, std, { direction: 'up', fingers: true });
const opts = { mode: 'wrap' as const, maxWidth: 190, notes: 'fr' as const, chords: 'en' as const, annotation: 'degree' as const, stacks: 'change' as const };

const hiddenCount = (s: typeof score) => s.measures.flatMap((m) => m.events.flatMap((e) => e.notes)).filter((n) => n.hidden).length;
const noteCount = (s: typeof score) => s.measures.flatMap((m) => m.events.flatMap((e) => e.notes)).length;

describe('trous : niveau 2 et niveau 3', () => {
  it('niveau 3 : toutes les notes sont masquées, une par une', () => {
    const ex = buildExercise(score, 3);
    expect(ex.total).toBe(noteCount(score));
    expect(hiddenCount(ex.score)).toBe(noteCount(score));
    expect(ex.holes.length).toBe(ex.total);
    expect(ex.ratio).toBe(1);
    // chaque trou porte la case de la note masquée correspondante
    for (const h of ex.holes) {
      const col = layoutScore(ex.score, opts).columns[h.columnIndex]!;
      const pill = col.pills.find((p) => p.string === h.string)!;
      expect(pill.hidden).toBe(true);
      expect(pill.fret).toBe(h.fret);
    }
  });

  it('niveau 2 : environ 35 % des notes, au moins deux, jamais toutes', () => {
    const ex = buildExercise(score, 2);
    expect(ex.total).toBe(Math.max(2, Math.round(noteCount(score) * HOLES_RATIO)));
    expect(ex.total).toBeLessThan(noteCount(score));
    expect(hiddenCount(ex.score)).toBe(ex.total);
    expect(ex.notes).toBe(noteCount(score));
    // segment court (4 notes) : deux trous, pas un seul
    const short = buildExercise(positionToScore(segmentPlan(box1, 'strings2').position, std, { direction: 'up' }), 2, { rng: mulberry32(3) });
    expect(short.notes).toBe(4);
    expect(short.total).toBe(2);
  });

  it('même graine → mêmes trous ; deux graines → trous différents', () => {
    const a = buildExercise(score, 2, { rng: mulberry32(42) });
    const b = buildExercise(score, 2, { rng: mulberry32(42) });
    const c = buildExercise(score, 2, { rng: mulberry32(7) });
    expect(a.holes.map((h) => h.key)).toEqual(b.holes.map((h) => h.key));
    expect(a.holes.map((h) => h.key)).not.toEqual(c.holes.map((h) => h.key));
  });

  it('les clés suivent l’ordre de lecture des colonnes', () => {
    const ex = buildExercise(score, 3);
    for (let i = 1; i < ex.holes.length; i++) {
      expect(ex.holes[i]!.columnIndex).toBeGreaterThan(ex.holes[i - 1]!.columnIndex);
    }
    expect(ex.holes[0]!.columnIndex).toBe(0);
  });

  it('un trou n’affiche ni chiffre ni annotation (rien ne fuit)', () => {
    const ex = buildExercise(score, 3);
    const layout = layoutScore(ex.score, opts);
    for (const col of layout.columns) {
      for (const pill of col.pills) {
        expect(pill.hidden).toBe(true);
        expect(pill.text).toBe(String(pill.fret)); // le chiffre reste dans le modèle…
        expect(col.sideAnnotations).toEqual([]); // …mais aucune annotation n’est dessinée
      }
    }
  });

  it('le score reste valide après masquage (le modèle ne change pas)', () => {
    const ex = buildExercise(score, 3);
    expect(validateScore(ex.score)).toEqual([]);
    expect(noteCount(ex.score)).toBe(noteCount(score));
  });

  it('révéler une case rend sa couleur, sans toucher les autres', () => {
    const ex = buildExercise(score, 3);
    const keys = new Set([ex.holes[0]!.key]);
    const shown = withRevealed(ex.score, keys);
    expect(hiddenCount(shown)).toBe(ex.total - 1);
    expect(validateScore(shown)).toEqual([]);
    const pill = layoutScore(shown, opts).columns[0]!.pills[0]!;
    expect(pill.hidden).toBe(false);
  });

  it('le trou désigné porte un anneau visible même masqué (activeHoleKey)', () => {
    const ex = buildExercise(score, 3);
    const key = ex.holes[2]!.key;
    const layout = layoutScore(ex.score, { ...opts, activeHoleKey: key });
    const active = layout.columns.flatMap((c) => c.pills).filter((p) => p.active);
    expect(active.length).toBe(1);
    expect(active[0]!.hidden).toBe(true);
  });
});

describe('réponse : comparaison et étoiles', () => {
  it('une réponse n’est juste qu’à la case exacte, dans les bornes du manche', () => {
    const ex = buildExercise(score, 3);
    const h = ex.holes[0]!;
    expect(checkAnswer(h, h.fret)).toBe(true);
    expect(checkAnswer(h, h.fret + 1)).toBe(false);
    expect(checkAnswer(h, -1)).toBe(false);
    expect(checkAnswer(h, 25)).toBe(false);
    expect(checkAnswer(h, 2.5)).toBe(false);
  });

  it('étoiles : 0 sous 80 %, ★ à 80 %, ★★ à 95 %, ★★★ sans aucune erreur', () => {
    expect(starsFor(0.79, 0, 0)).toBe(0);
    expect(starsFor(0.8, 2, 2)).toBe(1);
    expect(starsFor(0.95, 1, 1)).toBe(2);
    expect(starsFor(1, 0, 0)).toBe(3);
    expect(starsFor(1, 1, 0)).toBe(2);
    expect(starsFor(1, 0, 1)).toBe(2);
  });
});

describe('découpage (chunking)', () => {
  it('1 corde = la corde grave seule, 2 cordes gardent les deux plus graves', () => {
    const one = segmentPlan(box1, 'string1');
    expect(one.position.notes.every((n) => n.string === 0)).toBe(true);
    expect(one.strings).toBe(1);
    const two = segmentPlan(box1, 'strings2');
    expect(two.position.notes.every((n) => n.string < 2)).toBe(true);
    expect(two.strings).toBe(2);
    expect(two.position.notes.length).toBeGreaterThan(one.position.notes.length);
  });

  it('aller-retour : la descente est l’inverse exact, sans répéter le sommet', () => {
    const plan = segmentPlan(box1, 'updown');
    expect(plan.direction).toBe('updown');
    const s = positionToScore(plan.position, std, { direction: plan.direction });
    const notes = s.measures.flatMap((m) => m.events.flatMap((e) => e.notes));
    expect(notes.length).toBe(plan.position.notes.length * 2 - 1);
    const up = plan.position.notes.map((n) => `${n.string}:${n.fret}`);
    const played = notes.map((n) => `${n.string}:${n.fret}`);
    expect(played.slice(0, up.length)).toEqual(up);
    expect(played.slice(up.length)).toEqual([...up].reverse().slice(1));
  });

  it('chaque segment produit une tablature valide et un exercice jouable', () => {
    for (const s of SEGMENTS) {
      const plan = segmentPlan(box1, s.value);
      const sc = positionToScore(plan.position, std, { direction: plan.direction });
      expect(validateScore(sc)).toEqual([]);
      const ex = buildExercise(sc, 2, { rng: mulberry32(1) });
      expect(ex.total).toBeGreaterThan(0);
      expect(ex.holes.every((h) => h.fret >= 0 && h.fret <= 24)).toBe(true);
      expect(holeKey(ex.holes[0]!.columnIndex, ex.holes[0]!.string)).toBe(ex.holes[0]!.key);
    }
  });

  it('une position de 7 cordes reste jouable (générique sur le nombre de cordes)', () => {
    const seven = TUNINGS.standard7!;
    const pos = generatePositions('ionian', 'C', seven, '3nps')[0]!;
    const sc = positionToScore(pos, seven, { direction: 'up' });
    const ex = buildExercise(sc, 3);
    expect(ex.total).toBe(pos.notes.length);
    expect(validateScore(ex.score)).toEqual([]);
  });
});

describe('transposition : proposer une tonique jamais vue', () => {
  it('écarte les toniques déjà travaillées', () => {
    const t = unseenTonic('pentatonic-minor', ['A']);
    expect(t).not.toBeNull();
    expect(t).not.toBe('A');
  });

  it('orthographe admise par le moteur, et épuisement propre', () => {
    const seen: string[] = [];
    for (let i = 0; i < 20; i++) {
      const t = unseenTonic('dorian', seen);
      if (!t) break;
      expect(tonicSpellings(getScale('dorian'), pitchClassOf(t))).toContain(t);
      seen.push(t);
    }
    expect(seen.length).toBeGreaterThanOrEqual(12);
    // toutes les écritures admises ont été proposées : plus rien à proposer
    const all: string[] = [];
    for (let pc = 0; pc < 12; pc++) all.push(...tonicSpellings(getScale('dorian'), pc));
    expect(unseenTonic('dorian', all)).toBeNull();
  });
});

describe('masque des clics du métronome (hauteur et temps)', () => {
  it('une note de guitare jouée sur le temps n’est pas masquée ; un clic entendu l’est', () => {
    // 60 BPM : un clic par seconde ; 3,02 s est à 20 ms d'un clic
    expect(clickMasked(3.02, 60, 45)).toBe(false); // La2 sur le temps : c'est ce qu'on demande
    expect(clickMasked(3.02, 60, 72)).toBe(false); // Do5, haut d'une box : toujours pas un clic
    expect(clickMasked(3.02, 60, 84)).toBe(true); // Do6 : le clic du temps
    expect(clickMasked(3.02, 60, 91)).toBe(true); // Sol6 : le clic du premier temps
    expect(clickMasked(3.5, 60, 84)).toBe(false); // loin d'un clic : une vraie note, même aiguë
  });

  it('la bande des clics couvre leur glissement (+8 % / −10 %) et rien d’une position grave', () => {
    expect(isClickPitch(82.3)).toBe(true);
    expect(isClickPitch(92.3)).toBe(true);
    expect(isClickPitch(88)).toBe(false); // Mi6, Mi aigu case 24
    expect(isClickPitch(76)).toBe(false);
  });
});

describe('grille rythmique (métronome sans notes)', () => {
  it('un temps par trou, en mesures entières, sans aucune note jouée', () => {
    const g = tempoGrid(5, 60);
    expect(g.beats).toBe(8); // 5 trous → 2 mesures de 4 temps
    expect(g.seconds).toBe(8);
    expect(g.score.measures.length).toBe(2);
    expect(validateScore(g.score)).toEqual([]);
    expect(g.score.measures.flatMap((m) => m.events).every((e) => e.kind === 'rest' && e.notes.length === 0)).toBe(true);
  });

  it('le tempo reste dans 30-200 BPM et la durée suit', () => {
    expect(tempoGrid(4, 10).score.tempo).toBe(30);
    expect(tempoGrid(4, 500).score.tempo).toBe(200);
    expect(tempoGrid(4, 50).beats).toBe(4);
    expect(tempoGrid(4, 50).seconds).toBeCloseTo(4.8, 6);
    expect(tempoGrid(4, 50).npm).toBe(50);
  });

  it('en croches : deux trous par temps, débit doublé, durée moitié', () => {
    // 12 notes d'une box : 12 temps en noires, 6 → 8 temps (mesures entières) en croches
    const q = tempoGrid(12, 80, 1);
    const e = tempoGrid(12, 80, 2);
    expect(q.beats).toBe(12);
    expect(e.beats).toBe(8);
    expect(e.perBeat).toBe(2);
    expect(e.npm).toBe(160); // 80 BPM en croches = 160 notes par minute
    expect(e.seconds).toBeCloseTo(6, 6);
    expect(validateScore(e.score)).toEqual([]);
  });

  it('dans la grille avec une tolérance d’un dixième de temps', () => {
    const g = tempoGrid(4, 60); // 4 s
    expect(insideGrid(3.5, g)).toBe(true);
    expect(insideGrid(4.25, g)).toBe(true);
    expect(insideGrid(4.5, g)).toBe(false);
    expect(insideGrid(9, g)).toBe(false);
  });

  it('étoiles : la grille manquée plafonne à ★, la grille tenue conditionne ★★ et ★★★', () => {
    expect(starsFor(1, 0, 0, 'kept')).toBe(3);
    expect(starsFor(0.96, 0, 1, 'kept')).toBe(2);
    expect(starsFor(0.96, 0, 0, 'kept')).toBe(2);
    expect(starsFor(0.85, 0, 0, 'kept')).toBe(1);
    expect(starsFor(1, 0, 0, 'missed')).toBe(1);
    expect(starsFor(0.79, 0, 0, 'kept')).toBe(0);
    // sans grille : comportement inchangé
    expect(starsFor(1, 0, 0)).toBe(3);
    expect(starsFor(0.95, 0, 0)).toBe(2);
  });
});
