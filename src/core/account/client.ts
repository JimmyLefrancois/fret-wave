/**
 * Appels au compte facultatif (`worker/`). Le serveur Vite n'a pas d'API : le compte n'existe
 * que sur un build de production.
 */
export const ACCOUNTS_ENABLED = import.meta.env.PROD;

export interface Account {
  name: string;
}

const JSON_POST = { method: 'POST', headers: { 'content-type': 'application/json' } };

/** Réponse de `/api/auth/get-session` : `null` sans session. */
export function parseAccount(body: unknown): Account | null {
  const name = (body as { user?: { name?: unknown } } | null)?.user?.name;
  return typeof name === 'string' ? { name } : null;
}

export async function fetchAccount(doFetch: typeof fetch = fetch): Promise<Account | null> {
  const res = await doFetch('/api/auth/get-session');
  if (!res.ok) throw new Error(`session : ${res.status}`);
  return parseAccount(await res.json());
}

/** Renvoie l'adresse de Discord où envoyer le navigateur. */
export async function startSignIn(callbackURL: string, doFetch: typeof fetch = fetch): Promise<string> {
  const res = await doFetch('/api/auth/sign-in/social', {
    ...JSON_POST,
    body: JSON.stringify({ provider: 'discord', callbackURL }),
  });
  const url = res.ok ? (await res.json() as { url?: unknown }).url : undefined;
  if (typeof url !== 'string') throw new Error(`connexion : ${res.status}`);
  return url;
}

export async function signOut(doFetch: typeof fetch = fetch): Promise<void> {
  const res = await doFetch('/api/auth/sign-out', { ...JSON_POST, body: '{}' });
  if (!res.ok) throw new Error(`déconnexion : ${res.status}`);
}
