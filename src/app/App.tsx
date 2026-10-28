/**
 * Coquille de l'app (phase 1d) : écran de chargement, décor pixel, routeur par hash, barre de navigation.
 * Les pages de contrôle des phases 1a-1c restent joignables (#/tab, #/audio, #/theorie, depuis les réglages).
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AudioEngine } from '../core/audio/engine';
import { applyTheme, getTheme } from '../core/themes';
import { AudioPage } from './AudioPage';
import { HubPage } from './HubPage';
import { LoadingScreen } from './LoadingScreen';
import { navigate, parseRoute, ROUTE_HREF, type RouteName } from './router';
import { SceneBackground } from './SceneBackground';
import { SettingsPage } from './SettingsPage';
import { useSettings } from './settings';
import { TabPage } from './TabPage';
import { TheoryPage } from './TheoryPage';
import { TunerPage } from './TunerPage';
import { PixelIcon, type IconName } from './ui';
import { installDevHooks } from './devHooks';
import { ScaleDiscoveryPage } from '../modules/gammes/ScaleDiscoveryPage';
import { ScaleSelectPage } from '../modules/gammes/ScaleSelectPage';
import { ScaleTrainingPage } from '../modules/gammes/ScaleTrainingPage';
import { ImproPage } from '../modules/gammes/ImproPage';
import { SequencePage } from '../modules/gammes/SequencePage';
import { ChordsPage } from '../modules/accords/ChordsPage';
import { ChordLessonPage } from '../modules/accords/ChordLessonPage';
import { ChordQuizPage } from '../modules/accords/ChordQuizPage';

const SHORT_NAME: Record<string, string> = { nylon: 'GUITARE NYLON', electric: 'GUITARE ÉLECTRIQUE' };

const NAV: { route: RouteName; label: string; icon: IconName }[] = [
  { route: 'hub', label: 'Accueil', icon: 'navHome' },
  { route: 'gammes', label: 'Gammes', icon: 'navScales' },
  // les accords retrouvent leur onglet : ils étaient passés en lien de pied de page, ce qui les
  // rendait invisibles alors que le module est complet depuis la 4b
  { route: 'accords', label: 'Accords', icon: 'navChords' },
  { route: 'tuner', label: 'Accordeur', icon: 'navTuner' },
  // La page « Son » (outil de contrôle de la 1c) sort de la barre : elle reste joignable depuis les réglages
  // et par son URL (#/audio). Cinq onglets en police pixel ne tiennent pas sur un téléphone de 390 px.
  { route: 'settings', label: 'Réglages', icon: 'navSliders' },
];

const ACTIVE: Record<RouteName, RouteName> = {
  hub: 'hub', gammes: 'gammes', scale: 'gammes', training: 'gammes', review: 'gammes', sequences: 'gammes', impro: 'gammes',
  // les écrans du module Accords allument l'onglet Accords
  accords: 'accords', chord: 'accords', chordquiz: 'accords',
  tuner: 'tuner', settings: 'settings', tab: 'settings', audio: 'audio', theory: 'settings',
};

function Page({ route }: { route: RouteName }) {
  switch (route) {
    case 'hub': return <HubPage />;
    case 'gammes': return <ScaleSelectPage />;
    case 'scale': return <ScaleDiscoveryPage />;
    // clés distinctes : sans elles, React réutilise l'instance et la session mélangée ne démarre pas
    case 'training': return <ScaleTrainingPage key="training" />;
    case 'review': return <ScaleTrainingPage key="review" initialMixed />;
    case 'sequences': return <SequencePage />;
    case 'impro': return <ImproPage />;
    case 'accords': return <ChordsPage />;
    // clé distincte : changer d'accord ne doit pas réutiliser l'état de la leçon précédente
    case 'chord': return <ChordLessonPage />;
    case 'chordquiz': return <ChordQuizPage />;
    case 'tuner': return <TunerPage />;
    case 'settings': return <SettingsPage />;
    case 'tab': return <TabPage />;
    case 'audio': return <AudioPage />;
    case 'theory': return <TheoryPage />;
  }
}

export function App() {
  const engine = AudioEngine.get();
  // rendu réactif à l'état du moteur (chargement, erreur, progression)
  useSyncExternalStore((cb) => engine.subscribe(cb), () => engine.version);
  const settings = useSettings();
  const [route, setRoute] = useState<RouteName>(() => parseRoute(location.hash));
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    installDevHooks();
    void engine.preload();
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
    // URL nue : on installe la route du hub sans recharger
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
    <div className="app">
      <SceneBackground
        theme={theme}
        reduceMotion={settings.reduceMotion}
        scanlines={settings.scanlines && theme.scanlines}
        variant="poster"
        sunX={route === 'hub' ? 0.5 : 0.82}
      />
      <div className={`app-content ${isDevPage ? 'dev' : ''}`}>
        <Page route={route} />
      </div>
      <nav className="bottombar" aria-label="Navigation principale">
        {NAV.map((n) => (
          <button
            key={n.route}
            type="button"
            className={`navbtn ${ACTIVE[route] === n.route ? 'on' : ''}`}
            aria-current={ACTIVE[route] === n.route ? 'page' : undefined}
            onClick={() => navigate(n.route)}
          >
            <PixelIcon name={n.icon} size={20} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
