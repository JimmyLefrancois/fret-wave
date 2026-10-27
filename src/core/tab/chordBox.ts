/**
 * Boîte d'accord (phase 4a) — la vue complémentaire de la décision **D1 = B** : elle n'existe que dans
 * les étapes « Découvrir » et « Construire » du module Accords, et reste désactivable.
 *
 * Pourquoi elle existe malgré la règle « tablature uniquement » : une pile de chiffres est une liste,
 * une boîte est une **géométrie**. Ce que la main doit comprendre — deux doigts voisins, un écart de
 * trois cases, un index à plat sur cinq cordes — se lit d'un coup d'œil dans une grille et pas dans
 * une colonne de nombres (MUSIC_DESIGN §7.1). La boîte ne remplace pas la tab : elle l'accompagne.
 *
 * Rendu : pixels logiques entiers, aucun lissage, mêmes couleurs de fonction d'intervalle que la
 * tablature (la couleur d'une note ne change pas d'une vue à l'autre).
 */
import { interpretChord } from '../theory/chords';
import { fretToMidi } from '../theory/fretboard';
import { TUNINGS } from '../theory/tunings';
import type { Voicing } from '../theory/voicings';
import { intervalStyle, type TabTheme } from './colors';
import { drawGlyph, drawText, glyph } from './font';
import type { Surface } from './surface';

/** Métriques en pixels logiques (S = 2 à l'écran → 138 × 174 px CSS pour une boîte 6 cordes). */
export const BOX_METRICS = {
  stringGap: 9,
  fretGap: 13,
  rows: 5,
  labelW: 11,
  padX: 5,
  padRight: 8,
  top: 14,
  bottom: 8,
  dot: 9,
} as const;

export interface BoxDot {
  x: number;
  y: number;
  w: number;
  h: number;
  string: number;
  fret: number;
  /** Fonction d'intervalle dans l'accord : « 1 », « b3 », « 5 ». */
  fn: string;
  finger: number | null;
}

export interface ChordBoxLayout {
  voicingId: string;
  chord: string;
  width: number;
  height: number;
  /** Abscisse de chaque corde (index 0 = corde grave, à gauche — sens d'une boîte d'accord). */
  stringX: number[];
  /** Ordonnées des 6 lignes de frette (rows + 1). */
  fretY: number[];
  /** Première case représentée (1 quand le sillet est dessiné). */
  baseFret: number;
  /** Sillet épais (aucune frette au-dessus de la fenêtre). */
  nut: boolean;
  dots: BoxDot[];
  /** Cordes à vide : rond au-dessus du sillet. */
  open: { x: number; y: number; string: number }[];
  /** Cordes non jouées : croix au-dessus du sillet. */
  muted: { x: number; y: number; string: number }[];
  barre: { x: number; y: number; w: number; h: number; fret: number; fromString: number; toString: number } | null;
  /** Case à afficher à gauche (fenêtre au-delà de la 1re case). */
  fretLabel: string | null;
  /** Corde mise en avant (étape « Construire ») : anneau blanc autour de la pastille. */
  highlight: number | null;
}

/**
 * Géométrie d'une boîte d'accord. La fenêtre commence à la première case frettée (ou à la case 1 si
 * l'accord est entièrement à vide) et montre **5 cases** — l'étendue maximale admise par la base de
 * voicings, donc aucune forme ne peut sortir du cadre par construction.
 */
