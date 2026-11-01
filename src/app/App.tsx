/**
 * Coquille de l'app (phase 1d) : écran de chargement, décor pixel, routeur par hash, barre de navigation.
 * Les pages de contrôle des phases 1a-1c restent joignables (#/tab, #/audio, #/theorie, depuis les réglages).
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AudioEngine } from '../core/audio/engine';
import { applyTheme, getTheme } from '../core/themes';
import { AudioPage } from './AudioPage';
import { LoadingScreen } from './LoadingScreen';
import { MetronomePage } from './MetronomePage';
import { ACTIVE_ROUTE, navigate, parseRoute, ROUTE_HREF, type RouteName } from './router';
import { SceneBackground } from './SceneBackground';
import { SettingsPage } from './SettingsPage';
import { useSettings } from './settings';
import { TabPage } from './TabPage';
import { TheoryPage } from './TheoryPage';
import { TunerPage } from './TunerPage';
import { useDesktop } from './useDesktop';
import { PixelIcon, type IconName } from './ui';
import { installDevHooks } from './devHooks';
import { startJournalSync } from './journalSync';
import { ScaleDiscoveryPage } from '../modules/gammes/ScaleDiscoveryPage';
import { ScaleSelectPage } from '../modules/gammes/ScaleSelectPage';
import { ScaleReviewPage } from '../modules/gammes/ScaleReviewPage';
import { ImproPage } from '../modules/gammes/ImproPage';
import { SequencePage } from '../modules/gammes/SequencePage';
import { HubPage } from './HubPage';
import { ChordDictionaryPage } from '../modules/accords/ChordDictionaryPage';
import { ChordReviewPage } from '../modules/accords/ChordReviewPage';
import { ChordsPage } from '../modules/accords/ChordsPage';

const SHORT_NAME: Record<string, string> = { nylon: 'GUITARE NYLON', electric: 'GUITARE ÉLECTRIQUE' };

const NAV: { route: RouteName; label: string; icon: IconName }[] = [
  { route: 'hub', label: 'Accueil', icon: 'navHome' },
  { route: 'gammes', label: 'Gammes', icon: 'navScales' },
  { route: 'accords', label: 'Accords', icon: 'navChords' },
  { route: 'tuner', label: 'Accordeur', icon: 'navTuner' },
  { route: 'metronome', label: 'Métronome', icon: 'navMetronome' },
  // La page « Son » (outil de contrôle de la 1c) sort de la barre : elle reste joignable depuis les réglages
  // et par son URL (#/audio).
  { route: 'settings', label: 'Réglages', icon: 'navSliders' },
];

function Page({ route }: { route: RouteName }) {
  switch (route) {
    case 'hub': return <HubPage />;
    case 'gammes': return <ScaleSelectPage />;
    case 'scale': return <ScaleDiscoveryPage />;
    case 'review': return <ScaleReviewPage />;
    case 'sequences': return <SequencePage />;
    case 'impro': return <ImproPage />;
    case 'accords': return <ChordsPage />;
    case 'dictionary': return <ChordDictionaryPage />;
    case 'chordReview': return <ChordReviewPage />;
    case 'tuner': return <TunerPage />;
    case 'metronome': return <MetronomePage />;
    case 'settings': return <SettingsPage />;
    case 'tab': return <TabPage />;
    case 'audio': return <AudioPage />;
    case 'theory': return <TheoryPage />;
  }
}

export function App() {
  const desktop = useDesktop();
  const engine = AudioEngine.get();
  // rendu réactif à l'état du moteur (chargement, erreur, progression)
  useSyncExternalStore((cb) => engine.subscribe(cb), () => engine.version);
  const settings = useSettings();
  const [route, setRoute] = useState<RouteName>(() => parseRoute(location.hash));
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    installDevHooks();
    void engine.preload();
    void startJournalSync();
  }, [engine]);

  // thème : variables CSS + meta theme-color (le premier rendu se fait déjà avec les défauts CSS)
  useEffect(() => {
    const t = applyTheme(document.documentElement, settings.theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t.palette.bg);
  }, [settings.theme]);

  useEffect(() => {
    const on = () => {
      setRoute(parseRoute(location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    // URL nue : on installe la route de l'accueil sans recharger
    if (!location.hash) history.replaceState(null, '', ROUTE_HREF.hub);
    return () => window.removeEventListener('hashchange', on);
  }, []);

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

  const theme = getTheme(settings.theme);
  const isDevPage = route === 'tab' || route === 'audio' || route === 'theory';

  return (
    <div className={`app workspace route-${route}`}>
      <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>Aller au contenu</a>
      <SceneBackground
        theme={theme}
        reduceMotion={settings.reduceMotion}
        scanlines={settings.scanlines && theme.scanlines}
        variant="poster"
        sunX={0.82}
      />
      <header className="mobile-brand"><a href={ROUTE_HREF.hub} className="brand">Fretwave</a><button type="button" aria-label="Réglages" onClick={() => navigate('settings')}><PixelIcon name="navSliders" size={24} /></button></header>
      <div id="main-content" tabIndex={-1} className={`app-content ${isDevPage ? 'dev' : ''}`}>
        <Page route={route} />
      </div>
      <nav className="bottombar" aria-label="Navigation principale">
        {desktop && <a className="brand" href={ROUTE_HREF.gammes}>Fretwave</a>}
        {NAV.filter(n => desktop || n.route !== 'settings').map((n) => (
          <button
            key={n.route}
            type="button"
            className={`navbtn nav-${n.route} ${ACTIVE_ROUTE[route] === n.route ? 'on' : ''}`}
            aria-current={ACTIVE_ROUTE[route] === n.route ? 'page' : undefined}
            onClick={() => navigate(n.route)}
          >
            <PixelIcon name={n.icon} size={20} />
            <span>{n.label}</span>
          </button>
        ))}
        {desktop && <p className="nav-offline">Disponible hors ligne</p>}
      </nav>
    </div>
  );
}
