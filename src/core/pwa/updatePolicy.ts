/**
 * Quand appliquer une mise à jour de la PWA (D118).
 *
 * Une version installée s'ouvre d'abord depuis le cache : la nouvelle n'est connue qu'une ou deux secondes plus tard.
 * On recharge donc seulement juste après une ouverture, pour ne jamais couper un exercice ou le micro. Sur mobile,
 * l'app reste souvent en mémoire : revenir après une longue absence compte aussi comme une ouverture.
 */

/** Après une ouverture, délai pendant lequel recharger ne coupe rien d'utile. */
export const FRESH_OPENING_MS = 10_000;
/** Absence au-delà de laquelle un retour dans l'app compte comme une nouvelle ouverture. */
export const REOPENING_AWAY_MS = 30 * 60_000;

export class OpeningClock {
  private hiddenAt: number | null = null;

  constructor(private openedAt: number) {}

  /** Vrai tant que l'élève vient d'ouvrir l'app. */
  isFresh(now: number): boolean {
    return now - this.openedAt < FRESH_OPENING_MS;
  }

  hidden(now: number): void {
    this.hiddenAt ??= now;
  }

  /** L'app revient au premier plan. Renvoie vrai si ce retour compte comme une nouvelle ouverture. */
  visible(now: number): boolean {
    const away = this.hiddenAt === null ? 0 : now - this.hiddenAt;
    this.hiddenAt = null;
    if (away < REOPENING_AWAY_MS) return false;
    this.openedAt = now;
    return true;
  }
}
