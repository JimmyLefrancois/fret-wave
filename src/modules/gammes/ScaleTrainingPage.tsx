/**
 * Module Gammes — niveaux 2 « Mémorisation » et 3 « Rappel » (BRIEF.md §2, MUSIC_DESIGN §3.4, §13).
 *
 * Un seul écran pour les deux niveaux, parce que la mécanique est la même : **des trous dans une
 * tablature réelle**, que l'élève comble en jouant, micro ouvert. Ce qui change :
 *  - N2 masque une part des notes (réglable 20 / 35 / 50 %, au moins 2 trous, jamais toutes) ;
 *  - N3 masque **tout** (la tablature ne donne que les cordes, les mesures et le rythme) et chronomètre.
 *
 * Trois ajouts de la seconde passe de la phase 2 :
 *  - **grille rythmique** : le métronome de la 1c joue un temps par trou, sans jouer une seule note
 *    (score de silences) ; finir dans la grille et juste à ≥ 95 % vaut ★★, parfait sans erreur vaut ★★★ ;
 *  - **session mélangée** (interleaving) : 3 à 5 formes différentes enchaînées, calculées depuis le
 *    journal, sans repasser par le hub ;
 *  - le taux de trous et le tempo sont des réglages (`settings.holeRate`, `settings.trainingTempo`).
 *
 * Une tentative n'est enregistrée qu'une fois la série terminée, avec les trous justes **au premier
 * essai** : c'est la seule mesure honnête de ce que l'élève sait déjà. Une case révélée après deux
 * erreurs compte comme fausse.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { clearTrainingStart, peekTrainingStart, setScaleSelection, useScaleSelection } from '../../app/scaleSession';
import { openStep } from '../../app/openStep';
import { dailySession } from '../../app/hubPlan';
import { MAX_TEMPO, MIN_TEMPO, setSettings, useSettings } from '../../app/settings';
import { TabView } from '../../app/TabView';
import { NeckView } from '../../app/NeckView';
import { Panel, PixelButton, Segmented, Switch } from '../../app/ui';
import { MicStrip } from '../../app/MicStrip';
import { ensureInputEngine, inputEngineIfAny, windowFor } from '../../app/inputSession';
import { AudioEngine } from '../../core/audio/engine';
import { describeInputError, type InputEngine, type InputFrame } from '../../core/input/engine';
import { matchPitch, noteNameOf, targetsFor, type MatchVerdict } from '../../core/input/match';
import { useInputSettings } from '../../core/input/settings';
import { fmtNote, type NoteName } from '../../core/theory';
import { neckNotes, positionToScore } from '../../core/tab';
import { TabPlayer } from '../../core/audio/tabPlayer';
import {
  appendAttempt, newAttemptId, nodeIdOf, progressStore, readAttempts, stateLabel, streak, summarizeDay,
  summarizeNodes, xpForAttempt, xpSummary,
  type Attempt, type AttemptLevel, type NodeStats,
} from '../../core/progress';
import { capStep, missingText, type FormStep } from './curriculum';
import { degreeName, fmtDegree, legendFor, positionLabelPlain, resolveScale } from './resolve';
import { TabLegend } from './TabLegend';
import { InstrumentPicker } from '../../app/AudioControls';
import { LevelsNav } from './LevelsNav';
import { PlaySection } from './PlaySection';
import { useDesktop } from '../../app/useDesktop';
import { LandscapeView, openLandscape } from '../../app/LandscapeView';
import { canAutoOpenMic, micPermission } from '../../core/input/autoOpen';
import { Celebration } from './Celebration';
import {
  SEGMENTS, buildExercise, resumedStart, clickMasked, insideGrid, endScreenFor, nextStepFor, STEP_LABEL, type StepKind, missedSummary, mulberry32, segmentPlan, starsFor, stepOpen, tempoGrid, withRevealed,
  type GridOutcome, type GridSubdivision, type Segment,
} from './exercise';
import { REVIEW_MAX, buildReviewQueue, moreDue, sessionFact, type ReviewTarget } from './review';
import { coldNext, countsAsProof, lookRemaining, retryLine, type ColdStep } from './coldReview';
import { blindGrid, countInBeat, scoreBlind, type BlindGrid, type HeardNote } from './blind';
import * as clock from '../../core/clock';

type HoleMark = 'right' | 'revealed';

interface Result {
  accuracy: number;
  stars: number;
  xp: number;
  seconds: number;
  revealed: number;
  errors: number;
  grid: GridOutcome;
  /** La tentative vaut-elle preuve ? (`false` : rattrapage, écrit `afterReveal`) */
  proof: boolean;
}

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * État de la forme en une phrase, là où l'élève le lit : ce qui manque pour « apprise », ou pour la vitesse.
 * La maîtrise se recalcule depuis le journal : si les règles changent, cette phrase dit ce qui compte.
 */
function formStateLine(n: NodeStats | null, speedTarget: number): string {
  if (!n) return 'Cette forme : jamais vérifiée. « Apprise » = 2 réussites sur 2 jours, dont une sur la position entière, de mémoire (Niv3) ou au micro.';
  if (n.state === 'learning' || n.state === 'available') {
    return `Cette forme : en apprentissage. Pour « apprise », il manque ${missingText(n)}.`;
  }
  if (n.state === 'learned') return 'Cette forme : apprise. « Maîtrisée » viendra avec la révision tenue à 16 jours.';
  return `Cette forme : ${stateLabel(n)}.`
    + (n.speedVerified ? '' : ` Pour la vitesse : de mémoire (Niv3), au micro, grille en croches tenue à ${speedTarget} BPM, ≥ 95 %.`);
}

