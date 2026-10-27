/**
 * Police bitmap maison 5×7 (largeur variable) : aucune police pixel existante ne couvre ♯ ♭ 𝄪 𝄫 ø Δ ↓ ↑
 * dans un rendu net (PROJECT.md §5.3). Chaque glyphe : 7 rangées séparées par « / », « # » = pixel allumé.
 * Les glyphes sont dessinés avec le pixel logique unique de l'app : jamais de lissage.
 */
import type { Surface } from './surface';

export const GLYPH_H = 7;

export interface Glyph {
  w: number;
  /** 7 rangées (9 pour les jambages g j p q y), chacune de `w` caractères « # » / « . ». */
  rows: readonly string[];
}

const RAW: Record<string, string> = {
  // chiffres
  '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
  '1': '..#../.##../..#../..#../..#../..#../.###.',
  '2': '.###./#...#/....#/...#./..#../.#.../#####',
  '3': '.###./#...#/....#/..##./....#/#...#/.###.',
  '4': '...#./..##./.#.#./#..#./#####/...#./...#.',
  '5': '#####/#..../####./....#/....#/#...#/.###.',
  '6': '.###./#..../#..../####./#...#/#...#/.###.',
  '7': '#####/....#/...#./..#../.#.../.#.../.#...',
  '8': '.###./#...#/#...#/.###./#...#/#...#/.###.',
  '9': '.###./#...#/#...#/.####/....#/....#/.###.',
  // majuscules
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
  B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.',
  D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####',
  F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.###.',
  H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '###/.#./.#./.#./.#./.#./###',
  J: '..###/...#./...#./...#./...#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
  L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
  N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
  R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.',
  T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#',
  X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
  Z: '#####/....#/...#./..#../.#.../#..../#####',
  // minuscules (hauteur d'x = 5 ; g j p q y : 9 rangées, jambage de 2 rangées sous la ligne de base)
  a: '...../...../.###./....#/.####/#...#/.####',
  b: '#..../#..../####./#...#/#...#/#...#/####.',
  c: '...../...../.###./#..../#..../#...#/.###.',
  d: '....#/....#/.####/#...#/#...#/#...#/.####',
  e: '...../...../.###./#...#/#####/#..../.###.',
  f: '..##/.#../####/.#../.#../.#../.#..',
  g: '...../...../.####/#...#/#...#/.####/....#/#...#/.###.',
  h: '#..../#..../####./#...#/#...#/#...#/#...#',
  i: '.#./.../##./.#./.#./.#./###',
  j: '..#/.../..#/..#/..#/..#/..#/#.#/.#.',
  k: '#..../#..../#..#./#.#../##.../#.#../#..#.',
  l: '##./.#./.#./.#./.#./.#./###',
  m: '...../...../##.#./#.#.#/#.#.#/#...#/#...#',
  n: '...../...../####./#...#/#...#/#...#/#...#',
  o: '...../...../.###./#...#/#...#/#...#/.###.',
  p: '...../...../####./#...#/#...#/#...#/####./#..../#....',
  q: '...../...../.####/#...#/#...#/#...#/.####/....#/....#',
  r: '..../..../#.##/##../#.../#.../#...',
  s: '...../...../.####/#..../.###./....#/####.',
  t: '.#../.#../####/.#../.#../.#../..##',
  u: '...../...../#...#/#...#/#...#/#...#/.####',
  v: '...../...../#...#/#...#/#...#/.#.#./..#..',
  w: '...../...../#...#/#...#/#.#.#/#.#.#/.#.#.',
  x: '...../...../#...#/.#.#./..#../.#.#./#...#',
  y: '...../...../#...#/#...#/#...#/.####/....#/#...#/.###.',
  z: '...../...../#####/...#./..#../.#.../#####',
  é: '..#../.#.../.###./#...#/#####/#..../.###.',
  è: '.#.../..#../.###./#...#/#####/#..../.###.',
  // altérations et symboles musicaux
  '♯': '.#.#./.#.#./#####/.#.#./#####/.#.#./.#.#.',
  '♭': '#../#../#../##./#.#/#.#/##.',
  '𝄪': '...../#...#/.#.#./..#../.#.#./#...#/.....',
  '♩': '..#./..#./..#./..#./.##./###./.#..',
  '°': '.##./#..#/#..#/.##./..../..../....',
  'ø': '....#/.###./#..##/#.#.#/##..#/.###./#....',
  'Δ': '..#../..#../.#.#./.#.#./#...#/#...#/#####',
  '↓': '..#../..#../..#../..#../#.#.#/.###./..#..',
  '↑': '..#../.###./#.#.#/..#../..#../..#../..#..',
  // ponctuation
  ' ': '.../.../.../.../.../.../...',
  '/': '...#/...#/..#./..#./.#../.#../#...',
  '-': '.../.../.../###/.../.../...',
  '–': '...../...../...../#####/...../...../.....',
  '+': '...../..#../..#../#####/..#../..#../.....',
  '=': '...../...../#####/...../#####/...../.....',
  '(': '..#/.#./#../#../#../.#./..#',
  ')': '#../.#./..#/..#/..#/.#./#..',
  '.': ['.', '.', '.', '.', '.', '.', '#'].join('/'),
  ',': '../../../../../.#/#.',
  ':': ['.', '.', '#', '.', '.', '#', '.'].join('/'),
  '·': ['.', '.', '.', '#', '.', '.', '.'].join('/'),
  '?': '.###./#...#/....#/...#./..#../...../..#..',
  '×': '...../#...#/.#.#./..#../.#.#./#...#/.....',
  '|': '#/#/#/#/#/#/#',
  '*': '...../#.#.#/.###./#####/.###./#.#.#/.....',
};

