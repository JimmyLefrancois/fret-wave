import { describe, expect, it } from 'vitest';
import { TUNINGS, generatePositions } from '../src/core/theory';
import { VOICINGS } from '../src/data/voicings';
import {
  METRICS, PPQ, arpeggioToScore, chordToScore, cursorAt, layoutScore, measureStarts, positionToScore, progressionToScore,
  scaleToScore, totalTicks, validateScore, type ColumnLayout, type LayoutOptions, type ScoreLayout, type TabScore,
} from '../src/core/tab';
import { rhythmScore } from './helpers/fixtures';

const std = TUNINGS.standard!;
const wrap: LayoutOptions = { mode: 'wrap', maxWidth: 195, notes: 'fr', chords: 'en', annotation: 'none', stacks: 'change' };
const scroll: LayoutOptions = { ...wrap, mode: 'scroll' };
const v = (id: string) => VOICINGS.find((x) => x.id === id)!;

interface Rect { x: number; y: number; w: number; h: number }
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function allPills(l: ScoreLayout): Rect[] {
  return l.columns.flatMap((c) => c.pills.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h })));
}

function sampleScores(): Array<[string, TabScore]> {
  const out: Array<[string, TabScore]> = [];
  out.push(['gamme pentatonique', scaleToScore('pentatonic-minor', 'A', std, { direction: 'updown' })]);
  out.push(['3NPS dorien', scaleToScore('dorian', 'D', std, { direction: 'up' })]);
  out.push(['2 chiffres', positionToScore(generatePositions('pentatonic-minor', 'A', std, 'boxes', { register: 1 })[0]!, std)]);
  out.push(['7 cordes', scaleToScore('ionian', 'G', TUNINGS.standard7!, {})]);
  out.push(['8 cordes', scaleToScore('aeolian', 'E', TUNINGS.standard8!, {})]);
  out.push(['drop D', scaleToScore('pentatonic-minor', 'D', TUNINGS.dropD!, {})]);
  for (const id of ['Em-022000', 'G-320003', 'C-x32010', 'F-133211', 'D-xx0232', 'Am7-x02010']) out.push([id, chordToScore(v(id))]);
  out.push(['progression', progressionToScore(['G-320003', 'D-xx0232', 'Em-022000', 'C-x32010'].map(v), { pattern: 'universal', romans: ['I', 'V', 'vi', 'IV'] })]);
  out.push(['rythme', rhythmScore()]);
  return out;
}

