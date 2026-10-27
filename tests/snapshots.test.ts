/**
 * Générateur de captures (hors test fonctionnel) : actif seulement si FRETWAVE_PNG_DIR est défini.
 *   FRETWAVE_PNG_DIR=/chemin npx vitest run tests/snapshots.test.ts
 * Écrit des PNG agrandis d'un facteur entier (pixels nets) : lisibilité, 2 chiffres, 7 cordes, accords, rythme,
 * simulation de daltonisme des couleurs d'intervalle.
 */
import { describe, expect, it } from 'vitest';
import { TUNINGS, generatePositions } from '../src/core/theory';
import { VOICINGS } from '../src/data/voicings';
import {
  BufferSurface, THEME_SYNTHWAVE, arpeggioToScore, chordToScore, drawScore, hexToRgb, layoutScore, positionToScore,
  progressionToScore, rgbToHex, scaleToScore, simulateDeficiency, PPQ,
  type Deficiency, type LayoutOptions, type TabScore,
} from '../src/core/tab';
import { ev, note, rhythmScore } from './helpers/fixtures';
import { renderToBuffer, writePng } from './helpers/png';

const dir = process.env.FRETWAVE_PNG_DIR;
const std = TUNINGS.standard!;
const base: LayoutOptions = { mode: 'wrap', maxWidth: 195, notes: 'fr', chords: 'en', annotation: 'none', stacks: 'change' };
const v = (id: string) => VOICINGS.find((x) => x.id === id)!;

function colorSheet(): TabScore {
  const fns = ['1', 'b2', '2', 'b3', '3', '4', '#4', 'b5', '5', '#5', 'b6', '6', 'b7', '7'];
  return {
    id: 'fixture:colors', kind: 'exercise', tuning: std, stringCount: 6, ppq: PPQ, tempo: 80, timeSig: [4, 4],
    measures: [0, 1].map((m) => ({
      events: Array.from({ length: 8 }, (_, i) => {
        const fn = fns[(m * 7 + i) % fns.length]!;
        return i < 7 ? ev(i * 240, 240, [note((i + m) % 6, 3 + i, fn)]) : ev(1680, 240, []);
      }),
    })),
  };
}

describe.skipIf(!dir)('captures PNG', () => {
  it('écrit les captures', () => {
    const out = dir!;
    const jobs: Array<[string, TabScore, LayoutOptions]> = [
      ['01-gamme-pentatonique-solfege', scaleToScore('pentatonic-minor', 'A', std, { direction: 'updown' }), { ...base, annotation: 'degree' }],
      ['02-deux-chiffres', positionToScore(generatePositions('pentatonic-minor', 'A', std, 'boxes', { register: 1 })[0]!, std), { ...base, annotation: 'note' }],
      ['03-dorien-3nps-anglo', scaleToScore('dorian', 'D', std, { direction: 'up' }), { ...base, notes: 'en', annotation: 'interval' }],
      ['04-sept-cordes', scaleToScore('dorian', 'D', TUNINGS.standard7!, { direction: 'up' }), { ...base, notes: 'en', annotation: 'degree' }],
      ['05-drop-d-arpege', arpeggioToScore(generatePositions('pentatonic-minor', 'D', TUNINGS.dropD!, 'boxes')[0]!, 'Dm7', TUNINGS.dropD!), { ...base, notes: 'en', annotation: 'degree' }],
      ['06-accord-em-plaque-arpege', chordToScore(v('Em-022000'), { pattern: 'universal' }), { ...base, annotation: 'degree' }],
      ['07-accord-f-barre', chordToScore(v('F-133211'), { style: 'strum' }), { ...base, annotation: 'degree' }],
      ['08-progression', progressionToScore(['G-320003', 'D-xx0232', 'Em-022000', 'C-x32010'].map(v), { pattern: 'universal', romans: ['I', 'V', 'vi', 'IV'] }), { ...base, annotation: 'degree' }],
      ['09-rythme', rhythmScore(), { ...base, maxWidth: 260 }],
      ['10-scroll-curseur', scaleToScore('locrian', 'B', std, { direction: 'updown' }), { ...base, mode: 'scroll', annotation: 'degree' }],
    ];
    for (const [name, score, opts] of jobs) {
      const tick = name.includes('curseur') ? 2300 : null;
      const { surface } = renderToBuffer(score, opts, tick, 1);
      writePng(`${out}/${name}.png`, surface, 4);
    }

    // simulation de daltonisme : même feuille de pastilles, 4 vues
    const layout = layoutScore(colorSheet(), { ...base, mode: 'scroll', annotation: 'degree' });
    const normal = new BufferSurface(layout.width, layout.height, THEME_SYNTHWAVE.panel);
    drawScore(normal, layout, THEME_SYNTHWAVE);
    const kinds: Array<Deficiency | 'normal'> = ['normal', 'protanopia', 'deuteranopia', 'tritanopia'];
    const sheet = new BufferSurface(layout.width, layout.height * kinds.length + (kinds.length - 1) * 2, '#000000');
    kinds.forEach((kind, i) => {
      const cache = new Map<string, string>();
      for (let y = 0; y < layout.height; y++) {
        for (let x = 0; x < layout.width; x++) {
          const c = normal.pixel(x, y);
          let sim = cache.get(c);
          if (!sim) {
            sim = kind === 'normal' ? c : simulateDeficiency(c, kind);
            cache.set(c, sim);
          }
          const [r, g, b] = hexToRgb(sim);
          sheet.fillRect(x, y + i * (layout.height + 2), 1, 1, rgbToHex(r, g, b));
        }
      }
    });
    writePng(`${out}/11-daltonisme-normal-protanopie-deuteranopie-tritanopie.png`, sheet, 4);
    expect(true).toBe(true);
  });
});
