/**
 * Aiguillage de `/api`. Sans dépendance à Cloudflare ni à Better Auth pour rester testable : le
 * Worker lui passe le gestionnaire d'authentification.
 */
export type RequestHandler = (request: Request) => Promise<Response> | Response;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export function routeApi(
  request: Request,
  handleAuth: RequestHandler,
  handleAttempts: RequestHandler,
): Promise<Response> | Response {
  const { pathname } = new URL(request.url);
  if (pathname === '/api/health') return json({ ok: true });
  if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) return handleAuth(request);
  if (pathname === '/api/attempts') return handleAttempts(request);
  return json({ error: 'not_found' }, 404);
}
