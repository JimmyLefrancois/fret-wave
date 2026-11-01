import { describe, expect, it } from 'vitest';
import { TUNINGS, generatePositions, getScale, pitchClassOf, tonicSpellings } from '../src/core/theory';
import { layoutScore, positionToScore, validateScore } from '../src/core/tab';
import {
  buildExercise, stringsOf, tempoGrid, withRevealed, clickMasked, isClickPitch, missedSummary, stepOpen,
} from '../src/modules/gammes/exercise';
import { unseenTonic, unseenZoneTonic } from '../src/modules/gammes/transpose';

const std = TUNINGS.standard!;
const box1 = generatePositions('pentatonic-minor', 'A', std, 'boxes')[0]!;
const score = positionToScore(box1, std, { direction: 'up', fingers: true });
const opts = { mode: 'wrap' as const, maxWidth: 190, notes: 'fr' as const, chords: 'en' as const, annotation: 'degree' as const, stacks: 'change' as const };

const hiddenCount = (s: typeof score) => s.measures.flatMap((m) => m.events.flatMap((e) => e.notes)).filter((n) => n.hidden).length;
const noteCount = (s: typeof score) => s.measures.flatMap((m) => m.events.flatMap((e) => e.notes)).length;

describe('rappel de mémoire : toutes les notes masquées', () => {
  it('toutes les notes sont masquées, une par une', () => {
    const ex = buildExercise(score);
    expect(ex.total).toBe(noteCount(score));
    expect(hiddenCount(ex.score)).toBe(noteCount(score));
    expect(ex.holes.length).toBe(ex.total);
    // chaque trou porte la case de la note masquée correspondante
    for (const h of ex.holes) {
      const col = layoutScore(ex.score, opts).columns[h.columnIndex]!;
      const pill = col.pills.find((p) => p.string === h.string)!;
      expect(pill.hidden).toBe(true);
      expect(pill.fret).toBe(h.fret);
    }
  });

  it('les clés suivent l’ordre de lecture des colonnes', () => {
    const ex = buildExercise(score);
    for (let i = 1; i < ex.holes.length; i++) {
      expect(ex.holes[i]!.columnIndex).toBeGreaterThan(ex.holes[i - 1]!.columnIndex);
    }
    expect(ex.holes[0]!.columnIndex).toBe(0);
  });

  it('un trou n’affiche ni chiffre ni annotation (rien ne fuit)', () => {
    const ex = buildExercise(score);
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
    const ex = buildExercise(score);
    expect(validateScore(ex.score)).toEqual([]);
    expect(noteCount(ex.score)).toBe(noteCount(score));
  });

  it('révéler une case rend sa couleur, sans toucher les autres', () => {
    const ex = buildExercise(score);
    const keys = new Set([ex.holes[0]!.key]);
    const shown = withRevealed(ex.score, keys);
    expect(hiddenCount(shown)).toBe(ex.total - 1);
    expect(validateScore(shown)).toEqual([]);
    const pill = layoutScore(shown, opts).columns[0]!.pills[0]!;
    expect(pill.hidden).toBe(false);
  });

  it('le trou désigné porte un anneau visible même masqué (activeHoleKey)', () => {
    const ex = buildExercise(score);
    const key = ex.holes[2]!.key;
    const layout = layoutScore(ex.score, { ...opts, activeHoleKey: key });
    const active = layout.columns.flatMap((c) => c.pills).filter((p) => p.active);
    expect(active.length).toBe(1);
    expect(active[0]!.hidden).toBe(true);
  });
});

