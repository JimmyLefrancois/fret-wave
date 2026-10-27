/**
 * Layout PUR de la tablature : TabScore → coordonnées en pixels logiques (aucun accès au canvas).
 * Testable sans navigateur ; le rendu (render.ts) ne fait que dessiner ce que ce module décrit.
 *
 * Géométrie (pixels logiques, PROJECT.md §4.9) :
 *  - pastille 11×13 (1 chiffre) ou 17×13 (2 chiffres) : contour 1 + remplissage 2 autour d'un glyphe 5×7 ;
 *  - pas de 14 px entre cordes → 1 px d'air entre deux pastilles voisines d'une pile d'accord ;
 *  - de haut en bas : en-tête (noms d'accords, chiffrage) · cordes · flèches de strum · rythme · annotation.
 */
import { fmtChord, fmtNote, fmtStringLabel } from '../theory/notation';
import type { ChordNotation, NoteNotation } from '../theory/types';
import { textWidth } from './font';
import {
  beamCount, beatTicksFor, fnToInterval, measureLength, measureStarts, noteValue, timeSigOf, totalTicks,
  type TabEvent, type TabNote, type TabScore,
} from './model';

export const METRICS = {
  stringStep: 14,
  pillH: 13,
  pillW1: 11,
  pillW2: 17,
  glyphH: 7,
  /** marge haute (glow, triangle du curseur) */
  topPad: 3,
  textRow: 10,
  arrowH: 7,
  rhythmH: 13,
  tupletH: 8,
  annotationH: 7,
  systemGap: 6,
  bottomPad: 4,
  barPadL: 3,
  barPadR: 2,
} as const;

export type AnnotationKind = 'none' | 'note' | 'degree' | 'interval' | 'finger';

export interface LayoutOptions {
  /** scroll : une seule ligne continue (curseur fixe, mobile) ; wrap : retour à la ligne (étude, grand écran). */
  mode: 'scroll' | 'wrap';
  /** Largeur logique maximale d'une ligne (mode wrap). */
  maxWidth?: number;
  notes: NoteNotation;
  chords: ChordNotation;
  annotation: AnnotationKind;
  /** change : la pile est redessinée au début de chaque mesure et aux changements d'accord (« simile ») ; all : à chaque frappe. */
  stacks: 'change' | 'all';
  /** Pixels logiques par noire (espacement proportionnel au temps). */
  pxPerQuarter?: number;
  /** Mode débutant : masque hampes, ligatures et silences (la tablature ne garde que les pastilles). */
  hideRhythm?: boolean;
  /** Fonction d'intervalle à mettre en évidence (exercice « montre-moi la ♭3 »). */
  highlightFn?: string;
  /**
   * Calque « notes de l'accord » : estompe les notes qui ne sont pas des notes de l'accord
   * (elles doivent porter `chordTone`, sinon rien n'est estompé).
   */
  emphasizeChordTones?: boolean;
  /** Trou actuellement désigné dans un exercice de mémorisation (`${columnIndex}:${string}`). */
  activeHoleKey?: string;
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  mode: 'wrap', maxWidth: 190, notes: 'fr', chords: 'en', annotation: 'none', stacks: 'change',
};

export type TextRole = 'chord' | 'roman' | 'label' | 'annotation' | 'string' | 'tempo';

export interface TextItem {
  x: number;
  y: number;
  text: string;
  role: TextRole;
}

export interface PillLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  string: number;
  fret: number;
  text: string;
  fn: string;
  muted: boolean;
  hidden: boolean;
  characteristic: boolean;
  passing: boolean;
  /** Estompée : la note n'est pas une note de l'accord alors que le calque « accord » est actif. */
  dim?: boolean;
  /** Mise en évidence par un exercice (anneau blanc). */
  highlight?: boolean;
  /** Trou désigné par l'utilisateur dans l'exercice de mémorisation (anneau du curseur). */
  active?: boolean;
}

export type RhythmItem =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'sprite'; name: string; x: number; y: number }
  | { kind: 'text'; x: number; y: number; text: string };

