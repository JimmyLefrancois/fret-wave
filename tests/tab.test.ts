import { describe, expect, it } from 'vitest';
import {
  CHORD_QUALITIES, SCALES, TUNINGS, getScale, generatePositions, instantiateShape, interpretChord,
  tonicSpellings, voicingMidis, voicingNotes, pitchClassOf,
} from '../src/core/theory';
import { MOBILE_SHAPES, VOICINGS } from '../src/data/voicings';
import {
  PPQ, STRUM_PATTERNS, arpeggioToScore, beamCount, chordToScore, defaultChordForScale, measureLength, measureStarts,
  noteValue, parseFn, positionToScore, progressionToScore, scaleToScore, totalTicks, validateScore,
  type TabScore,
} from '../src/core/tab';

const std = TUNINGS.standard!;
const clone = <T,>(x: T): T => structuredClone(x);

function allNotes(score: TabScore) {
  return score.measures.flatMap((m) => m.events.flatMap((e) => e.notes));
}

describe('valeurs de notes', () => {
  it('durées usuelles', () => {
    expect(noteValue(1920)).toEqual({ base: 'w', dots: 0 });
    expect(noteValue(480)).toEqual({ base: 'q', dots: 0 });
    expect(noteValue(240)).toEqual({ base: 'e', dots: 0 });
    expect(noteValue(120)).toEqual({ base: 's', dots: 0 });
    expect(noteValue(720)).toEqual({ base: 'q', dots: 1 });
    expect(noteValue(360)).toEqual({ base: 'e', dots: 1 });
    expect(noteValue(1440)).toEqual({ base: 'h', dots: 1 });
  });
  it('triolet de croches = 160 ticks (entier : pas de flottants)', () => {
    expect(noteValue(160, { actual: 3, normal: 2 })).toEqual({ base: 'e', dots: 0, tuplet: { actual: 3, normal: 2 } });
    expect(noteValue(160)).toBeNull();
    expect(Number.isInteger(PPQ / 3)).toBe(true);
  });
  it('durées non notables refusées', () => {
    expect(noteValue(100)).toBeNull();
    expect(noteValue(300)).toBeNull();
  });
  it('crochets', () => {
    expect(beamCount('q')).toBe(0);
    expect(beamCount('e')).toBe(1);
    expect(beamCount('s')).toBe(2);
  });
  it('fonctions d\'intervalle', () => {
    expect(parseFn('b3')).toEqual({ alt: -1, num: 3, family: 3 });
    expect(parseFn('#11')).toEqual({ alt: 1, num: 11, family: 4 });
    expect(parseFn('bb7')).toEqual({ alt: -2, num: 7, family: 7 });
    expect(parseFn('9')?.family).toBe(2);
    expect(parseFn('x')).toBeNull();
    expect(parseFn('14')).toBeNull();
  });
});

describe('validateScore : invariants', () => {
  const base = () => scaleToScore('pentatonic-minor', 'A', std, { direction: 'up' });

  it('un score généré est valide', () => {
    expect(validateScore(base())).toEqual([]);
  });

  it('détecte une durée de mesure fausse', () => {
    const s = clone(base());
    s.measures[0]!.events.pop();
    expect(validateScore(s).some((e) => e.includes('≠') && e.includes('signature'))).toBe(true);
  });

  it('détecte une hauteur incohérente avec accordage + case', () => {
    const s = clone(base());
    s.measures[0]!.events[0]!.notes[0]!.midi += 1;
    expect(validateScore(s).some((e) => e.includes('accordage + case'))).toBe(true);
  });

  it('détecte un nom de note incohérent, une case 25, une corde hors plage, deux notes sur une corde', () => {
    let s = clone(base());
    s.measures[0]!.events[0]!.notes[0]!.note = 'C#';
    expect(validateScore(s).some((e) => e.includes('incohérent'))).toBe(true);
    s = clone(base());
    s.measures[0]!.events[0]!.notes[0]!.fret = 25;
    expect(validateScore(s).some((e) => e.includes('hors 0…24'))).toBe(true);
    s = clone(base());
    s.measures[0]!.events[0]!.notes[0]!.string = 9;
    expect(validateScore(s).some((e) => e.includes('hors de'))).toBe(true);
    s = clone(base());
    const e0 = s.measures[0]!.events[0]!;
    e0.notes.push({ ...e0.notes[0]! });
    expect(validateScore(s).some((e) => e.includes('deux notes'))).toBe(true);
  });

  it('détecte un trou entre événements, un tick non entier, un nombre de cordes erroné, un silence avec notes', () => {
    let s = clone(base());
    s.measures[0]!.events[1]!.startTick += 10;
    expect(validateScore(s).some((e) => e.includes('trou ou chevauchement'))).toBe(true);
    s = clone(base());
    s.measures[0]!.events[0]!.durTick = 240.5;
    expect(validateScore(s).some((e) => e.includes('non entiers'))).toBe(true);
    s = clone(base());
    s.stringCount = 7;
    expect(validateScore(s).some((e) => e.includes('stringCount'))).toBe(true);
    s = clone(base());
    const last = s.measures[s.measures.length - 1]!.events.at(-1)!;
    last.kind = 'rest';
    last.notes = [clone(allNotes(base())[0]!)];
    expect(validateScore(s).some((e) => e.includes('silence'))).toBe(true);
  });
});

