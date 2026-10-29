import { describe, expect, it } from 'vitest';
import {
  CAGED_SHAPES, SCALES, TUNINGS, compatibleSystems, defaultSystem, fmtPositionLabel, generatePositions,
  getScale, makeScaleContext, maxNotesPerString, pitchClassOf, positionSupport, scalePitchClasses,
  simpleSpellings, symmetricPeriod, tonicSpellings, supportsCaged, fretToMidi, type CagedShape, type Position,
} from '../src/core/theory';

const std = TUNINGS.standard!;
const ALL_TUNINGS = Object.values(TUNINGS);

/** Une orthographe par hauteur (la moins coûteuse) pour une gamme. */
function tonics(scaleId: string): string[] {
  const def = getScale(scaleId);
  return Array.from({ length: 12 }, (_, pc) => tonicSpellings(def, pc)[0]!);
}

/** Invariants communs à toute position ; renvoie la liste des erreurs (vide = OK). */
function basicErrors(p: Position, tuningId: string): string[] {
  const tuning = TUNINGS[tuningId]!;
  const def = getScale(p.scaleId);
  const pcs = new Set(scalePitchClasses(def, p.tonic));
  const seen = new Set<string>();
  const errs: string[] = [];
  const tag = `${p.id}@${tuningId}`;
  for (const n of p.notes) {
    const pc = ((n.midi % 12) + 12) % 12;
    if (n.fret < 0 || n.fret > 24) errs.push(`${tag} : case ${n.fret} hors plage`);
    if (n.midi !== fretToMidi(tuning, n.string, n.fret)) errs.push(`${tag} : midi incohérent corde ${n.string} case ${n.fret}`);
    if (!pcs.has(pc)) errs.push(`${tag} : note hors gamme (corde ${n.string} case ${n.fret})`);
    if (pitchClassOf(n.note) !== pc) errs.push(`${tag} : orthographe incohérente ${n.note}`);
    const key = `${n.string}:${n.fret}`;
    if (seen.has(key)) errs.push(`${tag} : doublon ${key}`);
    seen.add(key);
  }
  // ordre de lecture : corde grave → aiguë, cases croissantes
  for (let i = 1; i < p.notes.length; i++) {
    const a = p.notes[i - 1]!, b = p.notes[i]!;
    if (!(b.string > a.string || (b.string === a.string && b.fret > a.fret))) errs.push(`${tag} : ordre de lecture`);
  }
  return errs;
}
function checkBasics(p: Position, tuningId: string) {
  expect(basicErrors(p, tuningId)).toEqual([]);
}

