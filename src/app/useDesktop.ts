import { useSyncExternalStore } from 'react';

/** Le bureau et le téléphone n'ont pas toujours la même page : même seuil que la grille de `app.css`. */
const DESKTOP_QUERY = '(min-width: 900px)';

export function useDesktop(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(DESKTOP_QUERY);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
  );
}
