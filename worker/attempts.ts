/**
 * Journal synchronisé du compte (D117). Une tentative est un événement immuable : le serveur n'ajoute
 * que celles qui lui manquent et n'en modifie jamais. Il garde les `SERVER_ATTEMPT_CAP` plus récentes,
 * comme le journal local.
 */
import type { RequestHandler } from './routes';

export const SERVER_ATTEMPT_CAP = 2000;
/** Taille maximale d'un envoi : au-delà, le client découpe. */
export const MAX_BATCH = 200;
const MAX_BODY_CHARS = 1_000_000;
const MAX_ID_CHARS = 200;

/** Le sous-ensemble de D1 utilisé ici : D1Database tel quel, typé à part pour les tests. */
export interface AttemptsDb {
  prepare(sql: string): { bind(...args: unknown[]): AttemptsStatement };
  batch(statements: AttemptsStatement[]): Promise<unknown>;
}
export interface AttemptsStatement {
  all<T = unknown>(): Promise<{ results: T[] }>;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/** Identifiant de l'utilisateur connecté, lu par la route `get-session` de Better Auth. */
export async function userIdOf(handleAuth: RequestHandler, request: Request): Promise<string | null> {
  const session = await handleAuth(new Request(new URL('/api/auth/get-session', request.url), { headers: request.headers }));
  if (!session.ok) return null;
  const body = (await session.json()) as { user?: { id?: unknown } } | null;
  return typeof body?.user?.id === 'string' ? body.user.id : null;
}

/** Un lot est valide si c'est un tableau d'objets à `id` texte et `ts` fini. */
export function parseBatch(body: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(body) || body.length > MAX_BATCH) return null;
  for (const item of body) {
    if (typeof item !== 'object' || item === null) return null;
    const { id, ts } = item as { id?: unknown; ts?: unknown };
    if (typeof id !== 'string' || id.length === 0 || id.length > MAX_ID_CHARS) return null;
    if (typeof ts !== 'number' || !Number.isFinite(ts)) return null;
  }
  return body as Record<string, unknown>[];
}

export async function listAttempts(db: AttemptsDb, userId: string): Promise<unknown[]> {
  const { results } = await db
    .prepare('select "payload" from "attempt" where "user_id" = ? order by "ts", "id"')
    .bind(userId)
    .all<{ payload: string }>();
  return results.map((row) => JSON.parse(row.payload) as unknown);
}

export async function addAttempts(db: AttemptsDb, userId: string, items: Record<string, unknown>[]): Promise<void> {
  const insert = db.prepare('insert or ignore into "attempt" ("user_id", "id", "ts", "payload") values (?, ?, ?, ?)');
  const prune = db.prepare(
    'delete from "attempt" where "user_id" = ? and "id" not in '
    + '(select "id" from "attempt" where "user_id" = ? order by "ts" desc, "id" desc limit ?)',
  );
  await db.batch([
    ...items.map((a) => insert.bind(userId, a.id, a.ts, JSON.stringify(a))),
    prune.bind(userId, userId, SERVER_ATTEMPT_CAP),
  ]);
}

/** Route `/api/attempts` : GET renvoie le journal, POST ajoute les tentatives manquantes. */
export async function attemptsRoute(request: Request, db: AttemptsDb, handleAuth: RequestHandler): Promise<Response> {
  const userId = await userIdOf(handleAuth, request);
  if (!userId) return json({ error: 'unauthorized' }, 401);
  if (request.method === 'GET') return json(await listAttempts(db, userId));
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return json({ error: 'too_large' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const items = parseBatch(body);
  if (!items) return json({ error: 'bad_batch' }, 400);
  if (items.length) await addAttempts(db, userId, items);
  return json({ ok: true });
}
