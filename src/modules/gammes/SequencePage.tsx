/**
 * Module Gammes — **séquences avec palier de tempo** (lot « mémoire et vitesse », MUSIC_DESIGN §3.5).
 *
 * Exercice de technique : la tablature reste **visible** (par 3, par 4, tierces, quartes sur la position
 * choisie). Au micro, chaque passe est précédée d'une mesure de décompte, jouée sur le métronome et jugée
 * note à note (justesse et mise en place) ; le tempo monte de 4 BPM après deux passes propres et en place,
 * redescend de 5 après deux échecs, jamais sous le départ (`sequence.ts`). Sans micro : tempo manuel,
 * rien n'est vérifié, ni palier ni XP.
 *
 * Une **seule tentative par session** (motif, tempo de départ, meilleur tempo validé, passes, précision) :
 * le journal plafonné à 2 000 entrées ne doit pas se remplir de passes. Elle nourrit la **vitesse** de la
 * forme (« maîtrisée »), jamais « apprise » ni la révision.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { setScaleSelection, useScaleSelection } from '../../app/scaleSession';
import { useSettings } from '../../app/settings';
import { TabView } from '../../app/TabView';
import { Panel, PixelButton, Segmented } from '../../app/ui';
import { MicStrip } from '../../app/MicStrip';
import { ensureInputEngine, inputEngineIfAny, windowFor } from '../../app/inputSession';
import { AudioEngine } from '../../core/audio/engine';
import { TabPlayer } from '../../core/audio/tabPlayer';
import { describeInputError, type InputEngine, type InputFrame } from '../../core/input/engine';
import { targetsFor, type HoleLike, type Target } from '../../core/input/match';
import { useInputSettings } from '../../core/input/settings';
import { SEQUENCE_LABEL, SEQUENCE_PATTERNS, sequenceToScore, type SequencePattern, type TabScore } from '../../core/tab';
import {
  appendAttempt, newAttemptId, nodeIdOf, progressStore, readAttempts, xpForAttempt, type Attempt,
} from '../../core/progress';
import { blindGrid, scoreBlind, type BlindGrid, type HeardNote } from './blind';
import { clickMasked } from './exercise';
import { positionLabelPlain, resolveScale } from './resolve';
import {
  LADDER_MAX, LADDER_MIN, judgePass, ladderStart, ladderStep, pauseDue, startTempo,
  type LadderState, type PassResult,
} from './sequence';

type Phase = 'idle' | 'countin' | 'pass' | 'between';

/** Cibles de la séquence, dans l'ordre de jeu (clé `colonne:corde`, comme les trous de l'exercice). */
function targetsOf(score: TabScore): Target[] {
  const holes: HoleLike[] = [];
  let col = 0;
  for (const m of score.measures) {
    for (const ev of m.events) {
      const n = ev.notes[0];
      if (ev.kind === 'notes' && n) holes.push({ key: `${col}:${n.string}`, columnIndex: col, string: n.string, fret: n.fret, note: n.note, fn: n.fn });
      col++;
    }
  }
  return targetsFor(holes, score.tuning);
}

