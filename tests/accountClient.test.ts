import { describe, expect, it, vi } from 'vitest';
import { fetchAccount, parseAccount, signOut, startSignIn } from '../src/core/account/client';

const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('parseAccount', () => {
  it('lit le pseudo de la session', () => {
    expect(parseAccount({ user: { name: 'Jimmy', email: 'x@y.z' } })).toEqual({ name: 'Jimmy' });
  });

  it('renvoie null sans session ou sur une réponse inattendue', () => {
    expect(parseAccount(null)).toBeNull();
    expect(parseAccount({ user: {} })).toBeNull();
    expect(parseAccount({ user: { name: 3 } })).toBeNull();
  });
});

describe('appels au compte', () => {
  it('fetchAccount distingue « pas de session » d’une panne', async () => {
    expect(await fetchAccount(reply(null))).toBeNull();
    await expect(fetchAccount(reply({}, 500))).rejects.toThrow('500');
  });

  it('startSignIn envoie Discord et l’adresse de retour, et rend l’adresse de Discord', async () => {
    const doFetch = reply({ url: 'https://discord.com/x', redirect: true });
    expect(await startSignIn('/#/reglages', doFetch)).toBe('https://discord.com/x');
    const init = vi.mocked(doFetch).mock.calls[0]?.[1];
    expect(JSON.parse(init?.body as string)).toEqual({ provider: 'discord', callbackURL: '/#/reglages' });
  });

  it('startSignIn échoue sans adresse', async () => {
    await expect(startSignIn('/', reply({ message: 'non' }, 404))).rejects.toThrow('404');
  });

  it('signOut signale un refus', async () => {
    await expect(signOut(reply({}, 403))).rejects.toThrow('403');
    await expect(signOut(reply({ success: true }))).resolves.toBeUndefined();
  });
});
