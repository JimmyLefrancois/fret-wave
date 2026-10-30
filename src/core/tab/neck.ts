/**
 * Vue manche (module Gammes, page Découvrir) — la vue complémentaire que MUSIC_DESIGN §7.1 et §3.9
 * recommandaient depuis la phase 0, accordée par l'élève : une position 3NPS se lit dans la tab comme
 * une liste de chiffres, le manche en montre la **forme** (le rectangle, la diagonale, l'endroit où elle
 * se pose entre le sillet et la 15e case).
 *
 * Orientation : celle de la tablature (corde aiguë en haut, graves en bas, cases de gauche à droite),
 * pour que l'œil passe d'une vue à l'autre sans rien retourner. Les pastilles sont **celles de la tab**
 * (`drawPill` : couleur de fonction, coins coupés de la fondamentale, encoche d'altération) ; elles ne
 * portent plus la case — c'est l'abscisse qui la dit — mais l'annotation choisie sous la tablature
 * (note, degré, intervalle, doigt). La tonique est cerclée : c'est le repère d'où la forme se lit.
 *
 * Deux cadrages : le manche entier (0 → 15) quand la place le permet, sinon une fenêtre d'une case de
 * part et d'autre de la position.
 */
import { fingeringsForPosition, noteKey } from '../theory/fingerings';
import { fmtNote, fmtStringLabel } from '../theory/notation';
import type { Position } from '../theory/positions';
import type { NoteNotation } from '../theory/types';
import type { Tuning } from '../theory/tunings';
import { mix, type TabTheme } from './colors';
import { drawText, textWidth } from './font';
import { METRICS, type AnnotationKind, type PillLayout } from './layout';
import { fnToInterval, parseFn } from './model';
import { drawPill } from './render';
import type { Surface } from './surface';

export const NECK_METRICS = {
  /** Largeur d'une case quand les pastilles n'ont qu'un caractère ; elle s'élargit avec l'étiquette. */
  fretW: 17,
  /** Air entre une pastille et les deux frettes de sa case. */
  fretAir: 3,
  /** Colonne des cordes à vide, à gauche du sillet. */
  openW: 14,
  padL: 2,
  padR: 3,
  top: 3,
  /** Rangée des numéros de case, sous la corde grave. */
  bottom: 12,
  /** Dernière case du cadrage « manche entier » (au moins). */
  fullTo: 15,
} as const;

/** Cases repérées par une incrustation (double à 12 et 24). */
const INLAYS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];

export interface NeckNote {
  string: number;
  fret: number;
  /** Fonction dans la gamme : « 1 », « b3 », « #4 ». */
  degree: string;
  /** Texte de la pastille ; à défaut, le chiffre du degré (l'altération est dite par l'encoche). */
  label?: string;
}

/**
 * Notes d'une position pour le manche, étiquetées comme l'annotation de la tablature. Le degré s'écrit
 * sans altération (« 3 » pour la ♭3) : l'encoche et la teinte de la pastille la portent déjà, et une
 * pastille d'un caractère garde le manche entier lisible.
 */
export function neckNotes(pos: Position, kind: AnnotationKind, notation: NoteNotation = 'fr'): NeckNote[] {
  const fingers = kind === 'finger' ? fingeringsForPosition(pos) : null;
  return pos.notes.map((n) => {
    const base = { string: n.string, fret: n.fret, degree: n.degree };
    switch (kind) {
      case 'note': return { ...base, label: fmtNote(n.note, notation) };
      case 'degree': return { ...base, label: degreeDigit(n.degree) };
      case 'interval': return { ...base, label: fnToInterval(n.degree) ?? '' };
      case 'finger': {
        const f = fingers!.get(noteKey(n.string, n.fret));
        return { ...base, label: f === undefined ? '' : String(f) };
      }
      case 'none': return { ...base, label: '' };
    }
  });
}

function degreeDigit(degree: string): string {
  const p = parseFn(degree);
  return p ? String(p.num) : '?';
}

export interface NeckRange {
  from: number;
  to: number;
}

