/**
 * Module Gammes — niveau 1 « Découverte » (BRIEF.md §2, docs/ARCHITECTURE.md §6.3).
 * La gamme est écrite en tablature (montée / descente / aller-retour) avec :
 *  - les couleurs de fonction d'intervalle et le glow des notes caractéristiques du mode ;
 *  - quatre annotations au choix (note, degré, intervalle, doigté) ;
 *  - un calque « notes de l'accord » qui estompe les notes étrangères ;
 *  - le mode « fondamentales d'abord » et le découpage par nombre de cordes (chunking) ;
 *  - l'exercice « montre-moi la ♭3 » (toucher la pastille) et la comparaison de deux modes voisins ;
 *  - le son final de la 1c (échantillons CC0), un drone de fondamentale, un métronome.
 * Chaque écoute complète est écrite dans le journal local : le hub affiche des chiffres vrais.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { setScaleSelection, useScaleSelection } from '../../app/scaleSession';
import { useSettings } from '../../app/settings';
import { TabView, type TabPick } from '../../app/TabView';
import { InstrumentPicker } from '../../app/AudioControls';
import { Panel, PixelButton, PixelIcon, Segmented, Switch } from '../../app/ui';
import { filterPosition, fmtNote } from '../../core/theory';
import { type AnnotationKind, type Direction, defaultChordForScale, positionToScore } from '../../core/tab';
import { TabPlayer, scoreTonic } from '../../core/audio/tabPlayer';
import { AudioEngine } from '../../core/audio/engine';
import { describeInputError, type InputEngine, type InputFrame } from '../../core/input/engine';
import { useInputSettings } from '../../core/input/settings';
import { ensureInputEngine, windowFor } from '../../app/inputSession';
import { locateInScore, scoreNotes } from '../../core/impro/locate';
import { appendAttempt, newAttemptId, nodeIdOf, progressStore, readAttempts } from '../../core/progress';
import { degreeName, fmtDegree, legendFor, positionLabelPlain, resolveScale } from './resolve';
import { TabLegend } from './TabLegend';
import {
  COMPARISON_LABEL, counterpartPosition, differingDegrees, markDegrees, neighbourDef, neighbourMode, neighbourPositions,
} from './compare';

const DIRECTION_LABEL: Record<Direction, string> = { up: 'Montée', down: 'Descente', updown: 'Aller-retour' };

const ANNOTATIONS: { value: AnnotationKind; label: string }[] = [
  { value: 'note', label: 'Notes' },
  { value: 'degree', label: 'Degrés' },
  { value: 'interval', label: 'Intervalles' },
  { value: 'finger', label: 'Doigtés' },
];

/** Sous-ensembles de cordes du découpage : on commence par les cordes graves (début de la montée). */
type StringLimit = 0 | 2 | 3 | 4;

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
  /**
   * P3 de la phase 3 (livrée ici, en phase 7) : **s'écouter sur la position**. La note entendue s'allume
   * à sa place dans la tablature — c'est le seul retour qui relie « ce que j'entends » à « ce que je lis ».
   */
  const [listenOn, setListenOn] = useState(false);
  const [listenEngine, setListenEngine] = useState<InputEngine | null>(null);
  const [listenBusy, setListenBusy] = useState(false);
  const [flash, setFlash] = useState<{ string: number; fret: number }[]>([]);
  const previousNote = useRef<{ string: number; fret: number; midi: number } | null>(null);
  const flashTimer = useRef<number | null>(null);
  const lastFlash = useRef<{ midi: number; at: number } | null>(null);
  const input = useInputSettings();
  const listenRef = useRef<(f: InputFrame) => void>(() => {});
  const [metro, setMetro] = useState(false);
  const [chordLayer, setChordLayer] = useState(false);
  const [rootsOnly, setRootsOnly] = useState(false);
  const [stringLimit, setStringLimit] = useState<StringLimit>(0);
  const [showRhythm, setShowRhythm] = useState(false);
  const [compare, setCompare] = useState(false);
  const [transport, setTransport] = useState<'stopped' | 'playing' | 'paused'>('stopped');
  const [status, setStatus] = useState('');
  const playing = transport === 'playing';

  // --- exercice « montre-moi la … »
  const [quiz, setQuiz] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [reveal, setReveal] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [score, setScore] = useState({ right: 0, wrong: 0 });
  const timers = useRef<number[]>([]);
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  // --- position affichée (fondamentales seules, sous-ensemble de cordes)
  const shownPos = useMemo(() => {
    if (!r.position) return null;
    let p = r.position;
    if (rootsOnly) p = filterPosition(p, (n) => n.degree === '1' || n.degree === '5');
    if (stringLimit) p = filterPosition(p, (n) => n.string < stringLimit);
    return p.notes.length ? p : r.position;
  }, [r.position, rootsOnly, stringLimit]);

  // degrés en ASCII (modèle) : l'affichage passe par fmtDegree, la mise en évidence par n.fn
  const availableDegrees = useMemo(() => [...new Set((shownPos?.notes ?? []).map((n) => n.degree))], [shownPos]);
  const targetLabel = target ? fmtDegree(target) : null;

  const scoreTab = useMemo(() => {
    if (!shownPos) return null;
    try {
      return positionToScore(shownPos, r.tuning, {
        direction,
        tempo,
        fingers: true,
        markChordTones: true,
        labelText: positionLabelPlain(shownPos, settings.noteNotation),
        ...(r.chord ? { chord: r.chord } : {}),
      });
    } catch {
      return null;
    }
  }, [shownPos, r.tuning, direction, tempo, r.chord, settings.noteNotation]);

  // --- comparaison avec le mode voisin (même tonique, même système, même forme)
  const neighbourId = neighbourMode(r.def.id);
  const neighbour = neighbourId ? neighbourDef(neighbourId) : null;
  const comparison = useMemo(() => {
    if (!compare || !neighbourId || !neighbour || !r.position) return null;
    try {
      const positions = neighbourPositions(neighbourId, r.tonic, r.tuning, r.selection.system);
      const pos = counterpartPosition(positions, r.position);
      if (!pos) return null;
      const diff = differingDegrees(r.def, neighbour);
      const otherChord = defaultChordForScale(neighbourId, r.tonic);
      const other = positionToScore(pos, r.tuning, {
        direction, tempo, fingers: true,
        ...(otherChord ? { chord: otherChord } : {}),
      });
      const mine = positionToScore(shownPos ?? r.position, r.tuning, {
        direction, tempo, fingers: true,
        ...(r.chord ? { chord: r.chord } : {}),
      });
      return { def: neighbour, pos, diff, score: markDegrees(other, diff.onlyB), mine: markDegrees(mine, diff.onlyA) };
    } catch {
      return null;
    }
  }, [compare, neighbourId, neighbour, r.position, r.tonic, r.tuning, r.selection.system, r.def, r.chord, direction, tempo, shownPos]);

  // --- lecture audio
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
  }, [scoreTab]);
  useEffect(() => player.current?.setTempo(tempo), [tempo]);
  useEffect(() => player.current?.setDrone(drone), [drone]);
  useEffect(() => player.current?.setMetronome(metro), [metro]);
  useEffect(() => {
    const p = player.current!;
    return () => p.dispose();
  }, []);

  // --- P3 : s'écouter sur la position (micro ouvert à la demande, refermé en quittant)
  useEffect(() => {
    if (!listenOn) {
      listenEngine?.stop();
      return;
    }
    let cancelled = false;
    setListenBusy(true);
    void (async () => {
      try {
        await AudioEngine.get().unlock();
        const e = await ensureInputEngine();
        if (cancelled) return;
        setListenEngine(e);
        await e.start(input, { windowSize: windowFor(r.tuning.id) });
        if (cancelled) {
          e.stop();
          return;
        }
        if (e.state !== 'listening') {
          const d = describeInputError(e.state, e.error);
          setStatus(`${d.message} — ${d.hint}`);
          setListenOn(false);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus(`micro indisponible : ${(err as Error).message}`);
          setListenOn(false);
        }
      } finally {
        if (!cancelled) setListenBusy(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listenOn]);

  useEffect(() => {
    if (!listenEngine || !scoreTab) return;
    const notes = scoreNotes(scoreTab);
    listenRef.current = (f: InputFrame) => {
      if (!f.stable || !f.isNew) return;
      const now = performance.now();
      const last = lastFlash.current;
      if (last && last.midi === f.midi && now - last.at < 400) return;
      lastFlash.current = { midi: f.midi, at: now };
      const at = locateInScore(notes, f.midi, previousNote.current);
      if (!at) return; // note hors de la position : rien à allumer, et on ne ment pas en allumant ailleurs
      previousNote.current = at;
      setFlash([{ string: at.string, fret: at.fret }]);
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash([]), 900);
    };
    return listenEngine.subscribe(() => {
      const f = listenEngine.last;
      if (f) listenRef.current(f);
    });
  }, [listenEngine, scoreTab]);

  const droneAvailable = scoreTab !== null && scoreTonic(scoreTab) !== null;

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
      // une écoute est une tentative non vérifiée : elle compte pour la série et la durée, jamais pour l'XP
      const formIndex = r.position.formIndex ?? r.position.index;
      const node = nodeIdOf({ scaleId: r.def.id, system: r.selection.system, formIndex });
      appendAttempt(progressStore(), {
        id: newAttemptId(Date.now(), node, readAttempts(progressStore()).length),
        ts: Date.now(),
        kind: 'listen',
        scaleId: r.def.id,
        tonic: r.tonic,
        tuningId: r.tuning.id,
        system: r.selection.system,
        positionId: r.position.id,
        formIndex,
        level: 1,
        strings: r.tuning.strings.length,
        correct: null,
        total: null,
        seconds,
        fretMin: r.position.fretMin,
        missedStrings: [],
        tempoOk: false,
      });
    }
  };

  const onPlay = async () => {
    if (!scoreTab) return;
    const p = player.current!;
    try {
      await p.init(); // en premier : reprend le contexte audio dans le geste
      if (!loaded.current || loaded.current.score !== scoreTab || loaded.current.loop !== loop) {
        await p.load({ ...scoreTab, tempo }, { loop });
        loaded.current = { score: scoreTab, loop };
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
    setScaleSelection({ positionIndex: (r.selection.positionIndex + delta + n) % n });
  };

  // --- exercice : choix de la cible et réponse
  const pickTarget = () => {
    const pool = availableDegrees.filter((d) => d !== target);
    const list = pool.length ? pool : availableDegrees;
    setTarget(list[Math.floor(Math.random() * list.length)] ?? null);
    setReveal(null);
    setFeedback(null);
  };

  const onPick = (pick: TabPick) => {
    if (!target) return;
    const ok = pick.fn === target;
    setFeedback({ ok, text: ok ? 'juste' : `non, c’était la ${fmtDegree(target)}` });
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), wrong: s.wrong + (ok ? 0 : 1) }));
    if (ok) {
      timers.current.push(window.setTimeout(pickTarget, 900));
    } else {
      setReveal(target);
      timers.current.push(window.setTimeout(() => setReveal(null), 1800));
    }
  };

  const toggleQuiz = (on: boolean) => {
    setQuiz(on);
    setScore({ right: 0, wrong: 0 });
    setFeedback(null);
    setReveal(null);
    if (on) pickTarget();
    else setTarget(null);
  };

  const characteristic = (r.def.characteristic ?? []).map(fmtDegree);

  return (
    <main className="shell">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate('gammes')} aria-label="Retour à la sélection">‹</button>
        <div>
          <h1 className="page-title">{r.title}</h1>
          <p className="t-small t-dim">{positionLabelPlain(r.position, settings.noteNotation)} · {r.tuning.strings.length} cordes</p>
        </div>
        <span className="tag tag-on">N1</span>
      </header>

      {quiz && (
        <div className={`quiz-strip ${feedback ? (feedback.ok ? 'ok' : 'no') : ''}`} role="status">
          <span className="quiz-q">
            Touche la <strong>{targetLabel ?? '—'}</strong>
            {target ? <em> · {degreeName(target)}</em> : null}
          </span>
          <span className="quiz-score">
            {feedback
              ? `${feedback.text} · ${score.right}/${score.right + score.wrong}`
              : `${score.right} juste${score.right > 1 ? 's' : ''} · ${score.wrong} erreur${score.wrong > 1 ? 's' : ''}`}
          </span>
        </div>
      )}

      {scoreTab ? (
        <TabView
          score={scoreTab}
          notes={settings.noteNotation}
          chords={settings.chordNotation}
          annotation={annotation}
          mode="wrap"
          scale="auto"
          reduceMotion={settings.reduceMotion}
          player={player.current}
          transport={transport}
          emphasizeChordTones={chordLayer}
          hideRhythm={!showRhythm}
          {...(reveal ? { highlightFn: reveal } : {})}
          {...(quiz ? { onPick } : {})}
          {...(flash.length > 0 ? { flash } : {})}
        />
      ) : (
        <Panel accent="yellow">
          <p className="t-body">Aucune position pour cette gamme / cet accordage.</p>
          <PixelButton onClick={() => navigate('gammes')}>Changer de système</PixelButton>
        </Panel>
      )}

      {scoreTab && (
        <div className="listen-band">
          <Switch
            checked={listenOn}
            onChange={setListenOn}
            label={listenBusy ? 'Micro…' : 'M’écouter'}
            hint="la note que tu joues s’allume sur la position"
            inline
          />
          {/* sans instrument : l'interrupteur vit à côté de la tablature qu'il interroge, pas 600 px plus bas */}
          <Switch
            checked={quiz}
            onChange={toggleQuiz}
            label="Montre-moi la note"
            hint="l’app demande une fonction, tu touches la pastille"
            inline
          />
          {quiz && (
            <p className="t-small t-dim">
              Les fonctions demandées sont celles qui sont affichées : « Fondamentales », dans « Plus d’options », réduit la difficulté.
            </p>
          )}
        </div>
      )}

      <TabLegend def={r.def} readonly={settings.reduceMotion} />

      <div className="pos-nav">
        <PixelButton variant="quiet" onClick={() => gotoPosition(-1)} disabled={r.positions.length < 2}>‹ Position</PixelButton>
        <span className="t-label pos-count">{r.selection.positionIndex + 1} / {r.positions.length}</span>
        <PixelButton variant="quiet" onClick={() => gotoPosition(1)} disabled={r.positions.length < 2}>Position ›</PixelButton>
      </div>

      <Panel className="span-7" accent="magenta" label="Écoute" right={<span className="badge">{r.formula}</span>}>
        <div className="transport-row">
          <PixelButton variant="primary" onClick={onPlay} disabled={!scoreTab || playing} ariaLabel="Lecture" className="play">
            <PixelIcon name="play" size={18} /> {transport === 'paused' ? 'Reprendre' : 'Écouter'}
          </PixelButton>
          <PixelButton variant="quiet" onClick={onPause} disabled={!playing} ariaLabel="Pause">
            <PixelIcon name="pause" size={14} />
          </PixelButton>
          <PixelButton variant="quiet" onClick={onStop} ariaLabel="Stop">
            <PixelIcon name="stop" size={12} />
          </PixelButton>
          {/* le tempo est un réglage de lecture : il vit sur la même ligne que le transport, à droite */}
          <div className="tempo-group">
            <span className="t-label">Tempo</span>
            <div className="tempo">
              <button type="button" className="tempo-btn" onClick={() => setTempo((t) => Math.max(40, t - 5))} aria-label="Moins vite">−</button>
              <span className="tempo-val">♩ {tempo}</span>
              <button type="button" className="tempo-btn" onClick={() => setTempo((t) => Math.min(200, t + 5))} aria-label="Plus vite">+</button>
            </div>
          </div>
        </div>
        <div className="toggle-grid">
          <Switch checked={drone && droneAvailable} onChange={setDrone} label="Drone" hint="fond. + quinte" inline />
          <Switch checked={metro} onChange={setMetro} label="Métronome" />
          <Switch checked={loop} onChange={setLoop} label="Boucle" />
        </div>
      </Panel>

      <Panel className="span-5 panel-fill" label="Lecture">
        {/* Une phrase sur la gamme elle-même (« mêmes notes que Do majeur ») : elle ouvre le panneau,
            au lieu de traîner en bas après les options, où elle n'avait ni sujet ni étiquette. */}
        {r.parent && <p className="t-small t-dim">{r.parent}</p>}
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
        <details className="more-opts">
          <summary className="t-label">Plus d’options</summary>
          <div className="field">
            <span className="t-label">Cordes (découpage)</span>
            <Segmented<StringLimit>
              size="sm"
              label="Nombre de cordes affichées"
              value={stringLimit}
              onChange={setStringLimit}
              options={[
                { value: 0, label: 'toutes' },
                { value: 2, label: '2 graves' },
                { value: 3, label: '3' },
                { value: 4, label: '4' },
              ]}
            />
          </div>
          <div className="toggle-grid">
            <Switch checked={chordLayer} onChange={setChordLayer} label={`Accord${r.chord ? ` (${r.chord})` : ''}`} hint="estompe les autres notes" />
            <Switch checked={rootsOnly} onChange={setRootsOnly} label="Fondamentales" hint="1 et 5 seulement" />
          </div>
          <Switch checked={showRhythm} onChange={setShowRhythm} label="Rythme" hint="hampes et ligatures" />
          {stringLimit !== 0 && (
            <p className="t-small t-dim">Découpage : les {stringLimit} cordes graves d’abord, puis on ajoute les suivantes.</p>
          )}
        </details>
        {status && <p className="t-small t-dim status">{status}</p>}
      </Panel>

      {/* le chemin d'une forme en quatre niveaux : on est au 1, les trois suivants sont à un toucher */}
      <nav className="levels" aria-label="Niveaux de travail">
        <div className="level here" aria-current="step">
          <span className="level-n">N1</span>
          <span className="level-t">Découvrir</span>
          <span className="level-s">avec le son · tu es ici</span>
        </div>
        <button type="button" className="level" onClick={() => navigate('training')}>
          <span className="level-n">N2</span>
          <span className="level-t">Trous</span>
          <span className="level-s">compléter les notes masquées</span>
        </button>
        <button type="button" className="level" onClick={() => navigate('training')}>
          <span className="level-n">N3</span>
          <span className="level-t">Rappel</span>
          <span className="level-s">tout de mémoire, tablature cachée</span>
        </button>
        <button type="button" className="level" onClick={() => navigate('impro')}>
          <span className="level-n">N4</span>
          <span className="level-t">Improviser</span>
          <span className="level-s">sur un accompagnement</span>
        </button>
      </nav>

      {/* Le geste suivant, écrit noir sur blanc : on a vu la position, on la joue. Deux suites, et pas
          une seule : répéter la position (justesse) ou improviser dessus (musique) — c'est la même
          position, ce ne sont pas les mêmes compétences. */}
      <div className="next-step">
        <div className="next-step-row">
          <PixelButton variant="primary" onClick={() => navigate('training')} title="S’exercer sur cette position, au micro" ariaLabel="S’exercer sur cette position, au micro">
            ▶ S’exercer
          </PixelButton>
          <PixelButton onClick={() => navigate('impro')} title="Improviser sur cette position, avec un accompagnement" ariaLabel="Improviser sur cette position, avec un accompagnement">
            Improviser
          </PixelButton>
          <PixelButton variant="quiet" onClick={() => navigate('sequences')} title="Séquences au métronome : par 3, par 4, tierces, quartes" ariaLabel="Séquences au métronome : par 3, par 4, tierces, quartes">
            Séquences
          </PixelButton>
        </div>
        <p className="t-small t-dim">
          S’exercer : le micro valide chaque note, la case se remplit. Sans micro, le pavé numérique
          prend le relais. Le niveau 2 masque une partie des notes, le niveau 3 toute la tablature : seule une
          tentative de l’exercice sert à la révision, une écoute ici ne prouve rien.
        </p>
      </div>

      {neighbourId && neighbour && (
        <Panel className="span-12" label={`Comparer à ${neighbour.nameFr.toLowerCase()}`}>
          <Switch
            checked={compare}
            onChange={setCompare}
            label="Deux modes côte à côte"
            hint={COMPARISON_LABEL[neighbourId] ? `la différence : ${COMPARISON_LABEL[neighbourId]}` : 'une seule note change'}
          />
          {compare && comparison && (
            <>
              <p className="t-small">
                {r.title} et {fmtNote(r.tonic, settings.noteNotation)} {comparison.def.nameFr.toLowerCase()}, <strong>même forme au même endroit</strong>.
                {comparison.diff.onlyA.length > 0 && (
                  <> Ce qui change : {comparison.diff.onlyA.join(' / ')} d’un côté, {comparison.diff.onlyB.join(' / ')} de l’autre (glow).</>
                )}
              </p>
              <p className="t-label comp-label">{r.title} · {comparison.diff.onlyA.join(' ') || '—'}</p>
              <TabView
                score={comparison.mine}
                notes={settings.noteNotation}
                chords={settings.chordNotation}
                annotation={annotation}
                mode="wrap"
                scale="auto"
                reduceMotion
                player={null}
                transport="stopped"
                hideRhythm
              />
              <p className="t-label comp-label">{fmtNote(r.tonic, settings.noteNotation)} {comparison.def.nameFr.toLowerCase()} · {comparison.diff.onlyB.join(' ') || '—'}</p>
              <TabView
                score={comparison.score}
                notes={settings.noteNotation}
                chords={settings.chordNotation}
                annotation={annotation}
                mode="wrap"
                scale="auto"
                reduceMotion
                player={null}
                transport="stopped"
                hideRhythm
              />
            </>
          )}
          {compare && !comparison && <p className="t-small t-dim">Pas de position équivalente pour cette comparaison.</p>}
          {!compare && (
            <p className="t-small t-dim">
              Active l’interrupteur : les deux gammes s’affichent l’une sous l’autre sur la <strong>même forme</strong>, et la note
              qui les sépare clignote des deux côtés.
            </p>
          )}
        </Panel>
      )}

      <Panel className="span-12" label="Une couleur par rôle">
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
          Chaque couleur marque le <strong>rôle</strong> de la note dans la gamme, pas sa place sur le manche : ♯4 et ♭5 sont sur la même case, mais gardent chacune leur couleur.
          {characteristic.length > 0 ? ` Note${characteristic.length > 1 ? 's' : ''} caractéristique${characteristic.length > 1 ? 's' : ''} : ${characteristic.join(', ')} (anneau qui pulse).` : ''}
        </p>
      </Panel>

      {r.hint && (
        <Panel className="span-12" label="Ce que tu écoutes">
          <p className="t-body">{r.hint}</p>
        </Panel>
      )}

      <Panel className="span-12">
        <InstrumentPicker />
      </Panel>

      <div className="row span-7 page-exit">
        <PixelButton variant="quiet" onClick={() => navigate('gammes')}>← Changer de gamme</PixelButton>
      </div>
    </main>
  );
}

