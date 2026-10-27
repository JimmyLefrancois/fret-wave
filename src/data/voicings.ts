import type { MobileShape, Voicing } from '../core/theory/voicings';

/**
 * Formes d'accord curées pour l'accordage standard (MUSIC_DESIGN.md §4.3).
 * Chaque entrée est validée par tests/voicings.test.ts ; les **doigtés** sont saisis ici (phase 4a,
 * dette de la 1d) et relus par tests/chordFingers.test.ts : un doigt = une case, une corde à vide ne
 * porte pas de doigt, le doigt de la case la plus basse est l'index ou le majeur, les cordes du barré
 * portent le doigt du barré.
 */
const S = 'standard';

export const VOICINGS: readonly Voicing[] = [
  { id: "Em-022000", chord: "Em", tuningId: S, frets: [0, 2, 2, 0, 0, 0], fingers: [null, 2, 3, null, null, null], family: "open", difficulty: 1, palier: "P1", omitted: [] },
  { id: "Em7-020000", chord: "Em7", tuningId: S, frets: [0, 2, 0, 0, 0, 0], fingers: [null, 1, null, null, null, null], family: "open7", difficulty: 1, palier: "P1", omitted: [], note: "1 doigt" },
  { id: "Em7-022030", chord: "Em7", tuningId: S, frets: [0, 2, 2, 0, 3, 0], fingers: [null, 1, 2, null, 3, null], family: "open7", difficulty: 2, palier: "P5", omitted: [] },
  { id: "E7-020100", chord: "E7", tuningId: S, frets: [0, 2, 0, 1, 0, 0], fingers: [null, 2, null, 1, null, null], family: "open7", difficulty: 2, palier: "P2", omitted: [] },
  { id: "E-022100", chord: "E", tuningId: S, frets: [0, 2, 2, 1, 0, 0], fingers: [null, 2, 3, 1, null, null], family: "open", difficulty: 2, palier: "P2", omitted: [] },
  { id: "Am-x02210", chord: "Am", tuningId: S, frets: [null, 0, 2, 2, 1, 0], fingers: [null, null, 2, 3, 1, null], family: "open", difficulty: 2, palier: "P2", omitted: [] },
  { id: "Am7-x02010", chord: "Am7", tuningId: S, frets: [null, 0, 2, 0, 1, 0], fingers: [null, null, 2, null, 1, null], family: "open7", difficulty: 2, palier: "P1", omitted: [], note: "ne pas jouer la 6e corde" },
  { id: "A-x02220", chord: "A", tuningId: S, frets: [null, 0, 2, 2, 2, 0], fingers: [null, null, 1, 2, 3, null], family: "open", difficulty: 2, palier: "P2", omitted: [] },
  { id: "A7-x02020", chord: "A7", tuningId: S, frets: [null, 0, 2, 0, 2, 0], fingers: [null, null, 2, null, 3, null], family: "open7", difficulty: 2, palier: "P2", omitted: [] },
  { id: "Asus2-x02200", chord: "Asus2", tuningId: S, frets: [null, 0, 2, 2, 0, 0], fingers: [null, null, 2, 3, null, null], family: "sus", difficulty: 1, palier: "P1", omitted: [], note: "même paire de doigts que Em, décalée d'une corde" },
  { id: "Asus4-x02230", chord: "Asus4", tuningId: S, frets: [null, 0, 2, 2, 3, 0], fingers: [null, null, 1, 2, 3, null], family: "sus", difficulty: 3, palier: "P5", omitted: [] },
  { id: "Esus4-002200", chord: "Esus4", tuningId: S, frets: [0, 0, 2, 2, 0, 0], fingers: [null, null, 1, 2, null, null], family: "sus", difficulty: 2, palier: "P5", omitted: [] },
  { id: "D-xx0232", chord: "D", tuningId: S, frets: [null, null, 0, 2, 3, 2], fingers: [null, null, null, 1, 3, 2], family: "open", difficulty: 3, palier: "P3", omitted: [] },
  { id: "Dm-xx0231", chord: "Dm", tuningId: S, frets: [null, null, 0, 2, 3, 1], fingers: [null, null, null, 2, 3, 1], family: "open", difficulty: 3, palier: "P3", omitted: [] },
  { id: "D7-xx0212", chord: "D7", tuningId: S, frets: [null, null, 0, 2, 1, 2], fingers: [null, null, null, 2, 1, 3], family: "open7", difficulty: 3, palier: "P5", omitted: [] },
  { id: "Dmaj7-xx0222", chord: "Dmaj7", tuningId: S, frets: [null, null, 0, 2, 2, 2], fingers: [null, null, null, 1, 2, 3], family: "open7", difficulty: 3, palier: "P5", omitted: [] },
  { id: "Dsus2-xx0230", chord: "Dsus2", tuningId: S, frets: [null, null, 0, 2, 3, 0], fingers: [null, null, null, 1, 3, null], family: "sus", difficulty: 2, palier: "P3", omitted: [] },
  { id: "Dsus4-xx0233", chord: "Dsus4", tuningId: S, frets: [null, null, 0, 2, 3, 3], fingers: [null, null, null, 1, 2, 3], family: "sus", difficulty: 3, palier: "P3", omitted: [] },
  { id: "C-x32010", chord: "C", tuningId: S, frets: [null, 3, 2, 0, 1, 0], fingers: [null, 3, 2, null, 1, null], family: "open", difficulty: 3, palier: "P4", omitted: [] },
  { id: "Cmaj7-x32000", chord: "Cmaj7", tuningId: S, frets: [null, 3, 2, 0, 0, 0], fingers: [null, 3, 2, null, null, null], family: "open7", difficulty: 2, palier: "P4", omitted: [], note: "2 doigts ; marchepied vers C" },
  { id: "Cadd9-x32030", chord: "Cadd9", tuningId: S, frets: [null, 3, 2, 0, 3, 0], fingers: [null, 2, 1, null, 3, null], family: "add", difficulty: 3, palier: "P5", omitted: [] },
  { id: "C7-x32310", chord: "C7", tuningId: S, frets: [null, 3, 2, 3, 1, 0], fingers: [null, 3, 2, 4, 1, null], family: "open7", difficulty: 4, palier: "P5", omitted: ["5"], note: "5te omise (déclarée)" },
  { id: "G-320003", chord: "G", tuningId: S, frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, null, null, null, 3], family: "open", difficulty: 3, palier: "P4", omitted: [] },
  { id: "G-320033", chord: "G", tuningId: S, frets: [3, 2, 0, 0, 3, 3], fingers: [2, 1, null, null, 3, 4], family: "open", difficulty: 4, palier: "P4", omitted: [], note: "variante 4 doigts" },
  { id: "G7-320001", chord: "G7", tuningId: S, frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, null, null, null, 1], family: "open7", difficulty: 3, palier: "P5", omitted: [] },
  { id: "Gmaj7-320002", chord: "Gmaj7", tuningId: S, frets: [3, 2, 0, 0, 0, 2], fingers: [3, 2, null, null, null, 1], family: "open7", difficulty: 3, palier: "P5", omitted: [] },
  { id: "B7-x21202", chord: "B7", tuningId: S, frets: [null, 2, 1, 2, 0, 2], fingers: [null, 1, 2, 3, null, 4], family: "open7", difficulty: 4, palier: "P5", omitted: [] },
  { id: "Bm7-x20202", chord: "Bm7", tuningId: S, frets: [null, 2, 0, 2, 0, 2], fingers: [null, 1, null, 2, null, 3], family: "open7", difficulty: 3, palier: "P7", omitted: [], note: "substitut simple de Bm" },
  { id: "Fmaj7-xx3210", chord: "Fmaj7", tuningId: S, frets: [null, null, 3, 2, 1, 0], fingers: [null, null, 3, 2, 1, null], family: "open7", difficulty: 3, palier: "P7", omitted: [], note: "sans barré" },
  { id: "F-xx3211", chord: "F", tuningId: S, frets: [null, null, 3, 2, 1, 1], fingers: [null, null, 3, 2, 1, 1], family: "open", difficulty: 4, palier: "P7", omitted: [], simplifiedOf: 'F-133211', barre: { fret: 1, fromString: 4, toString: 5, finger: 1 }, note: "mini-barré (index sur Si et mi)" },
  { id: "F-133211", chord: "F", tuningId: S, frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], family: "open", difficulty: 5, palier: "P7", omitted: [], barre: { fret: 1, fromString: 0, toString: 5, finger: 1 }, note: "barré complet (forme de Mi)" },
  { id: "Bm-x24432", chord: "Bm", tuningId: S, frets: [null, 2, 4, 4, 3, 2], fingers: [null, 1, 3, 4, 2, 1], family: "open", difficulty: 4, palier: "P7", omitted: [], barre: { fret: 2, fromString: 1, toString: 5, finger: 1 } },
  { id: "GoverB-x20003", chord: "G/B", tuningId: S, frets: [null, 2, 0, 0, 0, 3], fingers: [null, 1, null, null, null, 3], family: "slash", difficulty: 3, palier: "P6", omitted: [] },
  { id: "DoverFs-200232", chord: "D/F#", tuningId: S, frets: [2, 0, 0, 2, 3, 2], fingers: [1, null, null, 3, 4, 2], family: "slash", difficulty: 3, palier: "P6", omitted: [] },
  { id: "CoverG-332010", chord: "C/G", tuningId: S, frets: [3, 3, 2, 0, 1, 0], fingers: [4, 3, 2, null, 1, null], family: "slash", difficulty: 3, palier: "P6", omitted: [] },
  { id: "E5-022xxx", chord: "E5", tuningId: S, frets: [0, 2, 2, null, null, null], fingers: [null, 1, 3, null, null, null], family: "power", difficulty: 1, palier: "P2b", omitted: [] },
  { id: "A5-x022xx", chord: "A5", tuningId: S, frets: [null, 0, 2, 2, null, null], fingers: [null, null, 1, 3, null, null], family: "power", difficulty: 1, palier: "P2b", omitted: [] },
  { id: "D5-xx023x", chord: "D5", tuningId: S, frets: [null, null, 0, 2, 3, null], fingers: [null, null, null, 1, 3, null], family: "power", difficulty: 1, palier: "P2b", omitted: [] },
  { id: "G5-355xxx", chord: "G5", tuningId: S, frets: [3, 5, 5, null, null, null], fingers: [1, 3, 4, null, null, null], family: "power", difficulty: 2, palier: "P2b", omitted: [] },
  { id: "C5-x355xx", chord: "C5", tuningId: S, frets: [null, 3, 5, 5, null, null], fingers: [null, 1, 3, 4, null, null], family: "power", difficulty: 2, palier: "P2b", omitted: [] },
  { id: "triad-C-xxx553", chord: "C", tuningId: S, frets: [null, null, null, 5, 5, 3], fingers: [null, null, null, 3, 4, 1], family: "triad3", difficulty: 3, palier: "P9", omitted: [], note: "3 cordes aiguës · position fondamentale" },
  { id: "triad-CoverE-xxx988", chord: "C/E", tuningId: S, frets: [null, null, null, 9, 8, 8], fingers: [null, null, null, 3, 1, 2], family: "triad3", difficulty: 3, palier: "P9", omitted: [], note: "3 cordes aiguës · 1er renversement" },
  { id: "triad-CoverG-xxx010", chord: "C/G", tuningId: S, frets: [null, null, null, 0, 1, 0], fingers: [null, null, null, null, 1, null], family: "triad3", difficulty: 3, palier: "P9", omitted: [], note: "3 cordes aiguës · 2e renversement" },
];

