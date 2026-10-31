import { describe, expect, it } from 'vitest';
import { SYNC_BATCH, syncJournal } from '../src/core/account/journalSync';
import { ATTEMPT_CAP, ATTEMPTS_KEY, readAttempts, writeAttempts, type Attempt } from '../src/core/progress/journal';

function fakeStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k]! : null),
    setItem: (k: string, v: string) => { data[k] = v; },
  };
}

let seq = 0;
function attempt(patch: Partial<Attempt> = {}): Attempt {
  const base: Attempt = {
    id: `t-${seq++}`,
    ts: 1_000 + seq,
    kind: 'holes',
    scaleId: 'pentatonic-minor',
    tonic: 'A',
    tuningId: 'standard',
    system: 'boxes',
    positionId: 'boxes:0',
    formIndex: 0,
    level: 2,
    strings: 6,
    correct: 4,
    total: 5,
    seconds: 42,
    fretMin: 5,
    missedStrings: [],
    tempoOk: false,
  };
  return { ...base, ...patch };
}

/** Serveur en mémoire : GET rend le journal trié, POST ajoute sans doublon, plafonné comme le vrai. */
function fakeServer(initial: Attempt[] = [], options: { status?: number } = {}) {
  let rows = [...initial];
  const posts: Attempt[][] = [];
  const fetchFn = (async (_url: string, init?: RequestInit) => {
    if (options.status) return new Response('', { status: options.status });
    if (!init?.method) {
      return new Response(JSON.stringify([...rows].sort((a, b) => a.ts - b.ts)), { status: 200 });
    }
    const batch = JSON.parse(init.body as string) as Attempt[];
    posts.push(batch);
    for (const a of batch) if (!rows.some((r) => r.id === a.id)) rows.push(a);
    rows = rows.sort((a, b) => a.ts - b.ts).slice(-ATTEMPT_CAP);
    return new Response('{"ok":true}', { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchFn, posts, rows: () => rows };
}

describe('syncJournal', () => {
  it('récupère les tentatives qui manquent sur cet appareil, sans rien renvoyer', async () => {
    const remote = [attempt({ id: 'a' }), attempt({ id: 'b' })];
    const server = fakeServer(remote);
    const store = fakeStore();
    expect(await syncJournal(store, server.fetchFn)).toBe('synced');
    expect(readAttempts(store).map((a) => a.id)).toEqual(['a', 'b']);
    expect(server.posts).toEqual([]);
  });

  it('envoie au serveur les tentatives locales qu’il ne connaît pas', async () => {
    const local = [attempt({ id: 'local-1' }), attempt({ id: 'local-2' })];
    const server = fakeServer([]);
    const store = fakeStore();
    writeAttempts(store, local);
    expect(await syncJournal(store, server.fetchFn)).toBe('synced');
    expect(server.rows().map((a) => a.id)).toEqual(['local-1', 'local-2']);
  });

  it('fusionne les deux côtés sans doublon', async () => {
    const shared = attempt({ id: 'shared' });
    const server = fakeServer([shared, attempt({ id: 'remote-only' })]);
    const store = fakeStore();
    writeAttempts(store, [shared, attempt({ id: 'local-only' })]);
    await syncJournal(store, server.fetchFn);
    const ids = readAttempts(store).map((a) => a.id).sort();
    expect(ids).toEqual(['local-only', 'remote-only', 'shared']);
    expect(server.rows().map((a) => a.id).sort()).toEqual(['local-only', 'remote-only', 'shared']);
  });

  it('rejouer la synchro ne change rien et n’envoie plus rien', async () => {
    const server = fakeServer([]);
    const store = fakeStore();
    writeAttempts(store, [attempt({ id: 'x' })]);
    await syncJournal(store, server.fetchFn);
    const before = store.data[ATTEMPTS_KEY];
    server.posts.length = 0;
    await syncJournal(store, server.fetchFn);
    expect(server.posts).toEqual([]);
    expect(store.data[ATTEMPTS_KEY]).toBe(before);
  });

  it('découpe l’envoi en lots de SYNC_BATCH', async () => {
    const server = fakeServer([]);
    const store = fakeStore();
    writeAttempts(store, Array.from({ length: SYNC_BATCH + 5 }, (_, i) => attempt({ id: `n${i}`, ts: 2_000 + i })));
    await syncJournal(store, server.fetchFn);
    expect(server.posts.map((b) => b.length)).toEqual([SYNC_BATCH, 5]);
  });

  it('écarte les entrées du serveur que l’application ne sait pas lire', async () => {
    const server = fakeServer([attempt({ id: 'ok' })]);
    const original = server.fetchFn;
    const fetchFn = (async (url: string, init?: RequestInit) => {
      if (init?.method) return original(url, init);
      return new Response(JSON.stringify([{ id: 'cassée', ts: 'hier' }, ...server.rows()]), { status: 200 });
    }) as unknown as typeof fetch;
    const store = fakeStore();
    await syncJournal(store, fetchFn);
    expect(readAttempts(store).map((a) => a.id)).toEqual(['ok']);
  });

  it('signale une session expirée sans toucher au journal local', async () => {
    const store = fakeStore();
    const local = [attempt({ id: 'local' })];
    writeAttempts(store, local);
    const before = store.data[ATTEMPTS_KEY];
    expect(await syncJournal(store, fakeServer([], { status: 401 }).fetchFn)).toBe('signedOut');
    expect(store.data[ATTEMPTS_KEY]).toBe(before);
  });

  it('garde le journal local si le serveur ne répond pas', async () => {
    const store = fakeStore();
    writeAttempts(store, [attempt({ id: 'hors-ligne' })]);
    const down = (async () => { throw new TypeError('réseau'); }) as unknown as typeof fetch;
    expect(await syncJournal(store, down)).toBe('failed');
    expect(readAttempts(store).map((a) => a.id)).toEqual(['hors-ligne']);
  });
});
