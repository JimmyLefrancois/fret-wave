/**
 * Systèmes de positions et table de compatibilité gamme ↔ système (MUSIC_DESIGN.md §3.3).
 * Le moteur n'expose à l'UI que les systèmes compatibles, avec la raison d'un refus.
 */
import { getScale, type ScaleDef } from './scales';

export type PositionSystem = '3nps' | 'caged' | 'boxes' | 'symmetric' | 'passing-note';

export interface SystemAvailability {
  system: PositionSystem;
  available: boolean;
  /** Pourquoi indisponible (affiché au survol) ou précision sur les limites. */
  note?: string;
  /** Nombre de positions/formes du système pour cette gamme. */
  count?: number;
}

const DIATONIC_FAMILIES = new Set(['diatonic']);

function isHeptatonic(def: ScaleDef): boolean {
  return def.intervals.length === 7;
}

export function systemsFor(scaleId: string): SystemAvailability[] {
  const def = getScale(scaleId);
  const n = def.intervals.length;
  const out: SystemAvailability[] = [];

  // 3 notes par corde : gammes heptatoniques seulement.
  if (isHeptatonic(def)) {
    out.push({
      system: '3nps',
      available: true,
      count: 7,
      note: def.family === 'harmonic-minor' ? 'étirements 1-2-4 / 1-3-4 autour de ♭6→7 (3 demi-tons)' : undefined,
    });
  } else {
    out.push({ system: '3nps', available: false, note: `${n} notes : le 3 notes par corde suppose 7 notes` });
  }

  // CAGED : diatonique (majeure/mineure naturelle et modes). Non proposé pour harmonique/mélodique.
  if (DIATONIC_FAMILIES.has(def.family)) {
    out.push({ system: 'caged', available: true, count: 5 });
  } else if (def.family === 'pentatonic') {
    out.push({ system: 'caged', available: true, count: 5, note: 'option : formes de pentatonique liées aux accords' });
  } else if (def.family === 'harmonic-minor' || def.family === 'melodic-minor') {
    out.push({
      system: 'caged',
      available: false,
      note: 'la seconde augmentée casse les formes CAGED ; positions adaptées à documenter plus tard',
    });
  } else {
    out.push({ system: 'caged', available: false, note: 'CAGED ne s’applique pas à cette gamme' });
  }

  // Boxes : pentatoniques et blues.
  if (def.family === 'pentatonic' || def.family === 'blues') {
    out.push({
      system: 'boxes',
      available: true,
      count: 5,
      note: def.family === 'blues' ? 'boxes de la pentatonique + note de blues' : undefined,
    });
  } else {
    out.push({ system: 'boxes', available: false, note: 'les boxes sont réservées aux pentatoniques et au blues' });
  }

  // Symétriques : motifs répétés.
  out.push(
    def.family === 'symmetric'
      ? { system: 'symmetric', available: true, note: 'le motif se répète à intervalle fixe (2, 3 ou 4 cases)' }
      : { system: 'symmetric', available: false, note: 'gamme non symétrique' },
  );

  // Bebop : position + note de passage.
  out.push(
    def.family === 'bebop'
      ? { system: 'passing-note', available: true, note: 'gamme de 7 notes + note de passage chromatique marquée' }
      : { system: 'passing-note', available: false },
  );
  return out;
}

export function compatibleSystems(scaleId: string): PositionSystem[] {
  return systemsFor(scaleId).filter((s) => s.available).map((s) => s.system);
}