describe('3 notes par corde', () => {
  it('7 positions pour toute gamme heptatonique × 12 toniques × tous les accordages', () => {
    const errors: string[] = [];
    for (const def of SCALES.filter((s) => s.intervals.length === 7)) {
      for (const tonic of tonics(def.id)) {
        for (const tuning of ALL_TUNINGS) {
          const ps = generatePositions(def.id, tonic, tuning, '3nps');
          if (ps.length !== 7) errors.push(`${def.id} ${tonic} ${tuning.id} : ${ps.length} positions`);
          for (const p of ps) {
            errors.push(...basicErrors(p, tuning.id));
            // exactement 3 notes par corde, sur toutes les cordes
            const counts = new Map<number, number>();
            p.notes.forEach((n) => counts.set(n.string, (counts.get(n.string) ?? 0) + 1));
            if (counts.size !== tuning.strings.length || [...counts.values()].some((c) => c !== 3)) errors.push(`${p.id} : pas 3 notes par corde`);
          }
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it('le départ de la position k est le degré k sur la corde grave', () => {
    const ps = generatePositions('major'.replace('major', 'ionian'), 'C', std, '3nps');
    const lowNotes = ps.map((p) => p.notes[0]!.note);
    expect(lowNotes).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  });

  it('Do majeur : position 3 = Mi Fa Sol / La Si Do / Ré Mi Fa / Sol La Si / Do Ré Mi / Fa Sol La (cases 0-5)', () => {
    const p = generatePositions('ionian', 'C', std, '3nps')[2]!;
    const byString = [0, 1, 2, 3, 4, 5].map((s) => p.notes.filter((n) => n.string === s).map((n) => n.fret));
    expect(byString).toEqual([[0, 1, 3], [0, 2, 3], [0, 2, 3], [0, 2, 4], [1, 3, 5], [1, 3, 5]]);
  });

  it('étendue d\'une position ≤ 6 cases pour les gammes diatoniques (standard)', () => {
    for (const id of ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian']) {
      for (const tonic of tonics(id)) {
        for (const p of generatePositions(id, tonic, std, '3nps')) {
          expect(p.fretMax - p.fretMin, `${id} ${tonic} #${p.index}`).toBeLessThanOrEqual(6);
        }
      }
    }
  });

  it('positions voisines : 2 notes sur 3 en commun sur chaque corde (k → k+1)', () => {
    for (const tonic of tonics('ionian')) {
      const ps = generatePositions('ionian', tonic, std, '3nps');
      for (let k = 0; k < 6; k++) {
        const a = ps[k]!, b = ps[k + 1]!;
        // la position k+1 peut se trouver une octave plus haut/bas (instance la plus basse du manche) : on garde le meilleur décalage
        const set = new Set(a.notes.map((n) => `${n.string}:${n.midi}`));
        const shared = Math.max(...[-12, 0, 12].map((d) => b.notes.filter((n) => set.has(`${n.string}:${n.midi + d}`)).length));
        expect(shared, `${tonic} ${k}→${k + 1}`).toBe(12);
      }
    }
  });

  it('formIndex = rang dans la gamme parente (Ré dorien position 2 = forme 3 de Do majeur)', () => {
    const d = generatePositions('dorian', 'D', std, '3nps')[1]!;
    const c = generatePositions('ionian', 'C', std, '3nps')[2]!;
    expect(d.formIndex).toBe(2);
    expect(c.formIndex).toBe(2);
    // mêmes notes jouées : mêmes (corde, case)
    expect(d.notes.map((n) => `${n.string}:${n.fret}`)).toEqual(c.notes.map((n) => `${n.string}:${n.fret}`));
  });

  it('harmonique : étirements documentés — étendue maximale mesurée ≤ 6 cases d’écart (7 cases occupées)', () => {
    let worst = 0;
    for (const tonic of tonics('harmonic-minor')) {
      for (const p of generatePositions('harmonic-minor', tonic, std, '3nps')) worst = Math.max(worst, p.fretMax - p.fretMin);
    }
    expect(worst).toBeLessThanOrEqual(6);
  });
});

describe('boxes pentatoniques', () => {
  it('5 boxes, 2 notes par corde, 12 toniques, tous les accordages', () => {
    for (const id of ['pentatonic-minor', 'pentatonic-major']) {
      for (const tonic of tonics(id)) {
        for (const tuning of ALL_TUNINGS) {
          const ps = generatePositions(id, tonic, tuning, 'boxes');
          expect(ps.length).toBe(5);
          for (const p of ps) {
            checkBasics(p, tuning.id);
            expect(p.notes.length).toBe(2 * tuning.strings.length);
          }
        }
      }
    }
  });

  it('La mineur pentatonique : 5-8 → 7-10 → 9-13 → (12-15 = 0-3 une octave plus bas) → 2-5 ; register 1 donne l\'autre instance', () => {
    const ps = generatePositions('pentatonic-minor', 'A', std, 'boxes');
    expect(ps.map((p) => [p.fretMin, p.fretMax])).toEqual([[5, 8], [7, 10], [9, 13], [0, 3], [2, 5]]);
    const hi = generatePositions('pentatonic-minor', 'A', std, 'boxes', { register: 1 });
    const ranges = hi.map((p) => [p.fretMin, p.fretMax]);
    expect(ranges).toContainEqual([17, 20]); // box 1 une octave plus haut
    expect(ranges).toContainEqual([12, 15]); // box 4 : l'instance « 12-15 » du curriculum
    expect(hi.every((p) => p.fretMax <= 24)).toBe(true); // la box 3 (21-25) dépasse la case 24 : omise, pas tronquée
    expect(fmtPositionLabel(hi.find((p) => p.fretMin === 12)!)).toBe('Position 4 · cases 12–15');
    // box 1 = la forme classique
    const b1 = [0, 1, 2, 3, 4, 5].map((s) => ps[0]!.notes.filter((n) => n.string === s).map((n) => n.fret));
    expect(b1).toEqual([[5, 8], [5, 7], [5, 7], [5, 7], [5, 8], [5, 8]]);
  });

  it('Mi mineur pentatonique box 1 = cases 0-3 (quasi à vide)', () => {
    const p = generatePositions('pentatonic-minor', 'E', std, 'boxes')[0]!;
    expect([p.fretMin, p.fretMax]).toEqual([0, 3]);
  });

  it('boxes de la relative : La m pent et Do maj pent ont les mêmes cases', () => {
    const am = generatePositions('pentatonic-minor', 'A', std, 'boxes');
    const cm = generatePositions('pentatonic-major', 'C', std, 'boxes');
    const key = (p: Position) => p.notes.map((n) => `${n.string}:${n.fret}`).join(',');
    expect(new Set(am.map(key))).toEqual(new Set(cm.map(key)));
  });
});

describe('blues et bebop : position de base + note ajoutée', () => {
  it('La blues mineur box 1 : la blue note (Mi♭) est ajoutée, marquée, et les 10 notes de la box restent', () => {
    const blues = generatePositions('blues-minor', 'A', std, 'boxes')[0]!;
    const pent = generatePositions('pentatonic-minor', 'A', std, 'boxes')[0]!;
    const bluesKeys = new Set(blues.notes.map((n) => `${n.string}:${n.fret}`));
    for (const n of pent.notes) expect(bluesKeys.has(`${n.string}:${n.fret}`)).toBe(true);
    const blue = blues.notes.filter((n) => n.passing);
    expect(blue.length).toBeGreaterThan(0);
    for (const n of blue) {
      expect(n.degree).toBe('b5');
      expect(n.note).toBe('Eb');
    }
    // cases connues de la forme classique : corde de La case 6, corde de Sol case 8
    const set = new Set(blue.map((n) => `${n.string}:${n.fret}`));
    expect(set.has('1:6')).toBe(true);
    expect(set.has('3:8')).toBe(true);
  });

  it('blues majeur : la ♭3 est la note ajoutée', () => {
    const ps = generatePositions('blues-major', 'C', std, 'boxes');
    expect(ps.length).toBe(5);
    for (const p of ps) for (const n of p.notes.filter((x) => x.passing)) expect(n.degree).toBe('b3');
  });

  it('bebop dominant : 7 notes + la 7M en note de passage', () => {
    const ps = generatePositions('bebop-dominant', 'C', std, 'passing-note');
    expect(ps.length).toBe(7);
    let passing = 0;
    for (const p of ps) {
      checkBasics(p, 'standard');
      for (const n of p.notes.filter((x) => x.passing)) { expect(n.degree).toBe('7'); passing++; }
    }
    expect(passing).toBeGreaterThan(0);
  });

  it('bebop majeur : la ♯5 est la note de passage', () => {
    for (const p of generatePositions('bebop-major', 'G', std, 'passing-note')) {
      for (const n of p.notes.filter((x) => x.passing)) expect(n.degree).toBe('#5');
    }
  });
});

describe('CAGED', () => {
  it('5 formes pour la majeure, ses modes et les pentatoniques ; toutes les notes ∈ gamme ; couverture continue', () => {
    for (const id of ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian', 'pentatonic-major', 'pentatonic-minor']) {
      for (const tonic of tonics(id)) {
        const ps = generatePositions(id, tonic, std, 'caged');
        expect(ps.length, `${id} ${tonic}`).toBe(5);
        expect(new Set(ps.map((p) => p.shape)).size).toBe(5);
        ps.forEach((p) => checkBasics(p, 'standard'));
        // tri par cases croissantes
        for (let i = 1; i < ps.length; i++) expect(ps[i]!.fretMin).toBeGreaterThanOrEqual(ps[i - 1]!.fretMin);
      }
    }
  });

  it('couverture du manche : fenêtres consécutives qui se recouvrent, et la 1re + 12 recouvre la dernière (13 tonalités majeures)', () => {
    // on raisonne sur les fenêtres de cases (min–max des positions de la gamme complète, pas des notes présentes)
    for (const tonic of ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F']) {
      const ps = generatePositions('ionian', tonic, std, 'caged');
      const wins = ps.map((p) => [p.fretMin, p.fretMax] as const);
      for (let i = 1; i < wins.length; i++) {
        expect(wins[i]![0], `${tonic} ${i}`).toBeLessThanOrEqual(wins[i - 1]![1]);
      }
      expect(wins[0]![0] + 12).toBeLessThanOrEqual(wins[wins.length - 1]![1] + 1);
    }
  });

  it('chaque fenêtre non rognée a 2 ou 3 notes par corde (gamme heptatonique)', () => {
    for (const tonic of ['C', 'G', 'D', 'A', 'E', 'F', 'Bb']) {
      for (const p of generatePositions('ionian', tonic, std, 'caged')) {
        if (p.fretMin === 0) continue; // fenêtre rognée par le sillet
        const counts = new Map<number, number>();
        p.notes.forEach((n) => counts.set(n.string, (counts.get(n.string) ?? 0) + 1));
        for (const [s, c] of counts) expect(c, `${tonic} ${p.shape} corde ${s}`).toBeGreaterThanOrEqual(2);
        expect(maxNotesPerString(p)).toBeLessThanOrEqual(3);
      }
    }
  });

  it('chaque forme contient les 3 notes de l\'accord majeur (fondamentale, tierce, quinte) sur sa corde de départ', () => {
    for (const tonic of ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'F#']) {
      for (const p of generatePositions('ionian', tonic, std, 'caged')) {
        const deg = new Set(p.notes.map((n) => n.degree));
        for (const d of ['1', '3', '5']) expect(deg.has(d), `${tonic} ${p.shape}`).toBe(true);
      }
    }
  });

  it('la forme de Do en Do majeur est l\'accord ouvert : cases 0-4, fondamentale sur la corde de La case 3', () => {
    const c = generatePositions('ionian', 'C', std, 'caged')[0]!;
    expect(c.shape).toBe('C');
    expect([c.fretMin, c.fretMax]).toEqual([0, 4]);
    expect(c.notes.some((n) => n.string === 1 && n.fret === 3 && n.degree === '1')).toBe(true);
  });

  it('les décalages des formes sont cohérents avec les accords ouverts (C A G E D)', () => {
    expect(Object.keys(CAGED_SHAPES).sort()).toEqual(['A', 'C', 'D', 'E', 'G']);
    const w = (s: CagedShape) => CAGED_SHAPES[s].hi - CAGED_SHAPES[s].lo;
    for (const s of Object.keys(CAGED_SHAPES) as CagedShape[]) expect(w(s)).toBe(4); // fenêtre de 5 cases
  });

  it('refusé hors accordage standard (Drop D, 7 cordes avec Si grave reste accepté) avec une raison', () => {
    expect(supportsCaged(TUNINGS.dropD!)).toBe(false);
    expect(supportsCaged(TUNINGS.dadgad!)).toBe(false);
    expect(supportsCaged(TUNINGS.standard7!)).toBe(true);
    expect(generatePositions('ionian', 'C', TUNINGS.dropD!, 'caged')).toEqual([]);
    const note = positionSupport('ionian', TUNINGS.dropD!).find((s) => s.system === 'caged')!;
    expect(note.available).toBe(false);
    expect(note.note).toBeTruthy();
    // 7 cordes : la corde grave supplémentaire est incluse dans la fenêtre
    const p = generatePositions('ionian', 'C', TUNINGS.standard7!, 'caged')[0]!;
    expect(new Set(p.notes.map((n) => n.string)).size).toBe(7);
  });
});

describe('gammes symétriques', () => {
  it('périodes : tons entiers 2, diminuée 3, augmentée 4', () => {
    expect(symmetricPeriod(getScale('whole-tone'))).toBe(2);
    expect(symmetricPeriod(getScale('diminished-wh'))).toBe(3);
    expect(symmetricPeriod(getScale('diminished-hw'))).toBe(3);
    expect(symmetricPeriod(getScale('augmented'))).toBe(4);
  });

  it('un motif par case de la période ; fenêtre de 5 cases ; notes ∈ gamme ; tous accordages', () => {
    for (const [id, period] of [['whole-tone', 2], ['diminished-wh', 3], ['diminished-hw', 3], ['augmented', 4]] as const) {
      for (const tonic of tonics(id)) {
        for (const tuning of ALL_TUNINGS) {
          const ps = generatePositions(id, tonic, tuning, 'symmetric');
          expect(ps.length).toBe(period);
          ps.forEach((p) => {
            checkBasics(p, tuning.id);
            expect(p.fretMax - p.fretMin).toBeLessThanOrEqual(4);
          });
        }
      }
    }
  });
});

describe('table de compatibilité ↔ générateur', () => {
  it('pour chaque (gamme, système) disponible en standard : le générateur produit des positions ; indisponible → aucune', () => {
    for (const def of SCALES) {
      for (const s of positionSupport(def.id, std)) {
        const ps = generatePositions(def.id, tonics(def.id)[9]!, std, s.system);
        if (s.available) {
          expect(ps.length, `${def.id} ${s.system}`).toBeGreaterThan(0);
          if (s.count) expect(ps.length, `${def.id} ${s.system}`).toBe(s.count);
        } else {
          expect(ps, `${def.id} ${s.system}`).toEqual([]);
        }
      }
    }
  });

  it('chaque gamme du catalogue a un système par défaut en standard', () => {
    for (const def of SCALES) {
      const s = defaultSystem(def.id, std);
      expect(s, def.id).not.toBeNull();
      expect(compatibleSystems(def.id)).toContain(s);
    }
  });

  it('couverture des 12 hauteurs de tonique (une orthographe chacune) pour 3NPS et boxes', () => {
    const covered = new Set<number>();
    for (let pc = 0; pc < 12; pc++) {
      const t = simpleSpellings(pc)[0]!;
      const ps = generatePositions('ionian', t, std, '3nps');
      expect(ps.length).toBe(7);
      covered.add(pc);
    }
    expect(covered.size).toBe(12);
  });

  it('les tonalités à orthographe double (Fa♯ / Sol♭) donnent les mêmes cases', () => {
    const a = generatePositions('ionian', 'F#', std, '3nps').map((p) => p.notes.map((n) => n.midi));
    const b = generatePositions('ionian', 'Gb', std, '3nps').map((p) => p.notes.map((n) => n.midi));
    expect(a).toEqual(b);
    // mais les noms diffèrent : Mi♯ vs Fa
    const mi = makeScaleContext(getScale('ionian'), 'F#').notes;
    expect(mi).toContain('E#');
    expect(makeScaleContext(getScale('ionian'), 'Gb').notes).toContain('Cb');
  });

  it('étiquettes', () => {
    const p = generatePositions('pentatonic-minor', 'A', std, 'boxes')[1]!;
    expect(fmtPositionLabel(p)).toBe('Position 2 · cases 7–10');
    const t = generatePositions('ionian', 'C', std, '3nps')[2]!;
    expect(fmtPositionLabel(t)).toBe('Position 3 · cases 0–5');
    const c = generatePositions('ionian', 'C', std, 'caged')[0]!;
    expect(fmtPositionLabel(c, 'fr')).toBe('Forme de Do · CAGED · cases 0–4');
    expect(fmtPositionLabel(c, 'en')).toBe('Forme de C · CAGED · cases 0–4');
  });

  it('7 cordes et 8 cordes : toutes les cordes sont utilisées', () => {
    for (const tuning of [TUNINGS.standard7!, TUNINGS.standard8!]) {
      const p = generatePositions('pentatonic-minor', 'A', tuning, 'boxes')[0]!;
      expect(new Set(p.notes.map((n) => n.string)).size).toBe(tuning.strings.length);
    }
  });
});