const BY_ID = new Map(VOICINGS.map((v) => [v.id, v] as const));

export function voicingById(id: string): Voicing | undefined {
  return BY_ID.get(id);
}

/** Formes mobiles : barrés de forme de Mi (fondamentale corde 6) et de La (corde 5). */
export const MOBILE_SHAPES: readonly MobileShape[] = [
  { id: 'E-maj', quality: '', rootString: 0, offsets: [0, 2, 2, 1, 0, 0], family: 'barre-E', caged: 'E' },
  { id: 'E-min', quality: 'm', rootString: 0, offsets: [0, 2, 2, 0, 0, 0], family: 'barre-E', caged: 'E' },
  { id: 'E-dom7', quality: '7', rootString: 0, offsets: [0, 2, 0, 1, 0, 0], family: 'barre-E', caged: 'E' },
  { id: 'E-min7', quality: 'm7', rootString: 0, offsets: [0, 2, 0, 0, 0, 0], family: 'barre-E', caged: 'E' },
  { id: 'E-maj7', quality: 'maj7', rootString: 0, offsets: [0, null, 1, 1, 0, null], family: 'barre-E', caged: 'E' },
  { id: 'A-maj', quality: '', rootString: 1, offsets: [null, 0, 2, 2, 2, 0], family: 'barre-A', caged: 'A' },
  { id: 'A-min', quality: 'm', rootString: 1, offsets: [null, 0, 2, 2, 1, 0], family: 'barre-A', caged: 'A' },
  { id: 'A-dom7', quality: '7', rootString: 1, offsets: [null, 0, 2, 0, 2, 0], family: 'barre-A', caged: 'A' },
  { id: 'A-min7', quality: 'm7', rootString: 1, offsets: [null, 0, 2, 0, 1, 0], family: 'barre-A', caged: 'A' },
  { id: 'A-maj7', quality: 'maj7', rootString: 1, offsets: [null, 0, 2, 1, 2, 0], family: 'barre-A', caged: 'A' },
];
