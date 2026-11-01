/**
 * Synchro du journal avec le compte (D117). Le journal est une suite d'événements immuables : on
 * tire le serveur, on fusionne par identifiant, puis on envoie ce qui lui manque. Rejouer la synchro
 * ne change donc rien.
 */
import {
  chordMarkRows, mergeChordMarks, readChordMarks, writeChordMarks, type ChordMarkRow,
} from '../progress/chordMarks';
import { mergeAttempts } from '../progress/exportData';
import { ATTEMPT_CAP, normalizeAttempt, readAttempts, writeAttempts, type Attempt } from '../progress/journal';
import type { KeyValueStore } from '../audio/mixer';

/** Même taille que le plafond d'un envoi côté serveur (`MAX_BATCH`). */
export const SYNC_BATCH = 200;

export type SyncOutcome = 'synced' | 'signedOut' | 'failed';

export async function syncJournal(store: KeyValueStore | null, doFetch: typeof fetch = fetch): Promise<SyncOutcome> {
  let res: Response;
  try {
    res = await doFetch('/api/attempts');
  } catch {
    return 'failed';
  }
  if (res.status === 401) return 'signedOut';
  if (!res.ok) return 'failed';

  const remote = ((await res.json()) as unknown[])
    .map(normalizeAttempt)
    .filter((a): a is Attempt => a !== null);
  writeAttempts(store, mergeAttempts(readAttempts(store), remote));

  // Le serveur plafonne comme nous : une tentative plus ancienne que sa plus vieille ne revient pas.
  const remoteIds = new Set(remote.map((a) => a.id));
  const floor = remote.length >= ATTEMPT_CAP ? Math.min(...remote.map((a) => a.ts)) : -Infinity;
  const missing = readAttempts(store).filter((a) => !remoteIds.has(a.id) && a.ts >= floor);

  for (let i = 0; i < missing.length; i += SYNC_BATCH) {
    try {
      const post = await doFetch('/api/attempts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(missing.slice(i, i + SYNC_BATCH)),
      });
      if (post.status === 401) return 'signedOut';
      if (!post.ok) return 'failed';
    } catch {
      return 'failed';
    }
  }
  return 'synced';
}

function isMarkRow(v: unknown): v is ChordMarkRow {
  const r = (v ?? {}) as Partial<ChordMarkRow>;
  return typeof r.chordId === 'string' && r.chordId.length > 0
    && typeof r.known === 'boolean' && typeof r.noReview === 'boolean'
    && typeof r.ts === 'number' && Number.isFinite(r.ts);
}

/**
 * Synchro des coches d'accords (D140). On tire le serveur, on garde le plus récent forme par forme, puis on
 * envoie ce que le serveur n'a pas ou a de plus ancien. Rejouer la synchro ne change rien.
 */
export async function syncChordMarks(store: KeyValueStore | null, doFetch: typeof fetch = fetch): Promise<SyncOutcome> {
  let res: Response;
  try {
    res = await doFetch('/api/chord-marks');
  } catch {
    return 'failed';
  }
  if (res.status === 401) return 'signedOut';
  if (!res.ok) return 'failed';

  const body = (await res.json()) as unknown;
  const remote = (Array.isArray(body) ? body : []).filter(isMarkRow);
  const merged = mergeChordMarks(readChordMarks(store), remote);
  writeChordMarks(store, merged);

  const known = new Map(remote.map((r) => [r.chordId, r.ts] as const));
  const missing = chordMarkRows(merged).filter((r) => !known.has(r.chordId) || r.ts > known.get(r.chordId)!);
  for (let i = 0; i < missing.length; i += SYNC_BATCH) {
    try {
      const post = await doFetch('/api/chord-marks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(missing.slice(i, i + SYNC_BATCH)),
      });
      if (post.status === 401) return 'signedOut';
      if (!post.ok) return 'failed';
    } catch {
      return 'failed';
    }
  }
  return 'synced';
}
