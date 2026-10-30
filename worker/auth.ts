import { betterAuth } from 'better-auth';

export interface Env {
  DB: D1Database;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  /** Absents tant que l'application Discord n'existe pas : la connexion est alors désactivée. */
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
}

const DAY_SECONDS = 24 * 60 * 60;

export function createAuth(env: Env) {
  const { DISCORD_CLIENT_ID: clientId, DISCORD_CLIENT_SECRET: clientSecret } = env;
  return betterAuth({
    database: env.DB,
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    socialProviders:
      clientId && clientSecret
        ? {
            discord: {
              clientId,
              clientSecret,
              // Le pseudo vient de Discord ; l'avatar ne sert pas et n'est donc pas conservé.
              mapProfileToUser: () => ({ image: undefined }),
            },
          }
        : {},
    session: { expiresIn: 30 * DAY_SECONDS, updateAge: DAY_SECONDS },
    account: { encryptOAuthTokens: true },
    advanced: { ipAddress: { disableIpTracking: true } },
  });
}
