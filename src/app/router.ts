/**
 * Routeur minimal par hash (compatible PWA hors ligne, docs/ARCHITECTURE.md §4.1).
 * Une route = un écran ; l'état fin (gamme choisie, position) vit dans les magasins, pas dans l'URL.
 */

export type RouteName = 'gammes' | 'scale' | 'review' | 'sequences' | 'impro' | 'accords' | 'tuner' | 'metronome' | 'settings' | 'tab' | 'audio' | 'theory';

export const ROUTE_HREF: Readonly<Record<RouteName, string>> = {
  gammes: '#/gammes',
  scale: '#/gammes/jouer',
  review: '#/gammes/revision',
  sequences: '#/gammes/sequences',
  impro: '#/gammes/impro',
  accords: '#/accords',
  tuner: '#/accordeur',
  metronome: '#/metronome',
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
  '': 'gammes',
  '#': 'gammes',
};

/** L'app s'ouvre sur Gammes ; une page retirée (accueil, entraînement, leçon, QCM) mène à son outil (D128). */
export function parseRoute(hash: string): RouteName {
  const h = (hash || '').trim();
  if (LEGACY[h] !== undefined) return LEGACY[h]!;
  const clean = h.replace(/^#\/?/, '').replace(/\/+$/, '');
  switch (clean) {
    case 'gammes/jouer':
      return 'scale';
    case 'gammes/revision':
      return 'review';
    case 'gammes/sequences':
      return 'sequences';
    case 'gammes/impro':
    case 'gammes/improvisation':
      return 'impro';
    case 'accords':
    case 'accords/lecon':
    case 'accords/lecon-accord':
    case 'accords/qcm':
    case 'accords/sans-materiel':
      return 'accords';
    case 'accordeur':
    case 'tuner':
      return 'tuner';
    case 'metronome':
      return 'metronome';
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
      return 'gammes';
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

const EXERCISE_ROUTES: readonly RouteName[] = ['review', 'sequences', 'impro'];

/** La route d'exercice d'où l'on arrive, s'il y en a une : c'est là que l'accordeur propose de revenir. */
export function exerciseOrigin(previous: RouteName | null): RouteName | null {
  return previous && EXERCISE_ROUTES.includes(previous) ? previous : null;
}

let previous: RouteName | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', (e) => {
    previous = parseRoute(new URL(e.oldURL).hash);
  });
}

export function previousRoute(): RouteName | null {
  return previous;
}
