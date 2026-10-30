/**
 * Métronome (`#/metronome`, D112) : un outil, pas un exercice. Rien ne va au journal ni à l'XP.
 * Un seul panneau, rien à déplier : à l'arrêt, tous les réglages sont là, une ligne chacun ; en jeu sur
 * téléphone, ils s'effacent et les temps lumineux prennent leur place pour se lire de loin.
 * Espace : marche/arrêt, ou pause quand l'automation tourne. Entrée : marche/arrêt, toujours.
 * Une mesure silencieuse éteint aussi les temps lumineux : les laisser allumés donnerait la réponse.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { AudioEngine } from '../core/audio/engine';
import { CLICK_SOUNDS, type ClickSound } from '../core/audio/metronome';
import {
  METRO_BEATS_MAX, METRO_BPM_MAX, METRO_BPM_MIN, METRO_COUNT_MAX, loadMetronomeState, saveMetronomeState,
  type MetroBeat, type MetronomeConfig, type MetronomeState, type RampUnit, type SilentBars, type TempoRamp,
} from '../core/audio/metronomeRun';
import { MetronomeSession, type MetroState } from '../core/audio/metronomeSession';
import { useSettings } from './settings';
import { Chip, Panel, PixelButton, Segmented, Switch, type Option } from './ui';

const SOUND_LABEL: Record<ClickSound, string> = { bois: 'Bois', bip: 'Bip', cloche: 'Cloche', sec: 'Sec' };
const SOUND_OPTIONS: readonly Option<ClickSound>[] = CLICK_SOUNDS.map((s) => ({ value: s, label: SOUND_LABEL[s] }));
const COUNT_OPTIONS: readonly Option<number>[] = Array.from({ length: METRO_COUNT_MAX + 1 }, (_, n) => ({ value: n, label: n === 0 ? 'Aucun' : String(n) }));
const UNIT_OPTIONS: readonly Option<RampUnit>[] = [{ value: 'bars', label: 'Mesures' }, { value: 'seconds', label: 'Secondes' }];

const storage = () => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

function formatChrono(s: number): string {
  const total = Math.floor(s);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const tempoOf = (c: MetronomeConfig): string => (c.ramp.on ? `${c.ramp.from}→${c.ramp.to}` : String(c.bpm));

const HOLD_DELAY_MS = 400;
const HOLD_EVERY_MS = 70;

/**
 * Une ligne : libellé à gauche, valeur réglable à droite (`compact` : libellé au-dessus, pour deux par ligne).
 * Maintenir − ou + fait défiler (60 → 120 en 60 appuis, sinon).
 */
function Stepper(props: { label: string; value: number; min: number; max: number; step?: number; compact?: boolean; onChange: (v: number) => void }) {
  const { label, value, min, max, step = 1, compact = false, onChange } = props;
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const timers = useRef<{ delay: number; repeat: number } | null>(null);
  const held = useRef(false);
  const set = (v: number) => latest.current.onChange(Math.max(min, Math.min(max, v)));
  const release = () => {
    if (!timers.current) return;
    clearTimeout(timers.current.delay);
    clearInterval(timers.current.repeat);
    timers.current = null;
  };
  useEffect(() => release, []);
  const press = (dir: number) => (e: PointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return;
    held.current = false;
    release();
    timers.current = { repeat: 0, delay: window.setTimeout(() => {
      held.current = true;
      timers.current!.repeat = window.setInterval(() => set(latest.current.value + dir * step), HOLD_EVERY_MS);
    }, HOLD_DELAY_MS) };
    // sur la fenêtre : le bouton se désactive à la borne et ne recevrait plus le relâchement
    window.addEventListener('pointerup', release, { once: true });
    window.addEventListener('pointercancel', release, { once: true });
  };
  // le relâchement d'un maintien déclenche aussi un clic, qui ajouterait un cran
  const swallowHeld = (e: MouseEvent<HTMLSpanElement>) => {
    if (held.current) e.stopPropagation();
    held.current = false;
  };
  return (
    <div className={compact ? 'metro-stepper' : 'metro-row'}>
      <span className="metro-label">{label}</span>
      <div className="metro-stepper-control">
        <span className="metro-hold" onPointerDown={press(-1)} onClickCapture={swallowHeld}>
          <PixelButton onClick={() => set(value - step)} disabled={value <= min} ariaLabel={`${label} : moins ${step}`}>−</PixelButton>
        </span>
        <output className="metro-stepper-value" aria-label={label}>{value}</output>
        <span className="metro-hold" onPointerDown={press(1)} onClickCapture={swallowHeld}>
          <PixelButton onClick={() => set(value + step)} disabled={value >= max} ariaLabel={`${label} : plus ${step}`}>+</PixelButton>
        </span>
      </div>
    </div>
  );
}

