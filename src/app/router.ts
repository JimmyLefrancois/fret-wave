/**
 * Routeur minimal par hash (compatible PWA hors ligne, docs/ARCHITECTURE.md §4.1).
 * Une route = un écran ; l'état fin (gamme choisie, position) vit dans les magasins, pas dans l'URL.
 */

export type RouteName = 'hub' | 'gammes' | 'scale' | 'training' | 'review' | 'impro' | 'accords' | 'chord' | 'chordquiz' | 'tuner' | 'settings' | 'tab' | 'audio' | 'theory';

export const ROUTE_HREF: Readonly<Record<RouteName, string>> = {
  hub: '#/hub',
  gammes: '#/gammes',
  scale: '#/gammes/jouer',
  training: '#/gammes/entrainement',
  review: '#/gammes/revision',
  impro: '#/gammes/impro',
  accords: '#/accords',
  chord: '#/accords/lecon',
  chordquiz: '#/accords/qcm',
  tuner: '#/accordeur',
  settings: '#/reglages',
  tab: '#/tab',
  audio: '#/audio',
  theory: '#/theorie',
};

/** Anciennes URLs (phase 1a-1c) conservées pour ne pas casser les liens existants. */
const LEGACY: Readonly<Record<string, RouteName>> = {
  '#tab': 'tab',
  '#audio': 'audio',
  '#theorie': 'theory',
  '': 'hub',
  '#': 'hub',
};

export function parseRoute(hash: string): RouteName {
  const h = (hash || '').trim();
  if (LEGACY[h] !== undefined) return LEGACY[h]!;
  const clean = h.replace(/^#\/?/, '').replace(/\/+$/, '');
  switch (clean) {
    case 'hub':
    case '':
      return 'hub';
    case 'gammes':
      return 'gammes';
    case 'gammes/jouer':
      return 'scale';
    case 'gammes/entrainement':
      return 'training';
    case 'gammes/revision':
      return 'review';
    case 'gammes/impro':
    case 'gammes/improvisation':
      return 'impro';
    case 'accords':
      return 'accords';
    case 'accords/lecon':
    case 'accords/lecon-accord':
      return 'chord';
    case 'accords/qcm':
    case 'accords/sans-materiel':
      return 'chordquiz';
    case 'accordeur':
    case 'tuner':
      return 'tuner';
    case 'reglages':
    case 'settings':
      return 'settings';
    case 'tab':
      return 'tab';
    case 'audio':
      return 'audio';
    case 'theorie':
      return 'theory';
    default:
      return 'hub';
  }
}

export function navigate(route: RouteName): void {
  const href = ROUTE_HREF[route];
  if (location.hash !== href) location.hash = href;
}

/** Lien (ancre) réutilisable dans les composants. */
export function hrefOf(route: RouteName): string {
  return ROUTE_HREF[route];
}
