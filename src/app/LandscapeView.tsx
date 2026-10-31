import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { enterLandscape, exitLandscape, type OrientationHost } from './landscape';

/** À appeler dans le geste qui ouvre la vue : le navigateur l'exige pour le plein écran. */
export function openLandscape(): void {
  void enterLandscape(document, screen.orientation as OrientationHost);
}

/**
 * Vue en plein écran paysage. Hors de la page (portail) : un grand téléphone dépasse 900 px en paysage,
 * et la vue doit survivre au passage en rendu bureau. Quitter le plein écran par le navigateur la referme.
 */
export function LandscapeView(props: { label: string; onClose: () => void; children: ReactNode }) {
  const { label, onClose, children } = props;
  useEffect(() => {
    let entered = false;
    const onChange = () => {
      if (document.fullscreenElement) entered = true;
      else if (entered) onClose();
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      void exitLandscape(document, screen.orientation as OrientationHost);
    };
  }, [onClose]);
  return createPortal(
    <div className="tab-full" role="dialog" aria-modal="true" aria-label={label}>{children}</div>,
    document.body,
  );
}
