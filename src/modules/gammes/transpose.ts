/**
 * Transposition : la même **forme** dans une autre tonique (MUSIC_DESIGN §3.1).
 *
 * Un guitariste qui connaît la box 1 en La mineur la rejoue en Si♭ en la glissant d'une case — à condition
 * de savoir nommer sa tonique. L'app entraîne donc deux choses séparées : le motif (moteur) et le repérage
 * de la tonique sur le manche (mémoire). Cette fonction propose une tonique **jamais vue** pour une forme,
 * dans l'orthographe que le moteur admet (aucune enharmonie inventée : `tonicSpellings` décide).
 */
import { getScale, tonicSpellings, type NoteName } from '../../core/theory';

/** Tonique jamais rencontrée pour cette gamme, en priorité une tonique simple (armure courte). */
export function unseenTonic(scaleId: string, seen: readonly string[]): NoteName | null {
  let def;
  try {
    def = getScale(scaleId);
  } catch {
    return null;
  }
  const taken = new Set(seen);
  // on parcourt les hauteurs chromatiques à partir de la tonique la plus « proche » du do
  const candidates: NoteName[] = [];
  for (let pc = 0; pc < 12; pc++) {
    for (const name of tonicSpellings(def, pc)) {
      if (!taken.has(name) && !candidates.includes(name)) candidates.push(name);
    }
  }
  return candidates[0] ?? null;
}
