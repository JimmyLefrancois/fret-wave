/**
 * Coches d'accords du compte (D140). Contrairement à une tentative, une coche change : chaque ligne porte
 * sa date, et le serveur garde la plus récente, forme par forme. Rejouer un envoi ne change rien.
 */
import { userIdOf, type AttemptsDb } from './attempts';
import type { RequestHandler } from './routes';

/** Bien au-dessus des 40 formes de la liste : une borne contre l'abus, pas une règle. */
export const SERVER_MARK_CAP = 2000;
export const MAX_MARK_BATCH = 200;
const MAX_BODY_CHARS = 100_000;
const MAX_ID_CHARS = 200;

export interface ChordMarkRow {
  chordId: string;
  known: boolean;
  noReview: boolean;
  ts: number;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export function parseMarkBatch(body: unknown): ChordMarkRow[] | null {
  if (!Array.isArray(body) || body.length > MAX_MARK_BATCH) return null;
  const rows: ChordMarkRow[] = [];
  for (const item of body) {
    if (typeof item !== 'object' || item === null) return null;
    const { chordId, known, noReview, ts } = item as Partial<ChordMarkRow>;
    if (typeof chordId !== 'string' || chordId.length === 0 || chordId.length > MAX_ID_CHARS) return null;
    if (typeof known !== 'boolean' || typeof noReview !== 'boolean') return null;
    if (typeof ts !== 'number' || !Number.isFinite(ts) || ts < 0) return null;
    rows.push({ chordId, known, noReview, ts: Math.round(ts) });
  }
  return rows;
}

export async function listChordMarks(db: AttemptsDb, userId: string): Promise<ChordMarkRow[]> {
  const { results } = await db
    .prepare('select "chord_id", "known", "no_review", "updated_at" from "chord_mark" where "user_id" = ? order by "chord_id"')
    .bind(userId)
    .all<{ chord_id: string; known: number; no_review: number; updated_at: number }>();
  return results.map((r) => ({ chordId: r.chord_id, known: r.known === 1, noReview: r.no_review === 1, ts: r.updated_at }));
}

export async function saveChordMarks(db: AttemptsDb, userId: string, rows: readonly ChordMarkRow[]): Promise<void> {
  const upsert = db.prepare(
    'insert into "chord_mark" ("user_id", "chord_id", "known", "no_review", "updated_at") values (?, ?, ?, ?, ?) '
    + 'on conflict ("user_id", "chord_id") do update set "known" = excluded."known", "no_review" = excluded."no_review", '
    + '"updated_at" = excluded."updated_at" where excluded."updated_at" >= "chord_mark"."updated_at"',
  );
  const prune = db.prepare(
    'delete from "chord_mark" where "user_id" = ? and "chord_id" not in '
    + '(select "chord_id" from "chord_mark" where "user_id" = ? order by "updated_at" desc, "chord_id" desc limit ?)',
  );
  await db.batch([
    ...rows.map((r) => upsert.bind(userId, r.chordId, r.known ? 1 : 0, r.noReview ? 1 : 0, r.ts)),
    prune.bind(userId, userId, SERVER_MARK_CAP),
  ]);
}

/** Route `/api/chord-marks` : GET renvoie les coches, POST enregistre les plus récentes. */
export async function chordMarksRoute(request: Request, db: AttemptsDb, handleAuth: RequestHandler): Promise<Response> {
  const userId = await userIdOf(handleAuth, request);
  if (!userId) return json({ error: 'unauthorized' }, 401);
  if (request.method === 'GET') return json(await listChordMarks(db, userId));
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return json({ error: 'too_large' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const rows = parseMarkBatch(body);
  if (!rows) return json({ error: 'bad_batch' }, 400);
  if (rows.length) await saveChordMarks(db, userId, rows);
  return json({ ok: true });
}