describe('générateurs gamme / position', () => {
  it('scaleToScore valide pour toute gamme × 12 toniques × tous accordages (6 à 8 cordes)', () => {
    const errors: string[] = [];
    for (const def of SCALES) {
      for (let pc = 0; pc < 12; pc++) {
        const tonic = tonicSpellings(def, pc)[0]!;
        for (const tuning of Object.values(TUNINGS)) {
          for (const direction of ['up', 'updown'] as const) {
            try {
              const s = scaleToScore(def.id, tonic, tuning, { direction });
              errors.push(...validateScore(s));
              if (s.stringCount !== tuning.strings.length) errors.push('stringCount');
            } catch (e) {
              errors.push(`${def.id} ${tonic} ${tuning.id} : ${(e as Error).message}`);
            }
          }
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it('montée, descente, aller-retour : mêmes notes dans l\'ordre attendu, sommet non répété', () => {
    const pos = generatePositions('pentatonic-minor', 'A', std, 'boxes')[0]!;
    const up = allNotes(positionToScore(pos, std, { direction: 'up' }));
    const down = allNotes(positionToScore(pos, std, { direction: 'down' }));
    const both = allNotes(positionToScore(pos, std, { direction: 'updown' }));
    expect(up.length).toBe(12);
    expect(down.map((n) => n.midi)).toEqual(up.map((n) => n.midi).reverse());
    expect(both.length).toBe(23);
    expect(both.map((n) => n.midi)).toEqual([...up.map((n) => n.midi), ...down.map((n) => n.midi).slice(1)]);
    // la box 1 de La mineur écrite corde par corde : 5 8 | 5 7 | 5 7 | 5 7 | 5 8 | 5 8
    expect(up.map((n) => n.fret)).toEqual([5, 8, 5, 7, 5, 7, 5, 7, 5, 8, 5, 8]);
  });

  it('degrés de la box 1 de La mineur pentatonique', () => {
    const pos = generatePositions('pentatonic-minor', 'A', std, 'boxes')[0]!;
    const up = allNotes(positionToScore(pos, std));
    expect(up.map((n) => n.note)).toEqual(['A', 'C', 'D', 'E', 'G', 'A', 'C', 'D', 'E', 'G', 'A', 'C']);
    expect(up.map((n) => n.fn)).toEqual(['1', 'b3', '4', '5', 'b7', '1', 'b3', '4', '5', 'b7', '1', 'b3']);
  });

  it('remplit la dernière mesure avec des silences alignés (7 croches = 1 mesure + 1 silence)', () => {
    const pos = generatePositions('pentatonic-minor', 'A', std, 'boxes')[0]!;
    const s = positionToScore({ ...pos, notes: pos.notes.slice(0, 7) }, std);
    expect(s.measures.length).toBe(1);
    expect(s.measures[0]!.events.length).toBe(8);
    expect(s.measures[0]!.events[7]).toMatchObject({ kind: 'rest', durTick: 240, startTick: 1680 });
    expect(validateScore(s)).toEqual([]);
  });

  it('3 notes sur la mesure 3 : silences de remplissage = 1 noire + 1 blanche, alignés sur les temps', () => {
    const pos = generatePositions('pentatonic-minor', 'A', std, 'boxes')[0]!;
    // 8 + 8 + 2 croches
    const s = positionToScore({ ...pos, notes: [...pos.notes, ...pos.notes, ...pos.notes].slice(0, 18) }, std, { direction: 'up' });
    expect(s.measures.length).toBe(3);
    const last = s.measures[2]!.events;
    expect(last.map((e) => [e.startTick, e.durTick, e.kind])).toEqual([
      [0, 240, 'notes'], [240, 240, 'notes'], [480, 480, 'rest'], [960, 960, 'rest'],
    ]);
  });

  it('mesure à 6/8 : 6 croches par mesure', () => {
    const pos = generatePositions('ionian', 'C', std, '3nps')[0]!;
    const s = positionToScore(pos, std, { timeSig: [6, 8] });
    expect(validateScore(s)).toEqual([]);
    expect(measureLength(s, 0)).toBe(1440);
    expect(s.measures[0]!.events.length).toBe(6);
  });

  it('notes caractéristiques marquées (dorien : 6 ; locrien : ♭2 et ♭5 ; blues mineur : ♭5)', () => {
    const flagged = (id: string, tonic: string, sys?: 'boxes' | '3nps') => {
      const s = scaleToScore(id, tonic, std, { system: sys });
      return new Set(allNotes(s).filter((n) => n.characteristic).map((n) => n.fn));
    };
    expect(flagged('dorian', 'D')).toEqual(new Set(['6']));
    expect(flagged('locrian', 'B')).toEqual(new Set(['b2', 'b5']));
    expect(flagged('blues-minor', 'A')).toEqual(new Set(['b5']));
    expect(flagged('ionian', 'C').size).toBe(0);
  });

  it('étiquette de position et accord au-dessus de la première mesure', () => {
    const s = scaleToScore('pentatonic-minor', 'A', std);
    expect(s.measures[0]!.label).toEqual({ chord: 'Am7', text: 'cases 5–8' });
    expect(s.measures[1]?.label).toBeUndefined();
    expect(s.meta).toMatchObject({ scaleId: 'pentatonic-minor', tonic: 'A', system: 'boxes' });
  });

  it('accord dérivé de la gamme', () => {
    const cases: Array<[string, string, string | null]> = [
      ['ionian', 'C', 'Cmaj7'], ['dorian', 'D', 'Dm7'], ['mixolydian', 'G', 'G7'], ['locrian', 'B', 'Bm7b5'],
      ['aeolian', 'A', 'Am7'], ['pentatonic-minor', 'A', 'Am7'], ['pentatonic-major', 'C', 'C'],
      ['blues-minor', 'E', 'Em7'], ['harmonic-minor', 'A', 'Am'], ['diminished-wh', 'C', 'Cdim7'], ['whole-tone', 'C', null],
    ];
    for (const [id, tonic, chord] of cases) expect(defaultChordForScale(id, tonic), id).toBe(chord);
  });

  it('cases = les notes de la position (corde, case) sans perte', () => {
    for (const id of ['ionian', 'dorian', 'harmonic-minor']) {
      for (const direction of ['up', 'down'] as const) {
        const pos = generatePositions(id, 'D', std, '3nps')[3]!;
        const s = positionToScore(pos, std, { direction });
        const got = allNotes(s).map((n) => `${n.string}:${n.fret}`).sort();
        expect(got).toEqual(pos.notes.map((n) => `${n.string}:${n.fret}`).sort());
      }
    }
  });
});

describe('arpège', () => {
  it('Am7 dans la box 1 de La m pent : seulement 1 ♭3 5 ♭7, fonctions relatives à l\'accord', () => {
    const pos = generatePositions('pentatonic-minor', 'A', std, 'boxes')[0]!;
    const s = arpeggioToScore(pos, 'Am7', std);
    expect(validateScore(s)).toEqual([]);
    const ns = allNotes(s);
    expect(new Set(ns.map((n) => n.fn))).toEqual(new Set(['1', 'b3', '5', 'b7']));
    for (const n of ns) expect(['A', 'C', 'E', 'G']).toContain(n.note);
    expect(s.measures[0]!.label?.chord).toBe('Am7');
  });

  it('la fonction est celle de l\'accord, pas de la gamme (Cmaj7 dans La mineur naturelle : 3 → 5 → 7)', () => {
    const pos = generatePositions('aeolian', 'A', std, '3nps')[0]!;
    const s = arpeggioToScore(pos, 'Cmaj7', std);
    expect(validateScore(s)).toEqual([]);
    expect(new Set(allNotes(s).map((n) => n.fn))).toEqual(new Set(['1', '3', '5', '7']));
  });

  it('refuse un accord absent de la position', () => {
    const pos = generatePositions('pentatonic-minor', 'A', std, 'boxes')[0]!;
    expect(() => arpeggioToScore(pos, 'Bb', std)).toThrow();
  });

  it('7 cordes et Drop D : arpège valide', () => {
    for (const tuning of [TUNINGS.standard7!, TUNINGS.dropD!, TUNINGS.dadgad!]) {
      const pos = generatePositions('pentatonic-minor', 'A', tuning, 'boxes')[0]!;
      const s = arpeggioToScore(pos, 'Am7', tuning, { direction: 'updown' });
      expect(validateScore(s)).toEqual([]);
      expect(s.stringCount).toBe(tuning.strings.length);
    }
  });
});

describe('accords : plaqué et arpégé depuis le voicing', () => {
  it('chaque voicing curé : score valide, notes = voicing (cordes, cases, hauteurs, noms), X sur les cordes non jouées', () => {
    const errors: string[] = [];
    for (const v of VOICINGS) {
      const s = chordToScore(v, { style: 'both' });
      errors.push(...validateScore(s));
      const strum = s.measures[0]!.events[0]!;
      const expectedFrets = v.frets.flatMap((f, i) => (f === null ? [] : [`${i}:${f}`]));
      if (strum.notes.map((n) => `${n.string}:${n.fret}`).join() !== expectedFrets.join()) errors.push(`${v.id} : cases`);
      if (strum.notes.map((n) => n.midi).join() !== voicingMidis(v).join()) errors.push(`${v.id} : hauteurs`);
      if (strum.notes.map((n) => n.note).join() !== voicingNotes(v).join()) errors.push(`${v.id} : noms`);
      const unplayed = v.frets.flatMap((f, i) => (f === null ? [i] : []));
      if ((strum.unplayed ?? []).join() !== unplayed.join()) errors.push(`${v.id} : cordes non jouées`);
      if (strum.chord !== v.chord) errors.push(`${v.id} : nom d'accord`);
    }
    expect(errors).toEqual([]);
  });

  it('l\'arpège joue exactement les mêmes notes que la pile, de la grave à l\'aiguë', () => {
    for (const v of VOICINGS) {
      const s = chordToScore(v, { style: 'both' });
      const strumNotes = s.measures[0]!.events[0]!.notes;
      const arpMeasure = s.measures[1]!;
      const arp = arpMeasure.events.filter((e) => e.kind === 'notes').map((e) => e.notes[0]!);
      expect(arp.map((n) => n.string), v.id).toEqual(strumNotes.map((n) => n.string));
      expect(arp.map((n) => n.string), v.id).toEqual([...arp.map((n) => n.string)].sort((a, b) => a - b));
      expect(arp.map((n) => n.midi), v.id).toEqual(strumNotes.map((n) => n.midi));
    }
  });

  it('fonctions : Em = 1 5 1 3 5 1 ; G/B contient la tierce à la basse', () => {
    const em = VOICINGS.find((v) => v.id === 'Em-022000')!;
    expect(chordToScore(em, { style: 'strum' }).measures[0]!.events[0]!.notes.map((n) => n.fn)).toEqual(['1', '5', '1', 'b3', '5', '1']);
    const gb = VOICINGS.find((v) => v.chord === 'G/B')!;
    const first = chordToScore(gb, { style: 'strum' }).measures[0]!.events[0]!.notes[0]!;
    expect(first.note).toBe('B');
    expect(first.fn).toBe('3');
  });

  it('formes mobiles (barrés) : 10 formes × 13 fondamentales, scores valides, barré transmis quand il existe', () => {
    const errors: string[] = [];
    let n = 0;
    for (const shape of MOBILE_SHAPES) {
      for (const root of ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']) {
        const v = instantiateShape(shape, root);
        errors.push(...validateScore(chordToScore(v)));
        n++;
      }
    }
    expect(n).toBe(120);
    expect(errors).toEqual([]);
  });

  it('barré : transmis aux événements de la pile', () => {
    const v = { ...VOICINGS.find((x) => x.id === 'F-133211')!, barre: { fret: 1, fromString: 0, toString: 5, finger: 1 as const } };
    const s = chordToScore(v, { style: 'strum' });
    for (const e of s.measures[0]!.events) expect(e.barre).toEqual({ fret: 1, fromString: 0, toString: 5, finger: 1 });
  });

  it('motifs de strum : durent exactement une mesure 4/4 et alternent ↓↑ comme décrit', () => {
    for (const [id, hits] of Object.entries(STRUM_PATTERNS)) {
      expect(hits.reduce((s, [, u]) => s + u, 0), id).toBe(8);
    }
    const em = VOICINGS.find((v) => v.id === 'Em-022000')!;
    const s = chordToScore(em, { style: 'strum', pattern: 'universal' });
    expect(s.measures.length).toBe(1);
    expect(s.measures[0]!.events.map((e) => [e.strum!.dir, e.durTick / 240])).toEqual([
      ['D', 2], ['D', 1], ['U', 2], ['U', 1], ['D', 1], ['U', 1],
    ]);
    expect(validateScore(s)).toEqual([]);
  });

  it('style both : plaqué (1 mesure) puis arpégé (mesure suivante), étiquettes « plaqué » / « arpégé »', () => {
    const em = VOICINGS.find((v) => v.id === 'Em-022000')!;
    const s = chordToScore(em);
    expect(s.measures.map((m) => m.label?.text)).toEqual(['plaqué', 'arpégé']);
    expect(s.measures[1]!.events.map((e) => e.kind)).toEqual(['notes', 'notes', 'notes', 'notes', 'notes', 'notes', 'rest']);
    expect(s.measures[1]!.events.at(-1)).toMatchObject({ kind: 'rest', startTick: 1440, durTick: 480 });
  });
});

describe('progression', () => {
  const byId = (id: string) => VOICINGS.find((v) => v.id === id)!;
  it('une mesure par accord, noms et chiffrage romain, durées exactes', () => {
    const vs = [byId('G-320003'), byId('D-xx0232'), byId('Em-022000'), byId('C-x32010')];
    const s = progressionToScore(vs, { pattern: 'universal', romans: ['I', 'V', 'vi', 'IV'], tempo: 90 });
    expect(validateScore(s)).toEqual([]);
    expect(s.measures.length).toBe(4);
    expect(s.measures.map((m) => m.label?.chord)).toEqual(['G', 'D', 'Em', 'C']);
    expect(s.measures.map((m) => m.label?.roman)).toEqual(['I', 'V', 'vi', 'IV']);
    expect(totalTicks(s)).toBe(4 * 1920);
    expect(measureStarts(s)).toEqual([0, 1920, 3840, 5760]);
    expect(s.tempo).toBe(90);
  });
  it('refuse une progression vide ou à accordages mélangés', () => {
    expect(() => progressionToScore([])).toThrow();
  });
});

describe('cohérence avec la théorie', () => {
  it('toutes les qualités d\'accord de la liste ont une formule dont l\'orthographe tient dans une fonction valide', () => {
    for (const q of CHORD_QUALITIES) {
      const info = interpretChord(`C${q.suffix}`);
      info.degrees.forEach((d) => expect(parseFn(d), `${q.id} ${d}`).not.toBeNull());
    }
  });
  it('pitch classes des notes de gamme = gamme', () => {
    const def = getScale('lydian');
    const s = scaleToScore('lydian', 'F', std, { direction: 'up' });
    const pcs = new Set(allNotes(s).map((n) => pitchClassOf(n.note)));
    expect(pcs.size).toBe(def.intervals.length);
  });
});