export interface NeckLayout {
  width: number;
  height: number;
  range: NeckRange;
  /** Largeur d'une case (pixels logiques) : 17 au minimum, plus si une étiquette est large. */
  fretW: number;
  /** Sillet dessiné (le cadrage commence à la case 0). */
  nut: boolean;
  /** Ordonnée de chaque corde (index 0 = corde grave, en bas). */
  stringY: number[];
  /** Abscisse de chaque frette, de `wireStart` à `range.to` (la première est le sillet quand `nut`). */
  wireX: number[];
  wireStart: number;
  labels: { x: number; y: number; text: string }[];
  numbers: { x: number; y: number; text: string }[];
  inlays: { x: number; y: number }[];
  /** Zone de la position (cases fretMin → fretMax), en fond. */
  zone: { x: number; w: number } | null;
  pills: PillLayout[];
}

/**
 * Cadrage. `full` : du sillet à la 15e case (plus loin si la position dépasse) ; `window` : une case
 * d'air de chaque côté, en collant au sillet quand la position commence en 1re ou 2e case (le sillet
 * est un repère, une fenêtre qui s'arrête juste avant le perd).
 */
export function neckRange(zone: NeckRange, mode: 'full' | 'window', maxFret = 24): NeckRange {
  if (mode === 'full') return { from: 0, to: Math.min(maxFret, Math.max(NECK_METRICS.fullTo, zone.to + 1)) };
  const from = zone.from <= 2 ? 0 : zone.from - 1;
  const to = Math.min(maxFret, Math.max(zone.to + 1, from + 4));
  return { from, to };
}

export function layoutNeck(
  tuning: Tuning,
  notes: readonly NeckNote[],
  opts: { range: NeckRange; zone?: NeckRange | null; notation?: NoteNotation },
): NeckLayout {
  const m = NECK_METRICS;
  const n = tuning.strings.length;
  const { range } = opts;
  const nut = range.from === 0;
  const labelTexts = Array.from({ length: n }, (_, s) => fmtStringLabel(tuning.strings[s]!, s === n - 1, opts.notation ?? 'fr'));
  const labelW = Math.max(...labelTexts.map(textWidth)) + 3;

  const shown = notes.filter((q) => q.fret >= range.from && q.fret <= range.to);
  const texts = shown.map((q) => q.label ?? degreeDigit(q.degree));
  const pillW = texts.map((t) => Math.max(METRICS.pillW1, textWidth(t) + 6));
  const widest = Math.max(METRICS.pillW1, ...pillW);
  const fretW = Math.max(m.fretW, widest + 2 * m.fretAir);
  const openW = Math.max(m.openW, widest + m.fretAir);

  const x0 = m.padL + labelW + (nut ? openW : 0);
  const wireStart = nut ? 0 : range.from - 1;
  const wireX = Array.from({ length: range.to - wireStart + 1 }, (_, i) => x0 + i * fretW);
  const xOfWire = (k: number) => x0 + (k - wireStart) * fretW;
  /** Centre d'une case (0 = colonne des cordes à vide). */
  const cellX = (f: number) => (f === 0 ? x0 - Math.ceil(openW / 2) - 1 : xOfWire(f - 1) + Math.floor(fretW / 2));

  const rowCenter = (row: number) => m.top + 6 + row * METRICS.stringStep;
  const stringY = Array.from({ length: n }, (_, s) => rowCenter(n - 1 - s));
  const width = wireX[wireX.length - 1]! + m.padR;
  const height = rowCenter(n - 1) + 7 + m.bottom;

  const labels = labelTexts.map((text, s) => ({ x: m.padL, y: stringY[s]! - 3, text }));

  const numY = rowCenter(n - 1) + 9;
  const numbers: NeckLayout['numbers'] = [];
  const marked = new Set(INLAYS.filter((f) => f >= Math.max(1, range.from) && f <= range.to));
  if (!nut) marked.add(range.from); // une fenêtre dit toujours où elle commence
  for (const f of [...marked].sort((a, b) => a - b)) {
    const text = String(f);
    numbers.push({ x: cellX(f) - Math.floor(textWidth(text) / 2), y: numY, text });
  }

  // incrustations entre les deux cordes du milieu (12 et 24 : une de part et d'autre)
  const inlays: NeckLayout['inlays'] = [];
  /** Point de 3 px centré entre la rangée `row` et la suivante. */
  const between = (row: number) => rowCenter(row) + Math.floor(METRICS.stringStep / 2) - 1;
  for (const f of INLAYS) {
    if (f < Math.max(1, range.from) || f > range.to) continue;
    const x = cellX(f) - 1;
    if (f % 12 === 0) inlays.push({ x, y: between(1) }, { x, y: between(n - 3) });
    else inlays.push({ x, y: between(Math.floor((n - 1) / 2)) });
  }

  const z = opts.zone;
  const zone = z && z.to >= range.from && z.from <= range.to
    ? (() => {
        const left = Math.max(range.from, z.from) === 0 ? m.padL + labelW : xOfWire(Math.max(range.from, z.from) - 1);
        const right = xOfWire(Math.min(range.to, Math.max(z.to, 0)));
        return { x: left + 1, w: Math.max(0, right - left - 1) };
      })()
    : null;

  const pills: PillLayout[] = shown.map((note, i) => {
    const w = pillW[i]!;
    return {
      x: cellX(note.fret) - Math.floor((w - 1) / 2),
      y: stringY[note.string]! - 6,
      w,
      h: METRICS.pillH,
      string: note.string,
      fret: note.fret,
      text: texts[i]!,
      fn: note.degree,
      muted: false,
      hidden: false,
      characteristic: false,
      passing: false,
      // la tonique (degré 1 juste) est cerclée : on lit la forme à partir d'elle
      highlight: note.degree === '1',
    };
  });

  return { width, height, range, fretW, nut, stringY, wireX, wireStart, labels, numbers, inlays, zone, pills };
}

