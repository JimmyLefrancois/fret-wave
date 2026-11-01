import { PracticeHeader, PositionRail, PositionStepper } from './PracticeHeader';
/**
 * Improvisation (phase 7) — **jouer sur un accompagnement, et comprendre ce qu'on joue**.
 *
 * L'écran fait trois choses, dans cet ordre d'importance :
 *
 *  1. **il accompagne** : une grille (basse, pads, batterie) synthétisée, deux styles, un tempo réglable,
 *     l'accord courant affiché et surligné. Rien de tout cela ne juge ;
 *  2. **il inscrit ce que tu joues** : chaque note entendue s'allume **à sa place dans la position**
 *     (`flash` de `TabView`) — c'est P3 de la phase 3, qui atterrit ici ;
 *  3. **il classe** : chaque note reçoit un rôle harmonique (note d'accord, couleur, passage, à éviter,
 *     hors gamme), et la prise se résume par trois taux + un conseil.
 *
 * Ce que l'écran ne fait **pas** : juger le goût, la phrase, le rythme fin. Une ligne lente et juste vaut
 * mieux qu'une avalanche de notes, mais l'app ne sait mesurer que la justesse harmonique — et elle le dit.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from '../../core/audio/engine';
import { BackingPlayer, backingPattern, loopBeatsOf } from '../../core/audio/backing';
import { describeInputError, type InputEngine, type InputFrame } from '../../core/input/engine';
import { useInputSettings } from '../../core/input/settings';
import { ensureInputEngine, windowFor } from '../../app/inputSession';
import { CHORD_INTERVALS, judgeNote, ROLE_LABEL, summarizeImpro, type ImproNote, type ImproStats, type NoteRole } from '../../core/impro/classify';
import { locateInScore, scoreNotes, type PlacedNote } from '../../core/impro/locate';
import { positionToScore } from '../../core/tab/generators';
import { Chip, Panel, PixelButton } from '../../app/ui';
import { TabView } from '../../app/TabView';
import { useSettings } from '../../app/settings';
import { useDesktop } from '../../app/useDesktop';
import { LandscapeView, openLandscape } from '../../app/LandscapeView';
import { canAutoOpenMic, micPermission } from '../../core/input/autoOpen';
import { PlaySection } from './PlaySection';
import { setScaleSelection, useScaleSelection } from '../../app/scaleSession';
import { fmtNote, pitchClassOf } from '../../core/theory';
import { noteNameOf } from '../../core/input/match';
import { chordAtMeasure, chordName, backingsFor, IMPRO_BACKINGS, STYLE_LABEL, type BackingMode, type BackingStyle } from './impro';
import { legendFor, positionLabelPlain, resolveScale } from './resolve';

const ROLE_CLASS: Record<NoteRole, string> = {
  chord: 'impro-role-chord',
  color: 'impro-role-color',
  passing: 'impro-role-passing',
  avoid: 'impro-role-avoid',
  out: 'impro-role-out',
};

const pct = (v: number): string => `${Math.round(v * 100)} %`;

/** « 1 passage », « 3 passages » : un compte ne s'écrit pas au pluriel par défaut. */
const count = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`;

export function ImproPage() {
  const wide = useDesktop();
  const [landscape, setLandscape] = useState(false);
  // un grand téléphone dépasse 900 px en paysage : la vue de jeu garde le rendu téléphone
  const desktop = wide && !landscape;
  const settings = useSettings();
  const selection = useScaleSelection();
  const r = useMemo(() => resolveScale(selection, settings.noteNotation), [selection, settings.noteNotation]);

  /** La position telle qu'elle s'affiche : c'est aussi la carte des notes qu'on peut allumer. */
  const score = useMemo(() => {
    if (!r.position) return null;
    try {
      return positionToScore(r.position, r.tuning, {
        direction: 'up',
        fingers: true,
        labelText: positionLabelPlain(r.position, settings.noteNotation),
        // pas de nom d'accord au-dessus de la portée : sur cet écran l'accord **change toutes les
        // mesures** (c'est la grille qui le dit). Afficher le « chord » par défaut de la gamme
        // (Am7 pour La mineur pentatonique) annoncerait un accord que l'accompagnement ne joue pas.
      });
    } catch {
      return null;
    }
  }, [r.position, r.tuning, r.chord, settings.noteNotation]);

  const placed = useMemo(() => (score ? scoreNotes(score) : []), [score]);
  /** Les classes de hauteur de la position : c'est la gamme réellement affichée, pas une théorie à part. */
  const scalePcs = useMemo(() => [...new Set(placed.map((n) => ((n.midi % 12) + 12) % 12))].sort((a, b) => a - b), [placed]);
  /**
   * La tonique est celle de la **gamme choisie**, pas la première note de la position : une position de
   * La mineur pentatonique commence rarement sur La, et la grille se serait transposée sur la mauvaise
   * fondamentale sans que rien ne le signale.
   */
  const tonicPc = pitchClassOf(r.tonic);

  /** Mineur ou majeur : la tierce de la tonique décide, pas le nom de la famille. */
  const mode: BackingMode = useMemo(() => {
    const hasMinorThird = scalePcs.some((p) => ((p - tonicPc + 12) % 12) === 3);
    return hasMinorThird ? 'minor' : 'major';
  }, [scalePcs, tonicPc]);

  const [style, setStyle] = useState<BackingStyle>('synthwave');
  const backing = useMemo(() => backingsFor(mode).find((b) => b.style === style) ?? IMPRO_BACKINGS[0]!, [mode, style]);
  const [tempo, setTempo] = useState(backing.tempo);
  useEffect(() => setTempo(backing.tempo), [backing.tempo]);

  const [transport, setTransport] = useState<'stopped' | 'playing'>('stopped');
  const [measure, setMeasure] = useState(0);
  const [takes, setTakes] = useState<ImproNote[]>([]);
  const [summary, setSummary] = useState<ImproStats | null>(null);
  const [flash, setFlash] = useState<{ string: number; fret: number }[]>([]);
  const [status, setStatus] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);

  const player = useRef<BackingPlayer | null>(null);
  const previous = useRef<PlacedNote | null>(null);
  const flashTimers = useRef<number[]>([]);
  const lastJudged = useRef<{ midi: number; at: number } | null>(null);
  const onFrameRef = useRef<(f: InputFrame) => void>(() => {});

  // --- micro
  const input = useInputSettings();
  const [engine, setEngine] = useState<InputEngine | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [micBusy, setMicBusy] = useState(false);

  const chord = useMemo(() => chordAtMeasure(backing, tonicPc, measure), [backing, tonicPc, measure]);

  const stop = useCallback(() => {
    player.current?.stop();
    setTransport('stopped');
    setFlash([]);
    for (const t of flashTimers.current) window.clearTimeout(t);
    flashTimers.current = [];
    if (takes.length === 0) {
      setSummary(null);
      return;
    }
    const stats = summarizeImpro(takes);
    setSummary(stats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takes, r]);

  // identité stable : un changement de `onClose` ferait quitter le plein écran à `LandscapeView`
  const stopRef = useRef(stop);
  stopRef.current = stop;
  const closePlay = useCallback(() => {
    stopRef.current();
    setLandscape(false);
  }, []);

  const start = async (): Promise<void> => {
    setStatus('');
    setSummary(null);
    setTakes([]);
    previous.current = null;
    lastJudged.current = null;
    try {
      await AudioEngine.get().unlock();
      await AudioEngine.get().init();
      const ctx = AudioEngine.get().rawContext;
      if (!player.current) {
        const p = new BackingPlayer(ctx, AudioEngine.get().backingInput());
        p.load(backingPattern(backing, 40), tempo, loopBeatsOf(backing));
        player.current = p;
      } else {
        player.current.load(backingPattern(backing, 40), tempo, loopBeatsOf(backing));
      }
      player.current.start();
      setTransport('playing');
      setMeasure(0);
    } catch (e) {
      setStatus(`audio indisponible : ${(e as Error).message}`);
    }
  };

  // le tempo change en cours de jeu : on recharge la boucle sans arrêter le transport
  useEffect(() => {
    if (!player.current) return;
    player.current.load(backingPattern(backing, 40), tempo, loopBeatsOf(backing));
  }, [backing, tempo]);

  // --- suivi de la mesure (le curseur de l'écran, pas celui du son)
  useEffect(() => {
    if (transport !== 'playing') return;
    let raf = 0;
    const tick = () => {
      const p = player.current;
      if (p) setMeasure(p.currentMeasure());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [transport]);

  // --- micro : ouverture à la demande
  useEffect(() => {
    if (!micOn) {
      engine?.stop();
      return;
    }
    let cancelled = false;
    setMicBusy(true);
    void (async () => {
      try {
        await AudioEngine.get().unlock();
        const e = await ensureInputEngine();
        if (cancelled) return;
        setEngine(e);
        await e.start(input, { windowSize: windowFor(r.tuning.id) });
        if (cancelled) {
          e.stop();
          return;
        }
        if (e.state !== 'listening') {
          const d = describeInputError(e.state, e.error);
          setStatus(`${d.message} — ${d.hint}`);
          setMicOn(false);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus(`micro indisponible : ${(err as Error).message}`);
          setMicOn(false);
        }
      } finally {
        if (!cancelled) setMicBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micOn]);

  // au bureau, le micro s'ouvre seul dès que le navigateur le permet
  useEffect(() => {
    if (!desktop) return;
    let cancelled = false;
    void micPermission().then((permission) => {
      if (!cancelled && canAutoOpenMic(permission, navigator.userActivation?.hasBeenActive ?? false)) setMicOn(true);
    });
    return () => { cancelled = true; };
  }, [desktop]);

  useEffect(() => {
    if (!engine) return;
    return engine.subscribe(() => {
      const f = engine.last;
      if (f) onFrameRef.current(f);
    });
  }, [engine]);

  // --- écoute : une note jouée = une note classée, une pastille allumée
  const handleFrame = (f: InputFrame): void => {
    if (transport !== 'playing' || !f.stable || !f.isNew) return;
    const now = performance.now();
    const last = lastJudged.current;
    if (last && last.midi === f.midi && now - last.at < 320) return;
    lastJudged.current = { midi: f.midi, at: now };
    const p = player.current;
    const beatPhase = p ? (p.positionBeats() % 4) / 4 : 0;
    const judgement = judgeNote(f.midi, chord, scalePcs);
    setTakes((prev) => [...prev.slice(-80), { midi: f.midi, at: now, beatPhase, chord: { root: chord.root, quality: chord.quality }, judgement }]);
    const at = locateInScore(placed, f.midi, previous.current);
    if (at) {
      previous.current = at;
      setFlash([{ string: at.string, fret: at.fret }]);
      const timer = window.setTimeout(() => setFlash([]), 900);
      flashTimers.current.push(timer);
    }
  };
  onFrameRef.current = handleFrame;

  useEffect(() => () => {
    player.current?.stop();
    for (const t of flashTimers.current) window.clearTimeout(t);
  }, []);

  const live = useMemo(() => (takes.length > 0 ? summarizeImpro(takes) : null), [takes]);
  const recent = takes.slice(-8);
  const lane = r.position ? `${positionLabelPlain(r.position, settings.noteNotation)} · ${r.title}` : r.title;

  const tab = score && (
    <TabView
      score={score}
      notes={settings.noteNotation}
      chords={settings.chordNotation}
      annotation="none"
      mode="wrap"
      scale="auto"
      reduceMotion={settings.reduceMotion}
      player={null}
      transport="stopped"
      hideRhythm
      oneLine={wide || landscape}
      {...(flash.length > 0 ? { flash } : {})}
    />
  );
  const styleChips = (
    <>
      {(['synthwave', 'lofi'] as BackingStyle[]).map((s) => (
        <Chip key={s} selected={style === s} onClick={() => setStyle(s)}>{STYLE_LABEL[s]}</Chip>
      ))}
    </>
  );
  const chordGrid = (
    <div className="impro-grid">
      {backing.chords.map((c, i) => {
        const name = chordName(((tonicPc + c.offset) % 12 + 12) % 12, c.quality);
        return (
          <div key={`${c.roman}-${i}`} className={`impro-chord ${transport === 'playing' && i === measure ? 'on' : ''}`}>
            <span className="impro-chord-name">{name}</span>
            <span className="impro-chord-roman">{c.roman}</span>
          </div>
        );
      })}
    </div>
  );
  const tempoControl = (
    <div className="tempo-group">
      <span className="t-label">Tempo</span>
      <div className="tempo">
        <button type="button" className="tempo-btn" onClick={() => setTempo((t) => Math.max(60, t - 4))} aria-label="Moins vite">−</button>
        <span className="tempo-val">♩ {tempo}</span>
        <button type="button" className="tempo-btn" onClick={() => setTempo((t) => Math.min(140, t + 4))} aria-label="Plus vite">+</button>
      </div>
    </div>
  );
  const accompaniment = (
    <>
      <p className="t-small">{lane} · {tempo} BPM</p>
      <p className="t-small t-dim">{backing.why}</p>
    </>
  );
  const howToPlay = (
    <>
      <p className="t-small t-dim">Ouvre le micro, démarre l’accompagnement, et joue ce que tu entends : tes notes s’inscrivent sur la tablature.</p>
      <p className="t-small t-dim">La grille tourne, l’accord courant s’allume : joue ses notes sur les temps forts, le reste en passage.</p>
    </>
  );
  const chordNotes = (
    <p className="t-small t-dim">
      Notes de l’accord : {CHORD_INTERVALS[chord.quality].map((iv) => fmtNote(noteNameOf(60 + chord.root + iv), settings.noteNotation)).join(' · ')}
    </p>
  );
  const take = (
    <>
      {recent.length === 0 ? (
        <p className="t-small t-dim">Aucune note encore. Ouvre le micro, démarre l’accompagnement, et joue ce que tu entends.</p>
      ) : (
        <div className="impro-notes">
          {recent.map((n, i) => (
            <span key={`${n.at}-${i}`} className={`impro-note ${ROLE_CLASS[n.judgement.role]}`} title={ROLE_LABEL[n.judgement.role]}>
              {fmtNote(noteNameOf(n.midi), settings.noteNotation)}
            </span>
          ))}
        </div>
      )}
      {live && (
        <div className="impro-stats">
          <span><strong>{pct(live.chordRate)}</strong> de notes d’accord</span>
          <span><strong>{pct(live.inScaleRate)}</strong> dans la gamme</span>
          <span><strong>{pct(live.strongChordRate)}</strong> d’accords sur les temps forts</span>
        </div>
      )}
      {summary && (
        <div className="impro-summary">
          <p className="t-body"><strong>{summary.score} / 100</strong> — {summary.advice}</p>
          <p className="t-small t-dim">
            {count(summary.byRole.chord, 'note d’accord', 'notes d’accord')} · {count(summary.byRole.color, 'couleur', 'couleurs')} ·{' '}
            {count(summary.byRole.passing, 'passage', 'passages')} · {count(summary.byRole.avoid, 'note à éviter', 'notes à éviter')} ·{' '}
            {count(summary.byRole.out, 'hors gamme', 'hors gamme')}
          </p>
          <p className="t-small t-dim">
            Le score dit la tenue de la grille (notes d’accord sur les temps forts), pas le goût de la phrase. La prise est enregistrée sur la compétence « improviser sur cette position ».
          </p>
        </div>
      )}
    </>
  );

  if (desktop) {
    const playing = transport === 'playing';
    // micro fermé, c'est lui l'action principale : Démarrer garde le cyan des modes, le magenta reste unique
    const micFirst = !micOn && !playing;
    const degrees = legendFor(r.def);
    return (
      <main className="shell play-shell">
        <div className="play-surface practice-surface">
          <PracticeHeader scale={r} current="impro" disabled={transport === 'playing'} />

          <section className="play-tab practice-tab">
            <div className="play-tab-bar">
              <div className="play-degrees" role="img" aria-label={`Couleurs des degrés : ${degrees.map((it) => it.name).join(', ')}`}>
                {degrees.map((it) => (
                  <span key={it.fn} className="legend-pill" style={{ background: it.fill, color: it.digit }}>{it.fn}</span>
                ))}
              </div>
              <div className="field">
                <span className="t-label">Style</span>
                <div className="row">{styleChips}</div>
              </div>
              <PositionStepper scale={r} disabled={transport === 'playing'} />
            </div>
            <div className="impro-live">
              {chordGrid}
              {chordNotes}
            </div>
            <div className="practice-score"><PositionRail scale={r} disabled={transport === 'playing'} /><div className="practice-score-body"><p className="practice-position">{positionLabelPlain(r.position!, settings.noteNotation)}</p>{tab}</div></div>
          </section>

          {(recent.length > 0 || summary || micBusy || status) && (
            <section className="train-answer">
              {micBusy && <p className="t-small t-dim">ouverture du périphérique…</p>}
              {status && <p className="t-small ko">{status}</p>}
              {recent.length > 0 && take}
            </section>
          )}

          <div className="practice-transport play-head">
            <div className="transport-side">
              {tempoControl}
            </div>
            <div className="play-transport">
              {!micOn && (
                <PixelButton variant="primary" className="mic-spark" onClick={() => setMicOn(true)} disabled={micBusy}>▶ Ouvrir le micro</PixelButton>
              )}
              {playing ? (
                <PixelButton variant="primary" onClick={stop}>■ Arrêter</PixelButton>
              ) : (
                <PixelButton variant={micFirst ? 'ghost' : 'primary'} className={micFirst ? 'train-grid' : ''} onClick={() => void start()} disabled={!score}>▶ Démarrer</PixelButton>
              )}
            </div>
            <div className="transport-side">
              {live && <span className="badge badge-count">{live.notes} notes</span>}
            </div>
          </div>

          <div className="play-more">
            <PixelButton variant="quiet" onClick={() => setInfoOpen((o) => !o)}>
              {infoOpen ? '▾ Masquer les détails' : '▸ Détails de l’impro'}
            </PixelButton>
          </div>

          {infoOpen && (
            <div className="play-columns">
              <div className="play-col">
                <PlaySection title="Accompagnement">
                  {accompaniment}
                  {micOn && (
                    <div className="row">
                      <PixelButton variant="quiet" onClick={() => setMicOn(false)}>Fermer le micro</PixelButton>
                    </div>
                  )}
                </PlaySection>
              </div>
              <div className="play-col">
                <PlaySection title="Comment jouer" tone="cyan">
                  {howToPlay}
                </PlaySection>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // Téléphone : comme Séquences, le portrait lance et rend la prise ; le jeu et ses réglages sont en paysage
  const running = transport === 'playing';
  const micFirst = !micOn && !running;
  const openPlay = () => {
    setLandscape(true);
    openLandscape();
  };
  return (
    <main className="shell mplay">
      <div className="mplay-surface">
        <PracticeHeader scale={r} current="impro" disabled={running} />

        <section className="mplay-tab">
          <div className="mplay-bar">
            <PixelButton variant="primary" className="mplay-play mic-spark" onClick={openPlay} disabled={!score}>▶ Jouer</PixelButton>
            <p className="t-small t-dim mplay-play-note">Touche Jouer : l’écran passe automatiquement en paysage, avec tous les réglages.</p>
            {micBusy && <p className="t-small t-dim">ouverture du périphérique…</p>}
            {status && <p className="t-small ko">{status}</p>}
          </div>
        </section>

        {(recent.length > 0 || summary) && (
          <div className="mplay-details">
            <Panel className="span-12" label="Ta prise" right={live ? <span className="badge">{live.notes} notes</span> : undefined}>
              {take}
            </Panel>
          </div>
        )}

        <div className="mplay-more">
          <PixelButton variant="quiet" onClick={() => setInfoOpen((o) => !o)}>
            {infoOpen ? '▾ Masquer les détails' : '▸ Détails de l’impro'}
          </PixelButton>
        </div>

        {infoOpen && (
          <div className="mplay-details">
            <Panel className="span-12" label="Accompagnement">
              {accompaniment}
              {micOn && <PixelButton variant="quiet" onClick={() => setMicOn(false)}>Fermer le micro</PixelButton>}
            </Panel>
            <Panel className="span-12" label="Comment jouer">{howToPlay}</Panel>
          </div>
        )}
      </div>

      {landscape && (
        <LandscapeView label={`Improvisation : ${r.title}`} onClose={closePlay}>
          <div className="tab-full-bar tab-full-options">
            <PixelButton variant="quiet" onClick={closePlay}>{running ? 'Terminer' : 'Fermer'}</PixelButton>
            {!running && (
              <>
                <div className="land-pos">
                  <PixelButton variant="quiet" onClick={() => setScaleSelection({ positionIndex: Math.max(0, r.selection.positionIndex - 1) })} disabled={r.selection.positionIndex === 0} ariaLabel="Position précédente">‹</PixelButton>
                  <span className="t-label">{r.selection.positionIndex + 1} / {r.positions.length}</span>
                  <PixelButton variant="quiet" onClick={() => setScaleSelection({ positionIndex: Math.min(r.positions.length - 1, r.selection.positionIndex + 1) })} disabled={r.selection.positionIndex >= r.positions.length - 1} ariaLabel="Position suivante">›</PixelButton>
                </div>
                <div className="row">{styleChips}</div>
              </>
            )}
            {tempoControl}
            {!micOn && <PixelButton variant="primary" className="mic-spark" onClick={() => setMicOn(true)} disabled={micBusy}>▶ Ouvrir le micro</PixelButton>}
            {running ? (
              <PixelButton variant="primary" onClick={stop}>■ Arrêter</PixelButton>
            ) : (
              <PixelButton variant={micFirst ? 'ghost' : 'primary'} className={micFirst ? 'train-grid' : ''} onClick={() => void start()} disabled={!score}>▶ Démarrer</PixelButton>
            )}
            {live && <span className="badge badge-count">{live.notes} notes</span>}
          </div>
          <div className="land-chords">{chordGrid}{chordNotes}</div>
          <div className="land-body">{tab}</div>
          {status && <div className="land-status"><p className="t-small ko">{status}</p></div>}
        </LandscapeView>
      )}
    </main>
  );
}
