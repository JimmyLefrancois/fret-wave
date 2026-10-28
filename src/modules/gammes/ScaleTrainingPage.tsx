/**
 * Module Gammes — niveaux 2 « Mémorisation » et 3 « Rappel » (BRIEF.md §2, MUSIC_DESIGN §3.4, §13).
 *
 * Un seul écran pour les deux niveaux, parce que la mécanique est la même : **des trous dans une
 * tablature réelle**, que l'élève comble au pavé numérique (ou au clavier). Ce qui change :
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
import { setScaleSelection, useScaleSelection } from '../../app/scaleSession';
import { setSettings, useSettings } from '../../app/settings';
import { TabView, type TabPick } from '../../app/TabView';
import { Panel, PixelButton, Segmented, Switch } from '../../app/ui';
import { MicStrip } from '../../app/MicStrip';
import { ensureInputEngine, inputEngineIfAny, windowFor } from '../../app/inputSession';
import { AudioEngine } from '../../core/audio/engine';
import { describeInputError, type InputEngine, type InputFrame } from '../../core/input/engine';
import { matchPitch, noteNameOf, targetsFor, type MatchVerdict } from '../../core/input/match';
import { useInputSettings } from '../../core/input/settings';
import { fmtNote } from '../../core/theory';
import { positionToScore } from '../../core/tab';
import { TabPlayer } from '../../core/audio/tabPlayer';
import {
  appendAttempt, newAttemptId, nodeIdOf, progressStore, readAttempts, streak, summarizeDay, xpForAttempt, xpSummary,
  type Attempt, type AttemptLevel,
} from '../../core/progress';
import { degreeName, fmtDegree, positionLabelPlain, resolveScale } from './resolve';
import { TabLegend } from './TabLegend';
import { Celebration } from './Celebration';
import {
  SEGMENTS, buildExercise, holeKey, insideGrid, mulberry32, nearClick, segmentPlan, starsFor, tempoGrid, withRevealed,
  type GridOutcome, type Segment,
} from './exercise';
import { buildReviewQueue, type ReviewTarget } from './review';

type HoleMark = 'right' | 'revealed';

interface Result {
  accuracy: number;
  stars: number;
  xp: number;
  seconds: number;
  revealed: number;
  errors: number;
  grid: GridOutcome;
}

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function starRow(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

export function ScaleTrainingPage({ initialMixed = false }: { initialMixed?: boolean } = {}) {
  const settings = useSettings();
  const selection = useScaleSelection();
  const r = useMemo(() => resolveScale(selection, settings.noteNotation), [selection, settings.noteNotation]);

  const [level, setLevel] = useState<AttemptLevel>(2);
  const [segment, setSegment] = useState<Segment>('strings2');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [marks, setMarks] = useState<Record<string, HoleMark>>({});
  const [errors, setErrors] = useState<Record<string, number>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [entry, setEntry] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [result, setResult] = useState<Result | null>(null);
  const [journal, setJournal] = useState<Attempt[]>(() => readAttempts(progressStore()));
  /** Panneau de réussite : ouvert à la fin d'une série, refermé par « Continuer » ou Échap. */
  const [celebrate, setCelebrate] = useState(false);

  // --- grille rythmique
  const [grid, setGrid] = useState<'off' | 'running' | 'over'>('off');
  const gridStart = useRef(0);
  const player = useRef<TabPlayer | null>(null);
  if (player.current === null) player.current = new TabPlayer();

  // --- session mélangée
  const [mixed, setMixed] = useState(initialMixed);
  const [queue, setQueue] = useState<ReviewTarget[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [sessionDone, setSessionDone] = useState<{ forms: number; accuracy: number; xp: number } | null>(null);
  // accumulateur de session : une ref, pour que le bilan soit juste dès le dernier clic (pas un rendu plus tard)
  const sessionAcc = useRef({ forms: 0, accuracy: 0, xp: 0 });

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
  /** Anti-rebond : une même hauteur ne produit qu'un verdict toutes les 400 ms. */
  const actedRef = useRef<{ midi: number; at: number } | null>(null);

  const plan = useMemo(() => (r.position ? segmentPlan(r.position, segment) : null), [r.position, segment]);

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
  const display = useMemo(() => (exercise ? withRevealed(exercise.score, revealed) : null), [exercise, revealed]);

  const done = Object.keys(marks).length;
  const total = exercise?.total ?? 0;
  const activeHole = useMemo(() => exercise?.holes.find((h) => h.key === activeKey) ?? null, [exercise, activeKey]);
  const stopGrid = useCallback(() => {
    player.current?.stop();
    setGrid('off');
  }, []);

  // une session mélangée demandée par l'URL démarre tout de suite (une seule fois)
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!initialMixed || autoStarted.current) return;
    autoStarted.current = true;
    startMixed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMixed]);

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
    player.current?.stop();
    setGrid('off');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.scaleId, selection.tonic, selection.tuningId, selection.system, selection.positionIndex, level, segment, seed]);

  useEffect(() => {
    if (startedAt === null || result) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [startedAt, result]);

  useEffect(() => {
    const p = player.current!;
    return () => p.dispose();
  }, []);

  const touch = () => {
    if (startedAt === null) setStartedAt(Date.now());
  };

  const startGrid = async () => {
    if (total === 0 || grid === 'running') return;
    const p = player.current!;
    const g = tempoGrid(total, settings.trainingTempo);
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
      setStartedAt(Date.now());
      setGrid('running');
      setFeedback({ ok: true, text: `grille : ${g.beats} temps à ${g.score.tempo} BPM (${g.seconds.toFixed(1)} s)` });
    } catch (e) {
      setFeedback({ ok: false, text: `métronome indisponible : ${(e as Error).message}` });
      setGrid('off');
    }
  };

  const nextOpen = useCallback((after: string | null): string | null => {
    if (!exercise) return null;
    const order = exercise.holes.map((h) => h.key);
    const from = after ? order.indexOf(after) : -1;
    for (let i = 1; i <= order.length; i++) {
      const k = order[(from + i + order.length) % order.length]!;
      if (!marks[k]) return k;
    }
    return null;
  }, [exercise, marks]);

  const finish = useCallback((finalMarks: Record<string, HoleMark>, errorCount: Record<string, number>) => {
    if (!exercise || !plan || !r.position) return;
    const right = Object.values(finalMarks).filter((m) => m === 'right').length;
    const totalHoles = exercise.total;
    const accuracy = totalHoles > 0 ? right / totalHoles : 0;
    const revealedCount = Object.values(finalMarks).filter((m) => m === 'revealed').length;
    const errorTotal = Object.values(errorCount).reduce((s, v) => s + v, 0);
    const seconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    // grille tenue ? (finie avant la fin du métronome, tolérance d'un dixième de temps)
    // au micro, le temps de jeu est celui de l'attaque de la dernière note, latence mesurée retranchée ;
    // au pavé, c'est le temps de saisie (inchangé depuis la phase 2).
    const playedSeconds = lastNotePerf.current !== null && gridStartPerf.current > 0
      ? (lastNotePerf.current - gridStartPerf.current) / 1000
      : seconds;
    const gridOutcome: GridOutcome = grid === 'off' ? 'off' : grid === 'running' && insideGrid(playedSeconds, tempoGrid(totalHoles, settings.trainingTempo)) ? 'kept' : 'missed';
    if (grid !== 'off') stopGrid();
    const attempt: Attempt = {
      id: newAttemptId(Date.now(), nodeIdOf({ scaleId: r.def.id, system: r.selection.system, formIndex: r.position.formIndex ?? r.position.index }), readAttempts(progressStore()).length),
      ts: Date.now(),
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
    };
    setResult(res);
    // réussite = au moins une étoile ; en dessous, le panneau de résultat dit la vérité sans fête
    if (res.stars > 0) setCelebrate(true);
  }, [exercise, plan, r, level, startedAt, grid, settings.trainingTempo, stopGrid]);

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
    if (Object.keys(nextMarks).length === total) finish(nextMarks, errors);
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
      if (Object.keys(nextMarks).length === total) finish(nextMarks, nextErrors);
    } else {
      setFeedback({ ok: false, text: `${heardText}non — réessaie (encore une erreur et je révèle la case)` });
    }
  }, [exercise, errors, marks, nextOpen, total, finish]);

  const validate = useCallback(() => {
    if (!activeHole || entry === '') return;
    const value = Number(entry);
    setEntry('');
    if (value === activeHole.fret) applyRight(activeHole.key, null);
    else applyWrong(activeHole.key, null);
  }, [activeHole, entry, applyRight, applyWrong]);

  /** Verdict du micro : remplit, explique, ou ne compte rien (octave douteuse, accord, hors exercice). */
  const applyVerdict = useCallback((v: MatchVerdict, heardMidi: number) => {
    switch (v.kind) {
      case 'fill': {
        const latency = inputRef.current.latencies[inputRef.current.source] ?? 0;
        lastNotePerf.current = performance.now() - latency;
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
    // masque des clics du métronome : le micro les entend comme une attaque
    if (grid === 'running' && nearClick((now - gridStartPerf.current) / 1000, settings.trainingTempo)) return;
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
      setFeedback({ ok: true, text: `${fmtNote(noteNameOf(note.midi), settings.noteNotation)} est déjà écrite dans ce segment — vise un emplacement vide.` });
      return;
    }
    applyVerdict(verdict, note.midi);
  };

  const press = useCallback((d: string) => {
    touch();
    setEntry((e) => (e.length >= 2 ? e : `${e}${d}`));
  }, [startedAt]);

  const onPick = (pick: TabPick) => {
    if (!pick.hidden) {
      setFeedback({ ok: true, text: 'cette case est déjà écrite : touche un emplacement vide' });
      return;
    }
    setActiveKey(holeKey(pick.columnIndex, pick.string));
    setEntry('');
    setFeedback(null);
  };

  // --- clavier physique : chiffres, retour arrière, entrée
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (result) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        press(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setEntry((v) => v.slice(0, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        validate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, validate, result]);

  // --- micro : ouverture à la demande, fermeture en quittant l'écran
  useEffect(() => {
    if (!micOn) {
      engine?.stop();
      setMicState('idle');
      return;
    }
    let cancelled = false;
    setMicBusy(true);
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
          setFeedback({ ok: false, text: `${info.message} — ${info.hint}` });
          setMicOn(false);
        }
      } catch (err) {
        if (!cancelled) {
          setFeedback({ ok: false, text: `micro indisponible : ${(err as Error).message}` });
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
    const unsub = engine.subscribe(() => {
      const f = engine.last;
      if (f) onFrameRef.current(f);
    });
    return unsub;
  }, [engine]);

  // la fonction de traitement change à chaque rendu (exercice, marques, erreurs) : on la rebranche
  useEffect(() => {
    onFrameRef.current = handleFrame;
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
    setScaleSelection(t.selection);
    setSeed(Math.floor(Math.random() * 1e9));
  };

  const startMixed = () => {
    const q = buildReviewQueue(readAttempts(progressStore()), Date.now());
    setJournal(readAttempts(progressStore()));
    if (q.length === 0) {
      setFeedback({ ok: false, text: 'aucune forme à réviser : commence par une écoute ou une série de trous' });
      return;
    }
    setMixed(true);
    setQueue(q);
    setQIndex(0);
    setSessionDone(null);
    setResult(null);
    sessionAcc.current = { forms: 0, accuracy: 0, xp: 0 };
    applyTarget(q[0]!);
  };

  const nextInQueue = () => {
    if (result) {
      // la série vient de finir : on agrège la session avant d'avancer
      const a = sessionAcc.current;
      const forms = a.forms + 1;
      sessionAcc.current = { forms, accuracy: (a.accuracy * a.forms + result.accuracy) / forms, xp: a.xp + result.xp };
    }
    const next = qIndex + 1;
    if (next >= queue.length) {
      // dernière forme : on affiche le bilan, avec la dernière série déjà comptée
      setSessionDone({ ...sessionAcc.current });
      setResult(null);
      return;
    }
    setQIndex(next);
    setResult(null);
    applyTarget(queue[next]!);
  };

  const toggleMixed = (on: boolean) => {
    setMixed(on);
    setSessionDone(null);
    sessionAcc.current = { forms: 0, accuracy: 0, xp: 0 };
    if (!on) {
      setQueue([]);
      setQIndex(0);
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
  }, [exercise, plan, marks, errors, activeKey, result, level, segment, total, done, grid, mixed, queue, qIndex, press, validate, journal.length, micOn, engine]);

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

  const elapsed = startedAt === null ? 0 : Math.round(((result ? result.seconds * 1000 : now - startedAt)) / 1000);
  const activeStringLabel = activeHole
    ? `${fmtNote(r.tuning.strings[activeHole.string]!.replace(/-?\d+$/, ''), settings.noteNotation)} ${activeHole.string === 0 ? '(grave)' : activeHole.string === r.tuning.strings.length - 1 ? '(aiguë)' : ''}`.trim()
    : null;
  const gridSpec = tempoGrid(total, settings.trainingTempo);
  // XP total et XP du jour : recalculés depuis le journal, comme partout ailleurs
  const totals = useMemo(() => xpSummary(journal, new Date()), [journal]);
  const streakDays = useMemo(() => streak(journal, new Date()).days, [journal]);
  const sessionsToday = useMemo(() => summarizeDay(journal, new Date()).exercises, [journal]);

  return (
    <main className="shell">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate(mixed ? 'hub' : 'gammes')} aria-label="Retour">‹</button>
        <div>
          <h1 className="page-title">{r.title}</h1>
          <p className="t-small t-dim">{positionLabelPlain(r.position, settings.noteNotation)} · {plan.label}</p>
        </div>
        <span className="tag tag-on">{mixed && queue.length > 0 ? `Session ${qIndex + 1} / ${queue.length}` : `N${level}`}</span>
      </header>

      <TabView
        score={display}
        notes={settings.noteNotation}
        chords={settings.chordNotation}
        annotation="degree"
        mode="wrap"
        scale="auto"
        reduceMotion={settings.reduceMotion}
        player={null}
        transport="stopped"
        hideRhythm
        onPick={onPick}
        {...(activeKey ? { activeHoleKey: activeKey } : {})}
      />

      <TabLegend def={r.def} readonly={settings.reduceMotion} />


      <Panel className="span-7" accent="magenta" label="Exercice" right={<span className="badge">{done} / {total}</span>}>
        <div className={`mic-line ${micState === 'listening' ? 'on' : ''}`}>
          <div className="mic-line-body">
            <span className="mic-line-title">
              {micState === 'listening' ? 'Micro ouvert : joue la note, elle se remplit' : 'Valide au micro (tu joues) ou au pavé (tu tapes)'}
            </span>
            <span className="t-small t-dim">
              {micBusy
                ? 'ouverture du périphérique…'
                : micState === 'listening'
                  ? 'le pavé numérique reste disponible à tout moment'
                  : 'le micro ou l’interface USB doit être branché avant d’ouvrir'}
            </span>
          </div>
          {micState === 'listening' ? (
            <PixelButton variant="quiet" onClick={() => setMicOn(false)}>Fermer</PixelButton>
          ) : (
            <PixelButton variant="primary" onClick={() => setMicOn(true)} disabled={micBusy}>
              ▶ Ouvrir le micro
            </PixelButton>
          )}
        </div>
        {mixed && queue.length > 0 && (
          <p className="t-small">
            Formes : {queue.map((t) => `${t.title} (${t.positionLabel})`).join(' → ')}.
            {queue[qIndex] ? ` Celle-ci : ${queue[qIndex]!.reason}.` : ''}
          </p>
        )}
        {!mixed && (
          <div className="field">
            <span className="t-label">Niveau</span>
            <Segmented<AttemptLevel>
              size="sm"
              label="Niveau"
              value={level}
              onChange={(v) => restart(v, segment)}
              options={[
                { value: 2, label: 'N2 · trous' },
                { value: 3, label: 'N3 · rappel' },
              ]}
            />
          </div>
        )}
        <p className="t-small">
          {level === 2
            ? `${Math.round(settings.holeRate * 100)} % des notes masquées (au moins 2, jamais toutes) : ici ${total} trou${total > 1 ? 's' : ''} sur ${exercise.notes}. `
              + (micOn
                ? 'Joue la note à la guitare : elle remplit l’emplacement. Le pavé reste un secours.'
                : 'Touche un emplacement vide, tape son numéro au pavé, valide.')
            : `${exercise.notes} cases à écrire de mémoire : seules les cordes, les mesures et le rythme restent visibles.`
              + (micOn ? ' Joue-les dans l’ordre que tu veux.' : '')}
        </p>
        <div className="row exercise-start">
          <PixelButton variant="primary" onClick={() => restart()} title="Même gamme, nouveaux trous">▶ Nouvelle série</PixelButton>
          <PixelButton variant="quiet" onClick={() => navigate('scale')}>Écouter d’abord</PixelButton>
          {startedAt !== null && !result && <span className="t-label">{mmss(elapsed)}</span>}
        </div>

        <details className="adv-settings">
          <summary className="t-label">Réglages de la série · découpage, mélange, métronome</summary>
          <div className="row">
            <Switch checked={mixed} onChange={toggleMixed} label="Session mélangée" hint="3 à 5 formes différentes d’affilée" />
          </div>
          {!mixed && (
            <div className="field">
              <span className="t-label">Découpage</span>
              <Segmented<Segment>
                size="sm"
                label="Découpage"
                value={segment}
                onChange={(v) => restart(level, v)}
                options={SEGMENTS.map((s) => ({ value: s.value, label: s.label, note: s.hint }))}
              />
            </div>
          )}
          <div className="grid-row">
            <div className="tempo">
              <button type="button" className="tempo-btn" onClick={() => setSettings({ trainingTempo: Math.max(30, settings.trainingTempo - 5) })} aria-label="Grille moins vite">−</button>
              <span className="tempo-val">♩ {settings.trainingTempo}</span>
              <button type="button" className="tempo-btn" onClick={() => setSettings({ trainingTempo: Math.min(120, settings.trainingTempo + 5) })} aria-label="Grille plus vite">+</button>
            </div>
            <PixelButton variant={grid === 'running' ? 'primary' : 'ghost'} onClick={() => (grid === 'running' ? stopGrid() : void startGrid())} disabled={!!result}>
              {grid === 'running' ? 'Arrêter la grille' : 'Grille (métronome)'}
            </PixelButton>
            <span className="t-small t-dim">{gridSpec.beats} temps ≈ {gridSpec.seconds.toFixed(1)} s</span>
          </div>
          <p className="t-small t-dim">
            Un temps par trou, en mesures entières. Finir dans la grille et juste à ≥ 95 % vaut ★★,
            parfait sans une erreur vaut ★★★. Le métronome ne joue aucune note : il ne donne pas les réponses.
          </p>
        </details>
      </Panel>

      <Panel className="span-5 numpad-panel" accent="cyan" label={micOn ? 'Micro · pavé en secours' : 'Pavé numérique'} right={activeStringLabel ? <span className="tag">corde de {activeStringLabel}</span> : <span className="tag">aucun trou</span>}>
        {micOn && (
          <MicStrip
            engine={engine}
            notation={settings.noteNotation}
            thresholdDb={input.thresholds[input.source]}
            tolerance={input.centsTolerance}
            tuning={r.tuning}
            a4={input.a4}
          />
        )}
        <div className="numpad-entry" aria-live="polite">
          <span className="numpad-label">{activeStringLabel ? 'Case ?' : 'touche un emplacement vide'}</span>
          <span className="numpad-digits">{entry || '—'}</span>
        </div>
        <div className="numpad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} type="button" className="key" onClick={() => press(d)} disabled={!activeHole || !!result}>{d}</button>
          ))}
          <button type="button" className="key key-alt" onClick={() => setEntry('')} disabled={!entry}>C</button>
          <button type="button" className="key" onClick={() => press('0')} disabled={!activeHole || !!result}>0</button>
          <button type="button" className="key key-ok" onClick={validate} disabled={!activeHole || entry === '' || !!result}>✓</button>
        </div>
        <p className="t-small t-dim">
          Clavier physique : chiffres, retour arrière, entrée. Une case à deux chiffres (10 à 24) se tape d’affilée.
        </p>
        {feedback && (
          <p className={`t-small numpad-feedback ${feedback.ok ? 'ok' : 'no'}`} role="status">{feedback.text}</p>
        )}
      </Panel>


      {sessionDone && mixed ? (
        <Panel className="span-7" accent="green" label="Session terminée">
          <p className="stat-line">
            <strong>{sessionDone.forms}</strong> forme{sessionDone.forms > 1 ? 's' : ''} · précision moyenne{' '}
            <strong>{Math.round(sessionDone.accuracy * 100)} %</strong> · <strong>{sessionDone.xp}</strong> XP
          </p>
          <p className="t-small">
            Enchaîner des formes différentes coûte plus cher sur le moment et retient mieux que répéter la même :
            c’est fait exprès. Les échéances sont recalculées, le hub les affiche.
          </p>
          <div className="row">
            <PixelButton variant="primary" onClick={startMixed}>Nouvelle session</PixelButton>
            <PixelButton variant="quiet" onClick={() => navigate('hub')}>Accueil</PixelButton>
          </div>
        </Panel>
      ) : result ? (
        <Panel className="span-7" accent={result.stars > 0 ? 'green' : 'orange'} label="Résultat">
          <p className="result-stars">{starRow(result.stars)}</p>
          <p className="stat-line">
            <strong>{Math.round(result.accuracy * 100)} %</strong> de trous justes au premier essai · {result.revealed} révélé{result.revealed > 1 ? 's' : ''} · {result.errors} erreur{result.errors > 1 ? 's' : ''}
          </p>
          <p className="t-small">
            {result.grid === 'kept'
              ? `grille tenue en ${mmss(result.seconds)} · `
              : result.grid === 'missed'
                ? `hors grille (${mmss(result.seconds)} pour ${gridSpec.seconds.toFixed(1)} s) · `
                : ''}
            {result.xp > 0
              ? `+${result.xp} XP. Tentative enregistrée : elle entre dans la répétition espacée.`
              : '0 XP. La tentative est enregistrée quand même : elle dit où tu en es, et rien n’est bloqué.'}
          </p>
          <div className="row">
            {mixed ? (
              <>
                <PixelButton variant="primary" onClick={nextInQueue} disabled={queue.length === 0}>
                  {qIndex + 1 >= queue.length ? 'Terminer la session' : `Suivant · ${queue[qIndex + 1]?.title ?? ''}`}
                </PixelButton>
                <PixelButton variant="quiet" onClick={() => restart()}>Refaire celle-ci</PixelButton>
              </>
            ) : (
              <>
                <PixelButton variant="primary" onClick={() => restart()}>Rejouer</PixelButton>
                <PixelButton onClick={() => restart(level === 2 ? 3 : 2, segment)}>{level === 2 ? 'Passer au rappel (N3)' : 'Revenir aux trous (N2)'}</PixelButton>
                <PixelButton variant="quiet" onClick={() => navigate('gammes')}>Changer de gamme</PixelButton>
                <PixelButton variant="quiet" onClick={() => navigate('hub')}>Accueil</PixelButton>
              </>
            )}
          </div>
          <p className="t-small t-dim">
            Étoiles : ★ dès 80 % · ★★ dès 95 % · ★★★ sans une erreur ni une case révélée. Si tu as lancé la grille,
            ★★ et ★★★ exigent de la tenir ; la manquer plafonne à ★. Une case écrite de mémoire (N3) pèse 1,5 dans la
            maîtrise, un trou comblé (N2) pèse 1.
          </p>
        </Panel>
      ) : (
        <Panel className="span-7" accent="violet" label="Ce que cet exercice mesure">
          <p className="t-body">
            Les trous justes <strong>au premier essai</strong>. Une case trouvée du deuxième coup n’est pas « sue »,
            elle est reconnue. Le score d’aujourd’hui déplace la case dans la file de révision, il ne la certifie pas.
          </p>
          <p className="t-small t-dim">
            Série de {total} trou{total > 1 ? 's' : ''} sur {exercise.notes} note{exercise.notes > 1 ? 's' : ''} ({plan.strings} corde{plan.strings > 1 ? 's' : ''}).
            {journal.length > 0 ? ` ${journal.length} tentative${journal.length > 1 ? 's' : ''} déjà enregistrée${journal.length > 1 ? 's' : ''} sur cet appareil.` : ' Aucune tentative enregistrée pour l’instant.'}
          </p>
          <p className="t-small t-dim">
            L’annotation sous la tablature reste celle de ton réglage (notes, degrés, intervalles, doigtés) — elle est masquée sur les trous.
          </p>
        </Panel>
      )}

      {result && celebrate && result.stars > 0 && (
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
        />
      )}

      <div className="pos-nav">
        <PixelButton variant="quiet" onClick={() => setScaleSelection({ positionIndex: Math.max(0, r.selection.positionIndex - 1) })} disabled={r.selection.positionIndex === 0}>‹ Position</PixelButton>
        <span className="t-label pos-count">{r.selection.positionIndex + 1} / {r.positions.length}</span>
        <PixelButton variant="quiet" onClick={() => setScaleSelection({ positionIndex: Math.min(r.positions.length - 1, r.selection.positionIndex + 1) })} disabled={r.selection.positionIndex >= r.positions.length - 1}>Position ›</PixelButton>
      </div>

      <p className="t-small t-dim foot-note">
        Niveau 1 (découverte, avec le son) : <button type="button" className="linkish" onClick={() => navigate('scale')}>écran d’écoute</button>.
        Niveau 4 (improvisation) : <button type="button" className="linkish" onClick={() => navigate('impro')}>improviser sur un accompagnement</button>.
        Une note masquée n’est jamais jouée par l’app avant d’être trouvée.
      </p>
    </main>
  );
}