export interface ColumnLayout {
  /** Rang global (toutes lignes confondues). */
  index: number;
  systemIndex: number;
  measureIndex: number;
  eventIndex: number;
  /** Tick absolu du début de l'événement. */
  absTick: number;
  durTick: number;
  kind: 'notes' | 'rest';
  /** Bord gauche de la colonne, largeur, et abscisse de l'axe (chiffres, hampe, flèche, curseur). */
  x: number;
  w: number;
  cx: number;
  /** La pile est dessinée (sinon : simile, seule la flèche l'est). */
  stack: boolean;
  pills: PillLayout[];
  unplayed: Array<{ cx: number; y: number }>;
  arrow?: { dir: 'D' | 'U'; x: number; y: number };
  barre?: { x: number; y0: number; y1: number };
  /** Annotation par note à droite des pastilles d'une pile (sinon sous la tab). */
  sideAnnotations: TextItem[];
}

export interface MeasureLayout {
  index: number;
  /** Abscisse de la barre de gauche ; `endX` = abscisse de la barre de droite. */
  x: number;
  endX: number;
  tickStart: number;
  tickEnd: number;
  firstColumn: number;
  lastColumn: number;
}

export interface BarLine {
  x: number;
  /** thin : 1 px ; thick : 2 px (fin de morceau). */
  kind: 'thin' | 'thick';
}

export interface SystemLayout {
  index: number;
  y: number;
  height: number;
  /** Bord gauche de la première barre ; largeur totale. */
  x0: number;
  width: number;
  /** Ordonnée (absolue) de la ligne de chaque corde, de la plus aiguë (haut) à la plus grave. */
  stringYs: number[];
  tabTop: number;
  tabBottom: number;
  /** Rangée de rythme : ordonnée du haut de la hampe (ou bas de la tab si le rythme est masqué). */
  rhythmY: number;
  /** Mode « débutant » : aucune rangée de rythme dessinée. */
  noRhythm?: boolean;
  measures: MeasureLayout[];
  bars: BarLine[];
  texts: TextItem[];
  rhythm: RhythmItem[];
  timeSig?: { x: number; y: number; num: number; den: number };
}

export interface ScoreLayout {
  width: number;
  height: number;
  systems: SystemLayout[];
  columns: ColumnLayout[];
  measures: MeasureLayout[];
  options: LayoutOptions;
  totalTicks: number;
  /** Largeur de la colonne d'étiquettes (noms des cordes). */
  labelW: number;
  /** Positions verticales relatives au haut d'une ligne (identiques pour toutes les lignes). */
  rows: { tabTop: number; arrowsY: number | null; rhythmY: number; annotationY: number | null; systemH: number };
}

// ---------------------------------------------------------------------------
// Textes d'affichage
// ---------------------------------------------------------------------------

