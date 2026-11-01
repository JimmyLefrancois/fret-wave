/**
 * Module Gammes — séance de révision (D128) : le rappel à froid, seul exercice restant de l'ancien parcours.
 *
 * La file vient du journal (`review.ts`) ; « Réviser cette forme » y met la forme ouverte. Chaque forme se
 * joue de mémoire, micro ouvert, position entière en aller-retour, sur une tablature qui ne garde que les
 * cordes (MUSIC_DESIGN §3.4). Sous 80 %, « Regarde la forme », puis un rattrapage qui ne compte pas
 * (`coldReview.ts`).
 *
 * Une tentative n'est enregistrée qu'une fois la série terminée, avec les notes justes **au premier essai** :
 * c'est la seule mesure honnête de ce qui est retenu. Une case révélée après deux erreurs compte comme fausse.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { clearFormReview, peekFormReview, setScaleSelection, useScaleSelection } from '../../app/scaleSession';
import { useSettings } from '../../app/settings';
import { TabView } from '../../app/TabView';
import { NeckView } from '../../app/NeckView';
import { Panel, PixelButton } from '../../app/ui';
import { ensureInputEngine, inputEngineIfAny, windowFor } from '../../app/inputSession';
import { AudioEngine } from '../../core/audio/engine';
import { describeInputError, type InputEngine, type InputFrame } from '../../core/input/engine';
import { matchPitch, noteNameOf, targetsFor, type MatchVerdict } from '../../core/input/match';
import { useInputSettings } from '../../core/input/settings';
import { fmtNote } from '../../core/theory';
import { neckNotes, positionToScore } from '../../core/tab';
import {
  PASS, appendAttempt, cardOf, cardsFrom, newAttemptId, nodeIdOf, progressStore, readAttempts, type Attempt,
} from '../../core/progress';
import { degreeName, fmtDegree, legendFor, positionLabelPlain, resolveScale } from './resolve';
import { TabLegend } from './TabLegend';
import { PlaySection } from './PlaySection';
import { useDesktop } from '../../app/useDesktop';
import { LandscapeView, openLandscape } from '../../app/LandscapeView';
import { canAutoOpenMic, micPermission } from '../../core/input/autoOpen';
import { buildExercise, missedSummary, stepOpen, stringsOf, withRevealed } from './exercise';
import {
  REVIEW_MAX, buildReviewQueue, formReviewTarget, moreDue, reviewDelayText, sessionFact, type ReviewTarget,
} from './review';
import { coldNext, countsAsProof, lookRemaining, retryLine, type ColdStep } from './coldReview';
import * as clock from '../../core/clock';

type HoleMark = 'right' | 'revealed';

interface Result {
  accuracy: number;
  seconds: number;
  revealed: number;
  errors: number;
  /** La tentative vaut-elle preuve ? (`false` : rattrapage, écrit `afterReveal`) */
  proof: boolean;
}

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ScaleReviewPage() {
  const wide = useDesktop();
  // la série se joue en paysage ; un grand téléphone y dépasse 900 px, sans changer de rendu pour autant
  const [playing, setPlaying] = useState(false);
  const desktop = wide && !playing;
  const closePlay = useCallback(() => setPlaying(false), []);
  const [infoOpen, setInfoOpen] = useState(false);
  const settings = useSettings();
  const selection = useScaleSelection();
  const r = useMemo(() => resolveScale(selection, settings.noteNotation), [selection, settings.noteNotation]);
  // la gamme d'avant la séance (qui change de forme, voire de tonique) : on y revient à la fin
  const homeSelection = useRef(selection);

  /** Change à chaque nouvelle série : remet le plateau à zéro. */
  const [round, setRound] = useState(0);
  const [marks, setMarks] = useState<Record<string, HoleMark>>({});
  const [errors, setErrors] = useState<Record<string, number>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string; info?: true } | null>(null);
  // erreur d'ouverture du micro : affichée à côté du bouton qui l'a provoquée, pas dans le verdict
  const [micError, setMicError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => clock.now());
  const [result, setResult] = useState<Result | null>(null);
  const [journal, setJournal] = useState<Attempt[]>(() => readAttempts(progressStore()));
  const resultRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  // --- séance
  const [queue, setQueue] = useState<ReviewTarget[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [sessionDone, setSessionDone] = useState<{ forms: number; accuracy: number; retries: number } | null>(null);
  // rien à réviser : état vide explicite (pas d'exercice sur la forme courante)
  const [emptyReview, setEmptyReview] = useState(false);
  // dues restantes à la fin d'une séance (« Encore 3 formes dues »)
  const moreDueNow = sessionDone ? moreDue(journal, clock.now()) : 0;
  // accumulateur de session : une ref, pour que le bilan soit juste dès le dernier clic (pas un rendu plus tard)
  const sessionAcc = useRef({ forms: 0, accuracy: 0, retries: 0 });
  /**
   * `cold` = essai qui compte ; `look` = « Regarde la forme » ; `retry` = rattrapage écrit `afterReveal` ;
   * `next` = fini pour cette forme.
   */
  const [coldStep, setColdStep] = useState<ColdStep>('cold');
  const [lookStart, setLookStart] = useState<number | null>(null);
  /** « Refaire celle-ci » : la forme vient d'être montrée, l'essai ne prouve plus rien. */
  const [retake, setRetake] = useState(false);
  const proofless = (!countsAsProof(coldStep) && coldStep !== 'next') || retake;
  const coldActive = coldStep === 'cold' || coldStep === 'retry';

  // --- micro : le seul moyen de répondre, on joue la note à la guitare
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
  /** Cases remplies en jouant. */
  const micFills = useRef(0);
  /** Anti-rebond : une même hauteur ne produit qu'un verdict toutes les 400 ms. */
  const actedRef = useRef<{ midi: number; at: number } | null>(null);

  // « Regarde la forme » : la position entière sur le manche (mémoïsée : l'écran se redessine chaque seconde)
  const lookNeck = useMemo(
    () => (r.position ? { notes: neckNotes(r.position, 'degree', settings.noteNotation), zone: { from: r.position.fretMin, to: r.position.fretMax } } : null),
    [r.position, settings.noteNotation],
  );

  const baseScore = useMemo(() => {
    if (!r.position) return null;
    try {
      return positionToScore(r.position, r.tuning, {
        direction: 'updown',
        fingers: true,
        labelText: positionLabelPlain(r.position, settings.noteNotation),
        ...(r.chord ? { chord: r.chord } : {}),
      });
    } catch {
      return null;
    }
  }, [r.tuning, r.position, r.chord, settings.noteNotation]);

  const exercise = useMemo(() => (baseScore ? buildExercise(baseScore) : null), [baseScore]);

  const revealed = useMemo(() => new Set(Object.keys(marks)), [marks]);
  // révélées sans avoir été trouvées : contour pointillé, pour revoir où l'on a raté
  const missed = useMemo(() => new Set(Object.keys(marks).filter((k) => marks[k] === 'revealed')), [marks]);
  const display = useMemo(() => (exercise ? withRevealed(exercise.score, revealed, missed) : null), [exercise, revealed, missed]);

  const done = Object.keys(marks).length;
  const total = exercise?.total ?? 0;
  const activeHole = useMemo(() => exercise?.holes.find((h) => h.key === activeKey) ?? null, [exercise, activeKey]);

  // --- remise à zéro quand la cible change (gamme, position, nouvelle série)
  useEffect(() => {
    setMarks({});
    setErrors({});
    setActiveKey(null);
    setFeedback(null);
    setStartedAt(null);
    setResult(null);
    actedRef.current = null;
    micFills.current = 0;
  }, [selection.scaleId, selection.tonic, selection.tuningId, selection.system, selection.positionIndex, round]);

  const applyTarget = useCallback((t: ReviewTarget) => {
    setScaleSelection(t.selection);
    setRound((n) => n + 1);
    setColdStep('cold');
    setLookStart(null);
    setRetake(false);
  }, []);

  const startSession = useCallback(() => {
    const attempts = readAttempts(progressStore());
    const asked = peekFormReview() ? formReviewTarget(homeSelection.current) : null;
    const q = asked ? [asked] : buildReviewQueue(attempts, clock.now(), REVIEW_MAX);
    clearFormReview();
    setJournal(attempts);
    setEmptyReview(q.length === 0);
    setQueue(q);
    setQIndex(0);
    setSessionDone(null);
    setResult(null);
    sessionAcc.current = { forms: 0, accuracy: 0, retries: 0 };
    if (q.length > 0) applyTarget(q[0]!);
  }, [applyTarget]);

  // déclarée après la remise à zéro, qui sinon effaçait l'état de la séance au montage
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    startSession();
  }, [startSession]);

  useEffect(() => {
    if (startedAt === null || result) return;
    const t = window.setInterval(() => setNow(clock.now()), 250);
    return () => window.clearInterval(t);
  }, [startedAt, result]);

  const touch = () => {
    if (startedAt !== null) return;
    // `now` n'avance qu'au tick de 250 ms : sans ce rafraîchissement, le chrono affiche « -1:-2 » au premier appui
    const t = clock.now();
    setStartedAt(t);
    setNow(t);
  };

  const restart = () => setRound((n) => n + 1);

  // fermer la vue de jeu avant la fin remet la série à zéro, à froid compris (D137) : rien n'est écrit au journal
  const wasPlaying = useRef(false);
  useEffect(() => {
    const closed = wasPlaying.current && !playing;
    wasPlaying.current = playing;
    if (closed && !result) restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const nextOpen = useCallback((after: string | null, dir: 1 | -1 = 1): string | null => {
    if (!exercise) return null;
    return stepOpen(exercise.holes.map((h) => h.key), (k) => !marks[k], after, dir);
  }, [exercise, marks]);

  // un trou est toujours désigné : c'est lui que le micro cherche à remplir
  useEffect(() => {
    // série finie : plus de trou désigné (son cadre restait dessiné sur la dernière étiquette)
    if (result) {
      if (activeKey !== null) setActiveKey(null);
      return;
    }
    if (!exercise || activeKey !== null) return;
    const first = nextOpen(null);
    if (first) setActiveKey(first);
  }, [exercise, result, activeKey, nextOpen]);

  const finish = useCallback((finalMarks: Record<string, HoleMark>, errorCount: Record<string, number>) => {
    if (!exercise || !r.position) return;
    const right = Object.values(finalMarks).filter((m) => m === 'right').length;
    const accuracy = exercise.total > 0 ? right / exercise.total : 0;
    const seconds = startedAt ? Math.round((clock.now() - startedAt) / 1000) : 0;
    const formIndex = r.position.formIndex ?? r.position.index;
    const attempt: Attempt = {
      id: newAttemptId(clock.now(), nodeIdOf({ scaleId: r.def.id, system: r.selection.system, formIndex }), readAttempts(progressStore()).length),
      ts: clock.now(),
      kind: 'recall',
      scaleId: r.def.id,
      tonic: r.tonic,
      tuningId: r.tuning.id,
      system: r.selection.system,
      positionId: r.position.id,
      formIndex,
      level: 3,
      strings: stringsOf(r.position),
      correct: right,
      total: exercise.total,
      seconds,
      fretMin: r.position.fretMin,
      // diagnostic par corde : les trous qui ont coûté une erreur (ou une révélation)
      missedStrings: [...new Set(Object.keys(errorCount).map((k) => Number(k.split(':')[1] ?? 0)).filter((s) => Number.isInteger(s)))],
      tempoOk: false,
      ...(proofless ? { afterReveal: true as const } : {}),
      ...(micFills.current > 0 ? { mic: true as const } : {}),
      fullPosition: true,
    };
    setJournal(appendAttempt(progressStore(), attempt));
    setResult({
      accuracy,
      seconds,
      revealed: Object.values(finalMarks).filter((m) => m === 'revealed').length,
      errors: Object.values(errorCount).reduce((s, v) => s + v, 0),
      proof: !proofless,
    });
    // la session n'agrège que les essais qui prouvent : un rattrapage ne remonte pas la moyenne
    const acc = sessionAcc.current;
    if (!proofless) {
      const forms = acc.forms + 1;
      sessionAcc.current = { ...acc, forms, accuracy: (acc.accuracy * acc.forms + accuracy) / forms };
    } else if (coldStep === 'retry') {
      // le bilan dit combien de rattrapages ont suivi « Regarde la forme » (constat 5)
      sessionAcc.current = { ...acc, retries: acc.retries + 1 };
    }
    if (coldStep === 'cold' || coldStep === 'retry') setColdStep(coldNext(coldStep, { type: 'finished', accuracy }));
  }, [exercise, r, startedAt, proofless, coldStep]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise, marks, nextOpen, settings.noteNotation, total, finish, errors]);

  /**
   * Réponse fausse : la 2ᵉ erreur révèle la case (comptée fausse). `heard` = note réellement jouée,
   * affichée telle quelle.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise, errors, marks, nextOpen, total, finish]);

  /** Verdict du micro : remplit, explique, ou ne compte rien (octave douteuse, accord, hors exercice). */
  const applyVerdict = useCallback((v: MatchVerdict, heardMidi: number) => {
    switch (v.kind) {
      case 'fill':
        micFills.current += 1;
        applyRight(v.target.key, v.cents);
        break;
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
    const at = performance.now();
    const prev = actedRef.current;
    if (prev && prev.midi === note.midi && at - prev.at < 400) return;
    const open = exercise.holes.filter((h) => !marks[h.key]);
    if (open.length === 0) return;
    const targets = targetsFor(open, r.tuning);
    const verdict = matchPitch(note.midi + note.cents / 100, targets, {
      centsTolerance: input.centsTolerance,
      activeKey,
    });
    actedRef.current = { midi: note.midi, at };
    if (verdict.kind === 'fill' || verdict.kind === 'tuning' || verdict.kind === 'empty') {
      applyVerdict(verdict, note.midi);
      return;
    }
    // Une note déjà trouvée n'est **jamais** une erreur : c'est ainsi qu'on se repère avant de viser la case.
    // Le test porte sur le score affiché : un trou encore vide y est `hidden`, une note écrite ne l'est pas.
    const written = display?.measures
      .flatMap((m) => m.events.flatMap((e) => e.notes))
      .find((n) => !n.muted && !n.hidden && n.midi === note.midi);
    if (written) {
      setFeedback({ ok: true, info: true, text: `${fmtNote(noteNameOf(note.midi), settings.noteNotation)} est déjà écrite dans ce segment — vise un emplacement vide.` });
      return;
    }
    applyVerdict(verdict, note.midi);
  };

  // --- micro : ouverture à la demande, fermeture en quittant l'écran
  useEffect(() => {
    if (!micOn) {
      engine?.stop();
      setMicState('idle');
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
    return engine.subscribe(() => {
      const f = engine.last;
      if (f) onFrameRef.current(f);
    });
  }, [engine]);

  // la fonction de traitement change à chaque rendu (exercice, marques, erreurs) : on la rebranche
  useEffect(() => {
    // téléphone : on ne compte que ce qui se joue tablature ouverte
    onFrameRef.current = wide || playing ? handleFrame : () => {};
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

  /** Fin de « Regarde la forme » : la forme se masque, nouvel essai de mémoire (rattrapage). */
  const beginRetry = useCallback(() => {
    setColdStep('retry');
    setLookStart(null);
    setResult(null);
    setRound((n) => n + 1);
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

  // série finie : retour au portrait, où se lit le résultat
  useEffect(() => {
    if (result) setPlaying(false);
  }, [result]);

  // la session est agrégée dans `finish` (essais qui prouvent seulement) : avancer ne compte rien
  const nextInQueue = () => {
    const next = qIndex + 1;
    if (next >= queue.length) {
      // dernière forme : on affiche le bilan, avec la dernière série déjà comptée, et on retrouve sa gamme
      setSessionDone({ ...sessionAcc.current });
      setResult(null);
      setScaleSelection(homeSelection.current);
      return;
    }
    setQIndex(next);
    setResult(null);
    applyTarget(queue[next]!);
  };

  /** Quitter la séance en cours : on retrouve sa gamme, pas la dernière forme rappelée. */
  const leave = () => {
    setScaleSelection(homeSelection.current);
    navigate('gammes');
  };

  // --- crochet de vérification (développement uniquement) : état de la séance, jamais en production
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __review?: unknown }).__review = {
      queue, qIndex, marks, errors, activeKey, result, sessionDone, total, done, coldStep, emptyReview,
      /** Joue la note attendue (juste) ou une fausse, sans micro : le reste du parcours est le vrai. */
      answer: (ok: boolean) => {
        if (activeKey) (ok ? applyRight : applyWrong)(activeKey, null);
      },
      nextInQueue,
      startLook: () => { setLookStart(clock.now()); setNow(clock.now()); },
      endLook: beginRetry,
      journalLength: journal.length,
      // fonctions et non valeurs : l'état du moteur change 47 fois par seconde sans re-rendu de la page
      mic: { on: micOn, state: () => engine?.state ?? 'idle', set: (v: boolean) => setMicOn(v), last: () => engine?.last ?? null },
    };
  });

  // la forme vient de se terminer : son échéance se relit dans le journal à jour
  const nextReview = useMemo(() => {
    if (!result || !r.position) return null;
    const id = nodeIdOf({ scaleId: r.def.id, system: r.selection.system, formIndex: r.position.formIndex ?? r.position.index });
    return cardOf(cardsFrom(journal), id);
  }, [result, journal, r]);

  // rien à réviser : on le dit, au lieu d'ouvrir un exercice sur la forme courante (D97)
  if (emptyReview) {
    const started = journal.some((a) => a.module !== 'accords' && (a.kind === 'holes' || a.kind === 'recall'));
    return (
      <main className="shell">
        <header className="page-head">
          <button type="button" className="back" onClick={() => navigate('gammes')} aria-label="Retour à Gammes">‹</button>
          <div>
            <h1 className="page-title">Révision</h1>
          </div>
        </header>
        <Panel accent="green" label="Révision">
          <p className="t-body">Aucune forme à réviser pour l’instant.</p>
          <p className="t-small">
            {started
              ? 'Rien n’est dû aujourd’hui. Le haut de la page Gammes te dira quand une forme revient.'
              : 'Ouvre une forme dans Découvrir, puis touche « Réviser cette forme » : elle reviendra ici à son heure.'}
          </p>
          <div className="row">
            <PixelButton variant="primary" onClick={() => navigate('gammes')}>Gammes</PixelButton>
          </div>
        </Panel>
      </main>
    );
  }

  if (!r.position || !exercise || !display) {
    return (
      <main className="shell">
        <header className="page-head">
          <button type="button" className="back" onClick={() => navigate('gammes')} aria-label="Retour à la sélection">‹</button>
          <div>
            <h1 className="page-title">Révision</h1>
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
  const stringNames = r.tuning.strings.map((pitch, i, all) =>
    `${fmtNote(pitch.replace(/-?\d+$/, ''), settings.noteNotation)}${i === 0 ? ' grave' : i === all.length - 1 ? ' aigu' : ''}`);
  const missedLine = result ? missedSummary(exercise.holes, missed, stringNames) : null;
  const openPlay = () => {
    setPlaying(true);
    openLandscape();
  };
  const activeIndex = activeKey ? exercise.holes.findIndex((h) => h.key === activeKey) + 1 : 0;

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
  const sessionPanel = sessionDone && (
    <Panel className="span-5" accent="green" active label="Session terminée">
      <p className="stat-line">
        <strong>{sessionDone.forms}</strong> forme{sessionDone.forms > 1 ? 's' : ''} · précision moyenne{' '}
        <strong>{Math.round(sessionDone.accuracy * 100)} %</strong>
      </p>
      <p className="t-small">Les échéances sont recalculées : le haut de la page Gammes les affiche.</p>
      {retryLine(sessionDone.retries) && <p className="t-small">{retryLine(sessionDone.retries)}</p>}
      <div className="row">
        {/* la séance s'arrête à 5 ; s'il reste des dues (8 au plus aujourd'hui), on propose la suite (D97) */}
        {moreDueNow > 0 && (
          <PixelButton variant="primary" onClick={startSession}>Encore {moreDueNow} forme{moreDueNow > 1 ? 's' : ''} due{moreDueNow > 1 ? 's' : ''}</PixelButton>
        )}
        <PixelButton variant={moreDueNow > 0 ? 'quiet' : 'primary'} onClick={() => navigate('gammes')}>Gammes</PixelButton>
      </div>
    </Panel>
  );
  const resultPanel = result && (
    <Panel className="span-5" accent={result.accuracy >= PASS ? 'green' : 'orange'} active label="Résultat">
      {!result.proof && <p className="t-label">Rattrapage</p>}
      <p className={`stat-line ${result.accuracy < PASS ? 'miss' : ''}`} ref={resultRef} tabIndex={-1}>
        <strong>{Math.round(result.accuracy * 100)} %</strong> de notes justes au premier essai · {result.revealed} révélée{result.revealed > 1 ? 's' : ''} · {result.errors} erreur{result.errors > 1 ? 's' : ''}
      </p>
      {missedLine && <p className="t-small">{missedLine} — contour pointillé sur la tablature.</p>}
      <p className="t-small">
        {!result.proof
          ? 'Essai de rattrapage : enregistré, sans effet sur la révision.'
          : nextReview
            ? `Tentative enregistrée · ${reviewDelayText(nextReview.due - clock.now())}.`
            : 'Tentative enregistrée.'}
      </p>
      {coldStep === 'look' && (
        <>
          <p className="t-small">
            {lookStart === null
              ? `${Math.round(result.accuracy * 100)} % à froid, sous les 80 % : la forme revient bientôt. Regarde-la ${settings.lookSeconds} s, puis rejoue-la de mémoire — ce second essai ne compte pas.`
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
      {coldStep !== 'look' && (
        <div className="row">
          <PixelButton variant="primary" onClick={nextInQueue} disabled={queue.length === 0}>
            {qIndex + 1 >= queue.length ? 'Terminer la session' : `Suivant · ${queue[qIndex + 1]?.title ?? ''}`}
          </PixelButton>
          <PixelButton variant="quiet" onClick={() => { setRetake(true); restart(); }} title="Juste après la correction : l’essai est enregistré sans compter">
            Refaire celle-ci
          </PixelButton>
        </div>
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
      {activeIndex > 0 && activeStringLabel ? `Emplacement ${activeIndex} sur ${total}, corde de ${activeStringLabel}.` : ''}
    </p>
  );
  const sessionFacts = queue.length > 0 && queue[qIndex] && (
      <dl className="ex-facts">
        <dt>Session</dt>
        <dd>
          {sessionFact(qIndex, queue.length, queue[qIndex]!)}
          {queue.length > 1 && (
            <details className="ex-more">
              <summary>Les {queue.length} formes</summary>
              <ol>
                {queue.map((t, i) => (
                  <li key={`${t.nodeId}-${i}`} className={i === qIndex ? 'current' : ''}>{t.title} ({t.positionLabel}) : {t.reason}</li>
                ))}
              </ol>
            </details>
          )}
        </dd>
        <dt>Consigne</dt>
        <dd>
          {coldStep === 'retry'
            ? 'Rattrapage : tu viens de voir la forme, il ne compte pas.'
            : 'De mémoire, sans revoir la forme. Seul ce premier essai compte.'}
        </dd>
      </dl>
    );
  const elapsedLabel = startedAt !== null && !result && <span className="t-label">{mmss(elapsed)}</span>;
  const howScoredBody = (
    <>
      <p className="t-small">
        Les notes justes <strong>au premier essai</strong>. Une note trouvée du deuxième coup n’est pas sue, elle est
        reconnue. Le score d’aujourd’hui place la forme dans la file de révision, il ne la certifie pas.
      </p>
      <p className="t-small t-dim">
        Six paliers : 10 min, 1 jour, 3, 7, 16, puis 35 jours. À 95 % ou plus, la forme monte d’un palier. De 80 à 94 %,
        elle reste, et monte après deux fois d’affilée. Sous 80 %, elle descend de deux paliers.
      </p>
      <p className="t-small t-dim">
        Valide au micro : le micro ou l’interface USB doit être branché avant d’ouvrir. Une note masquée n’est jamais
        jouée par l’app avant d’être trouvée.
      </p>
    </>
  );
  const skip = coldActive && <PixelButton variant="quiet" onClick={nextInQueue}>Passer · forme suivante</PixelButton>;
  const degrees = legendFor(r.def);
  const headTag = queue.length > 0 ? `Session ${qIndex + 1} / ${queue.length}${coldActive ? ' · à froid' : ''}` : 'Révision';
  const subtitle = <p className="t-small t-dim">{positionLabelPlain(r.position, settings.noteNotation)} · position entière, aller-retour</p>;
  const back = <button type="button" className="back" onClick={leave} aria-label="Retour à Gammes">‹</button>;

  if (desktop) {
    const finished = result || sessionDone;
    return (
      <main className="shell play-shell">
        <div className="play-surface">
          {/* le micro reste à portée : on le touche la guitare en main */}
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
            {!micOn && !sessionDone && <div className="play-transport">{micAction}</div>}
            {!sessionDone && <span className="badge badge-count">{done} / {total} notes</span>}
            {elapsedLabel}
          </header>

          {!sessionDone && <section className="play-tab">
            <div className="play-tab-bar">
              {/* à froid, rien ne fuit : pas de légende avant la fin de la série */}
              {tabLegend !== false && (
                <div className="play-degrees" role="img" aria-label={`Couleurs des degrés : ${degrees.map((it) => it.name).join(', ')}`}>
                  {degrees.map((it) => (
                    <span key={it.fn} className="legend-pill" style={{ background: it.fill, color: it.digit }}>{it.fn}</span>
                  ))}
                </div>
              )}
              {skip}
            </div>
            {tab}
            {tabLegend}
            {lookPanel}
          </section>}

          {finished ? (
            <section className="train-outcome">{sessionDone ? sessionPanel : resultPanel}</section>
          ) : (
            <>
              {micLive}
              {(feedback || micError || micBusy) && (
                <section className="train-answer">
                  {feedback && (
                    <p className={`verdict ${feedback.info ? 'info' : feedback.ok ? 'ok' : 'no'}`} role="status">
                      {!feedback.info && <span className="verdict-mark" aria-hidden="true">{feedback.ok ? '✓' : '✕'}</span>}
                      {feedback.text}
                    </p>
                  )}
                  {micError && <p className="t-small mic-line-error" role="alert">{micError}</p>}
                  {micBusy && <p className="t-small t-dim">ouverture du périphérique…</p>}
                </section>
              )}
            </>
          )}

          {!sessionDone && (
            <div className="play-more">
              <PixelButton variant="quiet" onClick={() => setInfoOpen((o) => !o)}>
                {infoOpen ? '▾ Masquer les détails' : '▸ Détails de la série'}
              </PixelButton>
            </div>
          )}

          {infoOpen && !sessionDone && (
            <div className="play-columns">
              <div className="play-col">
                <PlaySection title="Exercice">{sessionFacts}</PlaySection>
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

  // Téléphone : la tablature se lit mal à la verticale, la série se joue donc en paysage, tablature sur une
  // ligne. Le portrait, en un seul bloc, lance et rend le résultat.
  const canPlay = coldStep !== 'look' && !sessionDone;
  const outcome = sessionPanel || resultPanel;
  return (
    <main className="shell mplay">
      <div className="mplay-surface">
        <header className="mplay-head">
          <div className="mplay-id">
            {back}
            <div className="mplay-title">
              <h1 className="page-title">{r.title}</h1>
              {subtitle}
            </div>
            {/* l'étiquette complète écrasait le titre sur une colonne de 90 px */}
            {queue.length > 1 && <span className="tag tag-on">{qIndex + 1} / {queue.length}</span>}
          </div>
        </header>

        {(outcome || lookPanel) && (
          <div className="mplay-details">
            {outcome}
            {lookPanel}
          </div>
        )}

        {(canPlay || micError || micBusy) && (
          <section className="mplay-tab">
            <div className="mplay-bar">
              {canPlay && (
                <PixelButton variant={result ? 'quiet' : 'primary'} className={`mplay-play ${result ? '' : 'mic-spark'}`} onClick={openPlay}>
                  {result ? 'Voir la correction' : '▶ Jouer'}
                </PixelButton>
              )}
              {canPlay && !result && <p className="t-small t-dim mplay-play-note">Touche Jouer : l’écran passe automatiquement en paysage, avec la tablature et le micro.</p>}
              {skip}
              {micError && <p className="t-small mic-line-error" role="alert">{micError}</p>}
              {micBusy && <p className="t-small t-dim">ouverture du périphérique…</p>}
            </div>
          </section>
        )}

        {!sessionDone && (
          <div className="mplay-more">
            <PixelButton variant="quiet" onClick={() => setInfoOpen((o) => !o)}>
              {infoOpen ? '▾ Masquer les détails' : '▸ Détails de la série'}
            </PixelButton>
          </div>
        )}

        {infoOpen && !sessionDone && (
          <div className="mplay-details">
            {sessionFacts && <Panel className="span-12" label="Exercice">{sessionFacts}</Panel>}
            {tabLegend}
            <Panel className="span-12" label="Comment c’est noté ?">{howScoredBody}</Panel>
          </div>
        )}
      </div>

      {playing && (
        <LandscapeView label={`Exercice : ${r.title}`} onClose={closePlay}>
          <div className="tab-full-bar">
            <PixelButton variant="quiet" onClick={closePlay}>Fermer</PixelButton>
            <span className="tab-full-title">{r.title}</span>
            {!result && !micOn && micAction}
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
    </main>
  );
}
