import { describe, expect, it, vi } from 'vitest';
import { routeApi } from '../worker/routes';

const request = (path: string) => new Request(`https://fretwave.test${path}`);

describe('routeApi', () => {
  it('répond à /api/health sans passer par l’authentification', async () => {
    const auth = vi.fn();
    const res = await routeApi(request('/api/health'), auth, vi.fn());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(auth).not.toHaveBeenCalled();
  });

  it('confie /api/auth/* à l’authentification', async () => {
    const answer = new Response('auth');
    const auth = vi.fn(() => answer);
    const req = request('/api/auth/get-session');
    expect(await routeApi(req, auth, vi.fn())).toBe(answer);
    expect(auth).toHaveBeenCalledWith(req);
  });

  it('confie /api/attempts au journal, sans passer par l’authentification directe', async () => {
    const answer = new Response('journal');
    const auth = vi.fn();
    const attempts = vi.fn(() => answer);
    const req = request('/api/attempts');
    expect(await routeApi(req, auth, attempts)).toBe(answer);
    expect(attempts).toHaveBeenCalledWith(req);
    expect(auth).not.toHaveBeenCalled();
  });

  it('ne confond pas un préfixe voisin avec /api/auth', async () => {
    const auth = vi.fn();
    const res = await routeApi(request('/api/authentique'), auth, vi.fn());
    expect(res.status).toBe(404);
    expect(auth).not.toHaveBeenCalled();
  });

  it('renvoie 404 sur une route inconnue', async () => {
    const res = await routeApi(request('/api/sync'), vi.fn(), vi.fn());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});