function statusText(state: MetroState, beat: MetroBeat | null): string {
  if (state === 'paused') return 'En pause';
  if (state === 'stopped' || !beat) return 'Prêt';
  if (beat.phase === 'count') return 'Décompte';
  return beat.audible ? 'Écoute le clic' : 'Mesure silencieuse';
}

export function MetronomePage() {
  const settings = useSettings();
  const [store, setStore] = useState<MetronomeState>(() => loadMetronomeState(storage()));
  const { config, slots } = store;
  const session = useMemo(() => new MetronomeSession(config), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [state, setState] = useState<MetroState>('stopped');
  const [beat, setBeat] = useState<MetroBeat | null>(null);
  const [slot, setSlot] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const frame = useRef<HTMLDivElement | null>(null);
  // même canal que la console de mixage des réglages : la valeur est mémorisée par le moteur
  const [volume, setVolume] = useState(() => AudioEngine.get().settings.volumes.metronome);
  const changeVolume = (v: number) => {
    setVolume(v);
    AudioEngine.get().setVolume('metronome', v);
  };

  useEffect(() => {
    session.setConfig(config);
    saveMetronomeState(storage(), store);
  }, [session, config, store]);

  // Quitter la page coupe le clic : le Transport est partagé avec les tablatures.
  useEffect(() => () => session.stop(), [session]);

  // Affichage calé sur ce qui est entendu ; on ne relit l'état React qu'au changement de temps.
  useEffect(() => {
    if (state !== 'playing') return;
    let raf = 0;
    const tick = () => {
      const heard = session.heard();
      if (heard) setBeat((b) => (b === heard ? b : heard));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [session, state]);

  useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  const patch = (p: Partial<MetronomeConfig>) => setStore((s) => ({ ...s, config: { ...s.config, ...p } }));
  const patchRamp = (p: Partial<TempoRamp>) => patch({ ramp: { ...config.ramp, ...p } });
  const patchSilence = (p: Partial<SilentBars>) => patch({ silence: { ...config.silence, ...p } });
  const nudge = (d: number) => patch({ bpm: Math.max(METRO_BPM_MIN, Math.min(METRO_BPM_MAX, config.bpm + d)) });

  const startStop = async () => {
    if (session.state === 'stopped') {
      await session.start();
    } else {
      session.stop();
      setBeat(null);
    }
    setState(session.state);
  };
  const pauseResume = () => {
    if (session.state === 'playing') session.pause();
    else session.resume();
    setState(session.state);
  };

  // Raccourcis lus depuis une référence : l'écouteur n'est posé qu'une fois.
  const keys = useRef({ startStop, pauseResume, rampOn: config.ramp.on });
  keys.current = { startStop, pauseResume, rampOn: config.ramp.on };
  useEffect(() => {
    const pausing = (e: KeyboardEvent) => e.key === ' ' && keys.current.rampOn && session.state !== 'stopped';
    // Démarrer garde le focus après un clic : sans ce cas, l'espace l'activerait et arrêterait au lieu de mettre en pause.
    const onMainButton = (e: KeyboardEvent) => pausing(e) && (e.target as HTMLElement | null)?.closest('.metro-go') != null;
    const on = (e: KeyboardEvent) => {
      if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return;
      // un bouton ou un champ actif garde sa propre touche
      if (!onMainButton(e) && (e.target as HTMLElement | null)?.closest('button, input, select, textarea, a, summary')) return;
      e.preventDefault();
      if (pausing(e)) keys.current.pauseResume();
      else void keys.current.startStop();
    };
    const onUp = (e: KeyboardEvent) => {
      if (onMainButton(e)) e.preventDefault(); // Firefox active le bouton au relâchement
    };
    window.addEventListener('keydown', on);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', on);
      window.removeEventListener('keyup', onUp);
    };
  }, [session]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frame.current?.requestFullscreen();
  };

  const { ramp, silence } = config;
  const running = state !== 'stopped';
  const shownBpm = running && beat ? beat.bpm : ramp.on ? ramp.from : config.bpm;
  const beats = beat?.beats ?? config.beats;
  const lit = beat && beat.audible && state === 'playing' ? beat.beat : -1;
  const canFlash = config.flash && !settings.reduceMotion && lit >= 0;
  const status = statusText(state, beat);
  const counting = state === 'playing' && beat?.phase === 'count';
  const lightsOut = state === 'paused' || (state === 'playing' && beat?.audible === false);
  const stored = slots[slot] ?? null;

  return (
    <main className="shell">
      <h1 className="sr-only">Métronome</h1>
      <Panel className="span-12" accent="magenta">
        <div ref={frame} className={`metro ${running ? 'running' : ''}`}>
          <div className="metro-player">
            {canFlash && <i key={beat!.total} className={`metro-flash ${lit === 0 ? 'strong' : ''}`} aria-hidden="true" />}
            <div className="metro-tempo">
              {[-5, -1].map((d) => (
                <PixelButton key={d} disabled={ramp.on} onClick={() => nudge(d)} ariaLabel={`Tempo moins ${-d}`}>−{-d}</PixelButton>
              ))}
              <p className="metro-bpm" data-testid="metro-bpm">
                <strong>{shownBpm}</strong>
                <span>{counting ? 'Décompte' : `BPM · ${Math.round(60000 / shownBpm)} ms`}</span>
              </p>
              {[1, 5].map((d) => (
                <PixelButton key={d} disabled={ramp.on} onClick={() => nudge(d)} ariaLabel={`Tempo +${d}`}>+{d}</PixelButton>
              ))}
            </div>
            {ramp.on ? (
              <p className="metro-ramp-line">Automation : {ramp.from} → {ramp.to} BPM</p>
            ) : (
              <input
                className="metro-slider"
                style={{ '--metro-fill': `${((config.bpm - METRO_BPM_MIN) / (METRO_BPM_MAX - METRO_BPM_MIN)) * 100}%` } as CSSProperties}
                type="range"
                min={METRO_BPM_MIN}
                max={METRO_BPM_MAX}
                value={config.bpm}
                onChange={(e) => patch({ bpm: Number(e.target.value) })}
                aria-label="Tempo en BPM"
              />
            )}
            <div className={`metro-beats ${beats > 6 ? 'many' : ''}`} style={{ '--metro-beats': beats } as CSSProperties} role="img" aria-label={`${beats} temps par mesure`}>
              {Array.from({ length: beats }, (_, i) => (
                <span key={i} className={`metro-beat ${i === 0 ? 'first' : ''} ${i === lit ? 'on' : ''} ${beat?.phase === 'count' ? 'count' : ''}`}><span>{i + 1}</span></span>
              ))}
              {/* posé sur les temps seulement quand ils sont éteints : un décompte se lit sur les temps, sa mention va sous le BPM */}
              <p className={`metro-status ${lightsOut ? '' : 'sr-only'}`} data-testid="metro-status">{status}</p>
            </div>
            <div className="metro-meta">
              <dl className="metro-counters">
                <div><dt>Temps</dt><dd data-testid="metro-total">{beat?.total ?? 0}</dd></div>
                <div><dt>Mesures</dt><dd data-testid="metro-bars">{beat?.bar ?? 0}</dd></div>
                <div><dt>Chrono</dt><dd>{formatChrono(beat?.elapsedS ?? 0)}</dd></div>
              </dl>
            </div>
            <div className="metro-volume">
              <span className="metro-label">Volume</span>
              <input
                className="metro-slider"
                style={{ '--metro-fill': `${volume * 100}%` } as CSSProperties}
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => changeVolume(Number(e.target.value))}
                aria-label="Volume du métronome"
                data-testid="metro-volume"
              />
              {document.fullscreenEnabled && (
                <Chip small onClick={toggleFullscreen}>{fullscreen ? 'Quitter' : 'Plein écran'}</Chip>
              )}
            </div>
          </div>

          <section className="metro-settings" aria-label="Réglages du métronome">
            <Stepper label="Temps par mesure" value={config.beats} min={1} max={METRO_BEATS_MAX} onChange={(b) => patch({ beats: b })} />
            <div className="metro-row">
              <span className="metro-label">Décompte</span>
              <Segmented<number> size="sm" value={config.countIn} options={COUNT_OPTIONS} onChange={(countIn) => patch({ countIn })} label="Mesures de décompte" />
            </div>
            <div className="metro-row">
              <span className="metro-label">Son</span>
              <Segmented<ClickSound> size="sm" value={config.sound} options={SOUND_OPTIONS} onChange={(sound) => patch({ sound })} label="Son du clic" />
            </div>
            <Switch
              checked={config.flash}
              onChange={(flash) => patch({ flash })}
              label="Flash à chaque temps"
              {...(settings.reduceMotion ? { hint: 'animations réduites dans les réglages' } : {})}
              disabled={settings.reduceMotion}
            />
            <div className="metro-group">
              <Switch checked={ramp.on} onChange={(on) => patchRamp({ on })} label="Paliers de tempo" />
              {ramp.on && (
                <div className="metro-sub">
                  <Stepper compact label="Départ" value={ramp.from} min={METRO_BPM_MIN} max={METRO_BPM_MAX} onChange={(from) => patchRamp({ from })} />
                  <Stepper compact label="Cible" value={ramp.to} min={METRO_BPM_MIN} max={METRO_BPM_MAX} onChange={(to) => patchRamp({ to })} />
                  <Stepper compact label="BPM par palier" value={ramp.step} min={1} max={50} onChange={(step) => patchRamp({ step })} />
                  <Stepper compact label={ramp.unit === 'bars' ? 'Mesures par palier' : 'Secondes par palier'} value={ramp.every} min={1} max={600} step={ramp.unit === 'bars' ? 1 : 5} onChange={(every) => patchRamp({ every })} />
                  <Segmented<RampUnit> size="sm" value={ramp.unit} options={UNIT_OPTIONS} onChange={(unit) => patchRamp({ unit })} label="Unité des paliers" />
                  <Switch checked={ramp.loop} onChange={(loop) => patchRamp({ loop })} label="Boucler" />
                </div>
              )}
            </div>
            <div className="metro-group">
              <Switch checked={silence.on} onChange={(on) => patchSilence({ on })} label="Mesures silencieuses" />
              {silence.on && (
                <div className="metro-sub">
                  <Stepper compact label="Audibles" value={silence.audible} min={1} max={64} onChange={(audible) => patchSilence({ audible })} />
                  <Stepper compact label="Silencieuses" value={silence.silent} min={1} max={64} onChange={(silent) => patchSilence({ silent })} />
                  <div className="metro-wide"><Switch checked={silence.random} onChange={(random) => patchSilence({ random })} label="Longueur aléatoire" hint="de 1 à la valeur réglée" /></div>
                </div>
              )}
            </div>
            <div className="metro-group metro-memory">
              <div className="metro-line">
                <span className="metro-label">Mémoire {slot + 1}</span>
                <span className="t-small t-dim">{stored ? `${tempoOf(stored)} BPM, ${stored.beats} temps` : 'vide'}</span>
              </div>
              <div className="metro-slots" role="group" aria-label="Emplacement de mémoire">
                {slots.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`seg metro-slot ${i === slot ? 'on' : ''} ${s ? 'full' : ''}`}
                    aria-pressed={i === slot}
                    title={s ? `${tempoOf(s)} BPM · ${s.beats} temps` : 'Vide'}
                    onClick={() => setSlot(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <div className="metro-slot-actions">
                <PixelButton onClick={() => setStore((s) => ({ ...s, slots: s.slots.map((v, i) => (i === slot ? s.config : v)) }))}>Enregistrer</PixelButton>
                <PixelButton disabled={!stored} onClick={() => stored && patch(stored)}>Charger</PixelButton>
                <PixelButton variant="quiet" disabled={!stored} onClick={() => setStore((s) => ({ ...s, slots: s.slots.map((v, i) => (i === slot ? null : v)) }))}>Effacer</PixelButton>
              </div>
            </div>
          </section>

          <div className="metro-go-row">
            <PixelButton variant="primary" className="metro-go" onClick={() => void startStop()} keyShortcuts="Enter">
              {running ? 'Arrêter' : '▶ Démarrer'}
              {!(running && ramp.on) && <span className="home-key">Entrée</span>}
            </PixelButton>
            {running && ramp.on && (
              <PixelButton onClick={pauseResume} keyShortcuts="Space">{state === 'paused' ? 'Reprendre' : 'Pause'}</PixelButton>
            )}
          </div>
        </div>
      </Panel>
    </main>
  );
}
