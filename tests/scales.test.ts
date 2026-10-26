import { describe, expect, it } from 'vitest';
import {
  SCALES, collectionKey, degreeLabels, distinctModes, distinctTranspositions, getScale, hasOneNotePerLetter,
  parentMajorTonic, pitchClassOf, scaleNotes, simpleSpellings, tonicSpellings,
} from '../src/core/theory/scales';
import { MAJOR_KEYS, MINOR_KEYS, REJECTED_KEYS, keyOptions, keySignature, progressKeyId } from '../src/core/theory/keys';

describe('orthographe des gammes', () => {
  it('Fa♯ majeur a Mi♯ ; Sol♭ majeur a Do♭', () => {
    expect(scaleNotes(getScale('ionian'), 'F#')).toEqual(['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#']);
    expect(scaleNotes(getScale('ionian'), 'Gb')).toEqual(['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F']);
  });

  it('Ré dorien = notes de Do majeur, formule 1 2 b3 4 5 6 b7', () => {
    const d = getScale('dorian');
    expect(scaleNotes(d, 'D')).toEqual(['D', 'E', 'F', 'G', 'A', 'B', 'C']);
    expect(degreeLabels(d)).toEqual(['1', '2', 'b3', '4', '5', '6', 'b7']);
    expect(parentMajorTonic(d, 'D')).toBe('C');
  });

  it('formules des 7 modes (degrés)', () => {
    const f = (id: string) => degreeLabels(getScale(id)).join(' ');
    expect(f('ionian')).toBe('1 2 3 4 5 6 7');
    expect(f('dorian')).toBe('1 2 b3 4 5 6 b7');
    expect(f('phrygian')).toBe('1 b2 b3 4 5 b6 b7');
    expect(f('lydian')).toBe('1 2 3 #4 5 6 7');
    expect(f('mixolydian')).toBe('1 2 3 4 5 6 b7');
    expect(f('aeolian')).toBe('1 2 b3 4 5 b6 b7');
    expect(f('locrian')).toBe('1 b2 b3 4 b5 b6 b7');
  });

  it('modes parents : tonique du parent majeur', () => {
    const cases: Array<[string, string, string]> = [
      ['phrygian', 'E', 'C'], ['lydian', 'F', 'C'], ['mixolydian', 'G', 'C'], ['aeolian', 'A', 'C'], ['locrian', 'B', 'C'],
    ];
    for (const [id, tonic, parent] of cases) expect(parentMajorTonic(getScale(id), tonic)).toBe(parent);
  });

  it('pentatoniques, blues, harmonique, mélodique jazz', () => {
    const f = (id: string) => degreeLabels(getScale(id)).join(' ');
    expect(f('pentatonic-minor')).toBe('1 b3 4 5 b7');
    expect(f('pentatonic-major')).toBe('1 2 3 5 6');
    expect(f('blues-minor')).toBe('1 b3 4 b5 5 b7');
    expect(f('blues-major')).toBe('1 2 b3 3 5 6');
    expect(f('harmonic-minor')).toBe('1 2 b3 4 5 b6 7');
    expect(f('melodic-minor')).toBe('1 2 b3 4 5 6 7');
    expect(scaleNotes(getScale('pentatonic-minor'), 'A')).toEqual(['A', 'C', 'D', 'E', 'G']);
  });

  it('Sol♯ harmonique contient Fa𝄪 (double dièse imposé par la formule)', () => {
    expect(scaleNotes(getScale('harmonic-minor'), 'G#')).toEqual(['G#', 'A#', 'B', 'C#', 'D#', 'E', 'F##']);
  });

  it('modes de l\'harmonique et de la mélodique', () => {
    const f = (id: string) => degreeLabels(getScale(id)).join(' ');
    expect(f('phrygian-dominant')).toBe('1 b2 3 4 5 b6 b7'); // = mixolydien b9 b13
    expect(f('lydian-dominant')).toBe('1 2 3 #4 5 6 b7');
    expect(f('altered')).toBe('1 b2 b3 b4 b5 b6 b7'); // 3 écrit b4 : une note par lettre
    expect(f('locrian-natural2')).toBe('1 2 b3 4 b5 b6 b7');
    expect(f('lydian-augmented')).toBe('1 2 3 #4 #5 6 7');
  });

  it('toute gamme heptatonique : une note par lettre, 12 toniques', () => {
    for (const def of SCALES.filter((s) => s.intervals.length === 7)) {
      for (let pc = 0; pc < 12; pc++) {
        for (const tonic of simpleSpellings(pc)) {
          const notes = scaleNotes(def, tonic);
          expect(hasOneNotePerLetter(notes), `${def.id} ${tonic}: ${notes.join(' ')}`).toBe(true);
        }
      }
    }
  });
});

