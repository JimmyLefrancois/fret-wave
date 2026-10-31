/**
 * Module Gammes — **séquences avec palier de tempo** (lot « mémoire et vitesse », MUSIC_DESIGN §3.5).
 *
 * Exercice de technique : la tablature reste **visible** (par 3, par 4, tierces, quartes, saut de corde ou
 * tour depuis un degré, sur la position choisie). Au micro, chaque passe est précédée d'une mesure de décompte, jouée sur le métronome et jugée
 * note à note (justesse et mise en place) ; le tempo monte de 4 BPM après deux passes propres et en place,
 * redescend de 5 après deux échecs, jamais sous le départ (`sequence.ts`). Sans micro : tempo manuel,
 * rien n'est vérifié, ni palier ni XP.
 *
 * Une **seule tentative par session** (motif, tempo de départ, meilleur tempo validé, passes, précision) :
 * le journal plafonné à 2 000 entrées ne doit pas se remplir de passes. Elle nourrit la **vitesse** de la
 * forme (« maîtrisée »), jamais « apprise » ni la révision.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { setScaleSelection, setTrainingStart, takeLiaisonRequest, useScaleSelection } from '../../app/scaleSession';
import { useSettings } from '../../app/settings';
import { TabView } from '../../app/TabView';
import { NeckView } from '../../app/NeckView';
import { Panel, PixelButton, Segmented } from '../../app/ui';
import { InstrumentPicker } from '../../app/AudioControls';
import { useDesktop } from '../../app/useDesktop';
import { LandscapeView, openLandscape } from '../../app/LandscapeView';
import { canAutoOpenMic, micPermission } from '../../core/input/autoOpen';
import { LevelsNav } from './LevelsNav';
import { PlaySection } from './PlaySection';
import { ensureInputEngine, inputEngineIfAny, windowFor } from '../../app/inputSession';
import { AudioEngine } from '../../core/audio/engine';
import { TabPlayer } from '../../core/audio/tabPlayer';
import { describeInputError, type InputEngine, type InputFrame } from '../../core/input/engine';
import { targetsFor, type HoleLike, type Target } from '../../core/input/match';
import { useInputSettings } from '../../core/input/settings';
import {
  SEQUENCE_LABEL, SEQUENCE_PATTERNS, isLiaison, liaisonToScore, liaisonsFor, linkNeckNotes, neckNotes, sequenceToScore,
  type NeckNote, type SequencePattern, type TabScore,
} from '../../core/tab';
import { extendedPosition, linkedPair, positionsOnNeck } from '../../core/theory';
import {
  appendAttempt, newAttemptId, nodeIdOf, progressStore, readAttempts, xpForAttempt, type Attempt,
} from '../../core/progress';
import { blindGrid, scoreBlind, type BlindGrid, type HeardNote } from './blind';
import { clickMasked } from './exercise';
import { degreesOf, fmtDegree, legendFor, positionLabelPlain, resolveScale } from './resolve';
import {
  LADDER_MAX, LADDER_MIN, judgePass, ladderStart, ladderStep, pauseDue, startTempo,
  type LadderState, type PassResult,
} from './sequence';
import * as clock from '../../core/clock';

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
  const wide = useDesktop();
  // la session se joue en paysage ; un grand téléphone y dépasse 900 px, sans changer de rendu pour autant
  const [playing, setPlaying] = useState(false);
  const desktop = wide && !playing;
  const closePlay = useCallback(() => setPlaying(false), []);
  const settings = useSettings();
  const selection = useScaleSelection();
  const r = useMemo(() => resolveScale(selection, settings.noteNotation), [selection, settings.noteNotation]);
  const input = useInputSettings();

  const [wanted, setPattern] = useState<SequencePattern>('g3');
  const [liaisonMode, setLiaisonMode] = useState(takeLiaisonRequest);
  const [startDegree, setStartDegree] = useState('1');
  const [phase, setPhase] = useState<Phase>('idle');
  const [ladder, setLadder] = useState<LadderState | null>(null);
  const [lastPass, setLastPass] = useState<PassResult | null>(null);
  // dernier changement de palier (+4, −5, 0) : affiché en grand, c'est le moment qui motive
  const [shift, setShift] = useState(0);
  const [manualBpm, setManualBpm] = useState(60);
  const [now, setNow] = useState(() => clock.now());
  const [saved, setSaved] = useState<{ xp: number; verified: boolean } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [neckOpen, setNeckOpen] = useState(false);

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

  const liaisons = useMemo(() => (r.position ? liaisonsFor(r.positions, r.position) : []), [r.positions, r.position]);
  // une liaison indisponible sur cette position retombe sur la première possible, ou sur les motifs
  const inLiaisons = liaisonMode && liaisons.length > 0;
  const pattern: SequencePattern = inLiaisons
    ? (isLiaison(wanted) && liaisons.includes(wanted) ? wanted : liaisons[0]!)
    : isLiaison(wanted) ? 'g3' : wanted;
  const form = r.position ? { scaleId: r.def.id, system: r.selection.system, formIndex: r.position.formIndex ?? r.position.index } : null;
  // départs proposés : les degrés de la gamme présents sur la position (un choix d'une autre gamme retombe sur le premier)
  const startDegrees = useMemo(
    () => degreesOf(r.def).filter((d) => r.position?.notes.some((n) => n.degree === d)),
    [r.def, r.position],
  );
  const start = (startDegrees.includes(startDegree) ? startDegree : startDegrees[0]) ?? '1';
  const score = useMemo(() => {
    if (!r.position) return null;
    try {
      // étiquette courte (« tierces · cases 5–8 ») : la position est déjà dans l'en-tête, et 390 px ne la tiennent pas deux fois
      if (isLiaison(pattern)) {
        const neck = positionsOnNeck(r.positions);
        const at = neck.findIndex((p) => p.id === r.position!.id);
        const [from, to] = pattern === 'traverse' ? [neck[0]!, neck[neck.length - 1]!]
          : pattern === 'link' ? linkedPair(r.positions, r.position)!
            : [neck[at]!, neck[at + 1]!];
        const number = (p: typeof from) => r.positions.findIndex((q) => q.id === p.id) + 1;
        return liaisonToScore(r.positions, r.position, r.tuning, pattern, { labelPrefix: `Position ${number(from)} vers ${number(to)}` });
      }
      return sequenceToScore(r.position, r.tuning, pattern, { startDegree: start });
    } catch {
      return null;
    }
  }, [r.position, r.positions, r.tuning, pattern, start]);
  // le manche d'une liaison : ce que la tablature écrit en chiffres, les ponts en pointillés
  const liaisonNeck = useMemo((): { notes: NeckNote[]; zone: { from: number; to: number }; text: string } | null => {
    if (!r.position || !isLiaison(pattern)) return null;
    const zoneOf = (ps: readonly { fretMin: number; fretMax: number }[]) => ({
      from: Math.min(...ps.map((p) => p.fretMin)), to: Math.max(...ps.map((p) => p.fretMax)),
    });
    if (pattern === 'link') {
      const [low, high] = linkedPair(r.positions, r.position)!;
      return {
        // les deux positions sont jouées : aucune ne reste à l'arrière-plan
        notes: linkNeckNotes(low, high, 'finger', settings.noteNotation).map((n) => ({ ...n, dim: false })), zone: zoneOf([low, high]),
        text: `Monte dans les cases ${low.fretMin}–${low.fretMax}, descends dans les cases ${high.fretMin}–${high.fretMax} : la main change de position sur la note qui brille.`,
      };
    }
    if (pattern === 'extended') {
      const ext = extendedPosition(r.positions, r.position)!;
      return {
        notes: neckNotes(ext, 'finger', settings.noteNotation), zone: zoneOf([ext]),
        text: 'La même position, plus les notes de la suivante sur les deux cordes aiguës : la main sort de la box et y revient.',
      };
    }
    const neck = positionsOnNeck(r.positions);
    return {
      notes: neck.flatMap((p, i) => (neck[i + 1] ? linkNeckNotes(p, neck[i + 1]!, 'degree', settings.noteNotation).filter((n) => !n.dim) : neckNotes(p, 'degree', settings.noteNotation)))
        .filter((n, i, all) => all.findIndex((m) => m.string === n.string && m.fret === n.fret) === i),
      zone: zoneOf(neck),
      text: `${neck.length} positions d’un seul trait, du bas au haut du manche : une en montant, la suivante en descendant, en changeant sur la note qui brille.`,
    };
  }, [r.position, r.positions, pattern, settings.noteNotation]);
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
      setNow(clock.now());
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
      setNow(clock.now());
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
    session.current = { startedAt: clock.now(), correct: 0, total: 0, missed: new Set(), verified: false };
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
      id: newAttemptId(clock.now(), nodeIdOf({ ...form, kind: 'sequence' }), readAttempts(progressStore()).length),
      ts: clock.now(),
      kind: 'sequence',
      scaleId: form.scaleId,
      tonic: r.tonic,
      tuningId: r.tuning.id,
      system: form.system,
      positionId: r.position.id,
      formIndex: form.formIndex,
      level: 4,
      strings: new Set(r.position.notes.map((n) => n.string)).size,
      // sans micro, rien n'est vérifié : une activité, jamais une preuve
      correct: verified ? s.correct : null,
      total: verified ? s.total : null,
      seconds: Math.round((clock.now() - s.startedAt) / 1000),
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

  // fermer la vue de jeu termine la session : les passes déjà validées sont enregistrées, le bilan se lit en portrait
  const wasPlaying = useRef(false);
  useEffect(() => {
    const closed = wasPlaying.current && !playing;
    wasPlaying.current = playing;
    if (closed && ladder) stopSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // le micro s'ouvre seul dès que le navigateur le permet
  useEffect(() => {
    let cancelled = false;
    void micPermission().then((permission) => {
      if (!cancelled && canAutoOpenMic(permission, navigator.userActivation?.hasBeenActive ?? false)) setMicOn(true);
    });
    return () => { cancelled = true; };
  }, []);

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

  const tab = (
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
      // bureau : plusieurs lignes, les motifs sont longs ; téléphone en paysage : une ligne qui suit la note
      oneLine={playing}
      {...(cursor ? { activeHoleKey: cursor } : {})}
    />
  );
  const neckPanel = liaisonNeck && (
      <Panel className="span-12 neck-panel" label="Manche" right={<span className="badge">cases {liaisonNeck.zone.from}–{liaisonNeck.zone.to}</span>}>
        <NeckView
          tuning={r.tuning}
          notes={liaisonNeck.notes}
          zone={liaisonNeck.zone}
          notation={settings.noteNotation}
          label={`${SEQUENCE_LABEL[pattern]}, cases ${liaisonNeck.zone.from} à ${liaisonNeck.zone.to}`}
        />
        <p className="t-small t-dim">{liaisonNeck.text}</p>
      </Panel>
    );
  const workField = liaisons.length > 0 && (
      <div className="field">
        <span className="t-label">Travail</span>
        <Segmented<'motifs' | 'liaisons'>
          size="sm"
          label="Type de travail"
          value={inLiaisons ? 'liaisons' : 'motifs'}
          onChange={(v) => { if (!ladder) setLiaisonMode(v === 'liaisons'); }}
          options={[{ value: 'motifs', label: 'Motifs' }, { value: 'liaisons', label: 'Liaisons' }]}
        />
      </div>
    );
  const patternField = (
    <div className="field">
      <span className="t-label">{inLiaisons ? 'Liaison' : 'Motif'}</span>
      <Segmented<SequencePattern>
        size="sm"
        label={inLiaisons ? 'Liaison' : 'Motif'}
        value={pattern}
        onChange={(v) => { if (!ladder) setPattern(v); }}
        options={(inLiaisons ? liaisons : SEQUENCE_PATTERNS).map((p) => ({ value: p, label: SEQUENCE_LABEL[p] }))}
      />
    </div>
  );
  const startField = pattern === 'cycle' && (
    <div className="field">
      <span className="t-label">Départ</span>
      <Segmented
        size="sm"
        label="Degré de départ"
        value={start}
        onChange={(v) => { if (!ladder) setStartDegree(v); }}
        options={startDegrees.map((d) => ({ value: d, label: fmtDegree(d) }))}
      />
    </div>
  );
  const startHint = pattern === 'cycle' && (
    <p className="t-small t-dim">Monte depuis ce degré, descends jusqu’en bas de la position, reviens-y : sortir de l’habitude de partir de la fondamentale.</p>
  );
  const manualTempo = (
    <div className="tempo">
      <button type="button" className="tempo-btn" onClick={() => setManualBpm((b) => Math.max(LADDER_MIN, b - 4))} aria-label="Moins vite">−</button>
      <span className="tempo-val">♪ {manualBpm}</span>
      <button type="button" className="tempo-btn" onClick={() => setManualBpm((b) => Math.min(LADDER_MAX, b + 4))} aria-label="Plus vite">+</button>
    </div>
  );
  const pauseNote = ladder && pauseDue(sessionMs) && (
      <p className="t-small" role="status">Dix minutes de séquences : une pause de deux minutes, main relâchée, et la précision revient.</p>
    );
  const savedNote = saved && (
      <p className="t-small" role="status">
        {saved.verified
          ? `Session enregistrée${saved.xp > 0 ? ` : +${saved.xp} XP` : ''}.${isLiaison(pattern) ? '' : ' Le meilleur tempo validé compte pour la vitesse de la forme.'}`
          : 'Session enregistrée comme activité, non vérifiée : sans micro, l’app n’entend rien.'}
      </p>
    );
  const statusNote = status && <p className="t-small numpad-feedback no" role="status">{status}</p>;
  const howScoredBody = (
    <>
      <p className="t-small">
        Une passe est réussie à ≥ 95 % de notes justes <strong>et</strong> en place : neuf notes sur dix à moins d’une
        demi-croche de leur temps (un retard constant ne compte pas, c’est la latence). C’est un exercice de technique,
        tablature visible : il prouve la <strong>vitesse</strong> d’une forme, pas qu’on la sait par cœur. Les liaisons
        travaillent le passage d’une forme à l’autre : elles ne comptent pas pour la vitesse d’une forme.
      </p>
      <p className="t-small t-dim">
        Une seule tentative par session au journal. Le tempo validé le plus haut sert de départ la fois suivante.
      </p>
    </>
  );
  const prevPosition = (
    <PixelButton variant="quiet" onClick={() => setScaleSelection({ positionIndex: Math.max(0, r.selection.positionIndex - 1) })} disabled={r.selection.positionIndex === 0 || !!ladder}>‹ Position</PixelButton>
  );
  const positionCount = <span className="t-label pos-count">{r.selection.positionIndex + 1} / {r.positions.length}</span>;
  const nextPosition = (
    <PixelButton variant="quiet" onClick={() => setScaleSelection({ positionIndex: Math.min(r.positions.length - 1, r.selection.positionIndex + 1) })} disabled={r.selection.positionIndex >= r.positions.length - 1 || !!ladder}>Position ›</PixelButton>
  );
  const degrees = legendFor(r.def);
  const beginLabel = `▶ Commencer ${listening ? `(${startTempo(readAttempts(progressStore()), form, pattern)} BPM)` : `à ${manualBpm} BPM`}`;


  if (desktop) {
    // micro fermé, c'est lui l'action principale : Commencer garde le cyan des modes, le magenta reste unique
    const micFirst = !micOn && !ladder;
    const hasNews = countLeft !== null || lastPass || !micOn || ladder?.best || (ladder && pauseDue(sessionMs)) || saved || status;
    return (
      <main className="shell play-shell">
        <div className="play-surface">
          <header className="play-head">
            <div className="play-id">
              <button type="button" className="back" onClick={() => navigate('training')} aria-label="Retour à l’entraînement">‹</button>
              <div>
                <div className="play-title">
                  <h1 className="page-title">{r.title}</h1>
                  <span className="tag tag-on">Niv4</span>
                </div>
                <p className="t-small t-dim">{positionLabelPlain(r.position, settings.noteNotation)} · séquence {SEQUENCE_LABEL[pattern]}{pattern === 'cycle' ? ` depuis la ${fmtDegree(start)}` : ''}</p>
              </div>
            </div>
            {micFirst && (
              <PixelButton variant="primary" className="mic-spark" onClick={() => setMicOn(true)} disabled={micBusy}>▶ Ouvrir le micro</PixelButton>
            )}
            {!listening && !ladder ? manualTempo : (
              <div className="seq-tempo">
                <span className="seq-bpm">♪ {bpm}</span>
                {shift !== 0 && (
                  <span className={`seq-shift ${shift > 0 ? 'up' : 'down'}`} role="status">
                    {shift > 0 ? `↑ +${shift}` : `↓ ${shift}`} BPM
                  </span>
                )}
              </div>
            )}
            {ladder ? (
              <PixelButton variant="primary" onClick={stopSession}>Terminer la session</PixelButton>
            ) : (
              <PixelButton variant={micFirst ? 'ghost' : 'primary'} className={micFirst ? 'train-grid' : ''} onClick={begin}>{beginLabel}</PixelButton>
            )}
            <span className="badge badge-count">{phase === 'pass' && listening ? `${consumed} / ${targets.length}` : targets.length} notes</span>
          </header>

          <section className="play-tab">
            <div className="play-tab-bar">
              <div className="play-degrees" role="img" aria-label={`Couleurs des degrés : ${degrees.map((it) => it.name).join(', ')}`}>
                {degrees.map((it) => (
                  <span key={it.fn} className="legend-pill" style={{ background: it.fill, color: it.digit }}>{it.fn}</span>
                ))}
              </div>
              {workField}
              {patternField}
              {startField}
              {neckPanel && <PixelButton variant="quiet" onClick={() => setNeckOpen(true)}>Vue manche</PixelButton>}
            </div>
            {tab}
          </section>

          {neckOpen && neckPanel && (
            <dialog
              ref={(d) => { if (d && !d.open) d.showModal(); }}
              className="play-neck-dialog"
              aria-label="Vue manche"
              onClose={() => setNeckOpen(false)}
              // un clic sur le fond (hors du contenu) referme
              onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
            >
              {neckPanel}
              <form method="dialog" className="play-neck-close">
                <PixelButton variant="quiet" onClick={() => setNeckOpen(false)}>Fermer</PixelButton>
              </form>
            </dialog>
          )}

          {hasNews && (
            <section className="train-answer">
              {countLeft !== null ? (
                <p className="seq-count" aria-live="assertive">{countLeft}</p>
              ) : lastPass && phase !== 'pass' ? (
                <p className={`seq-line ${lastPass.ok ? 'ok' : 'no'}`} role="status">
                  <span className="verdict-mark" aria-hidden="true">{lastPass.ok ? '✓' : '✕'}</span>
                  {Math.round(lastPass.accuracy * 100)} % · {lastPass.inTime ? 'en place' : 'pas en place'} — {lastPass.ok ? 'réussie' : 'à reprendre'}
                </p>
              ) : !micOn ? (
                <p className="seq-line seq-idle">Sans micro : tempo manuel, rien n’est vérifié.</p>
              ) : null}
              {ladder?.best ? <p className="t-small t-dim">validé : {ladder.best} BPM</p> : null}
              {pauseNote}
              {savedNote}
              {statusNote}
            </section>
          )}

          <div className="play-nav">
            <LevelsNav
              current={4}
              onSelect={(n) => {
                if (n === 1) navigate('scale');
                else if (n === 5) navigate('impro');
                else if (n === 2 || n === 3) { setTrainingStart({ level: n, segment: 'updown' }); navigate('training'); }
              }}
            />
            <div className="play-pos">
              {prevPosition}
              <span className="play-dots" aria-hidden="true">
                {r.positions.map((p, i) => <span key={p.id} className={i === r.selection.positionIndex ? 'on' : ''} />)}
              </span>
              {positionCount}
              {nextPosition}
            </div>
          </div>

          <div className="play-more">
            <PixelButton variant="quiet" onClick={() => setInfoOpen((o) => !o)}>
              {infoOpen ? '▾ Masquer les détails' : '▸ Détails de la séquence'}
            </PixelButton>
          </div>

          {infoOpen && (
            <div className="play-columns">
              <div className="play-col">
                <PlaySection title="Séquence">
                  {liaisons.length > 0 && (
                    <p className="t-small"><strong>Travail</strong> : ce que tu entraînes. Motifs : une figure qui se répète à l’intérieur de la position. Liaisons : le passage d’une position à une autre.</p>
                  )}
                  {inLiaisons ? (
                    <p className="t-small"><strong>Liaison</strong> : le trajet sur le manche. Deux positions : monter dans l’une, descendre dans la voisine. Traversée : toutes les positions d’un seul trait, du bas au haut du manche. Position étendue : la position, plus les notes de la suivante sur les deux cordes aiguës.</p>
                  ) : (
                    <p className="t-small"><strong>Motif</strong> : la figure jouée, en montant puis en descendant. Par 3 et par 4 : des groupes de 3 ou 4 notes voisines, qui repartent une note plus haut (1 2 3, 2 3 4…). Tierces : une note, puis celle d’après la suivante (1 3, 2 4…). Quartes : une note, puis la troisième d’après (1 4, 2 5…). Saut de corde : une corde, puis celle d’après la suivante. Tour : toute la position, depuis le degré de ton choix.</p>
                  )}
                  <p className="t-small"><strong>Départ</strong> : le degré d’où part le tour. Ce réglage n’apparaît qu’avec le motif « tour ».</p>
                  {startHint}
                  <p className="t-small t-dim">{listening ? 'Palier automatique : +4 après deux passes propres, −5 après deux échecs.' : 'Sans micro : ni palier, ni XP — la tablature et le métronome seulement.'}</p>
                  {micOn && (
                    <div className="row">
                      <PixelButton variant="quiet" onClick={() => setMicOn(false)} disabled={!!ladder}>Fermer le micro</PixelButton>
                    </div>
                  )}
                </PlaySection>
              </div>
              <div className="play-col">
                <PlaySection title="Comment c’est noté ?" tone="cyan">{howScoredBody}</PlaySection>
              </div>
            </div>
          )}

          <footer className="play-foot">
            <InstrumentPicker />
            <PixelButton variant="quiet" onClick={() => navigate('gammes')} disabled={!!ladder}>← Changer de gamme</PixelButton>
          </footer>
        </div>
      </main>
    );
  }

  // Téléphone : comme l'entraînement, le portrait règle et lance, la session se joue en paysage sur une ligne
  const micFirst = !micOn && !ladder;
  const openPlay = () => {
    setPlaying(true);
    openLandscape();
  };
  const passLine = lastPass && phase !== 'pass' && (
    <p className={`seq-line ${lastPass.ok ? 'ok' : 'no'}`} role="status">
      <span className="verdict-mark" aria-hidden="true">{lastPass.ok ? '✓' : '✕'}</span>
      {Math.round(lastPass.accuracy * 100)} % · {lastPass.inTime ? 'en place' : 'pas en place'} — {lastPass.ok ? 'réussie' : 'à reprendre'}
    </p>
  );
  return (
    <main className="shell mplay">
      <header className="mplay-head">
        <div className="mplay-id">
          <button type="button" className="back" onClick={() => navigate('training')} aria-label="Retour à l’entraînement">‹</button>
          <div className="mplay-title">
            <h1 className="page-title">{r.title}</h1>
            <p className="t-small t-dim">{positionLabelPlain(r.position, settings.noteNotation)} · séquence {SEQUENCE_LABEL[pattern]}{pattern === 'cycle' ? ` depuis la ${fmtDegree(start)}` : ''}</p>
          </div>
          <span className="tag tag-on">Niv4</span>
        </div>
      </header>

      <section className="mplay-tab">
        <div className="mplay-bar">
          <PixelButton variant="primary" className="mplay-play" onClick={openPlay}>▶ Jouer</PixelButton>
          <p className="t-small t-dim mplay-play-note">
            La tablature s’ouvre en paysage. Règle le motif, la position et le tempo, puis touche Commencer : elle défile sur la note attendue, et le tempo monte tout seul au micro.
          </p>
          {micBusy && <p className="t-small t-dim">ouverture du périphérique…</p>}
          {passLine}
          {savedNote}
          {statusNote}
        </div>
        {neckPanel}
      </section>

      <div className="mplay-levels">
        <LevelsNav
          current={4}
          onSelect={(n) => {
            if (n === 1) navigate('scale');
            else if (n === 5) navigate('impro');
            else if (n === 2 || n === 3) { setTrainingStart({ level: n, segment: 'updown' }); navigate('training'); }
          }}
        />
      </div>

      <div className="mplay-more">
        <PixelButton variant="quiet" onClick={() => setInfoOpen((o) => !o)}>
          {infoOpen ? '▾ Masquer les détails' : '▸ Détails de la séquence'}
        </PixelButton>
      </div>

      {infoOpen && (
        <>
          <Panel className="span-12" label="Séquence">
            {liaisons.length > 0 && (
              <p className="t-small"><strong>Travail</strong> : ce que tu entraînes. Motifs : une figure qui se répète à l’intérieur de la position. Liaisons : le passage d’une position à une autre.</p>
            )}
            {inLiaisons ? (
              <p className="t-small"><strong>Liaison</strong> : le trajet sur le manche. Deux positions : monter dans l’une, descendre dans la voisine. Traversée : toutes les positions d’un seul trait, du bas au haut du manche. Position étendue : la position, plus les notes de la suivante sur les deux cordes aiguës.</p>
            ) : (
              <p className="t-small"><strong>Motif</strong> : la figure jouée, en montant puis en descendant. Par 3 et par 4 : des groupes de 3 ou 4 notes voisines, qui repartent une note plus haut (1 2 3, 2 3 4…). Tierces : une note, puis celle d’après la suivante (1 3, 2 4…). Quartes : une note, puis la troisième d’après (1 4, 2 5…). Saut de corde : une corde, puis celle d’après la suivante. Tour : toute la position, depuis le degré de ton choix.</p>
            )}
            <p className="t-small"><strong>Départ</strong> : le degré d’où part le tour. Ce réglage n’apparaît qu’avec le motif « tour ».</p>
            {startHint}
            <p className="t-small t-dim">{listening ? 'Palier automatique : +4 après deux passes propres, −5 après deux échecs.' : 'Sans micro : ni palier, ni XP — la tablature et le métronome seulement.'}</p>
            {micOn && <PixelButton variant="quiet" onClick={() => setMicOn(false)}>Fermer le micro</PixelButton>}
          </Panel>
          <Panel className="span-12" label="Comment c’est noté ?">{howScoredBody}</Panel>
        </>
      )}

      <footer className="mplay-foot">
        <InstrumentPicker />
        <PixelButton variant="quiet" onClick={() => navigate('gammes')}>← Changer de gamme</PixelButton>
      </footer>

      {playing && (
        <LandscapeView label={`Séquence : ${r.title}`} onClose={closePlay}>
          <div className={`tab-full-bar ${ladder ? '' : 'tab-full-options'}`}>
            <PixelButton variant="quiet" onClick={closePlay}>{ladder ? 'Terminer' : 'Fermer'}</PixelButton>
            {!ladder && (
              <>
                <div className="land-pos">
                  <PixelButton variant="quiet" onClick={() => setScaleSelection({ positionIndex: Math.max(0, r.selection.positionIndex - 1) })} disabled={r.selection.positionIndex === 0} ariaLabel="Position précédente">‹</PixelButton>
                  <span className="t-label">{r.selection.positionIndex + 1} / {r.positions.length}</span>
                  <PixelButton variant="quiet" onClick={() => setScaleSelection({ positionIndex: Math.min(r.positions.length - 1, r.selection.positionIndex + 1) })} disabled={r.selection.positionIndex >= r.positions.length - 1} ariaLabel="Position suivante">›</PixelButton>
                </div>
                {workField}
                {patternField}
                {startField}
                {!listening && manualTempo}
                {micFirst && <PixelButton variant="primary" className="mic-spark" onClick={() => setMicOn(true)} disabled={micBusy}>▶ Ouvrir le micro</PixelButton>}
                <PixelButton variant={micFirst ? 'ghost' : 'primary'} onClick={begin}>{beginLabel}</PixelButton>
              </>
            )}
            <span className="tab-full-title">{ladder ? SEQUENCE_LABEL[pattern] : ''}</span>
            {ladder && (
              <div className="seq-tempo">
                <span className="seq-bpm">♪ {bpm}</span>
                {shift !== 0 && <span className={`seq-shift ${shift > 0 ? 'up' : 'down'}`} role="status">{shift > 0 ? `↑ +${shift}` : `↓ ${shift}`}</span>}
              </div>
            )}
            <span className="badge badge-count">{phase === 'pass' && listening ? `${consumed} / ${targets.length}` : targets.length} notes</span>
          </div>
          <div className="land-body">{tab}</div>
          {countLeft !== null ? (
            <p className="land-status land-count" aria-live="assertive">{countLeft}</p>
          ) : (passLine || pauseNote || statusNote) && (
            <div className="land-status">{passLine}{pauseNote}{statusNote}</div>
          )}
        </LandscapeView>
      )}
    </main>
  );
}