export function drawNeck(s: Surface, l: NeckLayout, theme: TabTheme): void {
  const firstY = l.stringY[l.stringY.length - 1]!;
  const lastY = l.stringY[0]!;
  const left = l.nut ? l.labels[0]!.x + Math.max(...l.labels.map((q) => textWidth(q.text))) + 3 : l.wireX[0]!;
  const right = l.wireX[l.wireX.length - 1]!;

  if (l.zone) s.fillRect(l.zone.x, firstY - 6, l.zone.w, lastY - firstY + 13, mix(theme.panel, theme.barLine, 0.2));
  for (const d of l.inlays) s.fillRect(d.x, d.y, 3, 3, mix(theme.panel, theme.barLine, 0.55));

  // frettes : fines ; le sillet (3 px) dit « on est en haut du manche »
  l.wireX.forEach((x, i) => {
    if (i === 0 && l.nut) s.fillRect(x - 1, firstY - 3, 3, lastY - firstY + 7, theme.text);
    else s.fillRect(x, firstY - 3, 1, lastY - firstY + 7, theme.barLine);
  });
  for (const y of l.stringY) s.fillRect(left, y, right - left + 1, 1, theme.stringLine);

  for (const t of l.labels) drawText(s, t.x, t.y, t.text, theme.label);
  for (const t of l.numbers) drawText(s, t.x, t.y, t.text, theme.textMuted);
  // anneau de la tonique, à 1 px d'air de la pastille, dessiné avant toutes les pastilles : une voisine
  // de corde le recouvre plutôt que l'inverse
  for (const p of l.pills) {
    if (!p.highlight) continue;
    s.fillRect(p.x - 2, p.y - 2, p.w + 4, 1, theme.text);
    s.fillRect(p.x - 2, p.y + p.h + 1, p.w + 4, 1, theme.text);
    s.fillRect(p.x - 2, p.y - 2, 1, p.h + 4, theme.text);
    s.fillRect(p.x + p.w + 1, p.y - 2, 1, p.h + 4, theme.text);
  }
  for (const p of l.pills) drawPill(s, theme, p);
}
