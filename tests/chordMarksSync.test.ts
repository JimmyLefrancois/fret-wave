import { describe, expect, it } from 'vitest';
import { syncChordMarks } from '../src/core/account/journalSync';
import {
  CHORD_MARKS_KEY, chordMarkRows, mergeChordMarks, NO_MARKS, readChordMarks, toggleChordMark, type ChordMarkRow,
} from '../src/core/progress/chordMarks';
import { chordMarksRoute, parseMarkBatch, saveChordMarks, MAX_MARK_BATCH } from '../worker/chordMarks';
import type { AttemptsDb } from '../worker/attempts';

function fakeStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } };
}
const row = (chordId: string, ts: number, known = true, noReview = false): ChordMarkRow => ({ chordId, known, noReview, ts });

/** Serveur en mémoire : même règle que l'upsert de `worker/chordMarks.ts`. */
function fakeServer(initial: ChordMarkRow[] = []) {
  const rows = [...initial];
  const posts: ChordMarkRow[][] = [];
  const doFetch = (async (_url: string, init?: RequestInit) => {
    if (init?.method !== 'POST') return new Response(JSON.stringify(rows));
    const batch = JSON.parse(init.body as string) as ChordMarkRow[];
    posts.push(batch);
    for (const r of batch) {
      const i = rows.findIndex((x) => x.chordId === r.chordId);
      if (i < 0) rows.push(r);
      else if (r.ts >= rows[i]!.ts) rows[i] = r;
    }
    return new Response('{"ok":true}');
  }) as typeof fetch;
  return { rows, posts, doFetch };
}

describe('fusion des coches', () => {
  it('le plus récent gagne, forme par forme', () => {
    const local = mergeChordMarks(NO_MARKS, [row('a', 10), row('b', 30)]);
    const out = mergeChordMarks(local, [row('a', 20, false), row('b', 20, false)]);
    expect(out.known).toEqual(['b']);
    expect(out.stamps).toEqual({ a: 20, b: 30 });
  });

  it('un décochage voyage : il garde sa ligne', () => {
    const s = fakeStore();
    toggleChordMark(s, 'known', 'a', 1);
    toggleChordMark(s, 'known', 'a', 2);
    expect(chordMarkRows(readChordMarks(s))).toEqual([row('a', 2, false)]);
  });

  it('une coche d’avant la synchro, sans date, est conservée et envoyée', async () => {
    const s = fakeStore({ [CHORD_MARKS_KEY]: JSON.stringify({ v: 1, known: ['a'], noReview: [] }) });
    const server = fakeServer();
    expect(await syncChordMarks(s, server.doFetch)).toBe('synced');
    expect(server.rows).toEqual([row('a', 0)]);
    expect(readChordMarks(s).known).toEqual(['a']);
  });
});

describe('synchro des coches', () => {
  it('deux appareils convergent, et rejouer n’envoie plus rien', async () => {
    const phone = fakeStore();
    const pc = fakeStore();
    const server = fakeServer();
    toggleChordMark(phone, 'known', 'a', 100);
    await syncChordMarks(phone, server.doFetch);
    await syncChordMarks(pc, server.doFetch);
    expect(readChordMarks(pc).known).toEqual(['a']);

    toggleChordMark(pc, 'known', 'a', 200); // décoche sur le PC
    await syncChordMarks(pc, server.doFetch);
    await syncChordMarks(phone, server.doFetch);
    expect(readChordMarks(phone).known).toEqual([]);

    const before = server.posts.length;
    await syncChordMarks(phone, server.doFetch);
    expect(server.posts.length).toBe(before);
  });

  it('sans session, rien ne change', async () => {
    const s = fakeStore();
    toggleChordMark(s, 'known', 'a', 1);
    const out = await syncChordMarks(s, (async () => new Response('{}', { status: 401 })) as unknown as typeof fetch);
    expect(out).toBe('signedOut');
    expect(readChordMarks(s).known).toEqual(['a']);
  });

  it('une panne réseau n’efface rien', async () => {
    const s = fakeStore();
    toggleChordMark(s, 'known', 'a', 1);
    const out = await syncChordMarks(s, (async () => { throw new Error('hors ligne'); }) as unknown as typeof fetch);
    expect(out).toBe('failed');
    expect(readChordMarks(s).known).toEqual(['a']);
  });
});

describe('route /api/chord-marks', () => {
  const noDb = {} as AttemptsDb;
  const auth = async (req: Request) => (req.headers.get('x-user')
    ? new Response(JSON.stringify({ user: { id: req.headers.get('x-user') } }))
    : new Response('null'));

  it('refuse sans session', async () => {
    const res = await chordMarksRoute(new Request('https://x/api/chord-marks'), noDb, auth);
    expect(res.status).toBe(401);
  });

  it('refuse un lot invalide', () => {
    expect(parseMarkBatch({})).toBeNull();
    expect(parseMarkBatch([{ chordId: '', known: true, noReview: false, ts: 1 }])).toBeNull();
    expect(parseMarkBatch([{ chordId: 'a', known: 'oui', noReview: false, ts: 1 }])).toBeNull();
    expect(parseMarkBatch(Array.from({ length: MAX_MARK_BATCH + 1 }, () => row('a', 1)))).toBeNull();
    expect(parseMarkBatch([row('a', 1)])).toEqual([row('a', 1)]);
  });

  it('écrit dans le lot l’utilisateur de la session et les coches en 0/1', async () => {
    const bound: unknown[][] = [];
    const db = {
      prepare: () => ({ bind: (...a: unknown[]) => { bound.push(a); return a as never; } }),
      batch: async () => [],
    } as unknown as AttemptsDb;
    await saveChordMarks(db, 'u1', [row('a', 5, true, true)]);
    expect(bound[0]).toEqual(['u1', 'a', 1, 1, 5]);
  });
});