describe('géométrie : pastilles et cordes', () => {
  it('pas de 14 px entre cordes, pastille de 13 px de haut → 1 px d\'air dans une pile', () => {
    const l = layoutScore(chordToScore(v('Em-022000'), { style: 'strum' }), wrap);
    const first = l.columns[0]!;
    expect(first.pills.length).toBe(6);
    const ys = first.pills.map((p) => p.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBe(METRICS.stringStep);
    for (const p of first.pills) expect(p.h).toBe(13);
    const sys = l.systems[0]!;
    for (let i = 1; i < sys.stringYs.length; i++) expect(sys.stringYs[i]! - sys.stringYs[i - 1]!).toBe(14);
    // la ligne de corde passe au centre de la pastille (6e rangée sur 13)
    first.pills.forEach((p) => expect(sys.stringYs).toContain(p.y + 6));
  });

  it('1 chiffre = 11 px de large, 2 chiffres = 17 px, jusqu\'à la case 24', () => {
    const l = layoutScore(positionToScore(generatePositions('pentatonic-minor', 'A', std, 'boxes')[2]!, std), wrap); // cases 9-13
    const widths = new Map(l.columns.flatMap((c) => c.pills).map((p) => [p.text, p.w]));
    expect(widths.get('9')).toBe(11);
    expect(widths.get('10')).toBe(17);
    expect(widths.get('13')).toBe(17);
    const s24 = rhythmScore();
    const l24 = layoutScore(s24, scroll);
    expect(l24.columns.flatMap((c) => c.pills).find((p) => p.text === '24')!.w).toBe(17);
  });

  it('la pastille est centrée sur l\'axe de la colonne (cx), 1 ou 2 chiffres', () => {
    for (const [, s] of sampleScores()) {
      const l = layoutScore(s, scroll);
      for (const c of l.columns) for (const p of c.pills) expect(p.x + (p.w - 1) / 2).toBe(c.cx);
    }
  });

  it('7 cordes : +14 px de haut ; 8 cordes : +28 px', () => {
    const h = (t: typeof std) => layoutScore(scaleToScore('pentatonic-minor', 'A', t, {}), scroll).height;
    expect(h(TUNINGS.standard7!) - h(std)).toBe(14);
    expect(h(TUNINGS.standard8!) - h(std)).toBe(28);
  });

  it('hauteur d\'une ligne de 6 cordes avec en-tête, flèches, rythme et annotation (valeur documentée)', () => {
    const l = layoutScore(chordToScore(v('Em-022000'), { style: 'strum' }), { ...wrap, annotation: 'degree' });
    const r = l.rows;
    // en-tête : marge 3 + nom d'accord 10 + ligne « plaqué » 10 + 3 ; cordes : 13 + 5×14 ; flèches : 2 + 7 ; rythme : 2 + 13
    expect(r.tabTop).toBe(3 + 10 + 10 + 3);
    expect(r.arrowsY).toBe(r.tabTop + 83 + 2);
    expect(r.rhythmY).toBe(r.arrowsY! + 7 + 2);
    expect(r.annotationY).toBeNull(); // pile d'accord : annotation à droite des pastilles, pas de rangée
    expect(r.systemH).toBe(r.rhythmY + 13 + METRICS.bottomPad);
    const scale = layoutScore(scaleToScore('pentatonic-minor', 'A', std, {}), { ...wrap, annotation: 'degree' });
    // 3 + 10 (accord) + 10 (cases) + 3 + 83 + 2 + 13 + 1 + 7 + 4 : sans flèches
    expect(scale.rows.arrowsY).toBeNull();
    expect(scale.rows.systemH).toBe(3 + 10 + 10 + 3 + 83 + 2 + 13 + 1 + 7 + 4);
  });

  it('pas d\'en-tête vide : sans nom d\'accord ni libellé, la marge haute se réduit à 3 px', () => {
    const s = rhythmScore();
    expect(layoutScore(s, scroll).rows.tabTop).toBe(METRICS.topPad);
  });
});

describe('aucun chevauchement, tous types de scores', () => {
  it('pastilles disjointes entre elles et avec les annotations latérales', () => {
    const errors: string[] = [];
    for (const [name, s] of sampleScores()) {
      expect(validateScore(s), name).toEqual([]);
      for (const opts of [scroll, wrap, { ...wrap, stacks: 'all' as const }, { ...scroll, annotation: 'degree' as const }, { ...wrap, annotation: 'note' as const }]) {
        const l = layoutScore(s, opts);
        const pills = allPills(l);
        for (let i = 0; i < pills.length; i++) {
          for (let j = i + 1; j < pills.length; j++) if (overlap(pills[i]!, pills[j]!)) errors.push(`${name} : pastilles ${i}/${j} se chevauchent`);
        }
        // annotations : jamais sur une pastille
        for (const c of l.columns) {
          for (const a of c.sideAnnotations) {
            const w = [...a.text].length * 6;
            const box = { x: a.x, y: a.y, w, h: 7 };
            for (const p of pills) if (overlap(box, p)) errors.push(`${name} : annotation « ${a.text} » sur une pastille`);
          }
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it('colonnes strictement croissantes en x dans une ligne, et à l\'intérieur de la ligne', () => {
    for (const [name, s] of sampleScores()) {
      for (const opts of [scroll, wrap]) {
        const l = layoutScore(s, opts);
        for (const sys of l.systems) {
          const cols = l.columns.filter((c) => c.systemIndex === sys.index);
          for (let i = 0; i < cols.length; i++) {
            const c = cols[i]!;
            expect(c.x, name).toBeGreaterThan(sys.x0);
            expect(c.x + c.w, name).toBeLessThanOrEqual(sys.width);
            if (i > 0) {
              const p = cols[i - 1]!;
              if (c.measureIndex === p.measureIndex) expect(c.x, name).toBe(p.x + p.w); // contiguës dans une mesure
              else expect(c.x, name).toBeGreaterThanOrEqual(p.x + p.w + 1 + METRICS.barPadL + METRICS.barPadR); // barre + marges entre mesures
              expect(c.cx, name).toBeGreaterThan(p.cx);
            }
            for (const pl of c.pills) {
              expect(pl.x, name).toBeGreaterThanOrEqual(c.x);
              expect(pl.x + pl.w, name).toBeLessThanOrEqual(c.x + c.w);
            }
          }
        }
      }
    }
  });
});

describe('dispositions', () => {
  it('scroll : une seule ligne continue ; wrap : lignes ≤ largeur demandée, mesures dans l\'ordre', () => {
    const s = scaleToScore('dorian', 'D', std, { direction: 'updown' });
    const ls = layoutScore(s, scroll);
    expect(ls.systems.length).toBe(1);
    const lw = layoutScore(s, wrap);
    expect(lw.systems.length).toBeGreaterThan(1);
    for (const sys of lw.systems) expect(sys.width).toBeLessThanOrEqual(195);
    expect(lw.measures.map((m) => m.index)).toEqual(s.measures.map((_, i) => i));
    expect(lw.systems.flatMap((sys) => sys.measures.map((m) => m.index))).toEqual(s.measures.map((_, i) => i));
    // ordonnées croissantes, sans trou négatif
    for (let i = 1; i < lw.systems.length; i++) expect(lw.systems[i]!.y).toBeGreaterThan(lw.systems[i - 1]!.y);
    expect(lw.height).toBe(lw.systems.at(-1)!.y + lw.rows.systemH);
  });

  it('wrap : les lignes non finales sont justifiées à la largeur demandée', () => {
    const s = scaleToScore('dorian', 'D', std, { direction: 'updown' });
    for (const maxWidth of [330, 400]) {
      const l = layoutScore(s, { ...wrap, maxWidth });
      l.systems.slice(0, -1).forEach((sys) => expect(sys.width).toBe(maxWidth));
    }
  });

  it('une mesure plus large que la ligne déborde au lieu d\'être coupée', () => {
    const s = scaleToScore('pentatonic-minor', 'A', std, {});
    const l = layoutScore(s, { ...wrap, maxWidth: 80 });
    expect(l.systems.length).toBe(s.measures.length);
    expect(l.width).toBeGreaterThan(80);
  });

  it('portrait téléphone (390 px / S=2 = 195 px logiques) : une mesure de croches à 2 chiffres tient sur une ligne', () => {
    const s = positionToScore(generatePositions('pentatonic-minor', 'A', std, 'boxes')[2]!, std);
    const l = layoutScore(s, wrap);
    for (const sys of l.systems) expect(sys.width).toBeLessThanOrEqual(195);
    expect(l.systems.length).toBe(s.measures.length); // 1 mesure par ligne
  });
});

describe('piles d\'accord et simile', () => {
  it('quatre ↓ sur le même accord : une seule pile (puis flèches seules) ; « all » : une pile par frappe', () => {
    const s = chordToScore(v('Em-022000'), { style: 'strum' });
    const change = layoutScore(s, wrap);
    expect(change.columns.map((c) => c.stack)).toEqual([true, false, false, false]);
    expect(change.columns.every((c) => c.arrow !== undefined)).toBe(true);
    const all = layoutScore(s, { ...wrap, stacks: 'all' });
    expect(all.columns.map((c) => c.stack)).toEqual([true, true, true, true]);
  });

  it('progression : la pile est redessinée à chaque mesure (= début de ligne possible)', () => {
    const s = progressionToScore(['G-320003', 'D-xx0232', 'Em-022000'].map(v), { pattern: 'universal' });
    const l = layoutScore(s, wrap);
    const firstOfMeasure = l.columns.filter((c) => c.eventIndex === 0);
    expect(firstOfMeasure.length).toBe(3);
    expect(firstOfMeasure.every((c) => c.stack)).toBe(true);
    expect(l.columns.filter((c) => c.eventIndex > 0).every((c) => !c.stack)).toBe(true);
  });

  it('X sur les cordes non jouées, à la bonne rangée', () => {
    const l = layoutScore(chordToScore(v('D-xx0232'), { style: 'strum' }), wrap);
    const first = l.columns[0]!;
    expect(first.unplayed.length).toBe(2);
    const ys = l.systems[0]!.stringYs;
    // cordes 0 et 1 (graves) = deux dernières lignes
    expect(first.unplayed.map((u) => u.y).sort()).toEqual([ys[4]!, ys[5]!].sort());
  });

  it('nom d\'accord à chaque changement et en tête de ligne ; chiffrage romain sous le nom', () => {
    const s = progressionToScore(['G-320003', 'D-xx0232'].map(v), { pattern: 'quarters', romans: ['I', 'V'] });
    const l = layoutScore(s, wrap);
    const chords = l.systems.flatMap((sys) => sys.texts.filter((t) => t.role === 'chord').map((t) => t.text));
    expect(chords).toEqual(['G', 'D']);
    const romans = l.systems.flatMap((sys) => sys.texts.filter((t) => t.role === 'roman').map((t) => t.text));
    expect(romans).toEqual(['I', 'V']);
  });

  it('notation des accords : anglo / solfège / jazz', () => {
    const s = chordToScore(v('Am7-x02010'), { style: 'strum' });
    const name = (chords: 'en' | 'fr' | 'jazz') => layoutScore(s, { ...wrap, chords }).systems[0]!.texts.find((t) => t.role === 'chord')!.text;
    expect(name('en')).toBe('Am7');
    expect(name('fr')).toBe('Lam7');
    expect(name('jazz')).toBe('A-7');
  });

  it('étiquettes de cordes : solfège (Mi … mi) et anglo (E … e), Drop D', () => {
    const labels = (t: typeof std, notes: 'fr' | 'en') =>
      layoutScore(scaleToScore('pentatonic-minor', 'A', t, {}), { ...wrap, notes }).systems[0]!.texts.filter((x) => x.role === 'string').map((x) => x.text);
    expect(labels(std, 'fr')).toEqual(['mi', 'Si', 'Sol', 'Ré', 'La', 'Mi']);
    expect(labels(std, 'en')).toEqual(['e', 'B', 'G', 'D', 'A', 'E']);
    expect(labels(TUNINGS.dropD!, 'en')).toEqual(['e', 'B', 'G', 'D', 'A', 'D']);
    expect(labels(TUNINGS.standard7!, 'fr').length).toBe(7);
  });

  it('annotations : notes, degrés (♭ ♯), intervalles, doigtés', () => {
    const s = chordToScore({ ...v('Em-022000'), fingers: [null, 2, 3, null, null, null] }, { style: 'strum' });
    const texts = (annotation: LayoutOptions['annotation']) =>
      layoutScore(s, { ...wrap, annotation }).columns[0]!.sideAnnotations.map((a) => a.text);
    expect(texts('degree')).toEqual(['1', '5', '1', '♭3', '5', '1']);
    expect(texts('interval')).toEqual(['P1', 'P5', 'P1', 'm3', 'P5', 'P1']);
    expect(texts('note')).toEqual(['Mi', 'Si', 'Mi', 'Sol', 'Si', 'Mi']);
    expect(texts('finger')).toEqual(['2', '3']);
    expect(texts('none')).toEqual([]);
  });

  it('barré : repère à gauche de la pile, couvrant les cordes concernées, et « B1 » en en-tête', () => {
    const f = chordToScore({ ...v('F-133211'), barre: { fret: 1, fromString: 0, toString: 5, finger: 1 } }, { style: 'strum' });
    const l = layoutScore(f, wrap);
    const b = l.columns[0]!.barre!;
    const ys = l.systems[0]!.stringYs;
    expect(b.y0).toBe(ys[0]! - 6);
    expect(b.y1).toBe(ys[5]! + 6);
    expect(b.x).toBeLessThan(l.columns[0]!.pills[0]!.x);
    expect(l.systems[0]!.texts.some((t) => t.text.includes('B1'))).toBe(true);
  });
});

describe('rythme : hampes, ligatures, points, silences, triolets', () => {
  const l = layoutScore(rhythmScore(), { ...scroll, maxWidth: 1000 });
  const sys = l.systems[0]!;
  const rects = sys.rhythm.filter((r) => r.kind === 'rect') as Array<{ x: number; y: number; w: number; h: number }>;
  const col = (mi: number, ei: number): ColumnLayout => l.columns.find((c) => c.measureIndex === mi && c.eventIndex === ei)!;
  const ry = sys.rhythmY;

  it('une hampe (1×9) sous chaque note, alignée sur l\'axe de la pastille', () => {
    for (const c of l.columns.filter((x) => x.kind === 'notes' && x.durTick < 1920)) {
      expect(rects.some((r) => r.x === c.cx && r.y === ry && r.w === 1 && r.h === 9), `m${c.measureIndex} é${c.eventIndex}`).toBe(true);
    }
  });

  it('deux croches : une ligature de la 1re à la 2e hampe ; 4 doubles croches : 2 niveaux', () => {
    const a = col(0, 1), b = col(0, 2);
    expect(rects).toContainEqual({ kind: 'rect', x: a.cx, y: ry + 7, w: b.cx - a.cx + 1, h: 2 });
    const s = [3, 4, 5, 6].map((i) => col(0, i));
    for (const y of [ry + 7, ry + 4]) {
      expect(rects).toContainEqual({ kind: 'rect', x: s[0]!.cx, y, w: s[3]!.cx - s[0]!.cx + 1, h: 2 });
    }
  });

  it('croche + 2 doubles : ligature simple sur 3, seconde ligature seulement sur les 2 doubles', () => {
    const e = col(0, 7), s1 = col(0, 8), s2 = col(0, 9);
    expect(rects).toContainEqual({ kind: 'rect', x: e.cx, y: ry + 7, w: s2.cx - e.cx + 1, h: 2 });
    expect(rects).toContainEqual({ kind: 'rect', x: s1.cx, y: ry + 4, w: s2.cx - s1.cx + 1, h: 2 });
  });

  it('noire pointée : un point ; blanche : anneau ; ronde : pas de hampe ; triolet : « 3 »', () => {
    const dq = col(1, 0);
    expect(rects).toContainEqual({ kind: 'rect', x: dq.cx + 3, y: ry + 9, w: 2, h: 2 });
    const half = col(1, 2);
    expect(rects).toContainEqual({ kind: 'rect', x: half.cx - 1, y: ry + 9, w: 3, h: 1 });
    const whole = col(3, 0);
    expect(rects.some((r) => r.x === whole.cx && r.h === 9)).toBe(false);
    expect(sys.rhythm.some((r) => r.kind === 'text' && r.text === '3')).toBe(true);
  });

  it('silences : un sprite par silence, au bon type', () => {
    const names = sys.rhythm.filter((r) => r.kind === 'sprite').map((r) => (r as { name: string }).name);
    expect(names).toContain('rest-q');
    expect(names).toContain('rest-e');
    expect(names).toContain('rest-s');
    expect(names).toContain('rest-h');
  });

  it('crochet isolé (voisine en silence) : fanion, pas de ligature', () => {
    // mesure 3 : ... noire, demi-soupir…, la double croche finale est précédée d'un silence de double croche
    const last = col(2, 7);
    expect(rects.some((r) => r.x === last.cx + 1 && r.w === 4)).toBe(true);
  });
});

describe('curseur', () => {
  const s = scaleToScore('dorian', 'D', std, { direction: 'updown' });

  it('sur le début d\'un événement : exactement l\'axe de sa colonne', () => {
    for (const opts of [scroll, wrap]) {
      const l = layoutScore(s, opts);
      for (const c of l.columns) {
        const cur = cursorAt(l, c.absTick);
        expect(cur.x).toBe(c.cx);
        expect(cur.systemIndex).toBe(c.systemIndex);
        expect(cur.columnIndex).toBe(c.index);
      }
    }
  });

  it('monotone croissant en x dans une ligne sur tout le morceau (pas de 1/10 de croche)', () => {
    for (const opts of [scroll, wrap]) {
      const l = layoutScore(s, opts);
      let prev = -1;
      let prevSys = 0;
      for (let t = 0; t <= totalTicks(s); t += 24) {
        const cur = cursorAt(l, t);
        if (cur.systemIndex === prevSys) expect(cur.x).toBeGreaterThanOrEqual(prev);
        else expect(cur.systemIndex).toBeGreaterThan(prevSys);
        prev = cur.x;
        prevSys = cur.systemIndex;
      }
    }
  });

  it('interpolation linéaire entre deux événements et jusqu\'à la barre de fin', () => {
    const l = layoutScore(s, scroll);
    const [a, b] = [l.columns[0]!, l.columns[1]!];
    const mid = cursorAt(l, (a.absTick + b.absTick) / 2);
    expect(mid.x).toBeCloseTo((a.cx + b.cx) / 2, 9);
    const m0 = l.measures[0]!;
    const lastCol = l.columns[m0.lastColumn]!;
    const nearEnd = cursorAt(l, m0.tickEnd - 1);
    expect(nearEnd.x).toBeGreaterThan(lastCol.cx);
    expect(nearEnd.x).toBeLessThan(m0.endX);
  });

  it('hors bornes : première et dernière positions ; changement de ligne au bon tick', () => {
    const l = layoutScore(s, wrap);
    expect(cursorAt(l, -100).columnIndex).toBe(0);
    expect(cursorAt(l, 1e9).columnIndex).toBe(l.columns.length - 1);
    const starts = measureStarts(s);
    // premier tick de chaque mesure : la ligne qui contient cette mesure
    l.systems.forEach((sys) => sys.measures.forEach((m) => expect(cursorAt(l, starts[m.index]!).systemIndex).toBe(sys.index)));
  });

  it('indépendant de l\'unité de temps : tempo ≠ géométrie (mêmes x à 60 et 120 BPM)', () => {
    const a = layoutScore({ ...s, tempo: 60 }, scroll);
    const b = layoutScore({ ...s, tempo: 120 }, scroll);
    expect(a.columns.map((c) => c.cx)).toEqual(b.columns.map((c) => c.cx));
    expect(PPQ).toBe(480);
  });

  it('silences et mesures finales : le curseur traverse les silences', () => {
    const l = layoutScore(rhythmScore(), scroll);
    const c = l.columns.find((x) => x.kind === 'rest')!;
    expect(cursorAt(l, c.absTick).x).toBe(c.cx);
  });
});

describe('arpège et accords : mise en page des types de score restants', () => {
  it('arpège : une note par colonne, pas de flèche, pas de pile', () => {
    const pos = generatePositions('pentatonic-minor', 'A', std, 'boxes')[0]!;
    const l = layoutScore(arpeggioToScore(pos, 'Am7', std), wrap);
    for (const c of l.columns.filter((x) => x.kind === 'notes')) {
      expect(c.pills.length).toBe(1);
      expect(c.arrow).toBeUndefined();
    }
    expect(l.rows.arrowsY).toBeNull();
  });
});
