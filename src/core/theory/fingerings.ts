/**
 * Gammes : doigtés conventionnels d'une position (annotation « doigté » de la 1b, remplie en 1d).
 *
 * Règle appliquée, corde par corde (c'est celle qu'on enseigne pour lire une position) :
 *  - l'index (1) prend la note la plus basse de la corde, l'auriculaire (4) la plus haute ;
 *  - à trois notes, la doigté du milieu dépend de l'espacement : 1-2-4 si la 2e note est collée
 *    à l'index, 1-3-4 si elle est collée à l'auriculaire (c'est la convention 1-2-4 / 1-3-4 des
 *    positions 3 notes par corde) ;
 *  - à deux notes : 1-2 (un demi-ton), 1-3 (un ton), 1-4 (un ton et demi ou plus) ;
 *  - à quatre notes : 1-2-3-4 dans l'ordre des cases ;
 *  - à cinq notes et plus : aucun doigté (il faudrait un démanché : on ne ment pas).
 *
 * LIMITE ASSUMÉE : c'est une **heuristique par corde**, pas une relecture de prof position par position.
 * Elle reproduit les doigtés usuels des boxes et des positions 3NPS (vérifié par test), et reste
 * plausible sur les fenêtres CAGED. Un doigté « officiel » alternatif existe toujours.
 */
import type { Position } from './positions';

export type Fingering = 1 | 2 | 3 | 4;

export function fingersForFrets(frets: readonly number[]): Fingering[] {
  const f = [...frets].sort((a, b) => a - b);
  const k = f.length;
  if (k === 0) return [];
  if (k === 1) return [1];
  if (k === 2) {
    const gap = f[1]! - f[0]!;
    return gap <= 1 ? [1, 2] : gap === 2 ? [1, 3] : [1, 4];
  }
  if (k === 3) {
    const s1 = f[1]! - f[0]!;
    const s2 = f[2]! - f[1]!;
    if (s1 + s2 <= 2) return [1, 2, 3];
    if (s1 === 1) return [1, 2, 4];
    if (s2 === 1) return [1, 3, 4];
    return [1, 3, 4];
  }
  if (k === 4) return [1, 2, 3, 4];
  return [];
}

/** Clé stable d'une note dans une position : `corde:case`. */
export function noteKey(string: number, fret: number): string {
  return `${string}:${fret}`;
}

/** Doigtés de toute la position (corde par corde). Les notes sans doigté fiable sont absentes de la table. */
export function fingeringsForPosition(pos: Position): Map<string, Fingering> {
  const byString = new Map<number, number[]>();
  for (const n of pos.notes) {
    const list = byString.get(n.string) ?? [];
    list.push(n.fret);
    byString.set(n.string, list);
  }
  const out = new Map<string, Fingering>();
  for (const [string, frets] of byString) {
    const fingers = fingersForFrets(frets);
    [...frets]
      .sort((a, b) => a - b)
      .forEach((fret, i) => {
        const finger = fingers[i];
        if (finger !== undefined) out.set(noteKey(string, fret), finger);
      });
  }
  return out;
}
