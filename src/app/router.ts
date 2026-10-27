/**
 * Routeur minimal par hash (compatible PWA hors ligne, PROJECT.md §4.1).
 * Une route = un écran ; l'état fin (gamme choisie, position) vit dans les magasins, pas dans l'URL.
 */

export type RouteName = 'hub' | 'gammes' | 'scale' | 'training' | 'review' | 'settings' | 'tab' | 'audio' | 'theory';

export const ROUTE_HREF: Readonly<Record<RouteName, string>> = {
  hub: '#/hub',
  gammes: '#/gammes',
  scale: '#/gammes/jouer',
  training: '#/gammes/entrainement',
  review: '#/gammes/revision',
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
