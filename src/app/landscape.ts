/**
 * Plein écran paysage du téléphone. Chaque étape peut être refusée : l'iPhone n'a ni plein écran ni
 * verrouillage d'orientation, Android exige le plein écran avant le verrou. Un refus n'est pas une erreur :
 * la vue pivote alors en CSS tant que l'écran reste en portrait (`.tab-full`, app.css).
 */
export interface LandscapeHost {
  fullscreenElement?: Element | null;
  documentElement?: { requestFullscreen?: () => Promise<void> };
  exitFullscreen?: () => Promise<void>;
}

export interface OrientationHost {
  lock?: (orientation: 'landscape') => Promise<void>;
  unlock?: () => void;
}

/** À appeler dans le geste de l'élève. */
export async function enterLandscape(doc: LandscapeHost, orientation?: OrientationHost): Promise<void> {
  try {
    await doc.documentElement?.requestFullscreen?.();
    await orientation?.lock?.('landscape');
  } catch {
    // refusé : repli CSS
  }
}

export async function exitLandscape(doc: LandscapeHost, orientation?: OrientationHost): Promise<void> {
  try {
    orientation?.unlock?.();
    if (doc.fullscreenElement) await doc.exitFullscreen?.();
  } catch {
    // déjà sorti
  }
}