export function SequencePage() {
  const settings = useSettings();
  const selection = useScaleSelection();
  const r = useMemo(() => resolveScale(selection, settings.noteNotation), [selection, settings.noteNotation]);
  const input = useInputSettings();

  const [pattern, setPattern] = useState<SequencePattern>('g3');
  const [phase, setPhase] = useState<Phase>('idle');
  const [ladder, setLadder] = useState<LadderState | null>(null);
  const [lastPass, setLastPass] = useState<PassResult | null>(null);
  // dernier changement de palier (+4, −5, 0) : affiché en grand, c'est le moment qui motive
  const [shift, setShift] = useState(0);
  const [manualBpm, setManualBpm] = useState(60);
  const [now, setNow] = useState(() => Date.now());
  const [saved, setSaved] = useState<{ xp: number; verified: boolean } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // --- micro
  const [micOn, setMicOn] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [engine, setEngine] = useState<InputEngine | null>(null);
  const listening = engine?.state === 'listening' && micOn;
  const onFrameRef = useRef<(f: InputFrame) => void>(() => {});
  const inputRef = useRef(input);
  inputRef.current = input;

  // --- passe en cours
  const player = useRef<TabPlayer | null>(null);
  if (player.current === null) player.current = new TabPlayer();
  const gridRef = useRef<BlindGrid | null>(null);
  const clickPerf = useRef(0);
  const passStartPerf = useRef(0);
  const heard = useRef<HeardNote[]>([]);
  const acted = useRef<{ midi: number; at: number } | null>(null);
  const [consumed, setConsumed] = useState(0);
  /** Cumul de la session : précision, cordes fautives, durée. */
  const session = useRef({ startedAt: 0, correct: 0, total: 0, missed: new Set<number>(), verified: false });
  const ladderRef = useRef<LadderState | null>(null);
  ladderRef.current = ladder;

  const form = r.position ? { scaleId: r.def.id, system: r.selection.system, formIndex: r.position.formIndex ?? r.position.index } : null;
  const score = useMemo(() => {
    if (!r.position) return null;
    try {
      // étiquette courte (« tierces · cases 5–8 ») : la position est déjà dans l'en-tête, et 390 px ne la tiennent pas deux fois
      return sequenceToScore(r.position, r.tuning, pattern);
    } catch {
      return null;
    }
  }, [r.position, r.tuning, pattern]);
  const targets = useMemo(() => (score ? targetsOf(score) : []), [score]);
  const bpm = ladder ? ladder.bpm : manualBpm;
  const running = phase === 'countin' || phase === 'pass';

  /** Une passe : une mesure de décompte, puis la grille de la séquence en croches au tempo du palier. */
  const startPass = async (tempo: number) => {
    if (!score || targets.length === 0) return;
    const p = player.current!;
    const g = blindGrid(targets.length, tempo, 2);
    try {
      await p.init();
      await p.load(g.score, { loop: false });
      p.setMetronome(true);
      p.onEnded = null;
      await p.play();
      const t0 = performance.now();
      clickPerf.current = t0;
      passStartPerf.current = t0 + g.countIn * 1000;
      gridRef.current = g;
      heard.current = [];
      acted.current = null;
      setConsumed(0);
      setPhase('countin');
      setNow(Date.now());
    } catch (e) {
      setStatus(`métronome indisponible : ${(e as Error).message}`);
      setPhase('idle');
    }
  };

  /** Fin d'une passe : jugement, palier, puis la suivante après un temps de respiration. */
  const endPass = () => {
    const g = gridRef.current;
    const lad = ladderRef.current;
    player.current?.stop();
    if (!g || !lad) return;
    if (!listening) {
      // sans micro : rien à juger, la passe est jouée et comptée, le tempo ne bouge pas
      setLadder({ ...lad, passes: lad.passes + 1 });
      setPhase('between');
      return;
    }
    const res = judgePass(targets, heard.current, lad.bpm, { centsTolerance: input.centsTolerance });
    const s = session.current;
    s.correct += res.correct;
    s.total += res.total;
    s.verified = true;
    for (const st of res.missedStrings) s.missed.add(st);
    setLastPass(res);
    const next = ladderStep(lad, res.ok);
    setShift(next.bpm - lad.bpm);
    setLadder(next);
    setPhase('between');
  };

  // horloge : décompte → passe → fin de passe (toutes les notes jouées, ou grille finie + un temps)
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setNow(Date.now());
      const g = gridRef.current;
      if (!g) return;
      const perf = performance.now();
      if (phase === 'countin' && perf >= passStartPerf.current) setPhase('pass');
      if (phase === 'pass' && perf >= passStartPerf.current + (g.grid.seconds + 60 / g.grid.score.tempo) * 1000) endPass();
    }, 80);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase]);

  // entre deux passes : 2 s pour lire le verdict, puis la suivante (au tempo du palier)
  useEffect(() => {
    if (phase !== 'between' || !ladder) return;
    const t = window.setTimeout(() => void startPass(ladder.bpm), 2000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, ladder]);

  const begin = () => {
    if (!form) return;
    const start = listening ? startTempo(readAttempts(progressStore()), form, pattern) : manualBpm;
    session.current = { startedAt: Date.now(), correct: 0, total: 0, missed: new Set(), verified: false };
    setSaved(null);
    setLastPass(null);
    setShift(0);
    const lad = ladderStart(start);
    // sans micro, le « palier » ne bouge jamais : il ne sert qu'à porter le tempo manuel
    setLadder(lad);
    void startPass(lad.bpm);
  };

  /** Écrit la session (une seule tentative) et s'arrête. */
  const stopSession = () => {
    player.current?.stop();
    const lad = ladderRef.current;
    const s = session.current;
    setPhase('idle');
    setLadder(null);
    if (!lad || !form || !r.position || lad.passes === 0) return;
    const verified = s.verified && s.total > 0;
    const attempt: Attempt = {
      id: newAttemptId(Date.now(), nodeIdOf({ ...form, kind: 'sequence' }), readAttempts(progressStore()).length),
      ts: Date.now(),
      kind: 'sequence',
      scaleId: form.scaleId,
      tonic: r.tonic,
      tuningId: r.tuning.id,
      system: form.system,
      positionId: r.position.id,
      formIndex: form.formIndex,
      level: 2,
      strings: new Set(r.position.notes.map((n) => n.string)).size,
      // sans micro, rien n'est vérifié : une activité, jamais une preuve
      correct: verified ? s.correct : null,
      total: verified ? s.total : null,
      seconds: Math.round((Date.now() - s.startedAt) / 1000),
      fretMin: r.position.fretMin,
      missedStrings: [...s.missed],
      tempoOk: lad.best !== null,
      pattern,
      bpmStart: lad.start,
      ...(lad.best !== null && verified ? { bpmBest: lad.best } : {}),
      passes: lad.passes,
      fullPosition: true,
      ...(verified ? { mic: true as const } : {}),
    };
    appendAttempt(progressStore(), attempt);
    setSaved({ xp: xpForAttempt(attempt), verified });
  };

  // quitter la page écrit la session en cours (sinon une demi-heure de travail disparaîtrait)
  const stopRef = useRef(stopSession);
  stopRef.current = stopSession;
  useEffect(() => () => {
    if (ladderRef.current) stopRef.current();
    player.current?.dispose();
    inputEngineIfAny()?.stop();
  }, []);

  // --- micro : ouverture à la demande (même chaîne que l'entraînement)
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
        await e.start(inputRef.current, { windowSize: windowFor(r.tuning.id) });
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

  useEffect(() => {
    if (!engine) return;
    return engine.subscribe(() => {
      const f = engine.last;
      if (f) onFrameRef.current(f);
    });
  }, [engine]);

  // --- écoute : une attaque = une note de la passe (le décompte et les clics ne comptent pas)
  const handleFrame = (f: InputFrame) => {
    if (phase !== 'pass' || !f.stable || (!f.isNew && !f.onset)) return;
    const g = gridRef.current;
    if (!g) return;
    const perf = performance.now();
    const midi = f.stable.midi + f.stable.cents / 100;
    const eighthMs = 30_000 / g.grid.score.tempo;
    const prev = acted.current;
    if (prev && prev.midi === f.stable.midi && perf - prev.at < Math.min(400, eighthMs * 0.6)) return;
    if (clickMasked((perf - clickPerf.current) / 1000, g.grid.score.tempo, midi)) return;
    acted.current = { midi: f.stable.midi, at: perf };
    const latency = inputRef.current.latencies[inputRef.current.source] ?? 0;
    heard.current.push({ midi, t: (perf - latency - passStartPerf.current) / 1000 });
    const sc = scoreBlind(targets, heard.current, { centsTolerance: input.centsTolerance, dedupeSeconds: Math.min(0.4, (eighthMs / 1000) * 0.6) });
    setConsumed(sc.consumed);
    if (sc.consumed >= targets.length) endPass();
  };
  useEffect(() => {
    onFrameRef.current = handleFrame;
  });

  // --- crochet de vérification (développement) : état du palier, injection d'une passe jouée
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __sequence?: unknown }).__sequence = {
      phase, ladder, lastPass, consumed, total: targets.length, listening, saved,
      mic: { set: (v: boolean) => setMicOn(v), state: () => engine?.state ?? 'idle' },
      begin: () => begin(),
      stop: () => stopSession(),
      setPattern: (p: SequencePattern) => setPattern(p),
      // une passe « jouée » sans guitare : les hauteurs attendues, à la croche, décalées de `shift` s ;
      // `stretch` > 1 = l'élève traîne (passe à tester hors tempo). Ne sert qu'aux outils de vérification.
      feedPass: (shift = 0.05, stretch = 1, wrong: number[] = []) => {
        const g = gridRef.current;
        if (!g) return;
        const eighth = 30 / g.grid.score.tempo;
        heard.current = targets.map((t, i) => ({ midi: wrong.includes(i) ? t.midi + 1 : t.midi, t: shift + i * eighth * stretch }));
        endPass();
      },
    };
  });

  if (!r.position || !score || !form) {
    return (
      <main className="shell">
        <header className="page-head">
          <button type="button" className="back" onClick={() => navigate('gammes')} aria-label="Retour">‹</button>
          <div><h1 className="page-title">Séquences</h1></div>
        </header>
        <Panel accent="yellow">
          <p className="t-body">Pas de séquence possible sur cette position.</p>
          <PixelButton onClick={() => navigate('gammes')}>Changer de gamme</PixelButton>
        </Panel>
      </main>
    );
  }

  const g = gridRef.current;
  const perf = performance.now();
  const countLeft = phase === 'countin' && g ? Math.max(1, Math.ceil((passStartPerf.current - perf) / (60_000 / g.grid.score.tempo))) : null;
  // curseur : la note attendue au micro ; sans micro, celle du temps qui passe
  const cursor = phase === 'pass'
    ? listening
      ? targets[consumed]?.key
      : g ? targets[Math.min(targets.length - 1, Math.max(0, Math.floor((perf - passStartPerf.current) / (30_000 / g.grid.score.tempo))))]?.key : undefined
    : undefined;
  const sessionMs = ladder ? now - session.current.startedAt : 0;

  return (
    <main className="shell">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate('training')} aria-label="Retour à l’entraînement">‹</button>
        <div>
          <h1 className="page-title">{r.title}</h1>
          <p className="t-small t-dim">{positionLabelPlain(r.position, settings.noteNotation)} · séquence {SEQUENCE_LABEL[pattern]}</p>
        </div>
        <span className="tag tag-on">{ladder ? `♪ ${bpm}` : 'Séquences'}</span>
      </header>

      {/* scène : tempo, décompte, verdict de passe et bouton principal, au-dessus de la tablature —
          c'est ce qu'on regarde de loin, les mains sur le manche */}
      <section className="seq-stage" aria-label="Passe en cours">
        <div className="seq-tempo">
          <span className="seq-bpm">♪ {bpm}</span>
          {shift !== 0 && (
            <span className={`seq-shift ${shift > 0 ? 'up' : 'down'}`} role="status">
              {shift > 0 ? `↑ +${shift}` : `↓ ${shift}`} BPM
            </span>
          )}
        </div>
        <div className="seq-now">
          {countLeft !== null ? (
            <p className="seq-count" aria-live="assertive">{countLeft}</p>
          ) : phase === 'pass' ? (
            <p className="seq-line" aria-live="polite">Joue la séquence sur le métronome.</p>
          ) : lastPass ? (
            <p className={`seq-line ${lastPass.ok ? 'ok' : 'no'}`} role="status">
              <span className="verdict-mark" aria-hidden="true">{lastPass.ok ? '✓' : '✕'}</span>
              {Math.round(lastPass.accuracy * 100)} % · {lastPass.inTime ? 'en place' : 'pas en place'} — {lastPass.ok ? 'réussie' : 'à reprendre'}
            </p>
          ) : (
            <p className="seq-line seq-idle">{listening ? 'Micro ouvert : chaque passe est jugée.' : 'Sans micro : tempo manuel, rien n’est vérifié.'}</p>
          )}
          {ladder?.best ? <p className="t-small t-dim">validé : {ladder.best} BPM</p> : null}
        </div>
        {ladder ? (
          <PixelButton variant="primary" onClick={stopSession}>Terminer la session</PixelButton>
        ) : (
          <PixelButton variant="primary" onClick={begin}>▶ Commencer {listening ? `(${startTempo(readAttempts(progressStore()), form, pattern)} BPM)` : `à ${manualBpm} BPM`}</PixelButton>
        )}
      </section>

      <TabView
        score={score}
        notes={settings.noteNotation}
        chords={settings.chordNotation}
        annotation="finger"
        mode="wrap"
        scale="auto"
        minScale={3}
        reduceMotion={settings.reduceMotion}
        player={null}
        transport="stopped"
        hideRhythm
        {...(cursor ? { activeHoleKey: cursor } : {})}
      />

      <Panel className="span-12" label="Séquence" right={<span className="badge">{phase === 'pass' && listening ? `${consumed} / ${targets.length}` : `${targets.length} notes`}</span>}>
        <div className="field">
          <span className="t-label">Motif</span>
          <Segmented<SequencePattern>
            size="sm"
            label="Motif"
            value={pattern}
            onChange={(v) => { if (!ladder) setPattern(v); }}
            options={SEQUENCE_PATTERNS.map((p) => ({ value: p, label: SEQUENCE_LABEL[p] }))}
          />
        </div>
        <div className={`mic-line ${listening ? 'on' : ''}`}>
          <div className="mic-line-body">
            <span className="mic-line-title">{listening ? 'Micro ouvert : chaque passe est jugée' : 'Sans micro : tempo manuel, rien n’est vérifié'}</span>
            <span className="t-small t-dim">
              {micBusy ? 'ouverture du périphérique…' : listening ? 'palier automatique : +4 après deux passes propres, −5 après deux échecs' : 'ni palier, ni XP — la tablature et le métronome seulement'}
            </span>
          </div>
          {listening ? (
            <PixelButton variant="quiet" onClick={() => setMicOn(false)} disabled={!!ladder}>Fermer</PixelButton>
          ) : (
            <PixelButton variant="primary" onClick={() => setMicOn(true)} disabled={micBusy || !!ladder}>▶ Ouvrir le micro</PixelButton>
          )}
        </div>
        {listening && (
          <MicStrip
            engine={engine}
            notation={settings.noteNotation}
            thresholdDb={input.thresholds[input.source]}
            tolerance={input.centsTolerance}
            tuning={r.tuning}
            a4={input.a4}
          />
        )}
        {!listening && !ladder && (
          <div className="tempo-row">
            <div className="tempo">
              <button type="button" className="tempo-btn" onClick={() => setManualBpm((b) => Math.max(LADDER_MIN, b - 4))} aria-label="Moins vite">−</button>
              <span className="tempo-val">♪ {manualBpm}</span>
              <button type="button" className="tempo-btn" onClick={() => setManualBpm((b) => Math.min(LADDER_MAX, b + 4))} aria-label="Plus vite">+</button>
            </div>
            <span className="t-small t-dim">BPM en croches</span>
          </div>
        )}
        {ladder && pauseDue(sessionMs) && (
          <p className="t-small" role="status">Dix minutes de séquences : une pause de deux minutes, main relâchée, et la précision revient.</p>
        )}
        <div className="row exercise-start">
          <PixelButton variant="quiet" onClick={() => navigate('training')} disabled={!!ladder}>Exercice de mémoire</PixelButton>
        </div>
        {saved && (
          <p className="t-small" role="status">
            {saved.verified
              ? `Session enregistrée${saved.xp > 0 ? ` : +${saved.xp} XP` : ''}. Le meilleur tempo validé compte pour la vitesse de la forme.`
              : 'Session enregistrée comme activité, non vérifiée : sans micro, l’app n’entend rien.'}
          </p>
        )}
        {status && <p className="t-small numpad-feedback no" role="status">{status}</p>}
      </Panel>

      <details className="how-scored">
        <summary>Comment c’est noté ?</summary>
        <p className="t-small">
          Une passe est réussie à ≥ 95 % de notes justes <strong>et</strong> en place : neuf notes sur dix à moins d’une
          demi-croche de leur temps (un retard constant ne compte pas, c’est la latence). C’est un exercice de technique,
          tablature visible : il prouve la <strong>vitesse</strong> d’une forme, pas qu’on la sait par cœur.
        </p>
        <p className="t-small t-dim">
          Une seule tentative par session au journal. Le tempo validé le plus haut sert de départ la fois suivante.
        </p>
      </details>

      <div className="pos-nav">
        <PixelButton variant="quiet" onClick={() => setScaleSelection({ positionIndex: Math.max(0, r.selection.positionIndex - 1) })} disabled={r.selection.positionIndex === 0 || !!ladder}>‹ Position</PixelButton>
        <span className="t-label pos-count">{r.selection.positionIndex + 1} / {r.positions.length}</span>
        <PixelButton variant="quiet" onClick={() => setScaleSelection({ positionIndex: Math.min(r.positions.length - 1, r.selection.positionIndex + 1) })} disabled={r.selection.positionIndex >= r.positions.length - 1 || !!ladder}>Position ›</PixelButton>
      </div>
    </main>
  );
}
