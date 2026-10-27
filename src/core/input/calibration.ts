/**
 * Calibration de l'entrée (phase 3) : plancher de bruit, seuil suggéré, **latence mesurée**.
 *
 * La latence n'est pas estimée à partir de `baseLatency` : c'est le **temps entre le moment où
 * l'app joue un clic et le moment où elle l'entend revenir**. Elle inclut donc la sortie, le trajet
 * dans l'air (ou le câble) et l'entrée — exactement ce qu'il faut retrancher pour juger un timing.
 * Elle est mesurée n fois, et la médiane écarte le clic raté (pièce bruyante, main sur la corde).
 *
 * Limite honnête : au micro, la valeur mesurée dépend de la distance aux haut-parleurs. Au casque,
 * c'est la vraie latence de la chaîne. L'écran dit lequel des deux on mesure.
 */

/** Quantile d'un tableau trié (0-1), sans dépendance. */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * Math.max(0, Math.min(1, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

/**
 * Plancher de bruit de la pièce : **médiane** des niveaux RMS (dBFS) relevés au silence.
 * La médiane, pas la moyenne : une toux ou une chaise déplace la moyenne, pas la médiane.
 */
export function noiseFloorDb(levels: readonly number[]): number {
  const finite = levels.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return -90;
  return Math.max(-90, Math.min(0, quantile(finite, 0.5)));
}

/**
 * Seuil de détection suggéré : plancher + marge, borné à ce que l'écran autorise.
 * Marge 12 dB : assez pour ignorer une respiration, assez peu pour capter une corde pincée doucement.
 */
export function suggestThreshold(floorDb: number, margin = 12, lo = -80, hi = -10): number {
  return Math.max(lo, Math.min(hi, Math.round(floorDb + margin)));
}

export interface LatencyPair {
  /** Instant où le clic a été **programmé** (secondes du contexte audio). */
  playedS: number;
  /** Instant où l'attaque a été **détectée** (secondes du même contexte). */
  detectedS: number;
}

export interface LatencyResult {
  /** Latence retenue (ms, arrondie à l'unité), 0 si aucune mesure exploitable. */
  ms: number;
  /** Mesures retenues pour la médiane. */
  used: number;
  /** Mesures écartées (négatives, absurdes ou trop loin de la médiane). */
  rejected: number;
  /** Toutes les valeurs brutes (ms), pour l'affichage et le diagnostic. */
  raw: number[];
}

/**
 * Latence aller-retour = médiane des écarts détecté − programmé, après avoir écarté
 *  - les valeurs négatives (le détecteur ne peut pas entendre avant que le son soit joué) et
 *  - celles à plus de 30 ms de la médiane (écho de la pièce, double détection).
 */
export function estimateLatency(pairs: readonly LatencyPair[], opts: { toleranceMs?: number; maxMs?: number } = {}): LatencyResult {
  const tol = opts.toleranceMs ?? 30;
  const max = opts.maxMs ?? 400;
  const raw = pairs.map((p) => (p.detectedS - p.playedS) * 1000).map((v) => Math.round(v * 10) / 10);
  const plausible = raw.filter((v) => Number.isFinite(v) && v >= 0 && v <= max);
  if (plausible.length === 0) return { ms: 0, used: 0, rejected: raw.length, raw };
  const median = quantile(plausible, 0.5);
  const kept = plausible.filter((v) => Math.abs(v - median) <= tol);
  const used = kept.length > 0 ? kept : plausible;
  const ms = Math.round(quantile(used, 0.5));
  return { ms, used: used.length, rejected: raw.length - used.length, raw };
}