/** Silences (rangée de rythme) : noms dédiés, pas des caractères. */
const RAW_SPRITES: Record<string, string> = {
  'rest-w': '...../#####/#####/...../...../...../.....',
  'rest-h': '...../...../...../#####/#####/...../.....',
  'rest-q': '.###./..#../.#.../..#../.#.../..##./...#.',
  'rest-e': '...../##..#/##.#./..#../..#../.#.../.#...',
  'rest-s': '##..#/##.#./##.#./.##../..#../.#.../.#...',
};

function parse(raw: string): Glyph {
  const rows = raw.split('/');
  return { w: rows[0]!.length, rows };
}

const GLYPHS = new Map<string, Glyph>(Object.entries(RAW).map(([ch, raw]) => [ch, parse(raw)]));
const SPRITES = new Map<string, Glyph>(Object.entries(RAW_SPRITES).map(([name, raw]) => [name, parse(raw)]));

// 𝄫 = deux bémols côte à côte (construit, pas dessiné deux fois)
{
  const flat = GLYPHS.get('♭')!;
  GLYPHS.set('𝄫', { w: flat.w * 2 + 1, rows: flat.rows.map((r) => `${r}.${r}`) });
}

export function hasGlyph(ch: string): boolean {
  return GLYPHS.has(ch);
}

export function glyph(ch: string): Glyph {
  return GLYPHS.get(ch) ?? GLYPHS.get('?')!;
}

export function sprite(name: string): Glyph {
  const s = SPRITES.get(name);
  if (!s) throw new Error(`sprite inconnu : ${name}`);
  return s;
}

export function allGlyphs(): ReadonlyMap<string, Glyph> {
  return GLYPHS;
}
export function allSprites(): ReadonlyMap<string, Glyph> {
  return SPRITES;
}

/** Caractères d'un texte (points de code : « 𝄪 » est un seul caractère). */
export function chars(text: string): string[] {
  return [...text];
}

/** Largeur en pixels logiques : somme des glyphes + 1 pixel entre chaque. */
export function textWidth(text: string): number {
  const cs = chars(text);
  if (cs.length === 0) return 0;
  return cs.reduce((w, c) => w + glyph(c).w, 0) + (cs.length - 1);
}

export function drawGlyph(s: Surface, g: Glyph, x: number, y: number, color: string, alpha = 1): void {
  for (let r = 0; r < g.rows.length; r++) {
    const row = g.rows[r]!;
    let c = 0;
    while (c < row.length) {
      if (row[c] === '#') {
        let end = c;
        while (end + 1 < row.length && row[end + 1] === '#') end++;
        s.fillRect(x + c, y + r, end - c + 1, 1, color, alpha);
        c = end + 1;
      } else c++;
    }
  }
}

export function drawText(s: Surface, x: number, y: number, text: string, color: string, alpha = 1): number {
  let cx = x;
  for (const ch of chars(text)) {
    const g = glyph(ch);
    drawGlyph(s, g, cx, y, color, alpha);
    cx += g.w + 1;
  }
  return cx - x - 1;
}

/** Texte agrandi d'un facteur entier (chiffrage de la mesure) : chaque pixel devient un carré k×k. */
export function drawTextScaled(s: Surface, x: number, y: number, text: string, color: string, k: number): number {
  let cx = x;
  for (const ch of chars(text)) {
    const g = glyph(ch);
    for (let r = 0; r < g.rows.length; r++) {
      for (let c = 0; c < g.w; c++) if (g.rows[r]![c] === '#') s.fillRect(cx + c * k, y + r * k, k, k, color);
    }
    cx += (g.w + 1) * k;
  }
  return cx - x - k;
}
