import { describe, expect, it } from 'vitest';
import { SERVER_ATTEMPT_CAP, attemptsRoute, parseBatch, type AttemptsDb } from '../worker/attempts';

/** Base D1 en mémoire : ne comprend que les trois requêtes de `worker/attempts.ts`. */
function fakeDb() {
  const rows: { user_id: string; id: string; ts: number; payload: string }[] = [];
  const run = (sql: string, args: unknown[]): { results?: unknown[] } => {
    if (sql.startsWith('select')) {
      const mine = rows.filter((r) => r.user_id === args[0]).sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
      return { results: mine.map((r) => ({ payload: r.payload })) };
    }
    if (sql.startsWith('insert')) {
      const [user_id, id, ts, payload] = args as [string, string, number, string];
      if (!rows.some((r) => r.user_id === user_id && r.id === id)) rows.push({ user_id, id, ts, payload });
      return {};
    }
    // prune : ne garde que les `limit` plus récentes de l'utilisateur
    const [user_id, , limit] = args as [string, string, number];
    const keep = new Set(
      rows.filter((r) => r.user_id === user_id)
        .sort((a, b) => b.ts - a.ts || b.id.localeCompare(a.id))
        .slice(0, limit)
        .map((r) => r.id),
    );
    const kept = rows.filter((r) => r.user_id !== user_id || keep.has(r.id));
    rows.splice(0, rows.length, ...kept);
    return {};
  };
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            sql,
            args,
            all: async () => run(sql, args),
          };
        },
      };
    },
    batch: async (statements: { sql: string; args: unknown[] }[]) => {
      for (const s of statements) run(s.sql, s.args);
      return [];
    },
  };
  return { db: db as unknown as AttemptsDb, rows };
}

/** Faux gestionnaire d'authentification : un en-tête `x-user` joue la session. */
const fakeAuth = async (req: Request) => {
  const user = req.headers.get('x-user');
  return new Response(JSON.stringify(user ? { user: { id: user } } : null), { status: 200 });
};

const attempt = (id: string, ts: number) => ({ id, ts, nodeId: `n-${id}` });

const send = (method: string, body: unknown, user: string | null = 'u1') => new Request('https://fretwave.test/api/attempts', {
  method,
  headers: { 'content-type': 'application/json', ...(user ? { 'x-user': user } : {}) },
  body: method === 'POST' ? JSON.stringify(body) : undefined,
});

describe('parseBatch', () => {
  it('accepte un tableau d’objets à id texte et ts fini', () => {
    expect(parseBatch([attempt('a', 1)])).toHaveLength(1);
    expect(parseBatch([])).toEqual([]);
  });

  it('refuse ce qui n’est pas un lot exploitable', () => {
    expect(parseBatch({ id: 'a', ts: 1 })).toBeNull();
    expect(parseBatch([null])).toBeNull();
    expect(parseBatch([{ id: '', ts: 1 }])).toBeNull();
    expect(parseBatch([{ id: 'a', ts: 'hier' }])).toBeNull();
    expect(parseBatch([{ id: 'a', ts: Number.NaN }])).toBeNull();
    expect(parseBatch(Array.from({ length: 201 }, (_, i) => attempt(`x${i}`, i)))).toBeNull();
  });
});

describe('attemptsRoute', () => {
  it('répond 401 sans session, en lecture comme en écriture', async () => {
    const { db } = fakeDb();
    expect((await attemptsRoute(send('GET', null, null), db, fakeAuth)).status).toBe(401);
    expect((await attemptsRoute(send('POST', [attempt('a', 1)], null), db, fakeAuth)).status).toBe(401);
  });

  it('ajoute les tentatives sans doublon et les relit dans l’ordre', async () => {
    const { db } = fakeDb();
    await attemptsRoute(send('POST', [attempt('b', 2), attempt('a', 1)]), db, fakeAuth);
    await attemptsRoute(send('POST', [attempt('a', 1)]), db, fakeAuth);
    const res = await attemptsRoute(send('GET', null), db, fakeAuth);
    expect(await res.json()).toEqual([attempt('a', 1), attempt('b', 2)]);
  });

  it('isole les journaux des utilisateurs', async () => {
    const { db } = fakeDb();
    await attemptsRoute(send('POST', [attempt('a', 1)], 'u1'), db, fakeAuth);
    const res = await attemptsRoute(send('GET', null, 'u2'), db, fakeAuth);
    expect(await res.json()).toEqual([]);
  });

  it('garde les plus récentes au-delà du plafond', async () => {
    const { db, rows } = fakeDb();
    const items = Array.from({ length: SERVER_ATTEMPT_CAP + 3 }, (_, i) => attempt(`t${String(i).padStart(4, '0')}`, i));
    for (let i = 0; i < items.length; i += 200) {
      await attemptsRoute(send('POST', items.slice(i, i + 200)), db, fakeAuth);
    }
    expect(rows.filter((r) => r.user_id === 'u1')).toHaveLength(SERVER_ATTEMPT_CAP);
    const res = await attemptsRoute(send('GET', null), db, fakeAuth);
    const kept = (await res.json()) as { ts: number }[];
    expect(kept[0]?.ts).toBe(3);
  });

  it('refuse un JSON cassé et un lot invalide sans rien écrire', async () => {
    const { db, rows } = fakeDb();
    const broken = new Request('https://fretwave.test/api/attempts', { method: 'POST', headers: { 'x-user': 'u1' }, body: '{' });
    expect((await attemptsRoute(broken, db, fakeAuth)).status).toBe(400);
    expect((await attemptsRoute(send('POST', [{ ts: 1 }]), db, fakeAuth)).status).toBe(400);
    expect(rows).toHaveLength(0);
  });

  it('répond 405 à une autre méthode', async () => {
    const { db } = fakeDb();
    expect((await attemptsRoute(send('DELETE', null), db, fakeAuth)).status).toBe(405);
  });
});
