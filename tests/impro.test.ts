import { describe, expect, it } from 'vitest';
import { locateInScore, scoreNotes } from '../src/core/impro/locate';
import { backingPattern, chordMidis, loopBeatsOf } from '../src/core/audio/backing';
import { IMPRO_BACKINGS, backingsFor, chordAtMeasure, chordName } from '../src/modules/gammes/impro';

/** Notes d'une position en Mi mineur pentatonique, cases 0-3 (les emplacements réels du manche). */
const position = [
  { string: 0, fret: 0, midi: 40 }, // Mi grave à vide
  { string: 0, fret: 3, midi: 43 }, // Sol
  { string: 1, fret: 0, midi: 45 }, // La
  { string: 1, fret: 2, midi: 47 }, // Si
  { string: 2, fret: 0, midi: 50 }, // Ré
  { string: 2, fret: 2, midi: 52 }, // Mi (octave)
  { string: 3, fret: 0, midi: 55 }, // Sol
  { string: 4, fret: 0, midi: 59 }, // Si
  { string: 5, fret: 0, midi: 64 }, // Mi aigu
  { string: 5, fret: 3, midi: 67 }, // Sol
];

describe('placement d’une note sur la position', () => {
  it('trouve l’emplacement exact', () => {
    expect(locateInScore(position, 52)).toEqual({ string: 2, fret: 2, midi: 52 });
  });

  it('accepte la même classe de hauteur à l’octave (une note juste ne reste pas éteinte)', () => {
    // Mi 4 (64) existe ; Mi 2 (40) aussi. Un Mi 3 (52) doit allumer l'emplacement écrit.
    expect(locateInScore(position, 76)).toMatchObject({ string: 5, fret: 0, midi: 64 });
  });

  it('préfère l’emplacement le plus proche de la note précédente', () => {
    const doubled = [
      { string: 0, fret: 0, midi: 40 },
      { string: 2, fret: 2, midi: 40 }, // même hauteur, autre corde
    ];
    expect(locateInScore(doubled, 40, { string: 2, fret: 0, midi: 50 })?.string).toBe(2);
    expect(locateInScore(doubled, 40, { string: 0, fret: 3, midi: 43 })?.string).toBe(0);
  });

  it('rend null pour une note absente de la position, sans rien inventer', () => {
    expect(locateInScore(position, 61)).toBeNull(); // Do♯, hors de la pentatonique
  });

  it('scoreNotes ignore les notes masquées ou étouffées', () => {
    const score = {
      stringCount: 6,
      measures: [{ events: [{ notes: [
        { string: 0, fret: 0, midi: 40 },
        { string: 1, fret: 0, midi: 45, muted: true },
        { string: 2, fret: 0, midi: 50, hidden: true },
      ] }] }],
    } as unknown as Parameters<typeof scoreNotes>[0];
    expect(scoreNotes(score)).toHaveLength(1);
  });
});

describe('accompagnements', () => {
  it('une mesure par accord, quatre accords par boucle', () => {
    for (const b of IMPRO_BACKINGS) {
      expect(b.chords).toHaveLength(4);
      expect(loopBeatsOf(b)).toBe(16);
    }
  });

  it('les accords suivent la tonique : la même boucle se transpose', () => {
    const b = IMPRO_BACKINGS.find((x) => x.id === 'synthwave-minor')!;
    // en Mi : i = Em, ♭VI = C, ♭III = G, ♭VII = D
    expect(['Em', 'C', 'G', 'D']).toEqual([0, 1, 2, 3].map((m) => chordName(chordAtMeasure(b, 4, m).root, chordAtMeasure(b, 4, m).quality)));
    // en La : Am, F, C, G
    expect(['Am', 'F', 'C', 'G']).toEqual([0, 1, 2, 3].map((m) => chordName(chordAtMeasure(b, 9, m).root, chordAtMeasure(b, 9, m).quality)));
  });

  it('le mode décide des accompagnements proposés', () => {
    expect(backingsFor('minor').every((b) => b.mode === 'minor')).toBe(true);
    expect(backingsFor('minor')).toHaveLength(2);
    expect(backingsFor('major')).toHaveLength(2);
  });

  it('une boucle synthwave a une caisse claire sur 2 et 4, une lo-fi sur 3 seulement', () => {
    const synth = IMPRO_BACKINGS.find((b) => b.id === 'synthwave-minor')!;
    const lofi = IMPRO_BACKINGS.find((b) => b.id === 'lofi-minor')!;
    const snares = (b: typeof synth) => backingPattern(b, 40).filter((e) => e.voice === 'snare').map((e) => e.beat % 4);
    expect([...new Set(snares(synth))].sort()).toEqual([1, 3]);
    expect([...new Set(snares(lofi))].sort()).toEqual([2]);
  });

  it('la basse joue la fondamentale de chaque mesure, dans le registre grave', () => {
    const b = IMPRO_BACKINGS.find((x) => x.id === 'synthwave-minor')!;
    const pattern = backingPattern(b, 40); // Mi grave
    const bass = pattern.filter((e) => e.voice === 'bass');
    expect(bass.filter((e) => e.beat % 4 === 0).map((e) => e.midis[0])).toEqual([40, 48, 43, 50]);
    expect(Math.min(...bass.flatMap((e) => e.midis))).toBeGreaterThanOrEqual(38);
  });

  it('chaque mesure porte un pad tenu, une fois par accord', () => {
    const b = IMPRO_BACKINGS[0]!;
    const pads = backingPattern(b, 40).filter((e) => e.voice === 'pad');
    expect(pads).toHaveLength(4);
    expect(pads.every((e) => e.beats === 4)).toBe(true);
  });

  it('les hauteurs d’accord empilent tierce, quinte et septième', () => {
    expect(chordMidis(40, 'min')).toEqual([52, 55, 59]);
    expect(chordMidis(40, 'min7')).toEqual([52, 55, 59, 62]);
    expect(chordMidis(48, 'maj7')).toEqual([60, 64, 67, 71]);
  });
});
