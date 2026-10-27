import { useEffect, useState, useSyncExternalStore } from 'react';
import { AudioEngine } from '../core/audio/engine';
import { AudioPage } from './AudioPage';
import { LoadingScreen } from './LoadingScreen';
import { TabPage } from './TabPage';
import { TheoryPage } from './TheoryPage';
import { installDevHooks } from './devHooks';

type Page = 'tab' | 'theory' | 'audio';

const SHORT_NAME: Record<string, string> = { nylon: 'GUITARE NYLON', electric: 'GUITARE ÉLECTRIQUE' };
const HASH: Record<Page, string> = { tab: '#tab', theory: '#theorie', audio: '#audio' };
const fromHash = (): Page => (location.hash === '#theorie' ? 'theory' : location.hash === '#audio' ? 'audio' : 'tab');

/** Page de contrôle (phases 1a-1c) : ce n'est pas l'UI finale (hub, thèmes, modules : suite de la phase 1). */
export function App() {
  const engine = AudioEngine.get();
  // rendu réactif à l'état du moteur (chargement, erreur, progression)
  useSyncExternalStore((cb) => engine.subscribe(cb), () => engine.version);
  const [page, setPage] = useState<Page>(fromHash);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    installDevHooks();
    void engine.preload();
  }, [engine]);
  useEffect(() => {
    const on = () => setPage(fromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const go = (p: Page) => {
    location.hash = HASH[p];
    setPage(p);
  };

  if (!skipped && engine.state !== 'ready') {
    const p = engine.progress;
    const name = SHORT_NAME[engine.settings.instrument];
    const frac = p ? p.loadedBytes / p.totalBytes : 0;
    return (
      <LoadingScreen
        progress={engine.state === 'error' ? frac : p ? 0.05 + 0.95 * frac : engine.tone ? 0.05 : 0.02}
        label={engine.tone ? 'CHARGEMENT DU SON' : 'DÉMARRAGE DU SON'}
        detail={p ? `${name ?? engine.settings.instrument.toUpperCase()} · ${(p.totalBytes / 1e6).toFixed(1).replace('.', ',')} MO` : undefined}
        error={engine.state === 'error' ? (engine.error ?? 'ÉCHEC') : undefined}
        onRetry={() => void engine.retry()}
        onSkip={() => setSkipped(true)}
      />
    );
  }

  return (
    <>
      <nav className="topnav">
        <button className={page === 'tab' ? 'on' : ''} onClick={() => go('tab')}>Tablature</button>
        <button className={page === 'audio' ? 'on' : ''} onClick={() => go('audio')}>Audio</button>
        <button className={page === 'theory' ? 'on' : ''} onClick={() => go('theory')}>Théorie</button>
      </nav>
      {page === 'tab' ? <TabPage /> : page === 'audio' ? <AudioPage /> : <TheoryPage />}
    </>
  );
}