describe('position entière', () => {
  it('aller-retour : la descente est l’inverse exact, sans répéter le sommet', () => {
    const plan = { position: box1, direction: 'updown' as const };
    expect(plan.direction).toBe('updown');
    const s = positionToScore(plan.position, std, { direction: plan.direction });
    const notes = s.measures.flatMap((m) => m.events.flatMap((e) => e.notes));
    expect(notes.length).toBe(plan.position.notes.length * 2 - 1);
    const up = plan.position.notes.map((n) => `${n.string}:${n.fret}`);
    const played = notes.map((n) => `${n.string}:${n.fret}`);
    expect(played.slice(0, up.length)).toEqual(up);
    expect(played.slice(up.length)).toEqual([...up].reverse().slice(1));
  });

  it('compte les cordes couvertes par la position', () => {
    expect(stringsOf(box1)).toBe(6);
    expect(stringsOf({ ...box1, notes: [] })).toBe(0);
  });

  it('une position de 7 cordes reste jouable (générique sur le nombre de cordes)', () => {
    const seven = TUNINGS.standard7!;
    const pos = generatePositions('ionian', 'C', seven, '3nps')[0]!;
    const sc = positionToScore(pos, seven, { direction: 'up' });
    const ex = buildExercise(sc);
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
});

describe('fin de série : où l’on a raté', () => {
  const std = TUNINGS.standard!;
  const [pos] = generatePositions('pentatonic-minor', 'A', std, 'boxes', {});
  const score = positionToScore(pos!, std);
  const opts = { mode: 'wrap' as const, maxWidth: 400, notes: 'fr' as const, chords: 'en' as const, annotation: 'none' as const, stacks: 'change' as const };

  it('une case révélée sans être trouvée porte la marque « missed », une case trouvée non', () => {
    const ex = buildExercise(score);
    const [a, b] = ex.holes;
    const shown = withRevealed(ex.score, new Set([a!.key, b!.key]), new Set([b!.key]));
    const pills = layoutScore(shown, opts).columns.flatMap((c) => c.pills.map((p) => ({ key: `${c.index}:${p.string}`, p })));
    expect(pills.find((x) => x.key === a!.key)!.p.missed).toBeUndefined();
    expect(pills.find((x) => x.key === b!.key)!.p.missed).toBe(true);
    expect(pills.find((x) => x.key === b!.key)!.p.hidden).toBe(false);
  });

  it('résumé par corde, la plus ratée d’abord ; rien de raté → null', () => {
    const holes = [
      { key: 'h1', string: 3 }, { key: 'h2', string: 3 }, { key: 'h3', string: 4 }, { key: 'h4', string: 0 },
    ] as unknown as Parameters<typeof missedSummary>[0];
    const names = ['Mi grave', 'La', 'Ré', 'Sol', 'Si', 'Mi aigu'];
    expect(missedSummary(holes, new Set(['h1', 'h2', 'h3']), names)).toBe('3 cases manquées : Sol ×2, Si ×1');
    expect(missedSummary(holes, new Set(['h4']), names)).toBe('1 case manquée : Mi grave ×1');
    expect(missedSummary(holes, new Set(), names)).toBeNull();
  });

  it('flèches : trou ouvert suivant / précédent, en bouclant et en sautant les cases faites', () => {
    const order = ['a', 'b', 'c', 'd'];
    const open = (k: string) => k !== 'b';
    expect(stepOpen(order, open, null, 1)).toBe('a');
    expect(stepOpen(order, open, 'a', 1)).toBe('c');
    expect(stepOpen(order, open, 'd', 1)).toBe('a');
    expect(stepOpen(order, open, 'c', -1)).toBe('a');
    expect(stepOpen(order, open, 'a', -1)).toBe('d');
    expect(stepOpen(order, open, null, -1)).toBe('d');
    expect(stepOpen(order, () => false, 'a', 1)).toBeNull();
  });
});

describe('transposition en révision : une tonique dont la forme tombe dans une zone non vue', () => {
  const zoneOfForm = (tonic: string, formIndex = 0) => {
    const pos = generatePositions('pentatonic-minor', tonic as never, std, 'boxes').find((p) => (p.formIndex ?? p.index) === formIndex)!;
    return Math.max(0, Math.min(4, Math.floor(Math.max(0, pos.fretMin) / 5)));
  };

  it('La m position 1 (zone 1) : la tonique proposée place la position ailleurs', () => {
    expect(zoneOfForm('A')).toBe(1);
    const t = unseenZoneTonic('pentatonic-minor', 'boxes', 0, 'standard', [1], ['A']);
    expect(t).not.toBeNull();
    expect(t).not.toBe('A');
    expect([0, 2, 3, 4]).toContain(zoneOfForm(t!));
  });

  it('toutes les zones déjà vues : rien à proposer', () => {
    expect(unseenZoneTonic('pentatonic-minor', 'boxes', 0, 'standard', [0, 1, 2, 3, 4], ['A'])).toBeNull();
  });

  it('orthographe admise par le moteur, jamais une tonique déjà vue', () => {
    const seen = ['A', 'D'];
    const t = unseenZoneTonic('dorian', '3nps', 0, 'standard', [1], seen);
    expect(t).not.toBeNull();
    expect(seen).not.toContain(t);
    expect(tonicSpellings(getScale('dorian'), pitchClassOf(t!))).toContain(t);
  });

  it('gamme inconnue : null, pas d’exception', () => {
    expect(unseenZoneTonic('nope', 'boxes', 0, 'standard', [], [])).toBeNull();
  });
});
