/** Panneau « Compte » des réglages : absent de `npm run dev`, qui n'a pas d'API. */
import { useEffect, useState } from 'react';
import { ACCOUNTS_ENABLED, fetchAccount, signOut, startSignIn, type Account } from '../core/account/client';
import { ROUTE_HREF } from './router';
import { Panel, PixelButton } from './ui';

type Status = 'loading' | 'signedOut' | 'unavailable' | { account: Account };

export function AccountPanel() {
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ACCOUNTS_ENABLED) return;
    let alive = true;
    fetchAccount().then(
      (account) => { if (alive) setStatus(account ? { account } : 'signedOut'); },
      () => { if (alive) setStatus('unavailable'); },
    );
    return () => { alive = false; };
  }, []);

  if (!ACCOUNTS_ENABLED) return null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setFailed(false);
    try {
      await action();
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };

  const signIn = () => run(async () => {
    location.href = await startSignIn(`${location.pathname}${ROUTE_HREF.settings}`);
  });
  const leave = () => run(async () => {
    await signOut();
    setStatus('signedOut');
  });

  return (
    <Panel className="span-12" accent="cyan" label="Compte">
      {status === 'loading' && <p className="t-small t-dim">Vérification du compte…</p>}
      {status === 'unavailable' && <p className="t-small">Compte indisponible pour le moment. L’app reste utilisable.</p>}
      {status === 'signedOut' && (
        <>
          <p className="t-small">
            Le compte est facultatif. Sans compte, ta progression reste sur cet appareil.
          </p>
          <div className="data-row">
            <PixelButton variant="primary" onClick={() => void signIn()} disabled={busy}>Se connecter avec Discord</PixelButton>
          </div>
        </>
      )}
      {typeof status === 'object' && (
        <>
          <p className="t-small">
            Compte actif : <strong>{status.account.name}</strong>. La synchronisation de ta progression arrive bientôt.
          </p>
          <div className="data-row">
            <PixelButton onClick={() => void leave()} disabled={busy}>Se déconnecter</PixelButton>
          </div>
        </>
      )}
      {failed && <p className="t-small" role="alert">Ça n’a pas fonctionné. Réessaie dans un instant.</p>}
    </Panel>
  );
}
