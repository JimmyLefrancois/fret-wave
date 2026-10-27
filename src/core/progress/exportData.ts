/**
 * Export / import JSON des données locales (PROJECT.md §12, risque R7).
 * Un fichier exporté est **lisible et vérifiable** : version, date, nombre de tentatives, et le journal
 * brut. L'import ne jette jamais : il compte ce qu'il refuse et fusionne par identifiant.
 */
import { ATTEMPT_CAP, normalizeAttempt, type Attempt } from './journal';

export const EXPORT_VERSION = 1;

export interface ExportPayload {
  v: 1;
  app: 'fretwave';
  exportedAt: string;
  /** Journal brut, du plus ancien au plus récent. */
  attempts: Attempt[];
}

export function exportPayload(attempts: readonly Attempt[], now: Date): ExportPayload {
  return {
    v: EXPORT_VERSION,
    app: 'fretwave',
    exportedAt: now.toISOString(),
    attempts: [...attempts].sort((a, b) => a.ts - b.ts),
  };
}

/** Indenté : un fichier qu'on peut ouvrir et lire à la main (pas de blob illisible). */
export function exportText(attempts: readonly Attempt[], now: Date): string {
  return `${JSON.stringify(exportPayload(attempts, now), null, 2)}\n`;
}

export function exportFilename(now: Date): string {
  const d = now.toISOString().slice(0, 10);
  return `fretwave-progression-${d}.json`;
}

export interface ImportResult {
  attempts: Attempt[];
  /** Entrées du fichier refusées (forme invalide). */
  rejected: number;
  /** Message d'erreur si le fichier n'est pas un export ; `null` s'il a été lu. */
  error: string | null;
}

export function parseImport(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { attempts: [], rejected: 0, error: 'ce fichier n’est pas du JSON lisible' };
  }
  if (!parsed || typeof parsed !== 'object') return { attempts: [], rejected: 0, error: 'format inattendu' };
  const o = parsed as { v?: unknown; app?: unknown; attempts?: unknown };
  if (!Array.isArray(o.attempts)) return { attempts: [], rejected: 0, error: 'aucun journal dans ce fichier' };
  if (o.v !== undefined && o.v !== EXPORT_VERSION) {
    return { attempts: [], rejected: 0, error: `version ${String(o.v)} non reconnue (cette app lit la version ${EXPORT_VERSION})` };
  }
  if (o.app !== undefined && o.app !== 'fretwave') {
    return { attempts: [], rejected: 0, error: 'ce fichier ne vient pas de Fretwave' };
  }
  const attempts: Attempt[] = [];
  let rejected = 0;
  for (const raw of o.attempts) {
    const a = normalizeAttempt(raw);
    if (a) attempts.push(a);
    else rejected++;
  }
  return { attempts, rejected, error: null };
}

/** Fusion par identifiant : importer deux fois le même fichier ne double rien. */
export function mergeAttempts(current: readonly Attempt[], incoming: readonly Attempt[]): Attempt[] {
  const byId = new Map<string, Attempt>();
  for (const a of current) byId.set(a.id, a);
  for (const a of incoming) if (!byId.has(a.id)) byId.set(a.id, a);
  return [...byId.values()].sort((x, y) => x.ts - y.ts || x.id.localeCompare(y.id)).slice(-ATTEMPT_CAP);
}
