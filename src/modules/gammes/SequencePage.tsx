import { PracticeHeader, PositionRail, PositionStepper } from './PracticeHeader';
/**
 * Module Gammes — **séquences avec palier de tempo** (lot « mémoire et vitesse », MUSIC_DESIGN §3.5).
 *
 * Exercice de technique : la tablature reste **visible** (par 3, par 4, tierces, quartes, saut de corde ou
 * tour depuis un degré, sur la position choisie). Au micro, chaque passe est précédée d'une mesure de décompte, jouée sur le métronome et jugée
 * note à note (justesse et mise en place) ; le tempo monte de 4 BPM après deux passes propres et en place,
 * redescend de 5 après deux échecs, jamais sous le départ (`sequence.ts`). Sans micro : tempo manuel,
 * rien n'est vérifié, pas de palier.
 *
 * Une **seule tentative par session** (motif, tempo de départ, meilleur tempo validé, passes, précision) :
 * le journal plafonné à 2 000 entrées ne doit pas se remplir de passes. Elle donne le tempo de départ de la
 * session suivante et l'onglet Progression, jamais la révision.
 *
 * **Gamme en boucle** (D125, travail par défaut) : la gamme tourne sur le métronome, au tempo choisi, sans
 * pause ; avec l'option +5 BPM toutes les N répétitions, un décompte précède chaque hausse de tempo.
 * Sans micro, rien n'est écouté ni noté. Au micro, mode tolérant (D126) : chaque tour est jugé, la gamme ne
 * s'arrête pas, et le tempo ne monte qu'après N tours propres d'affilée. Dans les deux cas, une activité au
 * journal ; au micro, elle porte ses séries (D127). Au micro, 2 s de silence terminent la session.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { setScaleSelection, takeLiaisonRequest, useScaleSelection } from '../../app/scaleSession';
import { useSettings } from '../../app/settings';
import { TabView } from '../../app/TabView';
import { NeckView } from '../../app/NeckView';
import { Panel, PixelButton, Segmented } from '../../app/ui';
import { useDesktop } from '../../app/useDesktop';
import { LandscapeView, openLandscape } from '../../app/LandscapeView';
import { canAutoOpenMic, micPermission } from '../../core/input/autoOpen';
import { SequenceProgress } from './SequenceProgress';
import { SessionSummary, type SavedSession } from './SessionSummary';
import { PlaySection } from './PlaySection';
import { ensureInputEngine, inputEngineIfAny, windowFor } from '../../app/inputSession';
import { AudioEngine } from '../../core/audio/engine';
import { TabPlayer } from '../../core/audio/tabPlayer';
import { describeInputError, type InputEngine, type InputFrame } from '../../core/input/engine';
import { targetsFor, type HoleLike, type Target } from '../../core/input/match';
import { useInputSettings } from '../../core/input/settings';
import {
  PPQ, SEQUENCE_LABEL, SEQUENCE_PATTERNS, isLiaison, liaisonToScore, liaisonsFor, linkNeckNotes, neckNotes, sequenceToScore,
  type NeckNote, type SequencePattern, type TabScore,
} from '../../core/tab';
import { extendedPosition, linkedPair, positionsOnNeck } from '../../core/theory';
import {
  appendAttempt, newAttemptId, nodeIdOf, progressStore, readAttempts, type Attempt,
} from '../../core/progress';
import { COUNT_IN_TICKS, blindGrid, scoreBlind, type BlindGrid, type HeardNote } from './blind';
import { clickMasked } from './exercise';
import { degreesOf, fmtDegree, legendFor, positionLabelPlain, resolveScale } from './resolve';
import {
  LADDER_MAX, LADDER_MIN, LOOP_EVERY_MAX, LOOP_STEP, judgePass, ladderStart, ladderStep, loopCountBeat, loopLeft, loopNoteIndex, loopRises, loopStep,
  formatTourLog, heardInTour, judgeTour, loopBilan, pauseDue, playedTours, playerStopped, sessionRuns, startTempo, TOURS_START, tourDecides, tourRaise, tourRecord,
  type LadderState, type LoopBilan, type PassResult, type TourLog, type TourResult, type TourRow, type TourStats,
} from './sequence';
import * as clock from '../../core/clock';

type Phase = 'idle' | 'countin' | 'pass' | 'between';
type Work = 'gamme' | 'motifs' | 'liaisons';

/** Le détail de la dernière session au micro, gardé pour l'analyse. */
const TOUR_LOG_KEY = 'fretwave.tourlog.v1';
const TOUR_LOG_MAX = 150;
function readTourLog(): string {
  try {
    return progressStore()?.getItem(TOUR_LOG_KEY) ?? '';
  } catch {
    return '';
  }
}
function saveTourLog(text: string): void {
  try {
    progressStore()?.setItem(TOUR_LOG_KEY, text);
  } catch {
    // stockage plein ou refusé : le détail reste à l'écran
  }
}

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
  const [work, setWork] = useState<Work>(() => (takeLiaisonRequest() ? 'liaisons' : 'gamme'));
  // gamme en boucle : +5 BPM toutes les `loopEvery` répétitions (0 = tempo fixe)
  const [loopEvery, setLoopEvery] = useState(0);
  const loopEveryRef = useRef(loopEvery);
  loopEveryRef.current = loopEvery;
  const [startDegree, setStartDegree] = useState('1');
  const [phase, setPhase] = useState<Phase>('idle');
  const [ladder, setLadder] = useState<LadderState | null>(null);
  const [lastPass, setLastPass] = useState<PassResult | null>(null);
  // dernier changement de palier (+4, −5, 0) : affiché en grand, c'est le moment qui motive
  const [shift, setShift] = useState(0);
  const [manualBpm, setManualBpm] = useState(60);
  const [now, setNow] = useState(() => clock.now());
  // gamme en boucle au micro : chaque tour est jugé
  const [loopListen, setLoopListen] = useState(false);
  const [tours, setTours] = useState<TourStats>(TOURS_START);
  const [lastTour, setLastTour] = useState<TourResult | null>(null);
  const toursRef = useRef(TOURS_START);
  const scored = useRef(false);
  const judged = useRef(0);
  const relance = useRef(0);
  const tourLag = useRef<number | null>(null);
  const masked = useRef<HeardNote[]>([]);
  const tourLogs = useRef<TourLog[]>([]);
  const tourRows = useRef<TourRow[]>([]);
  const [bilan, setBilan] = useState<LoopBilan | null>(null);
  const [tourLog, setTourLog] = useState(readTourLog);
  const [logCopied, setLogCopied] = useState(false);
  const [saved, setSaved] = useState<SavedSession | null>(null);
  // la synthèse de fin de session, et ce qui l'a provoquée
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [autoStopped, setAutoStopped] = useState(false);
  const [view, setView] = useState<'jeu' | 'progression'>('jeu');
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
  const lastAttack = useRef(0);
  const [consumed, setConsumed] = useState(0);
  /** Cumul de la session : précision, cordes fautives, durée. */
  const session = useRef({ startedAt: 0, correct: 0, total: 0, missed: new Set<number>(), verified: false });
  const ladderRef = useRef<LadderState | null>(null);
  ladderRef.current = ladder;

  const liaisons = useMemo(() => (r.position ? liaisonsFor(r.positions, r.position) : []), [r.positions, r.position]);
  // une liaison indisponible sur cette position retombe sur la première possible, ou sur les motifs
  const loopMode = work === 'gamme';
  const inLiaisons = work === 'liaisons' && liaisons.length > 0;
  const pattern: SequencePattern = loopMode ? 'scale' : inLiaisons
    ? (isLiaison(wanted) && liaisons.includes(wanted) ? wanted : liaisons[0]!)
    : isLiaison(wanted) || wanted === 'scale' ? 'g3' : wanted;
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

  /** Juge les tours finis, en laissant aux dernières notes le temps d'arriver. */
  const settleTours = (all = false) => {
    const g = gridRef.current;
    if (!scored.current || !g) return;
    const n = targets.length;
    const tempo = g.grid.score.tempo;
    const eighth = 30 / tempo;
    const elapsed = (performance.now() - passStartPerf.current) / 1000;
    const wait = all ? 0 : Math.max(eighth, 0.4) + (tourLag.current ?? 0);
    while (elapsed >= (judged.current + 1) * n * eighth + wait) {
      const lag = tourLag.current;
      const window = heardInTour(heard.current, judged.current, n, tempo, lag);
      const res = judgeTour(targets, window, tempo, { centsTolerance: inputRef.current.centsTolerance });
      tourLogs.current = [...tourLogs.current, {
        tour: ladderRef.current?.passes ?? 0,
        bpm: tempo, lag, result: res, heard: window, masked: heardInTour(masked.current, judged.current, n, tempo, lag),
      }].slice(-TOUR_LOG_MAX);
      tourRows.current.push({ bpm: tempo, result: res });
      if (res.lag !== null) tourLag.current = res.lag;
      judged.current += 1;
      for (const st of res.missedStrings) session.current.missed.add(st);
      toursRef.current = tourRecord(toursRef.current, res);
      const lad = ladderRef.current;
      if (lad) {
        ladderRef.current = { ...lad, passes: lad.passes + 1 };
        setLadder(ladderRef.current);
      }
      setTours(toursRef.current);
      setLastTour(res);
    }
  };

  /** Fin d'une répétition : au micro, un tour décisif s'arrête pour être jugé, puis on relance sur un décompte. */
  const nextLoop = (time: number) => {
    const lad = ladderRef.current;
    if (!lad) return;
    if (scored.current) {
      if (!tourDecides(toursRef.current, loopEveryRef.current, lad.bpm)) return;
      // le retour au début sonnerait un clic avant l'arrêt
      player.current?.setMetronome(false);
      setPhase('between');
      setShift(0);
      relance.current = window.setTimeout(() => {
        player.current?.stop();
        settleTours(true);
        const now = ladderRef.current;
        if (!now) return;
        const up = tourRaise(toursRef.current, loopEveryRef.current, now.bpm);
        toursRef.current = up.stats;
        ladderRef.current = { ...now, bpm: up.bpm };
        setTours(up.stats);
        setShift(up.bpm - now.bpm);
        setLadder(ladderRef.current);
        void startPass(up.bpm);
      }, 1000);
      return;
    }
    const next = loopStep(lad, loopEveryRef.current);
    if (next.bpm !== lad.bpm) player.current?.setTempoAt(next.bpm, time);
    player.current?.setLoopStart(loopRises(next, loopEveryRef.current) ? 0 : COUNT_IN_TICKS);
    ladderRef.current = next;
    setShift(next.bpm - lad.bpm);
    setLadder(next);
  };

  /** Une passe : une mesure de décompte, puis la grille de la séquence en croches au tempo du palier. */
  const startPass = async (tempo: number) => {
    if (!score || targets.length === 0) return;
    const p = player.current!;
    const g = blindGrid(targets.length, tempo, 2);
    try {
      await p.init();
      await p.load(g.score, loopMode
        // la boucle saute le décompte (nombre de notes pair : le temps tombe juste à chaque tour), sauf
        // quand le tempo monte : elle le reprend, et il donne le nouveau tempo (`nextLoop`)
        ? { loop: true, loopRange: { from: !scored.current && loopRises(ladderStart(tempo), loopEvery) ? 0 : COUNT_IN_TICKS, to: COUNT_IN_TICKS + targets.length * (PPQ / 2) }, onLoop: nextLoop, countInTicks: COUNT_IN_TICKS }
        : { loop: false, countInTicks: COUNT_IN_TICKS });
      p.setMetronome(true);
      p.onEnded = null;
      await p.play();
      const t0 = performance.now();
      clickPerf.current = t0;
      passStartPerf.current = t0 + g.countIn * 1000;
      gridRef.current = g;
      heard.current = [];
      masked.current = [];
      judged.current = 0;
      acted.current = null;
      lastAttack.current = 0;
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

  const stopRef = useRef<() => void>(() => {});
  // horloge : décompte → passe → fin de passe (toutes les notes jouées, ou grille finie + un temps)
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setNow(clock.now());
      const g = gridRef.current;
      if (!g) return;
      const perf = performance.now();
      if (phase === 'countin' && perf >= passStartPerf.current) setPhase('pass');
      settleTours();
      // au micro, le silence termine la session : les clics du métronome ne comptent pas comme du jeu
      if (phase === 'pass' && (scored.current || listening) && playerStopped(perf, passStartPerf.current, lastAttack.current)) {
        setAutoStopped(true);
        stopRef.current();
        setPlaying(false);
        return;
      }
      if (phase === 'pass' && !loopMode && perf >= passStartPerf.current + (g.grid.seconds + 60 / g.grid.score.tempo) * 1000) endPass();
    }, 80);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase]);

  // entre deux passes : 2 s pour lire le verdict, puis la suivante (au tempo du palier)
  useEffect(() => {
    if (phase !== 'between' || !ladder || loopMode) return;
    const t = window.setTimeout(() => void startPass(ladder.bpm), 2000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, ladder]);

  const begin = () => {
    if (!form) return;
    const start = listening && !loopMode ? startTempo(readAttempts(progressStore()), form, pattern) : manualBpm;
    session.current = { startedAt: clock.now(), correct: 0, total: 0, missed: new Set(), verified: false };
    scored.current = loopMode && loopListen;
    toursRef.current = TOURS_START;
    tourLag.current = null;
    tourLogs.current = [];
    tourRows.current = [];
    setBilan(null);
    setTours(TOURS_START);
    setLastTour(null);
    setSaved(null);
    setSummaryOpen(false);
    setAutoStopped(false);
    setStatus(null);
    setView('jeu');
    setLastPass(null);
    setShift(0);
    const lad = ladderStart(start);
    // sans micro, le « palier » ne bouge jamais : il ne sert qu'à porter le tempo manuel
    setLadder(lad);
    void startPass(lad.bpm);
  };

  /** Écrit la session (une seule tentative) et s'arrête. */
  const stopSession = () => {
    window.clearTimeout(relance.current);
    settleTours(true); // le tour tout juste fini compte ; celui qui vient de commencer, non
    player.current?.stop();
    const played = scored.current ? playedTours(tourRows.current) : [];
    const running = ladderRef.current;
    const lad = running && scored.current ? { ...running, passes: played.length } : running;
    const s = session.current;
    setPhase('idle');
    setLadder(null);
    if (!lad || !form || !r.position) return;
    if (scored.current) {
      setBilan(loopBilan(played));
      const text = formatTourLog(
        `Session du ${new Date(clock.now()).toLocaleString('fr-FR')} | ${r.title} | ${positionLabelPlain(r.position, settings.noteNotation)} | `
        + `départ ${lad.start} BPM | +5 toutes les ${loopEveryRef.current} (0 = fixe) | source ${inputRef.current.source} | `
        + `latence réglée ${inputRef.current.latencies[inputRef.current.source] ?? 0} ms | tolérance ${inputRef.current.centsTolerance} cents`,
        tourLogs.current.map((l) => (l.tour >= played.length ? { ...l, dropped: true } : l)),
      );
      setTourLog(text);
      setLogCopied(false);
      saveTourLog(text);
    }
    if (lad.passes === 0) {
      if (listening) setStatus('Rien à enregistrer : aucune répétition complète n’a été entendue.');
      return;
    }
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
      missedStrings: scored.current ? [...new Set(played.flatMap((t) => t.result.missedStrings))] : [...s.missed],
      tempoOk: lad.best !== null,
      pattern,
      bpmStart: lad.start,
      ...(lad.best !== null && verified ? { bpmBest: lad.best } : {}),
      passes: lad.passes,
      ...(scored.current ? { runs: sessionRuns(played) } : {}),
      fullPosition: true,
      ...(verified ? { mic: true as const } : {}),
    };
    appendAttempt(progressStore(), attempt);
    setSaved({ verified, ...(loopMode ? { loop: { reps: lad.passes, bpm: lad.bpm, clean: scored.current ? played.filter((t) => t.result.clean).length : null } } : {}) });
    setSummaryOpen(true);
  };

  // quitter la page écrit la session en cours (sinon une demi-heure de travail disparaîtrait)
  stopRef.current = stopSession;
  useEffect(() => () => {
    if (ladderRef.current) stopRef.current();
    player.current?.dispose();
    inputEngineIfAny()?.stop();
  }, []);

  // --- micro : ouverture à la demande (même chaîne que la révision)
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

  // le micro s'ouvre seul dès que le navigateur le permet ; la gamme en boucle n'écoute rien, il attend les motifs ou les liaisons
  useEffect(() => {
    if (loopMode) return;
    let cancelled = false;
    void micPermission().then((permission) => {
      if (!cancelled && canAutoOpenMic(permission, navigator.userActivation?.hasBeenActive ?? false)) setMicOn(true);
    });
    return () => { cancelled = true; };
  }, [loopMode]);

  useEffect(() => {
    if (!engine) return;
    return engine.subscribe(() => {
      const f = engine.last;
      if (f) onFrameRef.current(f);
    });
  }, [engine]);

  // --- écoute : une attaque = une note de la passe (le décompte et les clics ne comptent pas)
  const handleFrame = (f: InputFrame) => {
    // l'arrêt d'un tour décisif écoute encore : ses dernières notes arrivent après le retour de boucle
    const live = loopMode ? scored.current && (phase === 'pass' || phase === 'between') : phase === 'pass';
    if (!live || !f.stable || (!f.isNew && !f.onset)) return;
    const g = gridRef.current;
    if (!g) return;
    const perf = performance.now();
    const midi = f.stable.midi + f.stable.cents / 100;
    const eighthMs = 30_000 / g.grid.score.tempo;
    const prev = acted.current;
    if (prev && prev.midi === f.stable.midi && perf - prev.at < Math.min(400, eighthMs * 0.6)) return;
    if (clickMasked((perf - clickPerf.current) / 1000, g.grid.score.tempo, midi)) {
      if (scored.current) masked.current.push({ midi, t: (perf - (inputRef.current.latencies[inputRef.current.source] ?? 0) - passStartPerf.current) / 1000 });
      return;
    }
    acted.current = { midi: f.stable.midi, at: perf };
    lastAttack.current = perf;
    const latency = inputRef.current.latencies[inputRef.current.source] ?? 0;
    heard.current.push({ midi, t: (perf - latency - passStartPerf.current) / 1000 });
    if (scored.current) return; // jugée tour par tour (`settleTours`)
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
      setPattern: (p: SequencePattern) => { setPattern(p); setWork(isLiaison(p) ? 'liaisons' : 'motifs'); },
      setLoop: (every: number) => { setWork('gamme'); setLoopEvery(every); },
      setListen: (v: boolean) => { setLoopListen(v); if (v) setMicOn(true); },
      tours,
      lastTour,
      // un tour « joué » sans guitare, juste à temps sauf les rangs de `wrong`. Ne sert qu'aux outils de vérification.
      tourLog,
      bilan,
      feedTour: (tour: number, wrong: number[] = [], shift = 0.03) => {
        const g = gridRef.current;
        if (!g) return;
        const eighth = 30 / g.grid.score.tempo;
        lastAttack.current = performance.now();
        heard.current.push(...targets.map((t, i) => ({ midi: wrong.includes(i) ? t.midi + 1 : t.midi, t: shift + (tour * targets.length + i) * eighth })));
      },
      setBpm: (b: number) => setManualBpm(b),
      tick: () => player.current?.getTick() ?? 0,
      // une passe « jouée » sans guitare : les hauteurs attendues, à la croche, décalées de `shift` s ;
      // `stretch` > 1 = l'élève traîne (passe à tester hors tempo). Ne sert qu'aux outils de vérification.
      feedPass: (shift = 0.05, stretch = 1, wrong: number[] = []) => {
        const g = gridRef.current;
        if (!g) return;
        const eighth = 30 / g.grid.score.tempo;
        lastAttack.current = performance.now();
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
  const loopTick = loopMode && running ? player.current?.getTick() ?? 0 : null;
  const countLeft = loopTick !== null ? loopCountBeat(loopTick)
    : phase === 'countin' && g ? Math.max(1, Math.ceil((passStartPerf.current - perf) / (60_000 / g.grid.score.tempo))) : null;
  // curseur : la note attendue au micro ; sans micro, celle du temps qui passe
  const loopNote = loopTick !== null ? loopNoteIndex(loopTick, targets.length) : null;
  const cursor = phase !== 'pass' ? undefined
    : loopMode ? (loopNote === null ? undefined : targets[loopNote]?.key)
      : listening ? targets[consumed]?.key
        : g ? targets[Math.min(targets.length - 1, Math.max(0, Math.floor((perf - passStartPerf.current) / (30_000 / g.grid.score.tempo))))]?.key : undefined;
  const sessionMs = ladder ? now - session.current.startedAt : 0;

  const tab = (
    <TabView
      score={score}
      notes={settings.noteNotation}
      chords={settings.chordNotation}
      annotation="finger"
      mode="wrap"
      scale="auto"
      minScale={2}
      reduceMotion={settings.reduceMotion}
      player={null}
      transport="stopped"
      hideRhythm
      // bureau : plusieurs lignes, les motifs sont longs ; téléphone en paysage : une ligne qui suit la note
      oneLine={playing || loopMode}
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
  const workField = (
      <div className="field">
        <span className="t-label">Travail</span>
        <Segmented<Work>
          size="sm"
          label="Type de travail"
          value={loopMode ? 'gamme' : inLiaisons ? 'liaisons' : 'motifs'}
          onChange={(v) => { if (!ladder) setWork(v); }}
          options={[
            { value: 'gamme', label: 'Gamme en boucle' },
            { value: 'motifs', label: 'Motifs' },
            ...(liaisons.length > 0 ? [{ value: 'liaisons' as const, label: 'Liaisons' }] : []),
          ]}
        />
      </div>
    );
  const patternField = !loopMode && (
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
  const tempoStep = loopMode ? LOOP_STEP : 4;
  const manualTempo = (
    <div className="tempo">
      <button type="button" className="tempo-btn" onClick={() => setManualBpm((b) => Math.max(LADDER_MIN, b - tempoStep))} aria-label="Moins vite">−</button>
      <span className="tempo-val">♪ {manualBpm}</span>
      <button type="button" className="tempo-btn" onClick={() => setManualBpm((b) => Math.min(LADDER_MAX, b + tempoStep))} aria-label="Plus vite">+</button>
    </div>
  );
  const listenField = loopMode && (
    <div className="field">
      <span className="t-label">Écoute</span>
      <Segmented<'off' | 'tolerant'>
        size="sm"
        label="Écoute au micro"
        value={loopListen ? 'tolerant' : 'off'}
        onChange={(v) => { if (!ladder) { setLoopListen(v === 'tolerant'); if (v === 'tolerant') setMicOn(true); } }}
        options={[{ value: 'off', label: 'Sans micro' }, { value: 'tolerant', label: 'Tolérant' }]}
      />
    </div>
  );
  const rampField = loopMode && (
    <div className="tempo">
      <button type="button" className="tempo-btn" onClick={() => setLoopEvery((n) => Math.max(0, n - 1))} aria-label="Hausse de tempo moins fréquente">−</button>
      <span className="tempo-val">{loopEvery === 0 ? 'BPM fixe' : `+${LOOP_STEP} BPM / ${loopEvery === 1 ? 'gamme' : `${loopEvery} gammes`}`}</span>
      <button type="button" className="tempo-btn" onClick={() => setLoopEvery((n) => Math.min(LOOP_EVERY_MAX, n + 1))} aria-label="Plus de répétitions avant la hausse de tempo">+</button>
    </div>
  );
  const scoredRun = loopMode && !!ladder && scored.current;
  const untilRise = loopMode && ladder ? (scoredRun ? (loopEvery > 0 && bpm < LADDER_MAX ? loopEvery - tours.rise : null) : loopLeft(ladder, loopEvery)) : null;
  const propres = (n: number) => (n > 1 ? `${n} gammes propres` : `${n} gamme propre`);
  const riseNews = untilRise !== null && (
    <p className="t-small t-dim" role="status">+{LOOP_STEP} BPM dans {scoredRun ? propres(untilRise) : untilRise === 1 ? '1 gamme' : `${untilRise} gammes`}</p>
  );
  const tourLine = scoredRun && lastTour && (
    <p className={`seq-line ${lastTour.clean ? 'ok' : 'no'}`} role="status">
      <span className="verdict-mark" aria-hidden="true">{lastTour.clean ? '✓' : '✕'}</span>
      {lastTour.clean ? 'propre' : `${lastTour.errors} ${lastTour.errors > 1 ? 'erreurs' : 'erreur'}${lastTour.offTime > 0 ? `, ${lastTour.offTime} hors tempo` : ''}`} · série {tours.streak}
    </p>
  );
  const loopNews = (tourLine || riseNews) && <>{tourLine}{riseNews}</>;
  const countBadge = loopMode && ladder
    ? scoredRun ? `${tours.clean} / ${ladder.passes} propres` : `${ladder.passes} ${ladder.passes > 1 ? 'gammes' : 'gamme'}`
    : `${phase === 'pass' && listening ? `${consumed} / ${targets.length}` : targets.length} notes`;
  const subtitle = loopMode ? 'gamme en boucle' : `séquence ${SEQUENCE_LABEL[pattern]}${pattern === 'cycle' ? ` depuis la ${fmtDegree(start)}` : ''}`;
  const tempoHint = loopMode
    ? 'Gamme : la position monte et descend sans s’arrêter sur le métronome, au tempo de base choisi. En option, le tempo monte de 5 BPM toutes les quelques répétitions, avec un décompte avant chaque hausse. Tolérant : le micro juge chaque tour sans couper la gamme, et seuls les tours propres d’affilée font monter le tempo. Sinon, on relance au même tempo.'
    : listening ? 'Palier automatique : +4 après deux passes propres, −5 après deux échecs.' : 'Sans micro : pas de palier, la tablature et le métronome seulement.';
  const pauseNote = ladder && pauseDue(sessionMs) && (
      <p className="t-small" role="status">Dix minutes de séquences : une pause de deux minutes, main relâchée, et la précision revient.</p>
    );
  const savedNote = saved && (
      <p className="t-small" role="status">
        {saved.loop
          ? `${saved.loop.reps} ${saved.loop.reps > 1 ? 'gammes' : 'gamme'}${saved.loop.clean !== null ? ` dont ${saved.loop.clean} ${saved.loop.clean > 1 ? 'propres' : 'propre'}` : ''}, jusqu’à ${saved.loop.bpm} BPM.`
          : saved.verified
          ? 'Session enregistrée.'
          : 'Session enregistrée, non vérifiée : sans micro, l’app n’entend rien.'}
      </p>
    );
  const copyLog = () => {
    void navigator.clipboard?.writeText(tourLog).then(() => setLogCopied(true), () => {});
  };
  // journal d'analyse, à retirer une fois la détection réglée
  const tourLogPanel = loopMode && !ladder && tourLog && (
    <details className="tour-log">
      <summary className="t-small t-dim">Détail technique (développement)</summary>
      <PixelButton variant="quiet" onClick={copyLog}>{logCopied ? 'Copié' : 'Copier le détail des gammes'}</PixelButton>
      <pre tabIndex={0}>{tourLog}</pre>
    </details>
  );
  const replay = () => {
    setSummaryOpen(false);
    if (!desktop) { setPlaying(true); openLandscape(); }
    begin();
  };
  const summaryDialog = summaryOpen && saved && (
    <SessionSummary
      title={r.title}
      subtitle={`${positionLabelPlain(r.position, settings.noteNotation)} · ${subtitle}`}
      saved={saved}
      bilan={loopMode ? bilan : null}
      autoStopped={autoStopped}
      stringLabel={(s) => r.tuning.strings.length - s}
      {...(loopMode ? { onProgress: () => { setSummaryOpen(false); setView('progression'); } } : {})}
      onReplay={replay}
      onClose={() => setSummaryOpen(false)}
    />
  );
  const viewField = (
    <Segmented<'jeu' | 'progression'>
      size="sm"
      label="Vue de la page"
      value={ladder ? 'jeu' : view}
      onChange={(v) => { if (!ladder) setView(v); }}
      options={[
        { value: 'jeu', label: 'Exercice', ...(desktop ? {} : { icon: 'navMetronome' as const }) },
        { value: 'progression', label: 'Progression', ...(desktop ? {} : { icon: 'ranking' as const }) },
      ]}
    />
  );
  const progressView = view === 'progression' && !ladder;
  const progressPanel = <SequenceProgress journal={readAttempts(progressStore())} form={form} />;
  const statusNote = status && <p className="t-small numpad-feedback no" role="status">{status}</p>;
  const howScoredBody = (
    <>
      <p className="t-small">
        Une passe est réussie à ≥ 95 % de notes justes <strong>et</strong> en place : neuf notes sur dix à moins d’une
        demi-croche de leur temps (un retard constant ne compte pas, c’est la latence).
      </p>
      <p className="t-small">En tolérant, un tour de gamme est propre sans note fausse, manquée ou nettement hors tempo.</p>
      <p className="t-small t-dim">
        Une seule tentative par session au journal. Le tempo validé le plus haut sert de départ la fois suivante.
      </p>
    </>
  );
  const degrees = legendFor(r.def);
  const beginLabel = `▶ Commencer ${listening && !loopMode ? `(${startTempo(readAttempts(progressStore()), form, pattern)} BPM)` : `à ${manualBpm} BPM`}`;


  if (desktop) {
    // micro fermé, c'est lui l'action principale : Commencer garde le cyan des modes, le magenta reste unique
    const micFirst = !micOn && !ladder && !loopMode;
    const hasNews = countLeft !== null || (lastPass && !loopMode) || (!micOn && !loopMode) || ladder?.best || loopNews || (ladder && pauseDue(sessionMs)) || saved || status;
    return (
      <main className="shell play-shell">
        <div className="play-surface practice-surface">
          <PracticeHeader scale={r} current="sequences" disabled={!!ladder} />

          <div className="seq-view">{viewField}</div>
          {progressView ? progressPanel : (
          <section className="play-tab practice-tab">
            <div className="play-tab-bar">
              <div className="play-degrees" role="img" aria-label={`Couleurs des degrés : ${degrees.map((it) => it.name).join(', ')}`}>
                {degrees.map((it) => (
                  <span key={it.fn} className="legend-pill" style={{ background: it.fill, color: it.digit }}>{it.fn}</span>
                ))}
              </div>
              {workField}
              {listenField}
              {patternField}
              {startField}
              {neckPanel && <PixelButton variant="quiet" onClick={() => setNeckOpen(true)}>Vue manche</PixelButton>}
              <PositionStepper scale={r} disabled={!!ladder} />
            </div>
            <div className="practice-score"><PositionRail scale={r} disabled={!!ladder} /><div className="practice-score-body"><p className="practice-position">{positionLabelPlain(r.position!, settings.noteNotation)}</p>{tab}</div></div>
          </section>
          )}

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
              ) : lastPass && phase !== 'pass' && !loopMode ? (
                <p className={`seq-line ${lastPass.ok ? 'ok' : 'no'}`} role="status">
                  <span className="verdict-mark" aria-hidden="true">{lastPass.ok ? '✓' : '✕'}</span>
                  {Math.round(lastPass.accuracy * 100)} % · {lastPass.inTime ? 'en place' : 'pas en place'} — {lastPass.ok ? 'réussie' : 'à reprendre'}
                </p>
              ) : !micOn && !loopMode ? (
                <p className="seq-line seq-idle">Sans micro : tempo manuel, rien n’est vérifié.</p>
              ) : null}
              {ladder?.best ? <p className="t-small t-dim">validé : {ladder.best} BPM</p> : null}
              {loopNews}
              {pauseNote}
              {savedNote}
              {statusNote}
            </section>
          )}

          {tourLogPanel}
          {summaryDialog}

          <div className="practice-transport play-head">
            <div className="transport-side">
              {(loopMode || !listening) && !ladder ? manualTempo : (
                <div className="seq-tempo">
                  <span className="seq-bpm">♪ {bpm}</span>
                  {shift !== 0 && (
                    <span className={`seq-shift ${shift > 0 ? 'up' : 'down'}`} role="status">
                      {shift > 0 ? `↑ +${shift}` : `↓ ${shift}`} BPM
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="play-transport">
              {micFirst && (
                <PixelButton variant="primary" className="mic-spark" onClick={() => setMicOn(true)} disabled={micBusy}>▶ Ouvrir le micro</PixelButton>
              )}
              {ladder ? (
                <PixelButton variant="primary" onClick={stopSession}>Terminer la session</PixelButton>
              ) : (
                <PixelButton variant={micFirst ? 'ghost' : 'primary'} className={micFirst ? 'train-grid' : ''} onClick={begin} disabled={loopMode && loopListen && !listening}>{beginLabel}</PixelButton>
              )}
            </div>
            <div className="transport-side">
              {!ladder && rampField}
              <span className="badge badge-count">{countBadge}</span>
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
                  {!loopMode && <p className="t-small"><strong>Départ</strong> : le degré d’où part le tour. Ce réglage n’apparaît qu’avec le motif « tour ».</p>}
                  {startHint}
                  <p className="t-small t-dim">{tempoHint}</p>
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
        </div>
      </main>
    );
  }

  // Téléphone : comme la révision, le portrait règle et lance, la session se joue en paysage sur une ligne
  const micFirst = !micOn && !ladder && !loopMode;
  const openPlay = () => {
    setPlaying(true);
    openLandscape();
  };
  const passLine = lastPass && phase !== 'pass' && !loopMode && (
    <p className={`seq-line ${lastPass.ok ? 'ok' : 'no'}`} role="status">
      <span className="verdict-mark" aria-hidden="true">{lastPass.ok ? '✓' : '✕'}</span>
      {Math.round(lastPass.accuracy * 100)} % · {lastPass.inTime ? 'en place' : 'pas en place'} — {lastPass.ok ? 'réussie' : 'à reprendre'}
    </p>
  );
  return (
    <main className="shell mplay">
      <div className="mplay-surface">
      <PracticeHeader scale={r} current="sequences" disabled={!!ladder} />

      <div className="seq-view">{viewField}</div>
      {progressView ? progressPanel : (
      <section className="mplay-tab">
        <div className="mplay-bar">
          <PixelButton variant="primary" className="mplay-play mic-spark" onClick={openPlay}>▶ Jouer</PixelButton>
          <p className="t-small t-dim mplay-play-note">Touche Jouer : l’écran passe automatiquement en paysage, avec tous les réglages.</p>
          {micBusy && <p className="t-small t-dim">ouverture du périphérique…</p>}
          {passLine}
          {savedNote}
          {statusNote}
          {tourLogPanel}
        </div>
        {neckPanel}
      </section>
      )}
      {summaryDialog}

      <div className="mplay-more">
        <PixelButton variant="quiet" onClick={() => setInfoOpen((o) => !o)}>
          {infoOpen ? '▾ Masquer les détails' : '▸ Détails de la séquence'}
        </PixelButton>
      </div>

      {infoOpen && (
        <div className="mplay-details">
          <Panel className="span-12" label="Séquence">
            {liaisons.length > 0 && (
              <p className="t-small"><strong>Travail</strong> : ce que tu entraînes. Motifs : une figure qui se répète à l’intérieur de la position. Liaisons : le passage d’une position à une autre.</p>
            )}
            {inLiaisons ? (
              <p className="t-small"><strong>Liaison</strong> : le trajet sur le manche. Deux positions : monter dans l’une, descendre dans la voisine. Traversée : toutes les positions d’un seul trait, du bas au haut du manche. Position étendue : la position, plus les notes de la suivante sur les deux cordes aiguës.</p>
            ) : (
              <p className="t-small"><strong>Motif</strong> : la figure jouée, en montant puis en descendant. Par 3 et par 4 : des groupes de 3 ou 4 notes voisines, qui repartent une note plus haut (1 2 3, 2 3 4…). Tierces : une note, puis celle d’après la suivante (1 3, 2 4…). Quartes : une note, puis la troisième d’après (1 4, 2 5…). Saut de corde : une corde, puis celle d’après la suivante. Tour : toute la position, depuis le degré de ton choix.</p>
            )}
            {!loopMode && <p className="t-small"><strong>Départ</strong> : le degré d’où part le tour. Ce réglage n’apparaît qu’avec le motif « tour ».</p>}
            {startHint}
            <p className="t-small t-dim">{tempoHint}</p>
            {micOn && <PixelButton variant="quiet" onClick={() => setMicOn(false)}>Fermer le micro</PixelButton>}
          </Panel>
          <Panel className="span-12" label="Comment c’est noté ?">{howScoredBody}</Panel>
        </div>
      )}
      </div>

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
                {listenField}
                {patternField}
                {startField}
                {(loopMode || !listening) && manualTempo}
                {rampField}
                {micFirst && <PixelButton variant="primary" className="mic-spark" onClick={() => setMicOn(true)} disabled={micBusy}>▶ Ouvrir le micro</PixelButton>}
                <PixelButton variant={micFirst ? 'ghost' : 'primary'} onClick={begin} disabled={loopMode && loopListen && !listening}>{beginLabel}</PixelButton>
              </>
            )}
            <span className="tab-full-title">{ladder ? SEQUENCE_LABEL[pattern] : ''}</span>
            {ladder && (
              <div className="seq-tempo">
                <span className="seq-bpm">♪ {bpm}</span>
                {shift !== 0 && <span className={`seq-shift ${shift > 0 ? 'up' : 'down'}`} role="status">{shift > 0 ? `↑ +${shift}` : `↓ ${shift}`}</span>}
              </div>
            )}
            <span className="badge badge-count">{countBadge}</span>
          </div>
          <div className="land-body">{tab}</div>
          {countLeft !== null ? (
            <p className="land-status land-count" aria-live="assertive">{countLeft}</p>
          ) : (passLine || loopNews || pauseNote || statusNote) && (
            <div className="land-status">{passLine}{loopNews}{pauseNote}{statusNote}</div>
          )}
        </LandscapeView>
      )}
    </main>
  );
}
