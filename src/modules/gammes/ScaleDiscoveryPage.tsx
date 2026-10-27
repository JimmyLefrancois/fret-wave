/**
 * Module Gammes — niveau 1 « Découverte » (BRIEF.md §2, PROJECT.md §6.3).
 * La gamme est écrite en tablature (montée / descente / aller-retour) avec :
 *  - les couleurs de fonction d'intervalle (identiques dans tous les thèmes) et le glow des notes
 *    caractéristiques du mode ;
 *  - quatre annotations au choix (note, degré, intervalle, doigté) ;
 *  - un calque « notes de l'accord » qui estompe les notes étrangères ;
 *  - le son final de la 1c (échantillons CC0), un drone de fondamentale, un métronome.
 * Chaque écoute complète est écrite dans le journal local : le hub affiche des chiffres vrais.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { setScaleSelection, useScaleSelection } from '../../app/scaleSession';
import { useSettings } from '../../app/settings';
import { TabView } from '../../app/TabView';
import { Panel, PixelButton, PixelIcon, Segmented, Switch } from '../../app/ui';
import { fmtNote, type NoteNotation } from '../../core/theory';
import { type AnnotationKind, type Direction, positionToScore } from '../../core/tab';
import { TabPlayer, scoreTonic } from '../../core/audio/tabPlayer';
import { AudioEngine } from '../../core/audio/engine';
import { logPractice, practiceStore } from '../../core/progress/practiceLog';
import { InstrumentPicker } from '../../app/AudioControls';
import { legendFor, positionLabel, resolveScale } from './resolve';

const DIRECTION_LABEL: Record<Direction, string> = { up: 'Montée', down: 'Descente', updown: 'Aller-retour' };

const ANNOTATIONS: { value: AnnotationKind; label: string }[] = [
  { value: 'note', label: 'Notes' },
  { value: 'degree', label: 'Degrés' },
  { value: 'interval', label: 'Intervalles' },
  { value: 'finger', label: 'Doigtés' },
];

export function ScaleDiscoveryPage() {
  const settings = useSettings();
  const selection = useScaleSelection();
  const r = useMemo(() => resolveScale(selection, settings.noteNotation), [selection, settings.noteNotation]);
  const legend = useMemo(() => legendFor(r.def), [r.def]);

  const [direction, setDirection] = useState<Direction>('updown');
  const [annotation, setAnnotation] = useState<AnnotationKind>('degree');
  const [tempo, setTempo] = useState(70);
  const [loop, setLoop] = useState(false);
  const [drone, setDrone] = useState(true);
  const [metro, setMetro] = useState(false);
  const [chordLayer, setChordLayer] = useState(false);
  const [transport, setTransport] = useState<'stopped' | 'playing' | 'paused'>('stopped');
  const [status, setStatus] = useState('');
  const playing = transport === 'playing';

  const score = useMemo(() => {
    if (!r.position) return null;
    try {
      return positionToScore(r.position, r.tuning, {
        direction,
        tempo,
        fingers: true,
        markChordTones: true,
        labelText: positionLabel(r.position, settings.noteNotation),
        ...(r.chord ? { chord: r.chord } : {}),
      });
    } catch {
      return null;
    }
  }, [r.position, r.tuning, direction, tempo, r.chord, settings.noteNotation]);

  const player = useRef<TabPlayer | null>(null);
  if (player.current === null) player.current = new TabPlayer();
  const loaded = useRef<{ score: unknown; loop: boolean } | null>(null);
  const startedAt = useRef(0);
  const playedMs = useRef(0);

  useEffect(() => {
    player.current?.stop();
    loaded.current = null;
    playedMs.current = 0;
    startedAt.current = 0;
    setTransport('stopped');
    setStatus('');
  }, [score]);
  useEffect(() => player.current?.setTempo(tempo), [tempo]);
  useEffect(() => player.current?.setDrone(drone), [drone]);
  useEffect(() => player.current?.setMetronome(metro), [metro]);
  useEffect(() => {
    const p = player.current!;
    return () => p.dispose();
  }, []);

  const droneAvailable = score !== null && scoreTonic(score) !== null;

  const consume = (): number => {
    if (startedAt.current) {
      playedMs.current += performance.now() - startedAt.current;
      startedAt.current = 0;
    }
    return playedMs.current;
  };
  const logPlayed = () => {
    const seconds = Math.round(consume() / 1000);
    playedMs.current = 0;
    if (seconds >= 3 && r.position) {
      logPractice(practiceStore(), {
        ts: Date.now(),
        scaleId: r.def.id,
        tonic: r.tonic,
        system: r.selection.system,
        positionId: r.position.id,
        seconds,
      });
    }
  };

  const onPlay = async () => {
    if (!score) return;
    const p = player.current!;
    try {
      await p.init(); // en premier : reprend le contexte audio dans le geste
      if (!loaded.current || loaded.current.score !== score || loaded.current.loop !== loop) {
        await p.load({ ...score, tempo }, { loop });
        loaded.current = { score, loop };
      }
      p.onEnded = () => {
        logPlayed();
        setTransport('stopped');
        setStatus('terminé');
      };
      await p.play();
      startedAt.current = performance.now();
      setTransport('playing');
      setStatus('');
    } catch (e) {
      setStatus(`erreur audio : ${(e as Error).message}`);
      setTransport('stopped');
    }
  };
  const onPause = () => {
    player.current?.pause();
    consume();
    setTransport('paused');
    setStatus('pause');
  };
  const onStop = () => {
    player.current?.stop();
    logPlayed();
    setTransport('stopped');
    setStatus('arrêté');
  };

  const gotoPosition = (delta: number) => {
    const n = r.positions.length;
    if (n === 0) return;
    const next = (r.selection.positionIndex + delta + n) % n;
    setScaleSelection({ positionIndex: next });
  };

  const characteristic = (r.def.characteristic ?? []).map((c) => c.replace(/bb/g, '𝄫').replace(/b/g, '♭').replace(/#/g, '♯'));

  return (
    <main className="shell">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate('gammes')} aria-label="Retour à la sélection">‹</button>
        <div>
          <h1 className="page-title">{r.title}</h1>
          <p className="t-small t-dim">{positionLabel(r.position, settings.noteNotation)} · {r.tuning.nameFr}</p>
        </div>
        <span className="tag tag-on">N1</span>
      </header>

      <Panel accent="magenta" label="Écoute" right={<span className="badge">{r.formula}</span>}>
        <div className="transport-row">
          <PixelButton
            variant="primary"
            onClick={onPlay}
            disabled={!score || playing}
            ariaLabel="Lecture"
            className="play"
          >
            <PixelIcon name="play" size={18} /> {transport === 'paused' ? 'Reprendre' : 'Écouter'}
          </PixelButton>
          <PixelButton variant="quiet" onClick={onPause} disabled={!playing} ariaLabel="Pause">
            <PixelIcon name="pause" size={14} />
          </PixelButton>
          <PixelButton variant="quiet" onClick={onStop} ariaLabel="Stop">
            <PixelIcon name="stop" size={12} />
          </PixelButton>
        </div>
        <div className="tempo-row">
          <span className="t-label">Tempo</span>
          <div className="tempo">
            <button type="button" className="tempo-btn" onClick={() => setTempo((t) => Math.max(40, t - 5))} aria-label="Moins vite">−</button>
            <span className="tempo-val">♩ {tempo}</span>
            <button type="button" className="tempo-btn" onClick={() => setTempo((t) => Math.min(200, t + 5))} aria-label="Plus vite">+</button>
          </div>
        </div>

        <div className="toggle-grid">
          <Switch checked={drone && droneAvailable} onChange={setDrone} label="Drone" hint="fond. + quinte" />
          <Switch checked={metro} onChange={setMetro} label="Métronome" />
          <Switch checked={loop} onChange={setLoop} label="Boucle" />
        </div>

        <div className="field">
          <span className="t-label">Sens</span>
          <Segmented
            size="sm"
            label="Sens de lecture"
            value={direction}
            onChange={setDirection}
            options={(Object.keys(DIRECTION_LABEL) as Direction[]).map((d) => ({ value: d, label: DIRECTION_LABEL[d] }))}
          />
        </div>
        <div className="field">
          <span className="t-label">Annotation sous la tablature</span>
          <Segmented
            size="sm"
            label="Annotation"
            value={annotation}
            onChange={setAnnotation}
            options={ANNOTATIONS.map((a) => ({ value: a.value, label: a.label }))}
          />
        </div>
        <Switch
          checked={chordLayer}
          onChange={setChordLayer}
          label={`Notes de l'accord${r.chord ? ` (${r.chord})` : ''}`}
          hint="estompe les notes étrangères"
        />
        {status && <p className="t-small t-dim status">{status}</p>}
      </Panel>

      {score ? (
        <TabView
          score={score}
          notes={settings.noteNotation}
          chords={settings.chordNotation}
          annotation={annotation}
          mode="wrap"
          scale="auto"
          reduceMotion={settings.reduceMotion}
          player={player.current}
          transport={transport}
          emphasizeChordTones={chordLayer}
        />
      ) : (
        <Panel accent="yellow">
          <p className="t-body">Aucune position pour cette gamme / cet accordage.</p>
          <PixelButton onClick={() => navigate('gammes')}>Changer de système</PixelButton>
        </Panel>
      )}

      <div className="pos-nav">
        <PixelButton variant="quiet" onClick={() => gotoPosition(-1)} disabled={r.positions.length < 2}>
          ‹ Position
        </PixelButton>
        <span className="t-label pos-count">
          {r.selection.positionIndex + 1} / {r.positions.length}
        </span>
        <PixelButton variant="quiet" onClick={() => gotoPosition(1)} disabled={r.positions.length < 2}>
          Position ›
        </PixelButton>
      </div>

      <Panel accent="violet" label="Couleurs = fonctions">
        <div className="legend">
          {legend.map((it) => (
            <div key={it.fn} className="legend-item">
              <span className="legend-pill" style={{ background: it.fill, color: it.digit }}>{it.fn}</span>
              <span className="legend-name">{it.name}</span>
              {it.characteristic && <span className="tag tag-on">caractéristique</span>}
            </div>
          ))}
        </div>
        <p className="t-small t-dim">
          La couleur est attachée à la <strong>fonction</strong> : ♯4 et ♭5 tombent sur la même touche mais n’ont pas la même couleur.
          {characteristic.length > 0 ? ` Note${characteristic.length > 1 ? 's' : ''} caractéristique${characteristic.length > 1 ? 's' : ''} : ${characteristic.join(', ')} (anneau qui pulse).` : ''}
        </p>
      </Panel>

      {r.hint && (
        <Panel accent="yellow" label="Ce que tu écoutes">
          <p className="t-body">{r.hint}</p>
          {r.parent && <p className="t-small t-dim">{r.parent}</p>}
        </Panel>
      )}

      <Panel label="Instrument">
        <InstrumentPicker />
      </Panel>

      <div className="row">
        <PixelButton variant="quiet" onClick={() => navigate('gammes')}>← Changer de gamme</PixelButton>
        <PixelButton variant="quiet" onClick={() => navigate('hub')}>Hub</PixelButton>
      </div>
      <p className="t-small t-dim foot-note">
        Niveaux 2 (trous), 3 (rappel) et 4 (improvisation) : phases 2 et 7. Notations et thème : {noteSummary(settings.noteNotation)}.
        Son : {AudioEngine.get().settings.instrument === 'nylon' ? 'nylon' : 'électrique'} (CC0, crédits dans la page Audio).
      </p>
    </main>
  );
}

function noteSummary(n: NoteNotation): string {
  return n === 'fr' ? 'solfège' : `anglo-saxonne (${fmtNote('A', 'en')})`;
}
