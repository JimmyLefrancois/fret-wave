/**
 * Transposition : la même **forme** dans une autre tonique (MUSIC_DESIGN §3.1).
 *
 * Un guitariste qui connaît la box 1 en La mineur la rejoue en Si♭ en la glissant d'une case — à condition
 * de savoir nommer sa tonique. L'app entraîne donc deux choses séparées : le motif (moteur) et le repérage
 * de la tonique sur le manche (mémoire). Cette fonction propose une tonique **jamais vue** pour une forme,
 * dans l'orthographe que le moteur admet (aucune enharmonie inventée : `tonicSpellings` décide).
 */
import { generatePositions, getScale, tonicSpellings, TUNINGS, type NoteName, type PositionSystem } from '../../core/theory';
import { zoneOf } from '../../core/progress';

/** Toniques jamais rencontrées, dans l'ordre chromatique depuis le do (orthographes du moteur). */
function unseenTonics(scaleId: string, seen: readonly string[]): NoteName[] {
  let def;
  try {
    def = getScale(scaleId);
  } catch {
    return [];
  }
  const taken = new Set(seen);
  // on parcourt les hauteurs chromatiques à partir de la tonique la plus « proche » du do
  const candidates: NoteName[] = [];
  for (let pc = 0; pc < 12; pc++) {
    for (const name of tonicSpellings(def, pc)) {
      if (!taken.has(name) && !candidates.includes(name)) candidates.push(name);
    }
  }
  return candidates;
}

/** Tonique jamais rencontrée pour cette gamme, en priorité une tonique simple (armure courte). */
export function unseenTonic(scaleId: string, seen: readonly string[]): NoteName | null {
  return unseenTonics(scaleId, seen)[0] ?? null;
}

/**
 * Tonique jamais vue **et** qui place la forme dans une zone du manche absente de `zones` (MUSIC_DESIGN
 * §3.1, G1.4) : même dessin, autre case. Même ordre que `unseenTonic` ; `null` si aucune ne convient.
 */
export function unseenZoneTonic(
  scaleId: string, system: PositionSystem, formIndex: number, tuningId: string,
  zones: readonly number[], seen: readonly string[],
): NoteName | null {
  const tuning = TUNINGS[tuningId] ?? TUNINGS.standard!;
  for (const tonic of unseenTonics(scaleId, seen)) {
    const pos = generatePositions(scaleId, tonic, tuning, system).find((p) => (p.formIndex ?? p.index) === formIndex);
    if (pos && !zones.includes(zoneOf(pos.fretMin))) return tonic;
  }
  return null;
}