export function layoutChordBox(
  v: Voicing,
  opts: {
    highlight?: number | null;
    /**
     * Cordes **pas encore posées** (étape « Construire ») : elles ne sont ni jouées, ni étouffées —
     * elles n'existent pas encore. On ne dessine donc ni pastille, ni X, ni rond : la boîte se remplit
     * doigt par doigt, comme la main.
     */
    pending?: readonly number[];
  } = {},
): ChordBoxLayout {
  // seules les cordes **frettées** peuvent être « pas encore posées » : une corde à vide ou étouffée
  // n'a pas de doigt à poser, et doit être visible dès le premier geste (sinon l'élève gratte les six)
  const pending = new Set((opts.pending ?? []).filter((s) => (v.frets[s] ?? 0) > 0));
  const tuning = TUNINGS[v.tuningId];
  if (!tuning) throw new Error(`accordage inconnu : ${v.tuningId}`);
  const n = v.frets.length;
  const m = BOX_METRICS;
  const width = m.padX + m.labelW + (n - 1) * m.stringGap + m.padRight;
  const height = m.top + m.rows * m.fretGap + m.bottom;
  const stringX = Array.from({ length: n }, (_, i) => m.padX + m.labelW + i * m.stringGap);
  const fretY = Array.from({ length: m.rows + 1 }, (_, r) => m.top + r * m.fretGap);

  const fretted = v.frets.filter((f): f is number => f !== null && f > 0);
  const minFret = fretted.length ? Math.min(...fretted) : 1;
  // une corde à vide **jouée** ancre la forme au sillet : la fenêtre commence à la case 1, même si le
  // doigt le plus bas est à la case 2 (Em = 022000, le rond du Mi grave est au-dessus du sillet)
  const hasOpen = v.frets.some((f) => f === 0);
  const baseFret = hasOpen || minFret <= 1 ? 1 : minFret;
  const nut = baseFret === 1;

  const info = interpretChord(v.chord);
  const fnByPc = new Map(info.pitchClasses.map((pc, i) => [((pc % 12) + 12) % 12, info.degrees[i]!]));

  const dots: BoxDot[] = [];
  const open: ChordBoxLayout['open'] = [];
  const muted: ChordBoxLayout['muted'] = [];
  v.frets.forEach((fret, string) => {
    const x = stringX[string]!;
    if (pending.has(string)) return;
    if (fret === null) {
      muted.push({ x, y: m.top - 12, string });
      return;
    }
    if (fret === 0) {
      open.push({ x, y: m.top - 12, string });
      return;
    }
    const row = fret - baseFret;
    if (row < 0 || row >= m.rows) return; // impossible par validation (étendue ≤ 4 cases) — garde-fou
    const midi = fretToMidi(tuning, string, fret);
    const fn = fnByPc.get(((midi % 12) + 12) % 12) ?? '1';
    const finger = v.fingers?.[string];
    dots.push({
      x: x - 4,
      y: fretY[row]! + 2,
      w: m.dot,
      h: m.dot,
      string,
      fret,
      fn,
      finger: typeof finger === 'number' && finger > 0 ? finger : null,
    });
  });

  const barre = v.barre && v.barre.fret >= baseFret && v.barre.fret < baseFret + m.rows
    ? (() => {
        const from = Math.min(v.barre!.fromString, v.barre!.toString);
        const to = Math.max(v.barre!.fromString, v.barre!.toString);
        const y = fretY[v.barre!.fret - baseFret]! + 2 + 2;
        return { x: stringX[from]!, y, w: stringX[to]! - stringX[from]!, h: 5, fret: v.barre!.fret, fromString: from, toString: to };
      })()
    : null;

  return {
    voicingId: v.id,
    chord: v.chord,
    width,
    height,
    stringX,
    fretY,
    baseFret,
    nut,
    dots,
    open,
    muted,
    barre,
    fretLabel: nut ? null : String(baseFret),
    highlight: opts.highlight ?? null,
  };
}

/** Rendu de la boîte : silhouettes seules, couleurs de fonction sur les pastilles. */
export function drawChordBox(s: Surface, l: ChordBoxLayout, theme: TabTheme): void {
  const lastY = l.fretY[l.fretY.length - 1]!;
  const firstX = l.stringX[0]!;
  const lastX = l.stringX[l.stringX.length - 1]!;

  // cordes
  for (const x of l.stringX) s.fillRect(x, l.fretY[0]!, 1, lastY - l.fretY[0]! + 1, theme.stringLine);
  // frettes : toutes fines, sauf le sillet (4 px) qui dit « on est en haut du manche »
  for (let r = 1; r < l.fretY.length; r++) s.fillRect(firstX, l.fretY[r]!, lastX - firstX + 1, 1, theme.barLine);
  if (l.nut) s.fillRect(firstX - 1, l.fretY[0]!, lastX - firstX + 3, 4, theme.text);
  else s.fillRect(firstX, l.fretY[0]!, lastX - firstX + 1, 1, theme.barLine);

  // barré : barre pleine sous les pastilles
  if (l.barre) s.fillRect(l.barre.x - 2, l.barre.y, l.barre.w + 5, l.barre.h, theme.barre);

  // cordes étouffées / à vide (au-dessus du sillet)
  for (const o of l.muted) drawGlyph(s, glyph('×'), o.x - 2, o.y, theme.unplayed);
  for (const o of l.open) drawGlyph(s, glyph('o'), o.x - 2, o.y, theme.label);

  // pastilles (même code couleur que la tablature)
  for (const d of l.dots) {
    const st = intervalStyle(d.fn);
    s.fillRect(d.x, d.y, d.w, d.h, st.fill);
    // coins coupés de la fondamentale, comme dans la tablature
    if (st.root) {
      s.fillRect(d.x, d.y, 1, 1, theme.panel);
      s.fillRect(d.x + d.w - 1, d.y, 1, 1, theme.panel);
      s.fillRect(d.x, d.y + d.h - 1, 1, 1, theme.panel);
      s.fillRect(d.x + d.w - 1, d.y + d.h - 1, 1, 1, theme.panel);
    }
    if (d.finger !== null) drawText(s, d.x + 2, d.y + 1, String(d.finger), st.digit);
  }

  // étape « Construire » : la corde à poser est cerclée de blanc (2 px), sans changer sa couleur
  if (l.highlight !== null) {
    const d = l.dots.find((q) => q.string === l.highlight);
    if (d) {
      s.fillRect(d.x - 2, d.y - 2, d.w + 4, 1, theme.cursorCore);
      s.fillRect(d.x - 2, d.y + d.h + 1, d.w + 4, 1, theme.cursorCore);
      s.fillRect(d.x - 2, d.y - 2, 1, d.h + 4, theme.cursorCore);
      s.fillRect(d.x + d.w + 1, d.y - 2, 1, d.h + 4, theme.cursorCore);
    }
  }

  // repère de case (fenêtre au-delà de la 1re case)
  if (l.fretLabel) drawText(s, 1, l.fretY[0]! + 3, l.fretLabel, theme.label);
}
