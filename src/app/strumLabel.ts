/**
 * Libellés de strumming pour le DOM (phase 4b, corrigé après revue visuelle).
 *
 * Les flèches « ↓ » et « ↑ » sont dessinées **dans la tablature** par la police bitmap maison, mais
 * dans le DOM elles dépendent de la police système : à 12,5 px, elles se réduisaient à deux traits
 * verticaux indiscernables (« ıı (croches) »). Les triangles pleins ▼ ▲ existent dans toutes les
 * polices à toutes les tailles et se lisent du premier coup d'œil.
 *
 * Un seul endroit décide de ce à quoi ressemble un motif de strum : les écrans ne réécrivent pas
 * les flèches à la main.
 */
import { STRUM_PATTERNS, type StrumPatternId } from '../core/tab/generators';

/** Coup vers le bas (de la corde grave vers l'aiguë). */
export const DOWN = '▼';
/** Coup vers le haut. */
export const UP = '▲';

/** Flèches d'un motif, dans l'ordre des frappes (`▼ ▼ ▲ …`). */
export function arrowsOf(pattern: StrumPatternId, sep = ' '): string {
  return STRUM_PATTERNS[pattern].map(([dir]) => (dir === 'D' ? DOWN : UP)).join(sep);
}

/** Libellé court d'un motif, pour un sélecteur : « ▼ (noires) », « ▼▲ (croches) »… */
export const PATTERN_LABEL: Readonly<Record<StrumPatternId, string>> = {
  quarters: `${DOWN} (noires)`,
  eighths: `${DOWN}${UP} (croches)`,
  universal: `${DOWN} · ${DOWN}${UP} · ${UP}${DOWN}${UP}`,
};