/** « b3 » → « ♭3 », « #4 » → « ♯4 », « bb7 » → « 𝄫7 ». */
export function fmtFn(fn: string): string {
  return fn.replace(/^bb/, '𝄫').replace(/^##/, '𝄪').replace(/^b/, '♭').replace(/^#/, '♯');
}

export function annotationText(n: TabNote, kind: AnnotationKind, notation: NoteNotation): string {
  if (kind === 'none' || n.hidden || n.muted) return '';
  switch (kind) {
    case 'note': return fmtNote(n.note, notation);
    case 'degree': return fmtFn(n.fn);
    case 'interval': return fnToInterval(n.fn) ?? '';
    case 'finger': return n.finger === undefined ? '' : String(n.finger);
  }
}

function pillWidth(n: TabNote): number {
  return n.muted || n.fret < 10 ? METRICS.pillW1 : METRICS.pillW2;
}

function pillText(n: TabNote): string {
  return n.muted ? 'x' : String(n.fret);
}

// ---------------------------------------------------------------------------
// Plans (étape 1 : tout ce qui ne dépend pas de la position)
// ---------------------------------------------------------------------------

interface ColPlan {
  mi: number;
  ei: number;
  ev: TabEvent;
  abs: number;
  showStack: boolean;
  half: number;
  left: number;
  right: number;
  natural: number;
  w: number;
  annW: number;
  hasBarre: boolean;
}

interface MeasurePlan {
  index: number;
  cols: ColPlan[];
  padL: number;
  width: number;
  tsW: number;
  tickStart: number;
  tickEnd: number;
}

function stackKey(ev: TabEvent): string {
  return ev.notes.map((n) => `${n.string}:${n.fret}`).join(',');
}

function planColumns(score: TabScore, o: LayoutOptions): MeasurePlan[] {
  const starts = measureStarts(score);
  const ppq = o.pxPerQuarter ?? 36;
  let prevKey = '';
  return score.measures.map((m, mi) => {
    let tsW = 0;
    const ts = timeSigOf(score, mi);
    const prevTs = mi > 0 ? timeSigOf(score, mi - 1) : null;
    if (mi === 0 || (prevTs && (prevTs[0] !== ts[0] || prevTs[1] !== ts[1]))) {
      // Largeur réservée à la signature : la signature est dessinée **empilée** (numérateur au-dessus
      // du dénominateur), donc un chiffre de large. Une signature écrite « 4/4 » horizontalement
      // débordait sur la pastille du premier accord (défaut vu sur capture, phase 4a).
      tsW = Math.max(textWidth(String(ts[0])), textWidth(String(ts[1]))) + 2;
    }
    const cols: ColPlan[] = m.events.map((ev, ei) => {
      const isStackEvent = ev.kind === 'notes' && ev.notes.length >= 2;
      const key = stackKey(ev);
      const showStack = ev.kind === 'notes' && (!isStackEvent || o.stacks === 'all' || ei === 0 || key !== prevKey);
      if (isStackEvent) prevKey = key;
      else if (ev.kind === 'notes') prevKey = '';
      let half = 2;
      let annW = 0;
      let hasBarre = false;
      if (showStack) {
        half = Math.max(...ev.notes.map((n) => (pillWidth(n) - 1) / 2));
        if (isStackEvent && o.annotation !== 'none') {
          annW = Math.max(0, ...ev.notes.map((n) => textWidth(annotationText(n, o.annotation, o.notes))));
        }
        hasBarre = !!ev.barre;
      }
      const left = half + (hasBarre ? 4 : 0);
      const right = half + (annW > 0 ? 3 + annW : 0);
      const natural = 1 + left + right + 2;
      const w = Math.max(natural, Math.round((ev.durTick * ppq) / 480));
      return { mi, ei, ev, abs: starts[mi]! + ev.startTick, showStack, half, left, right, natural, w, annW, hasBarre };
    });
    const padL = METRICS.barPadL + tsW;
    const width = 1 + padL + cols.reduce((s, c) => s + c.w, 0) + METRICS.barPadR;
    return { index: mi, cols, padL, width, tsW, tickStart: starts[mi]!, tickEnd: starts[mi]! + measureLength(score, mi) };
  });
}

// ---------------------------------------------------------------------------
// Mise en page
// ---------------------------------------------------------------------------

function stringLabels(score: TabScore, notation: NoteNotation): string[] {
  const n = score.stringCount;
  // de l'aiguë (haut) à la grave (bas)
  return Array.from({ length: n }, (_, row) => {
    const s = n - 1 - row;
    return fmtStringLabel(score.tuning.strings[s]!, s === n - 1, notation);
  });
}

/** Répartit `extra` pixels entiers sur les colonnes proportionnellement à leur largeur (arrondi cumulé, somme exacte). */
function distribute(widths: number[], extra: number): number[] {
  const total = widths.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  let acc = 0;
  let given = 0;
  for (const w of widths) {
    acc += (extra * w) / total;
    const target = Math.round(acc);
    out.push(w + (target - given));
    given = target;
  }
  return out;
}

export function layoutScore(score: TabScore, options: LayoutOptions = DEFAULT_LAYOUT): ScoreLayout {
  const o = options;
  const N = score.stringCount;
  const plans = planColumns(score, o);

  // --- présence des rangées (identique pour toutes les lignes : l'œil retrouve les mêmes repères)
  let anyChord = false;
  let anyLine2 = false;
  let anyArrow = false;
  let anyTuplet = false;
  let anySingleAnn = false;
  const shownChord = (mi: number, ei: number): string | undefined => {
    const ev = score.measures[mi]!.events[ei]!;
    return ev.chord ?? (ei === 0 ? score.measures[mi]!.label?.chord : undefined);
  };
  score.measures.forEach((m, mi) => {
    if (m.label?.roman || m.label?.text) anyLine2 = true;
    m.events.forEach((ev, ei) => {
      if (shownChord(mi, ei)) anyChord = true;
      if (ev.strum) anyArrow = true;
      if (ev.tuplet) anyTuplet = true;
      if (ev.barre) anyLine2 = true;
      if (o.annotation !== 'none' && ev.notes.length === 1) anySingleAnn = true;
    });
  });
  const headerH = METRICS.topPad + (anyChord ? METRICS.textRow : 0) + (anyLine2 ? METRICS.textRow : 0) + (anyChord || anyLine2 ? 3 : 0);
  const tabTop = headerH;
  const stringYsRel = Array.from({ length: N }, (_, i) => tabTop + 6 + METRICS.stringStep * i);
  const tabBottom = tabTop + METRICS.pillH + METRICS.stringStep * (N - 1);
  let y = tabBottom;
  let arrowsY: number | null = null;
  if (anyArrow) {
    arrowsY = y + 2;
    y = arrowsY + METRICS.arrowH;
  }
  // mode « débutant » : ni hampes, ni ligatures, ni silences
  const noRhythm = !!o.hideRhythm;
  const rhythmY = noRhythm ? y : y + 2;
  if (!noRhythm) y = rhythmY + METRICS.rhythmH + (anyTuplet ? METRICS.tupletH : 0);
  let annotationY: number | null = null;
  if (anySingleAnn) {
    annotationY = y + 1;
    y = annotationY + METRICS.annotationH;
  }
  const systemH = y + METRICS.bottomPad;

  // --- colonne d'étiquettes (noms des cordes)
  const labels = stringLabels(score, o.notes);
  const labelW = Math.max(...labels.map(textWidth));
  const x0 = 1 + labelW + 2;

  // --- répartition des mesures en lignes
  const maxW = o.maxWidth ?? 190;
  const groups: MeasurePlan[][] = [];
  if (o.mode === 'scroll') {
    groups.push(plans);
  } else {
    let cur: MeasurePlan[] = [];
    let used = x0 + 2;
    for (const p of plans) {
      if (cur.length > 0 && used + p.width > maxW) {
        groups.push(cur);
        cur = [];
        used = x0 + 2;
      }
      cur.push(p);
      used += p.width;
    }
    if (cur.length) groups.push(cur);
  }

  const systems: SystemLayout[] = [];
  const columns: ColumnLayout[] = [];
  const allMeasures: MeasureLayout[] = [];
  let sy = 0;

  groups.forEach((group, si) => {
    const isLast = si === groups.length - 1;
    // largeur naturelle puis justification (lignes non finales en mode wrap)
    const natural = x0 + group.reduce((s, p) => s + p.width, 0) + 1;
    const colWidths = group.flatMap((p) => p.cols.map((c) => c.w));
    let widths = colWidths;
    if (o.mode === 'wrap' && !isLast && natural < maxW && colWidths.length > 0) {
      widths = distribute(colWidths, maxW - natural);
    }
    let wi = 0;

    const stringYs = stringYsRel.map((v) => sy + v); // ligne 0 = corde la plus aiguë (haut)
    const sys: SystemLayout = {
      index: si, y: sy, height: systemH, x0, width: 0, stringYs,
      tabTop: sy + tabTop, tabBottom: sy + tabBottom, rhythmY: sy + rhythmY, ...(noRhythm ? { noRhythm: true } : {}),
      measures: [], bars: [], texts: [], rhythm: [],
    };

    // étiquettes de cordes
    labels.forEach((text, row) => sys.texts.push({ x: 1, y: stringYs[row]! - 3, text, role: 'string' }));

    let mx = x0;
    let lastChord: string | undefined;
    group.forEach((p) => {
      const m = score.measures[p.index]!;
      sys.bars.push({ x: mx, kind: 'thin' });
      let cursor = mx + 1 + p.padL;
      const firstCol = columns.length;
      const colLayouts: ColumnLayout[] = [];
      let line2Parts: string[] = [];
      if (m.label?.roman) line2Parts.push(fmtRomanLabel(m.label.roman));
      if (m.label?.text) line2Parts.push(m.label.text);
      let barreLabel = false;

      p.cols.forEach((c) => {
        const w = widths[wi++]!;
        const cx = cursor + 1 + c.left;
        const col = buildColumn(c, w, cursor, cx, columns.length, si, stringYs, arrowsY === null ? null : sy + arrowsY, annotationY === null ? null : sy + annotationY, o, N);
        columns.push(col);
        colLayouts.push(col);
        // noms d'accords : à chaque changement, et au début de chaque ligne
        const chord = shownChord(c.mi, c.ei);
        if (chord && chord !== lastChord) {
          sys.texts.push({ x: cursor + 1, y: sy + METRICS.topPad, text: fmtChord(chord, o.chords), role: 'chord' });
          lastChord = chord;
        }
        if (c.ev.barre && c.showStack && !barreLabel) {
          line2Parts.push(`B${c.ev.barre.fret}`);
          barreLabel = true;
        }
        cursor += w;
      });
      if (line2Parts.length) {
          sys.texts.push({
          x: mx + 1 + p.padL + 1,
          y: sy + METRICS.topPad + (anyChord ? METRICS.textRow : 0),
          text: line2Parts.join(' '),
          role: m.label?.roman ? 'roman' : 'label',
        });
      }
      const endX = cursor + METRICS.barPadR;
      const ml: MeasureLayout = {
        index: p.index, x: mx, endX, tickStart: p.tickStart, tickEnd: p.tickEnd,
        firstColumn: firstCol, lastColumn: columns.length - 1,
      };
      sys.measures.push(ml);
      allMeasures.push(ml);
      if (!noRhythm) buildRhythm(score, p.index, colLayouts, sys, sy + rhythmY, anyTuplet);
      if (p.tsW > 0) {
        const ts = timeSigOf(score, p.index);
        // en tête de portée (première ligne), pas au milieu des cordes
        sys.timeSig = sys.timeSig ?? { x: mx + 1 + METRICS.barPadL, y: stringYs[0]! - 3, num: ts[0], den: ts[1] };
      }
      mx = endX;
    });
    // barre de fin de ligne
    sys.bars.push(isLast ? { x: mx, kind: 'thick' } : { x: mx, kind: 'thin' });
    sys.width = mx + (isLast ? 4 : 1);
    systems.push(sys);
    sy += systemH + (isLast ? 0 : METRICS.systemGap);
  });

  const width = Math.max(...systems.map((s) => s.width));
  return {
    width, height: sy, systems, columns, measures: allMeasures, options: o, totalTicks: totalTicks(score), labelW,
    rows: { tabTop, arrowsY, rhythmY, annotationY, systemH },
  };
}

function fmtRomanLabel(r: string): string {
  // les degrés romans avec altération (bII, #IV) : mêmes glyphes que le reste de l'app
  return r.replace(/^b/, '♭').replace(/^#/, '♯').replace(/dim$/, '°').replace(/m7b5$/, 'ø');
}

function buildColumn(
  c: ColPlan, w: number, colX: number, cx: number, index: number, systemIndex: number, stringYs: number[],
  arrowsAbsY: number | null, annAbsY: number | null, o: LayoutOptions, N: number,
): ColumnLayout {
  const col: ColumnLayout = {
    index, systemIndex, measureIndex: c.mi, eventIndex: c.ei, absTick: c.abs, durTick: c.ev.durTick,
    kind: c.ev.kind, x: colX, w, cx, stack: c.showStack, pills: [], unplayed: [], sideAnnotations: [],
  };
  const rowOf = (string: number) => N - 1 - string;
  if (c.showStack) {
    for (const n of c.ev.notes) {
      const yc = stringYs[rowOf(n.string)]!;
      const pw = pillWidth(n);
      col.pills.push({
        x: cx - (pw - 1) / 2, y: yc - 6, w: pw, h: METRICS.pillH, string: n.string, fret: n.fret,
        text: pillText(n), fn: n.fn, muted: !!n.muted, hidden: !!n.hidden,
        characteristic: !!n.characteristic, passing: !!n.passing,
        ...(o.emphasizeChordTones && n.chordTone === false ? { dim: true } : {}),
        ...(o.highlightFn && n.fn === o.highlightFn ? { highlight: true } : {}),
        ...(o.activeHoleKey && `${index}:${n.string}` === o.activeHoleKey ? { active: true } : {}),
      });
      if (c.ev.notes.length >= 2 && o.annotation !== 'none') {
        const text = annotationText(n, o.annotation, o.notes);
        if (text) col.sideAnnotations.push({ x: cx + c.half + 3, y: yc - 3, text, role: 'annotation' });
      } else if (c.ev.notes.length === 1 && annAbsY !== null) {
        const text = annotationText(n, o.annotation, o.notes);
        if (text) col.sideAnnotations.push({ x: cx - Math.floor(textWidth(text) / 2), y: annAbsY, text, role: 'annotation' });
      }
    }
    for (const u of c.ev.unplayed ?? []) col.unplayed.push({ cx, y: stringYs[rowOf(u)]! });
    if (c.ev.barre) {
      const top = stringYs[rowOf(Math.max(c.ev.barre.fromString, c.ev.barre.toString))]!;
      const bottom = stringYs[rowOf(Math.min(c.ev.barre.fromString, c.ev.barre.toString))]!;
      col.barre = { x: cx - c.half - 3, y0: top - 6, y1: bottom + 6 };
    }
  }
  if (c.ev.strum && arrowsAbsY !== null) col.arrow = { dir: c.ev.strum.dir, x: cx - 2, y: arrowsAbsY };
  return col;
}

// ---------------------------------------------------------------------------
// Rythme : hampes, ligatures, crochets, points, silences
// ---------------------------------------------------------------------------

function buildRhythm(score: TabScore, mi: number, cols: ColumnLayout[], sys: SystemLayout, ry: number, anyTuplet: boolean): void {
  const m = score.measures[mi]!;
  const beat = beatTicksFor(timeSigOf(score, mi));
  const out = sys.rhythm;
  const rect = (x: number, y: number, w: number, h: number) => out.push({ kind: 'rect', x, y, w, h });

  interface Item { col: ColumnLayout; ev: TabEvent; beams: number; base: string; dots: number; stem: boolean }
  const items: Item[] = m.events.map((ev, i) => {
    const nv = noteValue(ev.durTick, ev.tuplet);
    const base = nv?.base ?? 'q';
    return {
      col: cols[i]!, ev, base, dots: nv?.dots ?? 0,
      beams: ev.kind === 'rest' ? 0 : beamCount(base),
      stem: ev.kind === 'notes' && base !== 'w',
    };
  });

  // groupes de ligatures : événements consécutifs, avec ligature, dans le même temps (et même tuplet)
  const groups: Item[][] = [];
  let cur: Item[] = [];
  const sameBeat = (a: Item, b: Item) =>
    Math.floor(a.ev.startTick / beat) === Math.floor(b.ev.startTick / beat) &&
    (a.ev.tuplet?.actual ?? 0) === (b.ev.tuplet?.actual ?? 0);
  for (const it of items) {
    if (it.beams > 0 && cur.length > 0 && sameBeat(cur[cur.length - 1]!, it)) cur.push(it);
    else {
      if (cur.length) groups.push(cur);
      cur = it.beams > 0 ? [it] : [];
    }
  }
  if (cur.length) groups.push(cur);
  const grouped = new Set(groups.filter((g) => g.length > 1).flat());

  const stemEnd = ry + 9;
  for (const it of items) {
    const cx = it.col.cx;
    if (it.ev.kind === 'rest') {
      const name = it.base === 'w' ? 'rest-w' : it.base === 'h' ? 'rest-h' : it.base === 'q' ? 'rest-q' : it.base === 'e' ? 'rest-e' : 'rest-s';
      out.push({ kind: 'sprite', name, x: cx - 2, y: ry + 1 });
    } else if (it.base === 'w') {
      // ronde : anneau 5×3
      rect(cx - 2, ry + 3, 5, 1);
      rect(cx - 2, ry + 5, 5, 1);
      rect(cx - 2, ry + 4, 1, 1);
      rect(cx + 2, ry + 4, 1, 1);
    } else {
      rect(cx, ry, 1, 9);
      if (it.base === 'h') {
        rect(cx - 1, ry + 9, 3, 1);
        rect(cx - 1, ry + 11, 3, 1);
        rect(cx - 1, ry + 10, 1, 1);
        rect(cx + 1, ry + 10, 1, 1);
      }
    }
    // points
    for (let d = 0; d < it.dots; d++) rect(cx + 3 + d * 3, ry + (it.base === 'h' ? 10 : 9), 2, 2);
    // crochet isolé (pas dans un groupe ligaturé) : fanion vers la droite
    if (it.stem && it.beams > 0 && !grouped.has(it)) {
      for (let b = 0; b < it.beams; b++) rect(cx + 1, stemEnd - 2 - b * 3, 4, 2);
    }
  }

  // ligatures des groupes
  for (const g of groups) {
    if (g.length < 2) continue;
    const maxBeams = Math.max(...g.map((i) => i.beams));
    for (let level = 1; level <= maxBeams; level++) {
      const by = stemEnd - 2 - (level - 1) * 3;
      let i = 0;
      while (i < g.length) {
        if (g[i]!.beams < level) { i++; continue; }
        let j = i;
        while (j + 1 < g.length && g[j + 1]!.beams >= level) j++;
        if (j > i) rect(g[i]!.col.cx, by, g[j]!.col.cx - g[i]!.col.cx + 1, 2);
        else {
          // ligature partielle isolée : petit bout vers le voisin
          const toRight = i + 1 < g.length;
          rect(toRight ? g[i]!.col.cx : g[i]!.col.cx - 3, by, 4, 2);
        }
        i = j + 1;
      }
    }
    if (g[0]!.ev.tuplet && anyTuplet) {
      const mid = Math.round((g[0]!.col.cx + g[g.length - 1]!.col.cx) / 2);
      out.push({ kind: 'text', x: mid - 2, y: ry + METRICS.rhythmH - 1, text: String(g[0]!.ev.tuplet.actual) });
    }
  }
}

// ---------------------------------------------------------------------------
// Curseur
// ---------------------------------------------------------------------------

export interface CursorPos {
  x: number;
  systemIndex: number;
  /** Colonne dont l'événement est en cours. */
  columnIndex: number;
}

/**
 * Position du curseur pour un tick absolu : interpolation linéaire entre les axes des événements d'une
 * mesure, puis jusqu'à la barre de fin ; saut à la mesure suivante. Hors bornes : première / dernière position.
 */
export function cursorAt(layout: ScoreLayout, tick: number): CursorPos {
  const cols = layout.columns;
  if (cols.length === 0) return { x: 0, systemIndex: 0, columnIndex: 0 };
  if (tick <= cols[0]!.absTick) return { x: cols[0]!.cx, systemIndex: cols[0]!.systemIndex, columnIndex: 0 };
  // dernière colonne dont absTick ≤ tick
  let lo = 0;
  let hi = cols.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cols[mid]!.absTick <= tick) lo = mid;
    else hi = mid - 1;
  }
  const c = cols[lo]!;
  const next = cols[lo + 1];
  const measure = layout.measures.find((m) => m.index === c.measureIndex)!;
  const sameMeasure = next && next.measureIndex === c.measureIndex;
  const toX = sameMeasure ? next!.cx : measure.endX - 1;
  const toTick = sameMeasure ? next!.absTick : measure.tickEnd;
  const t = Math.max(0, Math.min(1, (tick - c.absTick) / (toTick - c.absTick)));
  return { x: c.cx + (toX - c.cx) * t, systemIndex: c.systemIndex, columnIndex: lo };
}
