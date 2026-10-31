import { attemptsRoute } from './attempts';
import { createAuth, type Env } from './auth';
import { routeApi } from './routes';

/**
 * Seules les requêtes `/api/*` arrivent ici (`run_worker_first` dans `wrangler.jsonc`) : le reste
 * du site est servi directement comme fichiers statiques, sans compter dans le quota de requêtes.
 */
let auth: ReturnType<typeof createAuth> | undefined;

export default {
  fetch(request, env) {
    const handleAuth = (req: Request) => (auth ??= createAuth(env)).handler(req);
    return routeApi(request, handleAuth, (req) => attemptsRoute(req, env.DB, handleAuth));
  },
} satisfies ExportedHandler<Env>;