describe('gammes symétriques : identité de révision', () => {
  it('transpositions distinctes : tons entiers 2, diminuée 3, augmentée 4, majeure 12', () => {
    expect(distinctTranspositions(getScale('whole-tone'))).toBe(2);
    expect(distinctTranspositions(getScale('diminished-wh'))).toBe(3);
    expect(distinctTranspositions(getScale('diminished-hw'))).toBe(3);
    expect(distinctTranspositions(getScale('augmented'))).toBe(4);
    expect(distinctTranspositions(getScale('ionian'))).toBe(12);
    expect(distinctTranspositions(getScale('pentatonic-minor'))).toBe(12);
  });

  it('modes distincts : tons entiers 1, diminuée 2, augmentée 2, majeure 7', () => {
    expect(distinctModes(getScale('whole-tone'))).toBe(1);
    expect(distinctModes(getScale('diminished-wh'))).toBe(2);
    expect(distinctModes(getScale('augmented'))).toBe(2);
    expect(distinctModes(getScale('ionian'))).toBe(7);
  });

  it('Do TD ≡ Mi♭ TD ≡ Fa♯ TD ≡ La TD ; Do DT ≡ Ré♭ TD', () => {
    const wh = getScale('diminished-wh');
    const hw = getScale('diminished-hw');
    const k = collectionKey(wh, 'C');
    expect(collectionKey(wh, 'Eb')).toBe(k);
    expect(collectionKey(wh, 'F#')).toBe(k);
    expect(collectionKey(wh, 'A')).toBe(k);
    expect(collectionKey(hw, 'C')).toBe(collectionKey(wh, 'Db'));
    expect(collectionKey(wh, 'D')).not.toBe(k);
  });

  it('Fa♯ et Sol♭ majeur : même collection (même nœud de progression)', () => {
    const maj = getScale('ionian');
    expect(collectionKey(maj, 'F#')).toBe(collectionKey(maj, 'Gb'));
    expect(progressKeyId('F#', 'major')).toBe(progressKeyId('Gb', 'major'));
  });
});

describe('politique des tonalités', () => {
  it('13 majeures et 13 mineures, armure ≤ 6 altérations', () => {
    expect(MAJOR_KEYS).toHaveLength(13);
    expect(MINOR_KEYS).toHaveLength(13);
    for (const k of MAJOR_KEYS) expect(Math.abs(keySignature(k, 'major'))).toBeLessThanOrEqual(6);
    for (const k of MINOR_KEYS) expect(Math.abs(keySignature(k, 'minor'))).toBeLessThanOrEqual(6);
  });

  it('armures attendues', () => {
    expect(keySignature('F#', 'major')).toBe(6);
    expect(keySignature('Gb', 'major')).toBe(-6);
    expect(keySignature('B', 'major')).toBe(5);
    expect(keySignature('Db', 'major')).toBe(-5);
    expect(keySignature('D#', 'minor')).toBe(6);
    expect(keySignature('Eb', 'minor')).toBe(-6);
  });

  it('refus : Do♯ (7♯), Do♭ (7♭), La♯m, La♭m', () => {
    for (const r of REJECTED_KEYS) {
      expect(Math.abs(keySignature(r.key, r.mode))).toBe(7);
      const list = r.mode === 'major' ? MAJOR_KEYS : MINOR_KEYS;
      expect(list).not.toContain(r.key);
      expect(list).toContain(r.use);
    }
  });

  it('Fa♯/Sol♭ et Ré♯m/Mi♭m proposés tous les deux ; les autres hauteurs une seule fois', () => {
    for (let pc = 0; pc < 12; pc++) {
      const maj = keyOptions(pc, 'major');
      const min = keyOptions(pc, 'minor');
      expect(maj.length).toBe(pc === 6 ? 2 : 1);
      expect(min.length).toBe(pc === 3 ? 2 : 1);
    }
  });

  it('le coût d\'orthographe retrouve exactement la table des tonalités (majeure et mineure naturelle)', () => {
    for (let pc = 0; pc < 12; pc++) {
      expect(new Set(tonicSpellings(getScale('ionian'), pc))).toEqual(new Set(keyOptions(pc, 'major')));
      expect(new Set(tonicSpellings(getScale('aeolian'), pc))).toEqual(new Set(keyOptions(pc, 'minor')));
    }
  });

  it('toniques de modes : La♭ lydien, Do♯ dorien, Mi♭ dorien', () => {
    expect(tonicSpellings(getScale('lydian'), pitchClassOf('Ab'))).toEqual(['Ab']);
    expect(tonicSpellings(getScale('dorian'), pitchClassOf('C#'))).toEqual(['C#']);
    expect(tonicSpellings(getScale('dorian'), pitchClassOf('Eb'))).toEqual(['Eb']);
  });
});
