import { registerSW } from 'virtual:pwa-register';
import { OpeningClock } from '../core/pwa/updatePolicy';

/** Enregistre le service worker et applique les mises à jour à l'ouverture (D118). */
export function registerPwa(): void {
  const clock = new OpeningClock(Date.now());
  let updatePending = false;
  let registration: ServiceWorkerRegistration | undefined;

  const updateSW = registerSW({
    onRegisteredSW(_url, reg) {
      registration = reg;
    },
    onNeedRefresh() {
      updatePending = true;
      if (clock.isFresh(Date.now())) void updateSW(true);
    },
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      clock.hidden(Date.now());
      return;
    }
    if (!clock.visible(Date.now())) return;
    if (updatePending) void updateSW(true);
    else void registration?.update();
  });
}