function starRow(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

export function ScaleTrainingPage({ initialMixed = false }: { initialMixed?: boolean } = {}) {
  const wide = useDesktop();
  // la série se joue en paysage ; un grand téléphone y dépasse 900 px, sans changer de rendu pour autant
  const [playing, setPlaying] = useState(false);
  const desktop = wide && !playing;
  const closePlay = useCallback(() => setPlaying(false), []);
  const [infoOpen, setInfoOpen] = useState(false);
  const settings = useSettings();
  const selection = useScaleSelection();
  const r = useMemo(() => resolveScale(selection, settings.noteNotation), [selection, settings.noteNotation]);
  // départ demandé par la séance du jour (« Avancer : Position 3, de mémoire ») ; sinon N2
  const [start] = useState(peekTrainingStart);
  useEffect(() => clearTrainingStart(), []);
  // la gamme de l'élève avant la séance de révision (qui change de forme, voire de tonique) : on y revient à la fin
  const homeSelection = useRef(selection);

  const [level, setLevel] = useState<AttemptLevel>(start?.level ?? 2);
  // par défaut, la position entière en aller-retour : c'est la gamme qu'on joue, pas un fragment
  const [segment, setSegment] = useState<Segment>(start?.segment ?? 'updown');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [marks, setMarks] = useState<Record<string, HoleMark>>({});
  const [errors, setErrors] = useState<Record<string, number>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [entry, setEntry] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string; info?: true } | null>(null);
  // erreur d'ouverture du micro : affichée à côté du bouton qui l'a provoquée, pas dans le verdict
  const [micError, setMicError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => clock.now());
  const [result, setResult] = useState<Result | null>(null);
  const [journal, setJournal] = useState<Attempt[]>(() => readAttempts(progressStore()));
  /** Panneau de réussite : ouvert à la fin d'une série, refermé par « Continuer » ou Échap. */
  const [celebrate, setCelebrate] = useState(false);
  // téléphone : le verdict (« non — réessaie… ») est caché sous la barre de réponse ; on l'y montre ~1,6 s
  // le résultat prend le focus (et s'annonce) dès qu'aucun écran de fin ne le recouvre
  const resultRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (result && !celebrate) resultRef.current?.focus();
  }, [result, celebrate]);

  // --- grille rythmique
  const [grid, setGrid] = useState<'off' | 'running' | 'over'>('off');
  const gridStart = useRef(0);
  const player = useRef<TabPlayer | null>(null);
  if (player.current === null) player.current = new TabPlayer();

  // --- session mélangée
  const [mixed, setMixed] = useState(initialMixed);
  const [queue, setQueue] = useState<ReviewTarget[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [sessionDone, setSessionDone] = useState<{ forms: number; accuracy: number; xp: number; retries: number } | null>(null);
  // la page Révision a trouvé une file vide : état vide explicite (pas d'exercice sur la forme courante)
  const [emptyReview, setEmptyReview] = useState(false);
  // dues restantes à la fin d'une séance (« Encore 3 formes dues »)
  const moreDueNow = sessionDone ? moreDue(journal, clock.now()) : 0;
  // et après les révisions : l'étape suivante de la séance du jour, sur la gamme de l'élève (D98)
  const afterStep = useMemo(() => {
    if (!sessionDone) return null;
    const home = resolveScale(homeSelection.current).selection;
    const s = dailySession(journal, clock.now(), { ...home, tonic: home.tonic as NoteName });
    if (s.next) return { step: s.next, text: `Ensuite : ${s.next.label.replace(' · ', ', ')}`, action: s.next.again ? '▶ Revoir la forme' : s.next.level === 1 ? '▶ Écouter' : '▶ Avancer' };
    if (s.cap) return { step: capStep(s.cap), text: `Nouveau défi : ${s.cap.title}`, action: `▶ Découvrir ${s.cap.name}` };
    return null;
  }, [sessionDone, journal]);
  // accumulateur de session : une ref, pour que le bilan soit juste dès le dernier clic (pas un rendu plus tard)
  const sessionAcc = useRef({ forms: 0, accuracy: 0, xp: 0, retries: 0 });
  /**
   * Rappel à froid (carte due) : `cold` = essai qui compte ; `look` = « Regarde la forme » ; `retry` =
   * rattrapage écrit `afterReveal` ; `next` = fini pour cette forme. `null` hors rappel à froid.
   */
  const [coldStep, setColdStep] = useState<ColdStep | null>(null);
  const [lookStart, setLookStart] = useState<number | null>(null);
  /** « Refaire celle-ci » en révision : la forme vient d'être montrée, l'essai ne prouve plus rien. */
  const [retake, setRetake] = useState(false);
  // --- série à l'aveugle (N3 au micro) : aucune tablature dessinée pendant le jeu
  const [blindOn, setBlindOn] = useState(false);
  const [blindPhase, setBlindPhase] = useState<'idle' | 'countin' | 'running'>('idle');
  const blindHeard = useRef<HeardNote[]>([]);
  /** Instant (horloge `performance`) du premier temps de la série, après le décompte. */
  const blindStartPerf = useRef(0);
  /** Instant du premier clic (décompte compris) : les clics tombent sur des temps comptés d'ici. */
  const blindClickPerf = useRef(0);
  const blindGridRef = useRef<BlindGrid | null>(null);
  /** Attaques écartées par le masque des clics (diagnostic du crochet de développement). */
  const blindMasked = useRef<{ midi: number; t: number }[]>([]);
  const blindLive = blindPhase !== 'idle';
  const proofless = (coldStep !== null && !countsAsProof(coldStep) && coldStep !== 'next') || (mixed && retake);
  const coldActive = coldStep === 'cold' || coldStep === 'retry';

  // --- micro (phase 3) : jouer la note au lieu de taper la case
  const input = useInputSettings();
  const [micOn, setMicOn] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [engine, setEngine] = useState<InputEngine | null>(null);
  const [micState, setMicState] = useState<string>('idle');
  const inputRef = useRef(input);
  inputRef.current = input;
  const tuningIdRef = useRef(r.tuning.id);
  tuningIdRef.current = r.tuning.id;
  const onFrameRef = useRef<(f: InputFrame) => void>(() => {});
  /** Dernière note validée au micro (horloge `performance`, latence retranchée). */
  const lastNotePerf = useRef<number | null>(null);
  const gridStartPerf = useRef(0);
  /** Une case validée au pavé pendant la série : la série n'est plus « au micro ». */
  const padUsed = useRef(false);
  /** Cases remplies en jouant (micro). */
  const micFills = useRef(0);
  /** Anti-rebond : une même hauteur ne produit qu'un verdict toutes les 400 ms. */
  const actedRef = useRef<{ midi: number; at: number } | null>(null);

  const plan = useMemo(() => (r.position ? segmentPlan(r.position, segment) : null), [r.position, segment]);
  // « Regarde la forme » : la position entière sur le manche (mémoïsée : l'écran se redessine chaque seconde)
  const lookNeck = useMemo(
    () => (r.position ? { notes: neckNotes(r.position, 'degree', settings.noteNotation), zone: { from: r.position.fretMin, to: r.position.fretMax } } : null),
    [r.position, settings.noteNotation],
  );

  const baseScore = useMemo(() => {
    if (!plan) return null;
    try {
      return positionToScore(plan.position, r.tuning, {
        direction: plan.direction,
        fingers: true,
        labelText: positionLabelPlain(r.position, settings.noteNotation),
        ...(r.chord ? { chord: r.chord } : {}),
      });
    } catch {
      return null;
    }
  }, [plan, r.tuning, r.position, r.chord, settings.noteNotation]);

  const exercise = useMemo(() => {
    if (!baseScore) return null;
    return buildExercise(baseScore, level as 2 | 3, level === 2 ? { ratio: settings.holeRate, rng: mulberry32(seed) } : {});
  }, [baseScore, level, seed, settings.holeRate]);

  const revealed = useMemo(() => new Set(Object.keys(marks)), [marks]);
  // révélées sans avoir été trouvées : contour pointillé, pour revoir où l'on a raté
  const missed = useMemo(() => new Set(Object.keys(marks).filter((k) => marks[k] === 'revealed')), [marks]);
  const display = useMemo(() => (exercise ? withRevealed(exercise.score, revealed, missed) : null), [exercise, revealed, missed]);
  const formNode = useMemo(() => {
    if (!r.position) return null;
    const id = nodeIdOf({ scaleId: r.def.id, system: r.selection.system, formIndex: r.position.formIndex ?? r.position.index });
    return summarizeNodes(journal, { speedTargetBpm: settings.speedTargetBpm }).find((n) => n.nodeId === id) ?? null;
  }, [journal, r, settings.speedTargetBpm]);

  const done = Object.keys(marks).length;
  const total = exercise?.total ?? 0;
  const activeHole = useMemo(() => exercise?.holes.find((h) => h.key === activeKey) ?? null, [exercise, activeKey]);
  const stopGrid = useCallback(() => {
    player.current?.stop();
    setGrid('off');
  }, []);

  // --- remise à zéro quand la cible change (gamme, position, niveau, segment, trous)
  useEffect(() => {
    setMarks({});
    setErrors({});
    setActiveKey(null);
    setEntry('');
    setFeedback(null);
    setStartedAt(null);
    setResult(null);
    lastNotePerf.current = null;
    actedRef.current = null;
    padUsed.current = false;
    micFills.current = 0;
    blindHeard.current = [];
    setBlindPhase('idle');
    player.current?.stop();
    setGrid('off');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.scaleId, selection.tonic, selection.tuningId, selection.system, selection.positionIndex, level, segment, seed]);

  // une session mélangée demandée par l'URL démarre tout de suite (une seule fois) —
  // déclarée après la remise à zéro, qui sinon effaçait « aucune forme à réviser » au montage
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!initialMixed || autoStarted.current) return;
    autoStarted.current = true;
    startMixed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMixed]);

  useEffect(() => {
    if (startedAt === null || result) return;
    const t = window.setInterval(() => setNow(clock.now()), 250);
    return () => window.clearInterval(t);
  }, [startedAt, result]);

  useEffect(() => {
    const p = player.current!;
    return () => p.dispose();
  }, []);

  const touch = () => {
    if (startedAt !== null) return;
    // `now` n'avance qu'au tick de 250 ms : sans ce rafraîchissement, le chrono affiche « -1:-2 » au premier appui
    const t = clock.now();
    setStartedAt(t);
    setNow(t);
  };

  const startGrid = async () => {
    if (total === 0 || grid === 'running') return;
    const p = player.current!;
    const g = tempoGrid(total, settings.trainingTempo, settings.gridSubdivision);
    try {
      await p.init(); // en premier : reprend le contexte audio dans le geste
      await p.load(g.score, { loop: false });
      p.setMetronome(true);
      p.onEnded = () => {
        // la grille est finie : la suite se juge sans bonus de tempo
        setGrid('over');
      };
      await p.play();
      gridStart.current = performance.now();
      gridStartPerf.current = performance.now();
      lastNotePerf.current = null;
      // le chrono repart de la grille : sinon une grille lancée puis abandonnée compte dans la tentative
      setStartedAt(clock.now());
      setGrid('running');
      setFeedback(null);
    } catch (e) {
      setFeedback({ ok: false, text: `métronome indisponible : ${(e as Error).message}` });
      setGrid('off');
    }
  };

  // fermer la vue de jeu avant la fin remet la série à zéro. Exception : à froid, recommencer effacerait les
  // cases révélées et fausserait le seul essai qui compte ; la série se met en pause (chrono, métronome coupé).
  const pausedAt = useRef<number | null>(null);
  const wasPlaying = useRef(false);
  useEffect(() => {
    const closed = wasPlaying.current && !playing;
    wasPlaying.current = playing;
    if (!closed || result) return;
    if (!coldActive) {
      restart();
      return;
    }
    if (startedAt !== null) pausedAt.current = clock.now();
    if (grid !== 'running') return;
    stopGrid();
    if (Object.keys(marks).length === 0 && Object.keys(errors).length === 0) setStartedAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  /** Série à l'aveugle : une mesure de décompte, puis la grille ; la tablature n'est plus dessinée. */
  const startBlind = async () => {
    if (!exercise || total === 0 || blindLive || micState !== 'listening') return;
    const p = player.current!;
    const bg = blindGrid(total, settings.trainingTempo, settings.gridSubdivision);
    try {
      await p.init();
      await p.load(bg.score, { loop: false });
      p.setMetronome(true);
      p.onEnded = null;
      await p.play();
      const t0 = performance.now();
      blindClickPerf.current = t0;
      blindStartPerf.current = t0 + bg.countIn * 1000;
      blindGridRef.current = bg;
      blindHeard.current = [];
      blindMasked.current = [];
      actedRef.current = null;
      setMarks({});
      setErrors({});
      setFeedback(null);
      setStartedAt(clock.now());
      setNow(clock.now());
      setBlindPhase('countin');
    } catch (e) {
      setFeedback({ ok: false, text: `métronome indisponible : ${(e as Error).message}` });
    }
  };

  // décompte puis série : l'horloge de l'écran avance, la phase suit
  useEffect(() => {
    if (!blindLive) return;
    const t = window.setInterval(() => {
      setNow(clock.now());
      if (performance.now() >= blindStartPerf.current) setBlindPhase('running');
    }, 100);
    return () => window.clearInterval(t);
  }, [blindLive]);

  /** Fin de la série à l'aveugle (toutes les notes jouées, ou « Terminer ») : verdict d'un coup. */
  function finishBlind() {
    const bg = blindGridRef.current;
    if (!exercise || !bg) return;
    player.current?.stop();
    const sc = scoreBlind(targetsFor(exercise.holes, r.tuning), blindHeard.current, { centsTolerance: input.centsTolerance, finished: true });
    const finalMarks: Record<string, HoleMark> = {};
    const errorCount: Record<string, number> = {};
    for (const h of exercise.holes) {
      if (sc.marks[h.key] === 'right') finalMarks[h.key] = 'right';
      else {
        finalMarks[h.key] = 'revealed';
        errorCount[h.key] = 1;
      }
    }
    const kept = sc.lastAttack !== null && insideGrid(sc.lastAttack, bg.grid);
    setBlindPhase('idle');
    setMarks(finalMarks);
    setErrors(errorCount);
    setFeedback({
      ok: sc.correct === sc.total,
      text: `à l’aveugle : ${sc.correct} justes sur ${sc.total} · tempo : ${kept ? 'grille tenue' : 'hors grille'}`,
    });
    finish(finalMarks, errorCount, { grid: kept ? 'kept' : 'missed', npm: bg.grid.npm });
  }

  const nextOpen = useCallback((after: string | null, dir: 1 | -1 = 1): string | null => {
    if (!exercise) return null;
    return stepOpen(exercise.holes.map((h) => h.key), (k) => !marks[k], after, dir);
  }, [exercise, marks]);

  // un trou est toujours désigné : sans lui, les chiffres tapés au clavier ne vont nulle part
  useEffect(() => {
    // série finie : plus de trou désigné (son cadre restait dessiné sur la dernière étiquette)
    if (result) {
      if (activeKey !== null) setActiveKey(null);
      return;
    }
    if (!exercise || blindLive || activeKey !== null) return;
    const first = nextOpen(null);
    if (first) setActiveKey(first);
  }, [exercise, result, blindLive, activeKey, nextOpen]);

  const finish = useCallback((
    finalMarks: Record<string, HoleMark>, errorCount: Record<string, number>,
    blindResult?: { grid: GridOutcome; npm: number },
  ) => {
    if (!exercise || !plan || !r.position) return;
    const right = Object.values(finalMarks).filter((m) => m === 'right').length;
    const totalHoles = exercise.total;
    const accuracy = totalHoles > 0 ? right / totalHoles : 0;
    const revealedCount = Object.values(finalMarks).filter((m) => m === 'revealed').length;
    const errorTotal = Object.values(errorCount).reduce((s, v) => s + v, 0);
    const seconds = startedAt ? Math.round((clock.now() - startedAt) / 1000) : 0;
    // grille tenue ? (finie avant la fin du métronome, tolérance d'un dixième de temps)
    // au micro, le temps de jeu est celui de l'attaque de la dernière note, latence mesurée retranchée ;
    // au pavé, c'est le temps de saisie (inchangé depuis la phase 2).
    const playedSeconds = lastNotePerf.current !== null && gridStartPerf.current > 0
      ? (lastNotePerf.current - gridStartPerf.current) / 1000
      : seconds;
    const gridOutcome: GridOutcome = blindResult ? blindResult.grid : grid === 'off' ? 'off' : grid === 'running' && insideGrid(playedSeconds, tempoGrid(totalHoles, settings.trainingTempo, settings.gridSubdivision)) ? 'kept' : 'missed';
    if (grid !== 'off') stopGrid();
    const attempt: Attempt = {
      id: newAttemptId(clock.now(), nodeIdOf({ scaleId: r.def.id, system: r.selection.system, formIndex: r.position.formIndex ?? r.position.index }), readAttempts(progressStore()).length),
      ts: clock.now(),
      kind: level >= 3 ? 'recall' : 'holes',
      scaleId: r.def.id,
      tonic: r.tonic,
      tuningId: r.tuning.id,
      system: r.selection.system,
      positionId: r.position.id,
      formIndex: r.position.formIndex ?? r.position.index,
      level: level as AttemptLevel,
      strings: plan.strings,
      correct: right,
      total: totalHoles,
      seconds,
      fretMin: plan.position.fretMin,
      // diagnostic par corde : les trous qui ont coûté une erreur (ou une révélation)
      missedStrings: [...new Set(Object.keys(errorCount).map((k) => Number(k.split(':')[1] ?? 0)).filter((s) => Number.isInteger(s)))],
      tempoOk: gridOutcome === 'kept',
      ...(proofless ? { afterReveal: true as const } : {}),
      // au micro = toutes les cases trouvées l'ont été en jouant (aucune au pavé)
      ...((!padUsed.current && micFills.current > 0) || blindResult ? { mic: true as const } : {}),
      ...(segment === 'all' || segment === 'updown' ? { fullPosition: true as const } : {}),
      ...(blindResult
        ? { gridNpm: blindResult.npm, blind: true as const }
        : grid !== 'off' ? { gridNpm: tempoGrid(totalHoles, settings.trainingTempo, settings.gridSubdivision).npm } : {}),
    };
    setJournal(appendAttempt(progressStore(), attempt));
    const res: Result = {
      accuracy,
      stars: starsFor(accuracy, revealedCount, errorTotal, gridOutcome),
      xp: xpForAttempt(attempt),
      seconds,
      revealed: revealedCount,
      errors: errorTotal,
      grid: gridOutcome,
      proof: !proofless,
    };
    setResult(res);
    // la session n'agrège que les essais qui prouvent : un rattrapage ne remonte pas la moyenne
    if (mixed && res.proof) {
      const acc = sessionAcc.current;
      const forms = acc.forms + 1;
      sessionAcc.current = { ...acc, forms, accuracy: (acc.accuracy * acc.forms + res.accuracy) / forms, xp: acc.xp + res.xp };
    } else if (mixed && coldStep === 'retry') {
      // le bilan dit combien de rattrapages ont suivi « Regarde la forme » (constat 5)
      sessionAcc.current = { ...sessionAcc.current, retries: sessionAcc.current.retries + 1 };
    }
    if (coldStep === 'cold' || coldStep === 'retry') setColdStep(coldNext(coldStep, { type: 'finished', accuracy }));
    // réussite = la fête ; échec = un écran calme (la série a une fin visible) ; rattrapage = rien
    if (endScreenFor(res.stars, res.proof, mixed)) setCelebrate(true);
  }, [exercise, plan, r, level, segment, startedAt, grid, settings.trainingTempo, settings.gridSubdivision, stopGrid, proofless, mixed, coldStep]);

  /** Réponse juste : la pastille reprend sa couleur, le curseur passe au trou suivant. */
  const applyRight = useCallback((key: string, cents: number | null) => {
    const hole = exercise?.holes.find((h) => h.key === key);
    if (!hole) return;
    touch();
    const nextMarks = { ...marks, [key]: 'right' as HoleMark };
    setMarks(nextMarks);
    setActiveKey(nextOpen(key));
    setFeedback({
      ok: true,
      text: `${fmtNote(hole.note, settings.noteNotation)} · ${fmtDegree(hole.fn)} (${degreeName(hole.fn)})`
        + (cents === null ? '' : ` · ${cents > 0 ? '+' : ''}${cents.toFixed(0)} ¢`)
        + ' — juste',
    });
    if (Object.keys(nextMarks).length === total) {
      setFeedback(null); // la série est finie : le dernier verdict ne reste pas affiché sous le résultat
      finish(nextMarks, errors);
    }
  }, [exercise, marks, nextOpen, settings.noteNotation, total, finish, errors]);

  /**
   * Réponse fausse : la 2ᵉ erreur révèle la case (comptée fausse). `heard` = note réellement jouée
   * (micro), affichée telle quelle : c'est l'information que le pavé ne peut pas donner.
   */
  const applyWrong = useCallback((key: string, heard: string | null) => {
    const hole = exercise?.holes.find((h) => h.key === key);
    if (!hole) return;
    touch();
    setActiveKey(key);
    const count = (errors[key] ?? 0) + 1;
    const nextErrors = { ...errors, [key]: count };
    setErrors(nextErrors);
    const heardText = heard ? `tu joues ${heard} · ` : '';
    if (count >= 2) {
      const nextMarks = { ...marks, [key]: 'revealed' as HoleMark };
      setMarks(nextMarks);
      setFeedback({ ok: false, text: `${heardText}c’était ${hole.fret} (case révélée)` });
      setActiveKey(nextOpen(key));
      if (Object.keys(nextMarks).length === total) {
        setFeedback(null);
        finish(nextMarks, nextErrors);
      }
    } else {
      setFeedback({ ok: false, text: `${heardText}non — réessaie (encore une erreur et je révèle la case)` });
    }
  }, [exercise, errors, marks, nextOpen, total, finish]);

  const validate = useCallback(() => {
    if (!activeHole || entry === '') return;
    const value = Number(entry);
    setEntry('');
    padUsed.current = true;
    if (value === activeHole.fret) applyRight(activeHole.key, null);
    else applyWrong(activeHole.key, null);
  }, [activeHole, entry, applyRight, applyWrong]);

  /** Verdict du micro : remplit, explique, ou ne compte rien (octave douteuse, accord, hors exercice). */
  const applyVerdict = useCallback((v: MatchVerdict, heardMidi: number) => {
    switch (v.kind) {
      case 'fill': {
        const latency = inputRef.current.latencies[inputRef.current.source] ?? 0;
        lastNotePerf.current = performance.now() - latency;
        micFills.current += 1;
        applyRight(v.target.key, v.cents);
        break;
      }
      case 'tuning':
        setFeedback({
          ok: false,
          text: `${Math.abs(v.cents).toFixed(0)} cents ${v.cents > 0 ? 'haut' : 'bas'} : ce n’est pas ta mémoire, c’est l’accord — passe par l’accordeur.`,
        });
        break;
      case 'octave':
        setFeedback({
          ok: false,
          text: 'une octave d’écart avec la case visée (le micro se trompe parfois d’octave sur les cordes graves) : rejoue la note seule, un peu plus fort.',
        });
        break;
      case 'wrong':
        applyWrong(v.target.key, fmtNote(noteNameOf(v.heardMidi), settings.noteNotation));
        break;
      case 'outside':
        setFeedback({ ok: false, text: `entendu ${fmtNote(noteNameOf(heardMidi), settings.noteNotation)} : cette note n’est pas dans l’exercice.` });
        break;
      case 'empty':
        break;
    }
  }, [applyRight, applyWrong, settings.noteNotation]);

  /** Une fenêtre du micro : on ne juge qu'une note stable, et une seule fois par attaque. */
  const handleFrame = (f: InputFrame) => {
    if (result || !exercise || !r.position) return;
    const note = f.stable;
    if (!note) return;
    if (!f.isNew && !f.onset) return;
    const now = performance.now();
    const prev = actedRef.current;
    if (prev && prev.midi === note.midi && now - prev.at < 400) return;
    if (blindLive) {
      // à l'aveugle : on écoute, on ne dit rien. Le décompte et les clics ne comptent pas.
      const bg = blindGridRef.current;
      if (!bg || now < blindStartPerf.current - 60) return;
      if (clickMasked((now - blindClickPerf.current) / 1000, bg.grid.score.tempo, note.midi + note.cents / 100)) {
        blindMasked.current.push({ midi: note.midi, t: (now - blindStartPerf.current) / 1000 });
        return;
      }
      actedRef.current = { midi: note.midi, at: now };
      const latency = inputRef.current.latencies[inputRef.current.source] ?? 0;
      blindHeard.current.push({ midi: note.midi + note.cents / 100, t: (now - latency - blindStartPerf.current) / 1000 });
      const sc = scoreBlind(targetsFor(exercise.holes, r.tuning), blindHeard.current, { centsTolerance: input.centsTolerance });
      if (sc.consumed >= exercise.holes.length) finishBlind();
      return;
    }
    // masque des clics du métronome : le micro les entend comme une attaque
    if (grid === 'running' && clickMasked((now - gridStartPerf.current) / 1000, settings.trainingTempo, note.midi + note.cents / 100)) return;
    const open = exercise.holes.filter((h) => !marks[h.key]);
    if (open.length === 0) return;
    const targets = targetsFor(open, r.tuning);
    const verdict = matchPitch(note.midi + note.cents / 100, targets, {
      centsTolerance: input.centsTolerance,
      activeKey,
    });
    actedRef.current = { midi: note.midi, at: now };
    if (verdict.kind === 'fill' || verdict.kind === 'tuning' || verdict.kind === 'empty') {
      applyVerdict(verdict, note.midi);
      return;
    }
    // Une note du segment qui n'est pas un trou (visible, ou déjà trouvée) n'est **jamais** une
    // erreur : c'est ainsi qu'un élève se repère avant de viser la case. Le test porte sur le score
    // affiché : un trou encore vide y est `hidden`, une note écrite ne l'est pas.
    const written = display?.measures
      .flatMap((m) => m.events.flatMap((e) => e.notes))
      .find((n) => !n.muted && !n.hidden && n.midi === note.midi);
    if (written) {
      setFeedback({ ok: true, info: true, text: `${fmtNote(noteNameOf(note.midi), settings.noteNotation)} est déjà écrite dans ce segment — vise un emplacement vide.` });
      return;
    }
    applyVerdict(verdict, note.midi);
  };

  const press = useCallback((d: string) => {
    touch();
    setEntry((e) => (e.length >= 2 ? e : `${e}${d}`));
  }, [startedAt]);

  // après le résultat : Entrée rejoue (hors session mélangée, hors écran de fin, hors bouton focalisé)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (result && e.key === 'Enter' && !mixed && !celebrate && !(t && t.closest('button, a, summary, input, select, textarea'))) {
        e.preventDefault();
        restart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, mixed, celebrate]);

  // --- micro : ouverture à la demande, fermeture en quittant l'écran
  useEffect(() => {
    if (!micOn) {
      engine?.stop();
      setMicState('idle');
      setBlindOn(false);
      return;
    }
    let cancelled = false;
    setMicBusy(true);
    setMicError(null);
    void (async () => {
      try {
        await AudioEngine.get().unlock(); // dans le geste qui a basculé l'interrupteur
        const e = await ensureInputEngine();
        if (cancelled) return;
        setEngine(e);
        await e.start(inputRef.current, { windowSize: windowFor(tuningIdRef.current) });
        if (cancelled) {
          e.stop();
          return;
        }
        setMicState(e.state);
        if (e.state !== 'listening') {
          const info = describeInputError(e.state, e.error);
          setMicError(`${info.message} — ${info.hint}`);
          setMicOn(false);
        }
      } catch (err) {
        if (!cancelled) {
          setMicError(`le micro n’a pas pu s’ouvrir — réessaie. (navigateur : ${(err as Error).message})`);
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

  // le micro est le seul moyen de répondre : il s'ouvre seul dès que le navigateur le permet
  useEffect(() => {
    let cancelled = false;
    void micPermission().then((permission) => {
      if (!cancelled && canAutoOpenMic(permission, navigator.userActivation?.hasBeenActive ?? false)) setMicOn(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!engine) return;
    const unsub = engine.subscribe(() => {
      const f = engine.last;
      if (f) onFrameRef.current(f);
    });
    return unsub;
  }, [engine]);

  // la fonction de traitement change à chaque rendu (exercice, marques, erreurs) : on la rebranche
  useEffect(() => {
    // téléphone : on ne compte que ce qui se joue tablature ouverte (l'aveugle, lui, se joue sans elle)
    onFrameRef.current = wide || playing || blindLive ? handleFrame : () => {};
  });

  // réglages d'entrée à chaud (seuil, clarté, La de référence)
  useEffect(() => {
    engine?.setGates({ thresholdDb: input.thresholds[input.source], clarityMin: input.clarityMin, a4: input.a4 });
  }, [engine, input.thresholds, input.source, input.clarityMin, input.a4]);

  // une autre taille de fenêtre est nécessaire quand l'accordage change (Si1 de 7 cordes)
  useEffect(() => {
    const e = engine;
    if (!e || e.state !== 'listening') return;
    void e.start(inputRef.current, { windowSize: windowFor(selection.tuningId) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.tuningId]);

  // quitter l'exercice ferme le micro (un flux oublié garde l'indicateur allumé et le périphérique occupé)
  useEffect(() => () => {
    inputEngineIfAny()?.stop();
  }, []);

  const restart = (nextLevel = level, nextSegment = segment) => {
    setLevel(nextLevel);
    setSegment(nextSegment);
    setSeed(Math.floor(Math.random() * 1e9));
  };

  const applyTarget = (t: ReviewTarget) => {
    setLevel(t.level);
    setSegment(t.segment);
    setScaleSelection(t.selection);
    setSeed(Math.floor(Math.random() * 1e9));
    setColdStep(t.mode === 'cold' ? 'cold' : null);
    setLookStart(null);
    setRetake(false);
  };

  /** Fin de « Regarde la forme » : la forme se masque, nouvel essai de mémoire (rattrapage). */
  const beginRetry = useCallback(() => {
    setColdStep('retry');
    setLookStart(null);
    setResult(null);
    setSeed(Math.floor(Math.random() * 1e9));
  }, []);

  // compte à rebours de l'observation : à zéro, la forme se masque d'elle-même
  useEffect(() => {
    if (coldStep !== 'look' || lookStart === null) return;
    const t = window.setInterval(() => {
      setNow(clock.now());
      if (lookRemaining(lookStart, clock.now(), settings.lookSeconds) === 0) beginRetry();
    }, 250);
    return () => window.clearInterval(t);
  }, [coldStep, lookStart, settings.lookSeconds, beginRetry]);

  const startMixed = () => {
    const q = buildReviewQueue(readAttempts(progressStore()), clock.now(), REVIEW_MAX, { cold: settings.coldReview });
    setJournal(readAttempts(progressStore()));
    setEmptyReview(q.length === 0);
    if (q.length === 0) {
      setSessionDone(null);
      setResult(null);
      setFeedback({ ok: false, text: 'aucune forme à réviser : commence par une écoute ou une série de trous' });
      return;
    }
    setMixed(true);
    setQueue(q);
    setQIndex(0);
    setSessionDone(null);
    setResult(null);
    sessionAcc.current = { forms: 0, accuracy: 0, xp: 0, retries: 0 };
    applyTarget(q[0]!);
  };

  // la session est agrégée dans `finish` (essais qui prouvent seulement) : avancer ne compte rien
  const nextInQueue = () => {
    const next = qIndex + 1;
    if (next >= queue.length) {
      // dernière forme : on affiche le bilan, avec la dernière série déjà comptée, et l'élève retrouve sa gamme
      setSessionDone({ ...sessionAcc.current });
      setResult(null);
      setScaleSelection(homeSelection.current);
      return;
    }
    setQIndex(next);
    setResult(null);
    applyTarget(queue[next]!);
  };

  /** Bilan → étape suivante : la page Révision ouvre l'écran d'entraînement ; ici même, on quitte la session. */
  const goAfter = (step: FormStep) => {
    if (initialMixed || step.level === 1) {
      openStep({ route: step.level === 1 ? 'scale' : 'training', selection: step.selection, level: step.level, segment: step.segment });
      return;
    }
    setScaleSelection(step.selection);
    toggleMixed(false);
    restart(step.level, step.segment);
  };

  const toggleMixed = (on: boolean) => {
    setMixed(on);
    setSessionDone(null);
    sessionAcc.current = { forms: 0, accuracy: 0, xp: 0, retries: 0 };
    if (!on) {
      setQueue([]);
      setQIndex(0);
      setColdStep(null);
      setLookStart(null);
      setRetake(false);
    } else {
      startMixed();
    }
  };

  // --- crochet de vérification (développement uniquement) : état de la série, jamais en production
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __training?: unknown }).__training = {
      exercise, plan, marks, errors, activeKey, result, level, segment, total, done, grid, mixed, queue, qIndex,
      select: (key: string | null) => setActiveKey(key),
      press: (d: string) => press(d),
      validate: () => validate(),
      startGrid: () => void startGrid(),
      gridClicks: () => player.current?.clicksPlayed ?? 0,
      startMixed: () => startMixed(),
      nextInQueue: () => nextInQueue(),
      // rappel à froid : étape courante et raccourcis de l'écran « Regarde la forme »
      cold: { step: coldStep, lookStart, startLook: () => setLookStart(clock.now()), endLook: () => beginRetry() },
      // série à l'aveugle : phase, notes entendues (le verdict reste caché à l'écran)
      blind: {
        on: blindOn, phase: blindPhase, set: (v: boolean) => setBlindOn(v), start: () => void startBlind(),
        finish: () => finishBlind(), heard: () => blindHeard.current.length,
        log: () => ({ heard: blindHeard.current, masked: blindMasked.current }),
      },
      journalLength: journal.length,
      // micro (phase 3) : état observable pour la vérification au navigateur
      // fonctions et non valeurs : l'état du moteur change 47 fois par seconde sans re-rendu de la page
      mic: {
        on: micOn,
        state: () => engine?.state ?? 'idle',
        set: (v: boolean) => setMicOn(v),
        last: () => engine?.last ?? null,
        lastNotePerf: () => lastNotePerf.current,
      },
    };
  }, [exercise, plan, marks, errors, activeKey, result, level, segment, total, done, grid, mixed, queue, qIndex, press, validate, journal.length, micOn, engine, coldStep, lookStart, beginRetry, blindOn, blindPhase]);

  // XP total (hooks : avant tout return anticipé) et XP du jour : recalculés depuis le journal, comme partout ailleurs
  const totals = useMemo(() => xpSummary(journal, clock.nowDate()), [journal]);
  const streakDays = useMemo(() => streak(journal, clock.nowDate()).days, [journal]);
  const sessionsToday = useMemo(() => summarizeDay(journal, clock.nowDate()).exercises, [journal]);

  // page Révision sans rien à réviser : on le dit, au lieu d'ouvrir un exercice sur la forme courante (D97)
  if (initialMixed && emptyReview) {
    const started = journal.some((a) => a.module !== 'accords' && (a.kind === 'holes' || a.kind === 'recall'));
    return (
      <main className="shell">
        <header className="page-head">
          <button type="button" className="back" onClick={() => navigate('hub')} aria-label="Retour à l’accueil">‹</button>
          <div>
            <h1 className="page-title">Révision</h1>
          </div>
        </header>
        <Panel accent="green" label="Révision">
          <p className="t-body">Aucune forme à réviser pour l’instant.</p>
          <p className="t-small">
            {started
              ? 'Rien n’est dû, et aucune forme en apprentissage n’attend aujourd’hui. L’accueil te dira quand une forme revient.'
              : 'Commence par une écoute ou une série de trous : une forme travaillée revient ici à son heure.'}
          </p>
          <div className="row">
            <PixelButton variant="primary" onClick={() => navigate('hub')}>Accueil</PixelButton>
            <PixelButton onClick={() => navigate('gammes')}>Gammes</PixelButton>
          </div>
        </Panel>
      </main>
    );
  }

  if (!r.position || !exercise || !display || !plan) {
    return (
      <main className="shell">
        <header className="page-head">
          <button type="button" className="back" onClick={() => navigate('gammes')} aria-label="Retour à la sélection">‹</button>
          <div>
            <h1 className="page-title">Entraînement</h1>
          </div>
        </header>
        <Panel accent="yellow">
          <p className="t-body">Aucune position pour cette gamme / cet accordage.</p>
          <PixelButton onClick={() => navigate('gammes')}>Changer de système</PixelButton>
        </Panel>
      </main>
    );
  }

  const elapsed = startedAt === null ? 0 : Math.max(0, Math.round(((result ? result.seconds * 1000 : now - startedAt)) / 1000));
  const activeStringLabel = activeHole
    ? `${fmtNote(r.tuning.strings[activeHole.string]!.replace(/-?\d+$/, ''), settings.noteNotation)} ${activeHole.string === 0 ? '(grave)' : activeHole.string === r.tuning.strings.length - 1 ? '(aiguë)' : ''}`.trim()
    : null;
  const gridSpec = tempoGrid(total, settings.trainingTempo, settings.gridSubdivision);
  const stringNames = r.tuning.strings.map((pitch, i, all) =>
    `${fmtNote(pitch.replace(/-?\d+$/, ''), settings.noteNotation)}${i === 0 ? ' grave' : i === all.length - 1 ? ' aigu' : ''}`);
  const missedLine = result ? missedSummary(exercise.holes, missed, stringNames) : null;
  const nextSteps = nextStepFor(level === 3 ? 3 : 2, result?.stars ?? 0, result?.proof ?? true);
  // série finie : retour au portrait, où se lit le résultat
  useEffect(() => {
    if (result) setPlaying(false);
  }, [result]);
  const openPlay = () => {
    if (startedAt !== null && pausedAt.current !== null && !result) {
      setStartedAt(resumedStart(startedAt, pausedAt.current, clock.now()));
      setNow(clock.now());
    }
    pausedAt.current = null;
    setPlaying(true);
    openLandscape();
  };
  const runStep = (k: StepKind) => {
    setCelebrate(false);
    if (k === 'review') navigate('scale');
    else if (k === 'upgrade') restart(3, segment);
    else if (k === 'downgrade') restart(2, segment);
    else restart();
  };
  const activeIndex = activeKey ? exercise.holes.findIndex((h) => h.key === activeKey) + 1 : 0;

  const blindPanel = blindLive && (
    <Panel className="span-12" accent="cyan" label="À l’aveugle">
      {(() => {
        const bg = blindGridRef.current!;
        const elapsed = (performance.now() - blindClickPerf.current) / 1000;
        const count = countInBeat(elapsed, bg);
        const beat = Math.min(bg.grid.beats, Math.floor(Math.max(0, elapsed - bg.countIn) / (60 / bg.grid.score.tempo)) + 1);
        return count !== null ? (
          <p className="blind-count" aria-live="assertive">{count}</p>
        ) : (
          <p className="t-body" aria-live="polite">
            Joue la position, dans l’ordre · temps {beat} / {bg.grid.beats}
            {elapsed - bg.countIn > bg.grid.seconds ? ' · grille finie, termine quand tu veux' : ''}
          </p>
        );
      })()}
      <MicStrip
        engine={engine}
        notation={settings.noteNotation}
        thresholdDb={input.thresholds[input.source]}
        tolerance={input.centsTolerance}
        tuning={r.tuning}
        a4={input.a4}
      />
      <p className="t-small t-dim">Aucun verdict pendant le jeu : la tablature et les cases justes ou fausses reviennent à la fin.</p>
      <div className="row">
        <PixelButton variant="primary" onClick={finishBlind}>Terminer</PixelButton>
      </div>
    </Panel>
  );
  const tab = (
    <TabView
      score={display}
      notes={settings.noteNotation}
      chords={settings.chordNotation}
      // à froid, rien ne fuit : ni degré, ni doigté, ni légende — sauf une fois la série finie
      annotation={coldActive && !result ? 'none' : 'degree'}
      mode="wrap"
      scale="auto"
      minScale={3}
      reduceMotion={settings.reduceMotion}
      player={null}
      transport="stopped"
      hideRhythm
      oneLine={wide || playing}
      // on répond à la guitare : le curseur avance seul, rien à toucher sur la tablature
    />
  );
  const tabLegend = !(coldActive && !result) && <TabLegend def={r.def} readonly={settings.reduceMotion} />;
  const lookPanel = coldStep === 'look' && lookStart !== null && lookNeck && (
      <Panel
        className="span-12 neck-panel"
        label="Manche"
        right={<span className="badge">tonique {fmtNote(r.tonic, settings.noteNotation)} · cases {lookNeck.zone.from}–{lookNeck.zone.to}</span>}
      >
        <NeckView
          tuning={r.tuning}
          notes={lookNeck.notes}
          zone={lookNeck.zone}
          notation={settings.noteNotation}
          label={positionLabelPlain(r.position, settings.noteNotation)}
        />
      </Panel>
    );
  const verdict = (
    <p className={`verdict ${feedback ? (feedback.info ? 'info' : feedback.ok ? 'ok' : 'no') : !result ? 'prompt' : ''}`} role="status">
      {feedback && !feedback.info && <span className="verdict-mark" aria-hidden="true">{feedback.ok ? '✓' : '✕'}</span>}
      {/* sans verdict, la consigne tient la place : « Corde de La · case ? », lisible de loin (le saut du pavé au premier chiffre n'existe plus) */}
      {feedback ? feedback.text : !result ? (activeStringLabel ? `Corde de ${activeStringLabel} · case ?` : 'Touche un emplacement vide') : ''}
    </p>
  );
  const sessionPanel = sessionDone && (
    <Panel className="span-5" accent="green" active label="Session terminée">
      <p className="stat-line">
        <strong>{sessionDone.forms}</strong> forme{sessionDone.forms > 1 ? 's' : ''} · précision moyenne{' '}
        <strong>{Math.round(sessionDone.accuracy * 100)} %</strong> · <strong>{sessionDone.xp}</strong> XP
      </p>
      <p className="t-small">
        Enchaîner des formes différentes coûte plus cher sur le moment et retient mieux que répéter la même :
        c’est fait exprès. Les échéances sont recalculées, le hub les affiche.
      </p>
      {retryLine(sessionDone.retries) && <p className="t-small">{retryLine(sessionDone.retries)}</p>}
      {afterStep && <p className="t-small">{afterStep.text}</p>}
      <div className="row">
        {/* la séance s'arrête à 5 ; s'il reste des dues (8 au plus aujourd'hui), on propose la suite (D97),
            puis l'étape suivante de la séance du jour (D98) */}
        {moreDueNow > 0 && (
          <PixelButton variant="primary" onClick={startMixed}>Encore {moreDueNow} forme{moreDueNow > 1 ? 's' : ''} due{moreDueNow > 1 ? 's' : ''}</PixelButton>
        )}
        {afterStep && (
          <PixelButton variant={moreDueNow > 0 ? 'ghost' : 'primary'} onClick={() => goAfter(afterStep.step)}>{afterStep.action}</PixelButton>
        )}
        <PixelButton variant={moreDueNow > 0 || afterStep ? 'quiet' : 'primary'} onClick={() => navigate('hub')}>Accueil</PixelButton>
      </div>
    </Panel>
  );
  const resultPanel = result && (
    <Panel className="span-5" accent={result.stars > 0 ? 'green' : 'orange'} active label="Résultat">
      {/* pas d'étoiles sur un rattrapage : on ne félicite que ce qui prouve (MUSIC_DESIGN §17.1) */}
      {result.proof ? <p className="result-stars">{starRow(result.stars)}</p> : <p className="t-label">Rattrapage</p>}
      <p className={`stat-line ${result.stars === 0 ? 'miss' : ''}`} ref={resultRef} tabIndex={-1}>
        <strong>{Math.round(result.accuracy * 100)} %</strong> de trous justes au premier essai · {result.revealed} révélé{result.revealed > 1 ? 's' : ''} · {result.errors} erreur{result.errors > 1 ? 's' : ''}
      </p>
      {missedLine && <p className="t-small">{missedLine} — contour pointillé sur la tablature.</p>}
      <p className="t-small">
        {result.grid === 'kept'
          ? `tempo : grille tenue en ${mmss(result.seconds)} · `
          : result.grid === 'missed'
            ? `tempo : hors grille (${mmss(result.seconds)} pour ${gridSpec.seconds.toFixed(1)} s) · `
            : ''}
        {!result.proof
          ? 'Essai de rattrapage : enregistré, sans effet sur la révision, la maîtrise ni l’XP.'
          : result.xp > 0
            ? `+${result.xp} XP. Tentative enregistrée : elle entre dans la répétition espacée.`
            : '0 XP. La tentative est enregistrée quand même : elle dit où tu en es, et rien n’est bloqué.'}
      </p>
      <p className="t-small">
        {formStateLine(formNode, settings.speedTargetBpm)}
        {result.proof && result.accuracy < 0.8 && formNode?.state === 'learned'
          ? ' Un essai raté ne retire pas « apprise » : elle se compte en réussites.'
          : ''}
      </p>
      {coldStep === 'look' && (
        <>
          <p className="t-small">
            {lookStart === null
              ? `${Math.round(result.accuracy * 100)} % à froid, sous les 80 % : la carte revient bientôt. Regarde la forme ${settings.lookSeconds} s, puis rejoue-la de mémoire — ce second essai ne compte pas.`
              : `Regarde la forme : elle se masque dans ${lookRemaining(lookStart, now, settings.lookSeconds)} s.`}
          </p>
          <div className="row">
            {lookStart === null ? (
              <PixelButton variant="primary" onClick={() => { setLookStart(clock.now()); setNow(clock.now()); }}>
                ▶ Regarde la forme ({settings.lookSeconds} s)
              </PixelButton>
            ) : (
              <PixelButton variant="primary" onClick={beginRetry}>J’ai vu, masquer</PixelButton>
            )}
            <PixelButton variant="quiet" onClick={nextInQueue}>Passer · forme suivante</PixelButton>
          </div>
        </>
      )}
      <div className="row">
        {coldStep === 'look' ? null : mixed ? (
          <>
            <PixelButton variant="primary" onClick={nextInQueue} disabled={queue.length === 0}>
              {qIndex + 1 >= queue.length ? 'Terminer la session' : `Suivant · ${queue[qIndex + 1]?.title ?? ''}`}
            </PixelButton>
            <PixelButton variant="quiet" onClick={() => { setRetake(true); restart(); }} title="Juste après la correction : l’essai est enregistré sans compter">
              Refaire celle-ci
            </PixelButton>
          </>
        ) : (
          <>
            <PixelButton variant="primary" onClick={() => runStep(nextSteps.primary)}>{STEP_LABEL[nextSteps.primary]}</PixelButton>
            <PixelButton onClick={() => runStep(nextSteps.secondary)}>{STEP_LABEL[nextSteps.secondary]}</PixelButton>
          </>
        )}
      </div>
      {!mixed && coldStep !== 'look' && (
        <p className="t-small result-links">
          <button type="button" className="linkish" onClick={() => navigate('gammes')}>Changer de gamme</button>
          {' · '}
          <button type="button" className="linkish" onClick={() => navigate('hub')}>Accueil</button>
        </p>
      )}
    </Panel>
  );
  const micAction = micState === 'listening' ? (
      <PixelButton variant="quiet" onClick={() => setMicOn(false)}>Fermer</PixelButton>
    ) : (
      <PixelButton variant="primary" className="mic-spark" onClick={() => setMicOn(true)} disabled={micBusy}>
        ▶ Ouvrir le micro
      </PixelButton>
    );
  const micLive = (
    <p className="sr-only" aria-live="polite">
      {activeIndex > 0 && activeStringLabel ? `Emplacement ${activeIndex} sur ${total}, corde de ${activeStringLabel}. Flèches gauche et droite pour changer.` : ''}
    </p>
  );
  const sessionFacts = mixed && queue.length > 0 && queue[qIndex] && (
      <dl className="ex-facts">
        <dt>Session</dt>
        <dd>
          {sessionFact(qIndex, queue.length, queue[qIndex]!)}
          <details className="ex-more">
            <summary>Les {queue.length} formes</summary>
            <ol>
              {queue.map((t, i) => (
                <li key={`${t.nodeId}-${i}`} className={i === qIndex ? 'current' : ''}>{t.title} ({t.positionLabel}) : {t.reason}</li>
              ))}
            </ol>
          </details>
        </dd>
        <dt>Consigne</dt>
        <dd>
          {coldStep === 'cold'
            ? 'De mémoire, sans revoir la forme. Seul ce premier essai compte.'
            : coldStep === 'retry'
              ? 'Rattrapage : tu viens de voir la forme, il ne compte pas.'
              : `${total} trou${total > 1 ? 's' : ''} sur ${exercise.notes} notes, la position entière.`}
        </dd>
        {!result && (
          <>
            <dt>État</dt>
            <dd>{formStateLine(formNode, settings.speedTargetBpm)}</dd>
          </>
        )}
      </dl>
    );
  const coldNotes = (
    <>
      {!mixed && coldStep === 'cold' && (
        <p className="t-small">
          <strong>Rappel à froid</strong> : la position entière, de mémoire, sans la revoir avant. Seul ce premier
          essai compte pour la révision, la maîtrise et l’XP.
        </p>
      )}
      {!mixed && coldStep === 'retry' && (
        <p className="t-small">
          <strong>Essai de rattrapage</strong> : enregistré comme pratique, sans effet sur la révision, la maîtrise
          ni l’XP — tu viens de voir la forme.
        </p>
      )}
    </>
  );
  const blindSwitch = !mixed && level === 3 && (
      <Switch
        checked={blindOn && micState === 'listening'}
        onChange={setBlindOn}
        disabled={micState !== 'listening'}
        label="À l’aveugle"
        hint={micState === 'listening'
          ? 'aucune tablature pendant le jeu, verdict à la fin'
          : 'ouvre le micro : à l’aveugle, seul le son est jugé'}
      />
    );
  const levelText = !mixed && (
    <>
    <p className="t-small">
      {level === 2
        ? `${Math.round(settings.holeRate * 100)} % des notes masquées (au moins 2, jamais toutes) : ici ${total} trou${total > 1 ? 's' : ''} sur ${exercise.notes}. `
          + 'Ouvre le micro et joue la note à la guitare : elle remplit l’emplacement.'
        : `${exercise.notes} cases à écrire de mémoire : seules les cordes, les mesures et le rythme restent visibles.`
          + ' Joue-les dans l’ordre que tu veux.'}
    </p>
    {!result && <p className="t-small">{formStateLine(formNode, settings.speedTargetBpm)}</p>}
    </>
    );
  const mixedSwitches = (
    <div className="row">
      <Switch checked={mixed} onChange={toggleMixed} label="Session mélangée" hint="3 à 5 formes différentes d’affilée" />
      <Switch
        checked={settings.coldReview}
        onChange={(v) => setSettings({ coldReview: v })}
        label="Rappel à froid en révision"
        hint="une forme due : de mémoire d’abord, sans la revoir (prochaine session)"
      />
    </div>
  );
  const segmentField = !mixed && (
      <div className="field">
        <span className="t-label">Sens</span>
        <Segmented<Segment>
          size="sm"
          label="Découpage"
          value={segment}
          onChange={(v) => restart(level, v)}
          options={SEGMENTS.filter((s) => s.value === 'all' || s.value === 'updown')
            .map((s) => ({ value: s.value, label: s.value === 'all' ? 'aller' : s.label, note: s.hint }))}
        />
      </div>
    );
  const gridTempo = (
    <div className="tempo">
      <button type="button" className="tempo-btn" onClick={() => setSettings({ trainingTempo: Math.max(MIN_TEMPO, settings.trainingTempo - 5) })} aria-label="Grille moins vite">−</button>
      <span className="tempo-val">♩ {settings.trainingTempo}</span>
      <button type="button" className="tempo-btn" onClick={() => setSettings({ trainingTempo: Math.min(MAX_TEMPO, settings.trainingTempo + 5) })} aria-label="Grille plus vite">+</button>
    </div>
  );
  const gridSubdivisionField = (
    <Segmented<GridSubdivision>
      size="sm"
      label="Notes par temps"
      value={settings.gridSubdivision}
      onChange={(v) => setSettings({ gridSubdivision: v })}
      options={[{ value: 1, label: 'noires' }, { value: 2, label: 'croches' }]}
    />
  );
  // grille abandonnée avant toute réponse : elle ne compte pas dans la tentative, le chrono repart de zéro
  const stopGridByHand = () => {
    stopGrid();
    if (Object.keys(marks).length === 0 && Object.keys(errors).length === 0) setStartedAt(null);
  };
  const gridButton = (
    // au bureau, sa propre couleur : le cyan, en aplat quand c'est le geste du moment (micro ouvert, grille lancée)
    <PixelButton
      variant={!desktop && grid === 'running' ? 'primary' : 'ghost'}
      className={desktop ? `train-grid ${grid === 'running' || micState === 'listening' ? 'on' : ''}` : ''}
      title="Joue en rythme : le métronome donne le temps, jamais les notes"
      onClick={() => (grid === 'running' ? stopGridByHand() : void startGrid())}
      disabled={!!result}
    >
      {grid === 'running' ? 'Arrêter la grille' : desktop ? '▶ Grille (métronome)' : '▶ Grille'}
    </PixelButton>
  );
  const gridEstimate = (
    <span className="t-small t-dim">{gridSpec.beats} temps ≈ {gridSpec.seconds.toFixed(1)} s</span>
  );
  const elapsedLabel = startedAt !== null && !result && <span className="t-label">{mmss(elapsed)}</span>;
  const howScoredBody = (
    <>
      <p className="t-small">
        Les trous justes <strong>au premier essai</strong>. Une case trouvée du deuxième coup n’est pas « sue »,
        elle est reconnue. Le score d’aujourd’hui déplace la case dans la file de révision, il ne la certifie pas.
      </p>
      <p className="t-small t-dim">
        Étoiles : ★ dès 80 % · ★★ dès 95 % · ★★★ sans une erreur ni une case révélée. Si tu as lancé la grille,
        ★★ et ★★★ exigent de la tenir ; la manquer plafonne à ★. Une case écrite de mémoire (Niv3) pèse 1,5 dans la
        maîtrise, un trou comblé (Niv2) pèse 1.
      </p>
      <p className="t-small t-dim">
        {settings.gridSubdivision === 2 ? 'Deux trous par temps' : 'Un temps par trou'}, en mesures entières
        ({gridSpec.npm} notes/min). Finir dans la grille et juste à ≥ 95 % vaut ★★, parfait sans une erreur vaut ★★★.
        Le métronome ne joue aucune note : il ne donne pas les réponses.
      </p>
      <p className="t-small t-dim">
        Vitesse « maîtrisée » : de mémoire (Niv3), au micro, position entière, ≥ 95 %, grille tenue à
        {' '}{settings.speedTargetBpm} BPM en croches ({settings.speedTargetBpm * 2} notes/min) — réglage du tempo cible dans Réglages.
      </p>
      <p className="t-small t-dim">
        Série de {total} trou{total > 1 ? 's' : ''} sur {exercise.notes} note{exercise.notes > 1 ? 's' : ''} ({plan.strings} corde{plan.strings > 1 ? 's' : ''}).
        {journal.length > 0 ? ` ${journal.length} tentative${journal.length > 1 ? 's' : ''} déjà enregistrée${journal.length > 1 ? 's' : ''} sur cet appareil.` : ' Aucune tentative enregistrée pour l’instant.'}
      </p>
      <p className="t-small t-dim">
        L’annotation sous la tablature reste celle de ton réglage (notes, degrés, intervalles, doigtés) — elle est masquée sur les trous.
        Une note masquée n’est jamais jouée par l’app avant d’être trouvée.
      </p>
    </>
  );
  const celebration = result && celebrate && endScreenFor(result.stars, result.proof, mixed) && (
      <Celebration
        title={r.title}
        position={positionLabelPlain(r.position, settings.noteNotation)}
        stars={result.stars}
        accuracy={result.accuracy}
        seconds={result.seconds}
        revealed={result.revealed}
        errors={result.errors}
        earned={result.xp}
        totalXp={totals.total}
        todayXp={totals.today}
        cap={totals.cap}
        streakDays={streakDays}
        sessionsToday={sessionsToday}
        readonly={settings.reduceMotion}
        onClose={() => setCelebrate(false)}
        gridKept={result.grid === 'kept'}
        {...(mixed
          ? {}
          : {
              actions: [
                { label: STEP_LABEL[nextSteps.primary], onClick: () => runStep(nextSteps.primary) },
                endScreenFor(result.stars, result.proof, mixed) === 'calm'
                  ? { label: STEP_LABEL[nextSteps.secondary], onClick: () => runStep(nextSteps.secondary) }
                  : { label: 'Continuer', onClick: () => setCelebrate(false) },
              ],
            })}
        {...(endScreenFor(result.stars, result.proof, mixed) === 'calm'
          ? { calm: true, detail: missedLine ?? `${Math.round(result.accuracy * 100)} % au premier essai` }
          : {})}
      />
    );
  const firstPosition = r.selection.positionIndex === 0;
  const lastPosition = r.selection.positionIndex >= r.positions.length - 1;
  const gotoPrevious = () => setScaleSelection({ positionIndex: Math.max(0, r.selection.positionIndex - 1) });
  const gotoNext = () => setScaleSelection({ positionIndex: Math.min(r.positions.length - 1, r.selection.positionIndex + 1) });
  const prevPosition = <PixelButton variant="quiet" onClick={gotoPrevious} disabled={firstPosition}>‹ Position</PixelButton>;
  const positionCount = <span className="t-label pos-count">{r.selection.positionIndex + 1} / {r.positions.length}</span>;
  const nextPosition = <PixelButton variant="quiet" onClick={gotoNext} disabled={lastPosition}>Position ›</PixelButton>;
  const levels = !mixed && (
    <LevelsNav
      current={level === 3 ? 3 : 2}
      onSelect={(n) => (n === 1 ? navigate('scale') : n === 5 ? navigate('impro') : n === 4 ? navigate('sequences') : restart(n, segment))}
    />
  );
  const degrees = legendFor(r.def);
  const headTag = mixed && queue.length > 0 ? `Session ${qIndex + 1} / ${queue.length}${coldActive ? ' · à froid' : ''}` : `Niv${level}`;
  const subtitle = <p className="t-small t-dim">{positionLabelPlain(r.position, settings.noteNotation)} · {plan.label}</p>;
  const back = <button type="button" className="back" onClick={() => navigate(mixed ? 'hub' : 'gammes')} aria-label="Retour">‹</button>;


  if (desktop) {
    const finished = result || (sessionDone && mixed);
    return (
      <main className="shell play-shell">
        <div className="play-surface">
          {/* le micro et la grille restent à portée : on les touche la guitare en main */}
          <header className="play-head">
            <div className="play-id">
              {back}
              <div>
                <div className="play-title">
                  <h1 className="page-title">{r.title}</h1>
                  <span className="tag tag-on">{headTag}</span>
                </div>
                {subtitle}
              </div>
            </div>
            {!micOn && <div className="play-transport">{micAction}</div>}
            {level === 3 && gridTempo}
            {level === 3 && gridButton}
            <span className="badge badge-count">{done} / {total} notes</span>
            {/* en N3, le chrono est celui de la grille : il s'arrête avec elle */}
            {(level !== 3 || grid === 'running') && elapsedLabel}
          </header>

          {blindLive ? (
            <section className="train-outcome">{blindPanel}</section>
          ) : (
            <>
              <section className="play-tab">
                <div className="play-tab-bar">
                  {/* à froid, rien ne fuit : pas de légende avant la fin de la série */}
                  {tabLegend !== false && (
                    <div className="play-degrees" role="img" aria-label={`Couleurs des degrés : ${degrees.map((it) => it.name).join(', ')}`}>
                      {degrees.map((it) => (
                        <span key={it.fn} className="legend-pill" style={{ background: it.fill, color: it.digit }}>{it.fn}</span>
                      ))}
                    </div>
                  )}
                  {segmentField}
                  {level === 3 && (
                    <div className="field">
                      <span className="t-label">Grille</span>
                      {gridSubdivisionField}
                    </div>
                  )}
                  {/* la précision du commutateur n'a pas la place ici : elle reste au survol */}
                  {blindSwitch && <div title={micState === 'listening' ? 'aucune tablature pendant le jeu, verdict à la fin' : 'ouvre le micro : à l’aveugle, seul le son est jugé'}>{blindSwitch}</div>}
                  {coldActive ? (
                    <PixelButton variant="quiet" onClick={nextInQueue}>Passer · forme suivante</PixelButton>
                  ) : coldStep !== 'look' && !result && (
                    <div className="row">
                      {!mixed && level === 3 && blindOn && micState === 'listening' && (
                        <PixelButton variant="primary" onClick={() => void startBlind()}>▶ Lancer à l’aveugle</PixelButton>
                      )}
                      <PixelButton variant="quiet" onClick={() => restart()} title="Même gamme, nouveaux trous">↻ Nouvelle série</PixelButton>
                    </div>
                  )}
                </div>
                {tab}
                {tabLegend}
                {lookPanel}
              </section>

              {finished ? (
                <section className="train-outcome">
                  {verdict}
                  {sessionDone && mixed ? sessionPanel : resultPanel}
                </section>
              ) : (
                <>
                  {micLive}
                  {/* rien à dire : pas de rangée, les niveaux suivent la tablature comme sur la page Jouer */}
                  {(feedback || micError || micBusy || (!mixed && (coldStep === 'cold' || coldStep === 'retry'))) && (
                    <section className="train-answer">
                      {feedback && (
                        <p className={`verdict ${feedback.info ? 'info' : feedback.ok ? 'ok' : 'no'}`} role="status">
                          {!feedback.info && <span className="verdict-mark" aria-hidden="true">{feedback.ok ? '✓' : '✕'}</span>}
                          {feedback.text}
                        </p>
                      )}
                      {micError && <p className="t-small mic-line-error" role="alert">{micError}</p>}
                      {micBusy && <p className="t-small t-dim">ouverture du périphérique…</p>}
                      {coldNotes}
                    </section>
                  )}
                </>
              )}

              {!mixed && (
                <div className="play-nav">
                  {levels}
                  <div className="play-pos">
                    {prevPosition}
                    <span className="play-dots" aria-hidden="true">
                      {r.positions.map((p, i) => <span key={p.id} className={i === r.selection.positionIndex ? 'on' : ''} />)}
                    </span>
                    {positionCount}
                    {nextPosition}
                  </div>
                </div>
              )}

              <div className="play-more">
                <PixelButton variant="quiet" onClick={() => setInfoOpen((o) => !o)}>
                  {infoOpen ? '▾ Masquer les détails' : '▸ Détails de la série'}
                </PixelButton>
              </div>

              {infoOpen && (
                <div className="play-columns">
                  <div className="play-col">
                    <PlaySection title="Exercice">
                      {sessionFacts}
                      {levelText}
                      {level === 3 && gridEstimate}
                      <p className="t-small t-dim">Valide au micro : le micro ou l’interface USB doit être branché avant d’ouvrir.</p>
                      {mixedSwitches}
                    </PlaySection>
                  </div>
                  <div className="play-col">
                    <PlaySection title="Comment c’est noté ?" tone="cyan">{howScoredBody}</PlaySection>
                  </div>
                </div>
              )}

              {/* en séance, la file mène : on n'en sort pas d'ici */}
              {!mixed && (
                <footer className="play-foot">
                  <InstrumentPicker />
                  <PixelButton variant="quiet" onClick={() => navigate('gammes')}>← Changer de gamme</PixelButton>
                </footer>
              )}
            </>
          )}
        </div>
        {!blindLive && celebration}
      </main>
    );
  }

  // Téléphone : la tablature se lit mal à la verticale, la série se joue donc en paysage, tablature sur une
  // ligne. Le portrait règle, lance, et rend le résultat.
  const canPlay = !blindLive && coldStep !== 'look' && !(sessionDone && mixed);
  // essai au Niv2 : Jouer dans le bloc, et toutes les options de jeu dans la vue qui s'ouvre
  const optionsInPlay = level === 2 && !mixed && coldStep === null;
  return (
    <main className="shell mplay">
      <header className="mplay-head">
        <div className="mplay-id">
          {back}
          <div className="mplay-title">
            <h1 className="page-title">{r.title}</h1>
            {subtitle}
          </div>
          <span className="tag tag-on">{headTag}</span>
        </div>
        {canPlay && !(optionsInPlay && !result) && (
          <div className="mplay-transport">
            {!result && !micOn && micAction}
            <PixelButton variant={micOn || result ? 'primary' : 'ghost'} className="play" onClick={openPlay}>
              {result ? 'Voir la correction' : done > 0 ? '▶ Reprendre' : '▶ Jouer'}
            </PixelButton>
            <span className="badge badge-count">{done} / {total} notes</span>
          </div>
        )}
      </header>

      {blindLive ? blindPanel : (
      <>
      {sessionDone && mixed ? (<>{verdict}{sessionPanel}</>) : result ? (<>{verdict}{resultPanel}</>) : (
      <section className="mplay-tab">
        {optionsInPlay ? (
          <div className="mplay-bar">
            <PixelButton variant="primary" className="mplay-play" onClick={openPlay}>▶ Jouer</PixelButton>
            <p className="t-small t-dim mplay-play-note">
              La tablature s’ouvre en paysage, avec des notes masquées. Joue-les à la guitare, micro ouvert : chaque note juste remplit son emplacement. Position et sens se règlent là-bas.
            </p>
          </div>
        ) : (
        <div className="mplay-bar">
          {sessionFacts}
          {!mixed && (
            <div className="mplay-pos">
              <PixelButton variant="quiet" onClick={gotoPrevious} disabled={firstPosition} ariaLabel="Position précédente">‹</PixelButton>
              <span className="t-label">Position {r.selection.positionIndex + 1} / {r.positions.length}</span>
              <PixelButton variant="quiet" onClick={gotoNext} disabled={lastPosition} ariaLabel="Position suivante">›</PixelButton>
            </div>
          )}
          {segmentField}
          {level === 3 && (
            <div className="mplay-grid">
              {gridTempo}
              {gridSubdivisionField}
            </div>
          )}
          {blindSwitch}
          {coldStep !== 'look' && <p className="mplay-hint">Touche Jouer pour afficher la tablature.</p>}
          {coldActive ? (
            // à froid, pas de nouvelle série (elle effacerait les cases déjà révélées) : « Passer » suffit
            <PixelButton variant="quiet" onClick={nextInQueue}>Passer · forme suivante</PixelButton>
          ) : coldStep !== 'look' && (
            <>
              {!mixed && level === 3 && blindOn && micState === 'listening' && (
                <PixelButton variant="primary" onClick={() => void startBlind()}>▶ Lancer à l’aveugle</PixelButton>
              )}
              <PixelButton variant="quiet" onClick={() => restart()} title="Même gamme, nouveaux trous">↻ Nouvelle série</PixelButton>
            </>
          )}
          {micError && <p className="t-small mic-line-error" role="alert">{micError}</p>}
          {micBusy && <p className="t-small t-dim">ouverture du périphérique…</p>}
          {coldNotes}
        </div>
        )}
        {lookPanel}
      </section>
      )}

      {!mixed && <div className="mplay-levels">{levels}</div>}

      <div className="mplay-more">
        <PixelButton variant="quiet" onClick={() => setInfoOpen((o) => !o)}>
          {infoOpen ? '▾ Masquer les détails' : '▸ Détails de la série'}
        </PixelButton>
      </div>

      {infoOpen && (
        <>
          <Panel className="span-12" label="Exercice">
            {levelText}
            {level === 3 && gridEstimate}
            <p className="t-small t-dim">Valide au micro : le micro ou l’interface USB doit être branché avant d’ouvrir.</p>
            {mixedSwitches}
          </Panel>
          {tabLegend}
          <Panel className="span-12" label="Comment c’est noté ?">{howScoredBody}</Panel>
        </>
      )}

      {/* en séance, la file mène : on n'en sort pas d'ici */}
      {!mixed && (
        <footer className="mplay-foot">
          <InstrumentPicker />
          <PixelButton variant="quiet" onClick={() => navigate('gammes')}>← Changer de gamme</PixelButton>
        </footer>
      )}
      </>
      )}

      {playing && (
        <LandscapeView label={`Exercice : ${r.title}`} onClose={closePlay}>
          <div className={`tab-full-bar ${optionsInPlay ? 'tab-full-options' : ''}`}>
            <PixelButton variant="quiet" onClick={closePlay}>Fermer</PixelButton>
            {optionsInPlay && !result ? (
              <>
                <div className="land-pos">
                  <PixelButton variant="quiet" onClick={gotoPrevious} disabled={firstPosition} ariaLabel="Position précédente">‹</PixelButton>
                  <span className="t-label">{r.selection.positionIndex + 1} / {r.positions.length}</span>
                  <PixelButton variant="quiet" onClick={gotoNext} disabled={lastPosition} ariaLabel="Position suivante">›</PixelButton>
                </div>
                {segmentField}
                <PixelButton variant="quiet" onClick={() => restart()} ariaLabel="Nouvelle série" title="Même gamme, nouveaux trous">↻</PixelButton>
                <span className="tab-full-title" />
              </>
            ) : <span className="tab-full-title">{r.title}</span>}
            {!result && !micOn && micAction}
            {level === 3 && !result && gridButton}
            {!result && elapsedLabel}
            <span className="badge badge-count">{done} / {total} notes</span>
          </div>
          <div className="land-body">{tab}</div>
          {!result && (feedback || micError) && (
            <p className={`land-status ${feedback && !feedback.info ? (feedback.ok ? 'ok' : 'no') : ''}`} role="status">
              {micError ?? feedback?.text}
            </p>
          )}
          {micLive}
        </LandscapeView>
      )}

      {celebration}
    </main>
  );
}
