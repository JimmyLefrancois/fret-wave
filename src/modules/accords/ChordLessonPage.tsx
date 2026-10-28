/**
 * Leçon d'accord — écran « apprendre un accord de zéro ».
 *
 * Les **sept étapes** du cycle du brief, dans l'ordre où un professeur les fait travailler :
 *  1. **Découvrir** — on entend avant de poser. Plaqué puis arpégé, depuis **la même forme** que la tab
 *     (un accord dont l'audio ne correspond pas à la tablature n'apprend rien) ;
 *  2. **Construire** — un doigt à la fois, validé au micro (P1 de la phase 3 : « joue la case que je
 *     montre ») ;
 *  3. **Vérifier** — corde par corde, dans l'ordre grave → aiguë. C'est la seule étape qui **certifie**
 *     une forme : une corde étouffée, un doigt trop loin de la frette et une guitare désaccordée donnent
 *     trois messages différents ;
 *  4. **Plaquer** — le geste complet, **déclaré** (l'analyse polyphonique est en phase 5) ;
 *  5. **Fixer** (4b) — la pose à froid chronométrée. C'est elle qui manquait pour que « appris » tienne
 *     sa promesse : un accord su lentement n'est pas un accord su ;
 *  6. **Enchaîner** (4b) — deux accords, le temps de changement mesuré entre deux basses. La musique
 *     commence au changement, pas à la forme ;
 *  7. **Intégrer** (4b) — quatre accords en mesure sur une progression, avec un motif de strum.
 *
 * « Appris » n'est pas décidé ici : les tentatives partent au journal, et la maîtrise se recalcule
 * (3 arpèges propres sur 2 jours **et** une pose à froid réussie).
 */
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { setChordSelection, useChordSelection } from '../../app/chordSession';
import { useSettings } from '../../app/settings';
import { ChordBoxView } from '../../app/ChordBoxView';
import { MicStrip } from '../../app/MicStrip';
import { TabView } from '../../app/TabView';
import { Chip, Panel, PixelButton, Segmented, Switch } from '../../app/ui';
import { AudioEngine } from '../../core/audio/engine';
import { TabPlayer } from '../../core/audio/tabPlayer';
import { describeInputError, type InputEngine, type InputFrame } from '../../core/input/engine';
import { noteNameOf } from '../../core/input/match';
import { useInputSettings } from '../../core/input/settings';
import { readTuningRecord, tuningFreshness } from '../../core/input/tuningGuide';
import { ensureInputEngine, inputEngineIfAny, windowFor } from '../../app/inputSession';
import { chordToScore, type TabScore } from '../../core/tab';
import type { StrumPatternId } from '../../core/tab/generators';
import { PATTERN_LABEL, arrowsOf } from '../../app/strumLabel';
import { fingerSteps, FINGER_NAME } from '../../core/theory/chordFingers';
import { fmtChord, fmtDegree, fmtNote, fmtStringLabel } from '../../core/theory';
import { interpretChord } from '../../core/theory/chords';
import { TUNINGS } from '../../core/theory/tunings';
import { voicingById } from '../../data/voicings';
import {
  appendAttempt, loadJournal, newAttemptId, nodeIdOf, progressStore, readAttempts, summarizeNodes,
  type Attempt,
} from '../../core/progress';
import { entryOf, palierOfVoicing } from './curriculum';
import {
  LESSON_STEPS, MAX_TRIES, adviceFor, applyVerdict, arpeggioCheck, checkSummary,
  judgeString, mutedAdvice, newCheck, type ArpeggioCheck, type LessonStep, type StringOutcome,
} from './lesson';
import {
  coldAttemptPayload, coldLimit, coldSeconds, coldVerdict, newColdRun, noteSounded, startCold, tickCold,
  type ColdRun, type ColdVerdict,
} from './fixer';
import {
  CHANGE_CLEAN_MS, CHANGE_FLUENT_MS, changeGrade, changeStats, detectChanges, markersOf, pairScore, shapeOf,
  transitionCandidates, type ChangeEvent, type ChangeStats,
} from './transitions';
import { PROGRESSIONS, progressionById, progressionCandidates, progressionScore } from './progressions';
import { learnedChordIds, nextChord, startedChordIds } from './recommend';

function ordinal(i: number): string {
  return ['①', '②', '③', '④', '⑤', '⑥'][i] ?? String(i + 1);
}

const DRILL_SECONDS = 30;

export function ChordLessonPage() {
  const settings = useSettings();
  const input = useInputSettings();
  const sel = useChordSelection();
  const v = voicingById(sel.voicingId) ?? voicingById('Em-022000')!;
  const tuning = TUNINGS[v.tuningId]!;
  const info = useMemo(() => interpretChord(v.chord), [v.chord]);

  const [step, setStep] = useState<LessonStep>('decouvrir');
  const [showBox, setShowBox] = useState(settings.showChordBox);
  const [micOn, setMicOn] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [engine, setEngine] = useState<InputEngine | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [heard, setHeard] = useState<{ note: string; cents: number; db: number } | null>(null);
  const [buildIndex, setBuildIndex] = useState(0);
  const [buildState, setBuildState] = useState(newCheck());
  const [check, setCheck] = useState(newCheck());
  const [saved, setSaved] = useState<'arpeggio' | 'strum' | null>(null);
  const [journal, setJournal] = useState<Attempt[]>(() => loadJournal(progressStore()));
  const [transport, setTransport] = useState<'stopped' | 'playing'>('stopped');
  const [status, setStatus] = useState('');

  // --- étapes 5 à 7 (4b)
  const [coldCheck, setColdCheck] = useState(newCheck());
  const coldRun = useRef<ColdRun>(newColdRun(8));
  const [, bumpCold] = useReducer((x: number) => x + 1, 0);
  const [coldResult, setColdResult] = useState<ColdVerdict | null>(null);
  const [drill, setDrill] = useState<{ active: boolean; startedAt: number; endsAt: number }>({ active: false, startedAt: 0, endsAt: 0 });
  const drillNotes = useRef<ChangeEvent[]>([]);
  const [drillStats, setDrillStats] = useState<ChangeStats | null>(null);
  const [drillSaved, setDrillSaved] = useState(false);
  const [pairKey, setPairKey] = useState('');
  const [progId, setProgId] = useState('rock-A');
  const [progTempo, setProgTempo] = useState(70);
  const [progPattern, setProgPattern] = useState<StrumPatternId>('quarters');
  const [metronome, setMetronome] = useState(true);
  const [progSaved, setProgSaved] = useState(false);

  const steps = useMemo(() => fingerSteps(v), [v]);
  const checks = useMemo(() => arpeggioCheck(v, tuning), [v, tuning]);
  const buildChecks = useMemo(() => {
    const byKey = new Map(checks.map((c) => [`${c.string}:${c.fret}`, c] as const));
    return steps.map((s) => byKey.get(`${s.string}:${s.fret}`)).filter((c): c is ArpeggioCheck => c !== undefined);
  }, [checks, steps]);
  const summary = checkSummary(check, checks);
  const coldSummary = checkSummary(coldCheck, checks);
  const buildDone = buildIndex >= buildChecks.length;

  const nodeId = nodeIdOf({ scaleId: '', system: 'accord', formIndex: 0, chordId: v.id });
  const nodeStats = useMemo(
    () => summarizeNodes(journal).find((n) => n.nodeId === nodeId) ?? null,
    [journal, nodeId],
  );
  const learned = useMemo(() => learnedChordIds(journal), [journal]);
  const started = useMemo(() => startedChordIds(journal), [journal]);
  const next = useMemo(() => nextChord(learned), [learned]);

  // --- transitions : la paire choisie, ou la plus utile du moment
  const candidates = useMemo(() => transitionCandidates(learned, started), [learned, started]);
  const pair = useMemo(() => {
    const byKey = candidates.find((c) => `${c.pair.a}|${c.pair.b}` === pairKey);
    if (byKey) return byKey;
    // par défaut : une paire qui contient l'accord de la leçon, sinon la première proposée
    return candidates.find((c) => c.pair.a === v.id || c.pair.b === v.id) ?? candidates[0] ?? null;
  }, [candidates, pairKey, v.id]);
  const voicingA = pair ? voicingById(pair.pair.a) ?? null : null;
  const voicingB = pair ? voicingById(pair.pair.b) ?? null : null;
  // la basse quand elle change, sinon la première corde qui bouge (Em → Em7 garde la même basse)
  const markers = voicingA && voicingB ? markersOf(voicingA, voicingB) : null;
  const bassA = markers?.a ?? null;
  const bassB = markers?.b ?? null;

  // --- progressions
  const progCandidates = useMemo(() => progressionCandidates(learned), [learned]);
  const prog = useMemo(() => progressionById(progId) ?? PROGRESSIONS[0]!, [progId]);

  // --- accordage : un rappel, pas une leçon (l'accordeur guidé vit dans #/accordeur)
  const tuningFresh = useMemo(() => tuningFreshness(readTuningRecord(progressStore()), new Date()), []);

  // --- lecture audio (une seule instance, comme les autres écrans)
  const player = useRef<TabPlayer | null>(null);
  if (player.current === null) player.current = new TabPlayer();
  useEffect(() => () => player.current?.dispose(), []);

  const scoreBoth = useMemo<TabScore | null>(() => {
    try {
      return chordToScore(v, { style: 'both', tempo: 70 });
    } catch {
      return null;
    }
  }, [v]);
  const scoreStrum = useMemo<TabScore | null>(() => {
    try {
      return chordToScore(v, { style: 'strum', tempo: 70 });
    } catch {
      return null;
    }
  }, [v]);
  const scoreArp = useMemo<TabScore | null>(() => {
    try {
      return chordToScore(v, { style: 'arpeggio', tempo: 70 });
    } catch {
      return null;
    }
  }, [v]);
  const scorePair = useMemo<TabScore | null>(() => {
    if (!voicingA || !voicingB) return null;
    try {
      return pairScore(voicingA, voicingB);
    } catch {
      return null;
    }
  }, [voicingA, voicingB]);
  const scoreProg = useMemo<TabScore | null>(() => {
    try {
      return progressionScore(prog, { tempo: progTempo, pattern: progPattern });
    } catch {
      return null;
    }
  }, [prog, progTempo, progPattern]);

  const play = async (score: TabScore | null, opts: { metronome?: boolean } = {}) => {
    if (!score) return;
    const p = player.current!;
    try {
      await p.init(); // dans le geste : le contexte audio se réveille ici
      p.setMetronome(opts.metronome ?? false);
      await p.load(score, { loop: false });
      p.onEnded = () => setTransport('stopped');
      await p.play();
      setTransport('playing');
      setStatus('');
    } catch (e) {
      setStatus(`erreur audio : ${(e as Error).message}`);
      setTransport('stopped');
    }
  };

  // --- changement d'accord : la leçon repart de zéro (aucun état d'un autre accord ne fuit)
  useEffect(() => {
    setStep('decouvrir');
    setBuildIndex(0);
    setBuildState(newCheck());
    setCheck(newCheck());
    setColdCheck(newCheck());
    coldRun.current = newColdRun(coldLimit({ palierId: palierOfVoicing(v.id)?.id ?? null, passes: 0 }));
    bumpCold();
    setColdResult(null);
    setDrill({ active: false, startedAt: 0, endsAt: 0 });
    drillNotes.current = [];
    setDrillStats(null);
    setDrillSaved(false);
    setSaved(null);
    setFeedback(null);
    setHeard(null);
    player.current?.stop();
    setTransport('stopped');
  }, [v.id]);

  // --- micro : ouverture à la demande, fermeture en quittant l'écran
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
        await e.start(input, { windowSize: windowFor(v.tuningId) });
        if (cancelled) {
          e.stop();
          return;
        }
        if (e.state !== 'listening') {
          const d = describeInputError(e.state, e.error);
          setFeedback({ ok: false, text: `${d.message} — ${d.hint}` });
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
    return engine.subscribe(() => {
      const f = engine.last;
      if (f) onFrameRef.current(f);
    });
  }, [engine]);

  useEffect(() => {
    engine?.setGates({ thresholdDb: input.thresholds[input.source], clarityMin: input.clarityMin, a4: input.a4 });
  }, [engine, input.thresholds, input.source, input.clarityMin, input.a4]);

  useEffect(() => () => {
    inputEngineIfAny()?.stop();
  }, []);

  // --- horloges : le chrono de la pose à froid et la fin de l'exercice d'enchaînement
  useEffect(() => {
    if (coldRun.current.phase !== 'running') return;
    const id = window.setInterval(() => {
      const before = coldRun.current.expired;
      coldRun.current = tickCold(coldRun.current, performance.now());
      if (coldRun.current.expired !== before) bumpCold();
    }, 100);
    return () => window.clearInterval(id);
  }, [coldRun.current.phase]);

  useEffect(() => {
    if (!drill.active) return;
    const id = window.setInterval(() => {
      if (performance.now() >= drill.endsAt) stopDrill();
    }, 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill.active, drill.endsAt]);

  const acted = useRef<{ midi: number; at: number } | null>(null);

  /** Une fenêtre du micro : on ne juge qu'une note stable, une seule fois par attaque. */
  const handleFrame = (f: InputFrame) => {
    const note = f.stable;
    if (!note) return;
    setHeard({ note: fmtNote(noteNameOf(note.midi), settings.noteNotation), cents: note.cents, db: f.rmsDb });
    if (!f.isNew && !f.onset) return;
    const now = performance.now();
    if (acted.current && acted.current.midi === note.midi && now - acted.current.at < 450) return;

    // --- Enchaîner : on n'évalue pas les cordes, on horodate des basses (voir transitions.ts)
    if (step === 'enchainer') {
      if (!drill.active || now >= drill.endsAt) return;
      acted.current = { midi: note.midi, at: now };
      drillNotes.current.push({ midi: note.midi + note.cents / 100, at: now });
      if (bassA && bassB) {
        const det = detectChanges(drillNotes.current, { bassA: bassA.midi, bassB: bassB.midi, centsTolerance: input.centsTolerance });
        setDrillStats(changeStats(det.changes, { durationMs: now - drill.startedAt }));
      }
      return;
    }

    const isCold = step === 'fixer';
    const target = step === 'construire' ? buildChecks[buildIndex]
      : step === 'verifier' || isCold ? checks[(isCold ? coldCheck : check).index]
        : null;
    if (!target) return;
    acted.current = { midi: note.midi, at: now };

    const verdict = judgeString(note.midi + note.cents / 100, target, { centsTolerance: input.centsTolerance });
    const ctx = { cents: note.cents, rmsDb: f.rmsDb, thresholdDb: input.thresholds[input.source] };
    // le conseil parle la langue de l'élève (« Mi grave », « mi aigu »), jamais « E2 »
    const naming = {
      stringLabel: fmtStringLabel(target.stringName, target.string === tuning.strings.length - 1, settings.noteNotation),
      noteLabel: fmtNote(target.note, settings.noteNotation),
    };
    if (step === 'construire') {
      const res = applyVerdict(buildState, target, verdict);
      setBuildState(res.state);
      if (res.advanced) {
        setBuildIndex(Math.min(buildChecks.length, buildIndex + 1));
        setFeedback(verdict.kind === 'fill' ? { ok: true, text: `${naming.noteLabel} sonne — doigt posé.` } : { ok: false, text: res.message ?? 'on passe au doigt suivant' });
      } else {
        const advice = adviceFor(verdict, target, ctx, naming);
        setFeedback(advice ? { ok: advice.code === 'dead', text: advice.text } : { ok: false, text: res.message ?? 'réessaie' });
      }
      return;
    }

    const state = isCold ? coldCheck : check;
    const res = applyVerdict(state, target, verdict);
    if (isCold) {
      setColdCheck(res.state);
      // la première corde juste arrête le chrono : c'est l'instant où la main est arrivée
      if (verdict.kind === 'fill' && coldRun.current.firstNoteAt === null) {
        coldRun.current = noteSounded(coldRun.current, now);
        bumpCold();
        setFeedback({ ok: true, text: `Première corde juste — ${coldSeconds(coldRun.current)?.toFixed(1).replace('.', ',')} s. Finis la vérification sans chrono.` });
      }
    } else {
      setCheck(res.state);
    }
    const advice = adviceFor(verdict, target, ctx, naming);
    if (advice) setFeedback({ ok: advice.code === 'dead' || advice.code === 'tune', text: advice.text });
    else if (verdict.kind === 'fill' && !isCold) setFeedback({ ok: true, text: `${naming.noteLabel} · ${target.fret === 0 ? 'à vide' : `case ${target.fret}`} — juste${Math.abs(verdict.cents) > 8 ? ` (${verdict.cents > 0 ? '+' : ''}${Math.round(verdict.cents)} ¢)` : ''}` });
  };

  const onFrameRef = useRef(handleFrame);
  onFrameRef.current = handleFrame;

  // --- enregistrement de la vérification (une seule fois)
  const verifyStart = useRef(0);
  useEffect(() => {
    if (step === 'verifier' && verifyStart.current === 0) verifyStart.current = performance.now();
    if (step !== 'verifier' || !summary.done || saved) return;
    const seconds = verifyStart.current ? (performance.now() - verifyStart.current) / 1000 : 0;
    writeAttempt({
      kind: micOn ? 'arpeggio' : 'strum',
      correct: micOn ? summary.ok : null,
      total: micOn ? summary.total : null,
      missedStrings: micOn ? summary.missedStrings : [],
      seconds,
    });
    setSaved(micOn ? 'arpeggio' : 'strum');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, summary.done, saved, micOn]);

  /** Écriture au journal : un seul chemin, sinon deux formats finissent par diverger. */
  function writeAttempt(patch: Partial<Attempt> & Pick<Attempt, 'kind'>): Attempt {
    const base: Omit<Attempt, 'id' | 'ts'> = {
      kind: patch.kind,
      scaleId: '',
      tonic: '',
      tuningId: v.tuningId,
      system: 'accord',
      positionId: v.id,
      formIndex: 0,
      level: 1,
      strings: tuning.strings.length,
      // une déclaration n'est pas une vérification : les chiffres ne sont posés que par les étapes qui
      // entendent (arpège, pose à froid, enchaînement) — D5, MUSIC_DESIGN §4.6
      correct: null,
      total: null,
      seconds: 0,
      fretMin: Math.min(...v.frets.filter((x): x is number => x !== null && x > 0), 0),
      missedStrings: [],
      tempoOk: false,
      module: 'accords',
      chordId: v.id,
    };
    const attempt: Attempt = {
      id: newAttemptId(Date.now(), patch.chordId ?? patch.progressionId ?? v.id, readAttempts(progressStore()).length),
      ts: Date.now(),
      ...base,
      ...patch,
    };
    const after = appendAttempt(progressStore(), attempt);
    setJournal(after);
    return attempt;
  }

  /** Sans micro : l'élève déclare le résultat de la corde. Statut distinct, aucun XP possible. */
  const declare = (outcome: StringOutcome) => {
    const c = checks[check.index];
    if (!c) return;
    setCheck((prev) => ({
      index: prev.index + 1,
      outcomes: { ...prev.outcomes, [c.key]: outcome },
      tries: { ...prev.tries, [c.key]: (prev.tries[c.key] ?? 0) + 1 },
      cents: prev.cents,
    }));
    if (outcome !== 'ok') {
      setFeedback({ ok: false, text: mutedAdvice(c, { stringLabel: fmtStringLabel(c.stringName, c.string === tuning.strings.length - 1, settings.noteNotation) }).text });
    }
    else setFeedback({ ok: true, text: `${c.note} · corde de ${fmtStringLabel(c.stringName, c.string === tuning.strings.length - 1, settings.noteNotation)} — déclarée juste` });
  };

  // --- Fixer : démarrer, arrêter et juger la pose à froid
  const passCount = nodeStats?.coldPasses ?? 0;
  const limit = coldLimit({ palierId: palierOfVoicing(v.id)?.id ?? null, passes: passCount });

  const beginCold = () => {
    setColdCheck(newCheck());
    setColdResult(null);
    coldRun.current = startCold(limit, performance.now());
    bumpCold();
    setFeedback({ ok: true, text: `Chrono lancé : ${limit} s pour faire sonner la première corde. Pas de boîte d’accord, pas d’aide.` });
  };

  const judgeCold = () => {
    const seconds = coldSeconds(coldRun.current);
    const verdict = coldVerdict({ seconds, summary: coldSummary, limitSec: coldRun.current.limitSec });
    coldRun.current = { ...coldRun.current, phase: 'done' };
    bumpCold();
    setColdResult(verdict);
    // une pose déclarée sans micro ne peut pas être une preuve : aucun chiffre n'entre au journal
    if (micOn) {
      // les secondes sont arrondies au supérieur : une pose à 8,1 s ne doit pas s'écrire 8 s
      const payload = coldAttemptPayload({ summary: coldSummary, seconds: seconds ?? coldRun.current.limitSec + 1, limitSec: coldRun.current.limitSec });
      writeAttempt({ kind: 'cold', ...payload });
    }
  };

  useEffect(() => {
    if (step !== 'fixer' || !coldSummary.done || coldResult) return;
    judgeCold();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, coldSummary.done, coldResult]);

  // --- Enchaîner : le drill chronométré
  function startDrill() {
    drillNotes.current = [];
    setDrillStats(null);
    setDrillSaved(false);
    const now = performance.now();
    setDrill({ active: true, startedAt: now, endsAt: now + DRILL_SECONDS * 1000 });
    setFeedback({ ok: true, text: `C’est parti : alterne les deux accords, une basse à chaque fois, pendant ${DRILL_SECONDS} s.` });
  }

  function stopDrill() {
    if (!drill.active) return;
    const durationMs = performance.now() - drill.startedAt;
    setDrill({ active: false, startedAt: 0, endsAt: 0 });
    if (!bassA || !bassB) return;
    const det = detectChanges(drillNotes.current, { bassA: bassA.midi, bassB: bassB.midi, centsTolerance: input.centsTolerance });
    const stats = changeStats(det.changes, { durationMs });
    setDrillStats(stats);
    if (stats.changes > 0) {
      writeAttempt({
        kind: 'transition',
        chordId: pair!.pair.a,
        chordIdB: pair!.pair.b,
        correct: stats.clean,
        total: stats.changes,
        changeMs: stats.medianMs ?? undefined,
        seconds: Math.round(durationMs / 1000),
      });
      setDrillSaved(true);
    }
  }

  const pendingStrings = step === 'construire' ? buildChecks.slice(buildIndex + 1).map((c) => c.string) : [];
  const highlight = step === 'construire' ? buildChecks[buildIndex]?.string ?? null : null;
  const palier = palierOfVoicing(v.id);
  const entry = entryOf(v.id)?.entry ?? null;
  const coldSecondsNow = coldSeconds(coldRun.current);

  return (
    <main className="shell">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate('accords')} aria-label="Retour au parcours d’accords">‹</button>
        <div>
          <h1 className="page-title">{fmtChord(v.chord, settings.chordNotation)}</h1>
          <p className="t-small t-dim">
            {palier ? `${palier.id} · ` : ''}
            {info.quality.nameFr} · {info.notes.map((n) => fmtNote(n, settings.noteNotation)).join(' – ')}
          </p>
        </div>
        <span className={`tag ${nodeStats?.state === 'learned' || nodeStats?.state === 'mastered' ? 'tag-on' : ''}`}>
          {nodeStats ? (nodeStats.state === 'learned' ? 'appris' : nodeStats.state === 'mastered' ? 'maîtrisé' : 'en apprentissage') : 'jamais vérifié'}
        </span>
      </header>

      {/* Sept étapes, deux rangées : sur 390 px, quatre boutons tiennent par ligne ; sept d'un coup
          donneraient des libellés d'une syllabe. */}
      <nav className="step-nav step-nav-7" aria-label="Étape de la leçon">
        {LESSON_STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`step-btn ${step === s.id ? 'on' : ''}`}
            aria-current={step === s.id ? 'step' : undefined}
            onClick={() => {
              setStep(s.id);
              setFeedback(null);
              if (s.id === 'verifier' && verifyStart.current === 0) verifyStart.current = performance.now();
            }}
          >
            <span className="step-num">{s.num}</span>
            <span className="step-label">{s.short}</span>
          </button>
        ))}
      </nav>
      {/* Bande posée sur le décor : la phrase seule, écrite à même le fond, se perdait dans le ciel
          étoilé (signalé sur toutes les étapes). L'objectif est un texte, la boîte d'accord un réglage :
          ils ne s'écrivent plus dans la même phrase. */}
      <div className="step-goal">
        <p className="t-small step-goal-text">{LESSON_STEPS.find((s) => s.id === step)?.goal}</p>
        <label className="step-box-toggle">
          <input type="checkbox" checked={showBox} onChange={(e) => setShowBox(e.target.checked)} />
          boîte d’accord
        </label>
      </div>

      {step === 'decouvrir' && (
        <>
          <Panel className="span-12" accent="cyan" label="L’accord">
            <div className="chord-intro">
              {/* S = 2 : les chiffres de doigt font 14 px CSS, comme dans la tablature — au-delà, la
                  boîte prend la moitié de l'écran d'un téléphone pour la même information */}
              {showBox && <ChordBoxView voicing={v} maxScale={2} />}
              <div className="chord-facts">
                <p className="t-body">
                  <strong>{fmtChord(v.chord, settings.chordNotation)}</strong> ={' '}
                  {info.notes.map((n, i) => (
                    <span key={n}>{i > 0 ? ' · ' : ''}<strong>{fmtNote(n, settings.noteNotation)}</strong>{' '}
                      <span className="t-dim">({fmtDegree(info.degrees[i]!)})</span></span>
                  ))}
                </p>
                <p className="t-small">
                  {info.quality.nameFr === 'mineur'
                    ? 'C’est la tierce mineure (♭3) qui rend l’accord mineur : une case sous la tierce majeure du même accord.'
                    : info.quality.nameFr === 'majeur'
                      ? 'La tierce majeure (3) rend l’accord majeur ; la quinte (5) est la note la plus stable après la fondamentale.'
                      : `Formule : ${info.degrees.map(fmtDegree).join(' ')} — ${info.quality.nameFr}.`}
                </p>
                {entry && <p className="t-small t-dim">{entry.why}</p>}
                <p className="t-small t-dim">
                  {v.frets.filter((f) => f !== null).length} cordes jouées
                  {v.frets.some((f) => f === 0) ? `, dont ${v.frets.filter((f) => f === 0).length} à vide` : ''}
                  {v.frets.some((f) => f === null) ? ` · ${v.frets.filter((f) => f === null).length} étouffée${v.frets.filter((f) => f === null).length > 1 ? 's' : ''}` : ''}
                </p>
                <p className={`t-small ${tuningFresh.stale ? 'ko' : 't-dim'}`}>
                  {tuningFresh.text}
                  {tuningFresh.stale ? ' — ' : ' · '}
                  <button type="button" className="linklike" onClick={() => navigate('tuner')}>
                    {tuningFresh.stale ? 'accorder (guidé, corde par corde)' : 'accordeur'}
                  </button>
                  {tuningFresh.stale ? ' : une guitare à −20 cents fait échouer des notes justes.' : ''}
                </p>
              </div>
            </div>
            <div className="row">
              <PixelButton variant="primary" onClick={() => void play(scoreStrum)}>▶ Plaqué</PixelButton>
              <PixelButton onClick={() => void play(scoreArp)}>▶ Arpégé</PixelButton>
              <PixelButton variant="quiet" onClick={() => setStep('construire')}>Construire →</PixelButton>
            </div>
            {status && <p className="t-small t-dim">{status}</p>}
          </Panel>
          {scoreStrum && (
            <Panel className="span-12" accent="magenta" label="Tablature plaquée">
              <TabView
                score={scoreStrum}
                notes={settings.noteNotation}
                chords={settings.chordNotation}
                annotation="degree"
                /* retour à la ligne : une mesure tient sur une ligne, et le champ reste scrollable en
                   largeur — en défilement continu, un score plus large que l'écran était coupé net */
                mode="wrap"
                scale="auto"
                reduceMotion={settings.reduceMotion}
                player={player.current}
                transport={transport}
              />
              <p className="t-small t-dim">
                La boîte montre la <strong>forme</strong>, la tablature dit <strong>quelles cordes sonnent</strong> —
                les deux sortent du même modèle.
              </p>
            </Panel>
          )}
        </>
      )}

      {step === 'construire' && (
        <>
          <Panel className="span-5" accent="cyan" label="Doigt par doigt">
            {showBox ? (
              <ChordBoxView voicing={v} highlight={highlight} pending={pendingStrings} />
            ) : (
              <p className="t-small t-dim">Boîte masquée : lis les doigtés ci-contre.</p>
            )}
            <p className="t-small">
              {buildDone
                ? 'Tous les doigts sont posés. Vérifie maintenant corde par corde : c’est là que se joue la propreté.'
                : `Pose ${FINGER_NAME[String(steps[buildIndex]?.finger ?? 1)]} sur la corde de ${
                    buildChecks[buildIndex]
                      ? fmtStringLabel(buildChecks[buildIndex]!.stringName, buildChecks[buildIndex]!.string === tuning.strings.length - 1, settings.noteNotation)
                      : ''
                  }, case ${steps[buildIndex]?.fret ?? ''}.`}
            </p>
            <div className="row">
              <Switch checked={micOn} onChange={setMicOn} label="Micro (valider chaque doigt)" />
            </div>
            {micOn && <MicStrip engine={engine} notation={settings.noteNotation} thresholdDb={input.thresholds[input.source]} tolerance={input.centsTolerance} tuning={tuning} a4={input.a4} />}
            {micBusy && <p className="t-small t-dim">ouverture du micro…</p>}
            {heard && <p className="t-small t-dim">entendu : {heard.note} ({heard.cents > 0 ? '+' : ''}{heard.cents.toFixed(0)} ¢ · {heard.db.toFixed(0)} dBFS)</p>}
            <div className="row">
              <PixelButton
                onClick={() => {
                  setBuildIndex((i) => Math.min(buildChecks.length, i + 1));
                  setFeedback(null);
                }}
                disabled={buildDone}
              >
                Doigt posé
              </PixelButton>
              <PixelButton variant="quiet" onClick={() => { setBuildIndex(0); setBuildState(newCheck()); }}>Recommencer</PixelButton>
              <PixelButton variant="primary" onClick={() => { setStep('verifier'); verifyStart.current = performance.now(); }} disabled={steps.length > 0 && !buildDone}>
                Vérifier →
              </PixelButton>
            </div>
            {feedback && <p className={`t-small ${feedback.ok ? 'ok' : 'ko'}`}>{feedback.text}</p>}
          </Panel>
          <Panel className="span-7" accent="violet" label="Ordre de pose">
            <ol className="finger-steps">
              {buildChecks.map((c, i) => {
                const s = steps[i]!;
                const done = i < buildIndex;
                const now = i === buildIndex;
                return (
                  <li key={c.key} className={`finger-step ${done ? 'done' : now ? 'now' : ''}`}>
                    <span className="finger-num">{ordinal(i)}</span>
                    <span className="finger-body">
                      <strong>{FINGER_NAME[String(s.finger)] ?? `doigt ${s.finger}`}</strong>
                      {' · corde de '}{fmtStringLabel(c.stringName, c.string === tuning.strings.length - 1, settings.noteNotation)}
                      {c.fret === 0 ? ' à vide' : `, case ${c.fret}`}
                      <span className="t-small t-dim"> — {fmtNote(c.note, settings.noteNotation)} ({fmtDegree(c.fn)})</span>
                    </span>
                    {(done || now) && (
                      <span className={`tag ${done ? 'tag-on' : ''}`}>{done ? 'posé' : 'à poser'}</span>
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="t-small t-dim">
              Le barré se pose d’abord, puis les doigts dans l’ordre. Cette liste est <strong>saisie</strong>, pas
              calculée : deux doigtés conventionnels existent pour certains accords, et l’heuristique se trompe.
            </p>
          </Panel>
        </>
      )}

      {step === 'verifier' && (
        <>
          <Panel className="span-7" accent="cyan" label="Corde par corde">
            <p className="t-small">
              {micOn
                ? 'Joue les cordes dans cet ordre, une par une, sans étouffer la voisine. Chaque note juste valide sa corde.'
                : 'Sans micro, l’app ne peut pas entendre : tu déclares. Le résultat est enregistré comme non vérifié — il ne rend pas l’accord « appris ».'}
            </p>
            <div className="row">
              <Switch checked={micOn} onChange={setMicOn} label="Micro" />
              <Chip small onClick={() => { setCheck(newCheck()); verifyStart.current = performance.now(); setFeedback(null); }}>Recommencer</Chip>
            </div>
            {micOn && <MicStrip engine={engine} notation={settings.noteNotation} thresholdDb={input.thresholds[input.source]} tolerance={input.centsTolerance} tuning={tuning} a4={input.a4} />}
            {heard && <p className="t-small t-dim">entendu : {heard.note} ({heard.cents > 0 ? '+' : ''}{heard.cents.toFixed(0)} ¢ · {heard.db.toFixed(0)} dBFS)</p>}

            <div className="check-list">
              {checks.map((c, i) => {
                const outcome = check.outcomes[c.key];
                const now = i === check.index && !summary.done;
                return (
                  <div key={c.key} className={`check-row ${outcome ?? (now ? 'now' : '')}`}>
                    {/* numéro de corde (1 = aiguë), comme dans l'accordeur : en police pixel, « Mi » et
                        « mi » sont identiques — deux lignes afficheraient « MI » deux fois */}
                    <span className="check-string" title={`corde de ${fmtStringLabel(c.stringName, c.string === tuning.strings.length - 1, settings.noteNotation)}`}>
                      {tuning.strings.length - c.string}
                    </span>
                    <span className="check-body">
                      <strong>{c.fret === 0 ? 'à vide' : `case ${c.fret}`}</strong> · {fmtNote(c.note, settings.noteNotation)} ({fmtDegree(c.fn)})
                      {c.finger ? ` · doigt ${c.finger}` : ''}
                      {check.cents[c.key] !== undefined && outcome ? <span className="t-small t-dim"> · {check.cents[c.key]! > 0 ? '+' : ''}{check.cents[c.key]!} ¢</span> : null}
                      {check.tries[c.key] && !outcome ? <span className="t-small t-dim"> · {MAX_TRIES - check.tries[c.key]!} essai(s)</span> : null}
                    </span>
                    {(outcome || now) && (
                      <span className={`tag ${outcome === 'ok' ? 'tag-on' : ''}`}>
                        {outcome === 'ok' ? 'juste' : outcome === 'wrong' ? 'révélée' : outcome === 'tuning' ? 'désaccordée' : 'à jouer'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {!micOn && !summary.done && checks[check.index] && (
              /* collant sous la barre de navigation sur téléphone : la liste des six cordes fait plus
                 qu'un écran, et la réponse doit rester sous le pouce */
              <div className="row check-actions">
                <PixelButton variant="primary" onClick={() => declare('ok')}>Elle sonne</PixelButton>
                <PixelButton onClick={() => declare('wrong')}>Elle ne sonne pas</PixelButton>
              </div>
            )}
            {feedback && <p className={`t-small ${feedback.ok ? 'ok' : 'ko'}`}>{feedback.text}</p>}

            {summary.done && (
              <>
                <p className="stat-line">
                  <strong>{summary.ok} / {summary.total}</strong> cordes justes
                  {summary.clean ? ' — l’accord est propre.' : summary.wrong > 0 ? ' — les cordes révélées sont marquées.' : '.'}
                </p>
                <p className="t-small t-dim">
                  {saved === 'arpeggio'
                    ? 'Vérification enregistrée (vérifiée au micro). « Appris » demande 3 vérifications propres sur 2 jours différents et une pose à froid.'
                    : saved === 'strum'
                      ? 'Déclaration enregistrée : elle compte comme activité, jamais comme preuve (statut « non vérifié »).'
                      : ''}
                </p>
                <div className="row">
                  <PixelButton variant="primary" onClick={() => { setStep('fixer'); }}>Fixer →</PixelButton>
                  <PixelButton variant="quiet" onClick={() => { setCheck(newCheck()); setSaved(null); verifyStart.current = performance.now(); }}>Refaire</PixelButton>
                </div>
              </>
            )}
          </Panel>
          <Panel className="span-5" accent="violet" label="Ce que le micro ne peut pas dire">
            <p className="t-small">
              Le micro donne une <strong>hauteur</strong>, jamais une <strong>corde</strong>. En arpège, l’ordre
              grave → aiguë lève l’ambiguïté : la hauteur attendue est connue à chaque instant.
            </p>
            <p className="t-small t-dim">
              Une corde étouffée sonne faible ; un doigt trop loin de la frette sonne 15 à 40 cents bas ; une
              guitare désaccordée sonne faux pour tout le monde. Trois causes, trois messages — et aucune
              n’est comptée comme une erreur de mémoire.
            </p>
            {showBox && <ChordBoxView voicing={v} />}
          </Panel>
        </>
      )}

      {step === 'plaquer' && (
        <>
          <Panel className="span-7" accent="cyan" label="Le geste complet">
            <p className="t-body">
              Un accord plaqué, c’est six cordes qui sonnent ensemble. L’app ne sait pas encore l’écouter :
              l’app ne sait pas encore écouter plusieurs cordes à la fois. Ici, tu déclares — et la tentative
              garde la distinction.
            </p>
            <div className="row">
              <PixelButton variant="primary" onClick={() => void play(scoreStrum)}>▶ Écouter plaqué</PixelButton>
              <PixelButton onClick={() => void play(scoreBoth)}>▶ Écouter arpégé</PixelButton>
            </div>
            <div className="row">
              <PixelButton
                onClick={() => {
                  writeAttempt({ kind: 'strum', correct: null, total: null, seconds: 0 });
                  setSaved('strum');
                  setFeedback({ ok: true, text: 'Plaqué déclaré. Il ne rentre pas dans « appris » tant qu’il n’est pas entendu.' });
                }}
              >
                Je l’ai plaqué proprement
              </PixelButton>
              <PixelButton variant="quiet" onClick={() => setFeedback({ ok: false, text: 'Pas de validation déclarée : c’est la bonne réponse quand ça frise. Reviens quand ça sonne.' })}>
                Pas encore
              </PixelButton>
              <PixelButton variant="ghost" onClick={() => setStep('fixer')}>Fixer →</PixelButton>
            </div>
            {feedback && <p className={`t-small ${feedback.ok ? 'ok' : 'ko'}`}>{feedback.text}</p>}
            {nodeStats && (
              <p className="t-small t-dim">
                {nodeStats.attempts} vérification{nodeStats.attempts > 1 ? 's' : ''} · {nodeStats.successes} propre{nodeStats.successes > 1 ? 's' : ''} ·
                {' '}{nodeStats.coldPasses} pose{nodeStats.coldPasses > 1 ? 's' : ''} à froid · maîtrise {Math.round(nodeStats.mastery * 100)} %
              </p>
            )}
          </Panel>
          <Panel className="span-5" accent="green" label="Et après ?">
            {next ? (
              <>
                <p className="t-small">
                  Prochain accord recommandé : <strong>{fmtChord(next.chord, settings.chordNotation)}</strong> — {next.reason}.
                </p>
                <div className="row">
                  <PixelButton
                    variant="ghost"
                    onClick={() => { setChordSelection({ voicingId: next.voicingId }); }}
                  >
                    Ouvrir {fmtChord(next.chord, settings.chordNotation)}
                  </PixelButton>
                  <PixelButton variant="quiet" onClick={() => navigate('accords')}>Tout le parcours</PixelButton>
                </div>
              </>
            ) : (
              <p className="t-small">Tout le parcours est appris : place aux transitions et aux progressions.</p>
            )}
            <p className="t-small t-dim">
              « Appris » : 3 arpèges propres sur 2 jours différents <strong>et</strong> une pose à froid réussie. Rien
              ne se débloque par un clic — mais rien ne se bloque non plus.
            </p>
          </Panel>
          {scoreStrum && (
            <Panel className="span-12" accent="magenta" label="Tablature plaquée">
              <TabView
                score={scoreStrum}
                notes={settings.noteNotation}
                chords={settings.chordNotation}
                annotation="degree"
                mode="wrap"
                scale="auto"
                reduceMotion={settings.reduceMotion}
                player={player.current}
                transport={transport}
              />
            </Panel>
          )}
        </>
      )}

      {step === 'fixer' && (
        <>
          <Panel className="span-7" accent="orange" label="Pose à froid, chronométrée">
            <p className="t-body">
              Pose l’accord <strong>sans aide</strong>, puis fais sonner la corde grave. Le chrono s’arrête à la
              première corde juste : c’est le moment où ta main est arrivée. Ensuite, tu vérifies les autres
              cordes sans chrono — c’est la propreté qui compte.
            </p>
            <div className="cold-line">
              <span className={`cold-chrono ${coldRun.current.expired ? 'ko' : ''}`}>
                {coldSecondsNow !== null ? `${coldSecondsNow.toFixed(1).replace('.', ',')} s` : '—'}
              </span>
              <span className="t-small t-dim">
                sur {limit} s · {passCount} pose{passCount > 1 ? 's' : ''} à froid réussie{passCount > 1 ? 's' : ''}
              </span>
            </div>
            <div className="row">
              <Switch checked={micOn} onChange={setMicOn} label="Micro" />
              <PixelButton
                variant="primary"
                onClick={beginCold}
                disabled={!micOn || coldRun.current.phase === 'running'}
              >
                {coldRun.current.phase === 'running' ? 'chrono en cours…' : `Démarrer · ${limit} s`}
              </PixelButton>
              {coldRun.current.phase === 'running' && (
                <PixelButton onClick={judgeCold}>Arrêter et juger</PixelButton>
              )}
              <Chip small onClick={() => { setColdCheck(newCheck()); coldRun.current = newColdRun(limit); bumpCold(); setColdResult(null); setFeedback(null); }}>Recommencer</Chip>
            </div>
            {!micOn && (
              <p className="t-small ko">
                La pose à froid demande le micro : sans lui, l’app ne peut pas dater la première corde juste, et
                une déclaration ne peut pas devenir une preuve.
              </p>
            )}
            {micOn && <MicStrip engine={engine} notation={settings.noteNotation} thresholdDb={input.thresholds[input.source]} tolerance={input.centsTolerance} tuning={tuning} a4={input.a4} />}
            {coldRun.current.expired && !coldResult && (
              <p className="t-small ko">
                {limit} s écoulées sans première corde juste. Continue quand même la vérification : la tentative sera
                enregistrée telle quelle, et elle ne comptera pas comme pose à froid.
              </p>
            )}
            {feedback && <p className={`t-small ${feedback.ok ? 'ok' : 'ko'}`}>{feedback.text}</p>}
            {coldResult && (
              <>
                <p className={`stat-line ${coldResult.passed ? 'ok' : 'ko'}`}><strong>{coldResult.headline}</strong></p>
                <p className="t-small t-dim">{coldResult.detail}</p>
                <div className="row">
                  <PixelButton variant="primary" onClick={() => setStep('enchainer')}>Enchaîner →</PixelButton>
                  <PixelButton variant="quiet" onClick={() => { setColdCheck(newCheck()); coldRun.current = newColdRun(limit); bumpCold(); setColdResult(null); }}>Refaire</PixelButton>
                </div>
              </>
            )}
            <div className="check-list">
              {checks.map((c, i) => {
                const outcome = coldCheck.outcomes[c.key];
                const now = i === coldCheck.index && !coldSummary.done;
                return (
                  <div key={c.key} className={`check-row ${outcome ?? (now ? 'now' : '')}`}>
                    <span className="check-string">{tuning.strings.length - c.string}</span>
                    <span className="check-body">
                      <strong>{c.fret === 0 ? 'à vide' : `case ${c.fret}`}</strong> · {fmtNote(c.note, settings.noteNotation)} ({fmtDegree(c.fn)})
                    </span>
                    <span className={`tag ${outcome === 'ok' ? 'tag-on' : ''}`}>
                      {outcome === 'ok' ? 'juste' : outcome === 'wrong' ? 'révélée' : now ? 'à jouer' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>
          <Panel className="span-5" accent="violet" label="Pourquoi une pose à froid">
            <p className="t-small">
              Savoir former un accord en le construisant doigt par doigt n’est pas savoir le <strong>placer</strong>.
              En musique, la main doit arriver avant le temps — c’est ça, la pose à froid.
            </p>
            <p className="t-small t-dim">
              Le temps accordé se resserre : {limit} s aujourd’hui, puis 5 s et 3 s à mesure que tu réussis.
              La répétition espacée reviendra te le demander dans quelques jours : c’est ce qui distingue
              « je l’ai réussi une fois » de « je le sais ».
            </p>
            {showBox && <ChordBoxView voicing={v} />}
            <p className="t-small t-dim">
              Une pose rapide mais sale n’est pas comptée : il faut à la fois le temps <strong>et</strong> au moins
              80 % des cordes justes.
            </p>
          </Panel>
        </>
      )}

      {step === 'enchainer' && (
        <>
          <Panel className="span-7" accent="magenta" label="Changement mesuré">
            <p className="t-body">
              Deux accords en alternance. {DRILL_SECONDS} secondes pendant lesquelles l’app horodate une
              <strong> note repère </strong> par accord — sa basse, ou la première corde qui change quand les deux
              accords partagent la même. La différence entre deux repères <strong>est</strong> ton temps de
              changement.
            </p>
            <p className="t-body">
              {voicingA ? fmtChord(voicingA.chord, settings.chordNotation) : '…'} →{' '}
              {voicingB ? fmtChord(voicingB.chord, settings.chordNotation) : '…'}
              {pair ? <span className="t-small t-dim"> — {pair.reason}</span> : null}
            </p>
            {/* l'action avant la liste : au premier écran d'un téléphone, « Démarrer » doit être atteignable
                sans faire défiler (revue de la 4a) */}
            <div className="row">
              <Switch checked={micOn} onChange={setMicOn} label="Micro" />
              <PixelButton variant="primary" onClick={startDrill} disabled={!micOn || drill.active || !pair}>
                {drill.active ? 'chrono en cours…' : `Démarrer · ${DRILL_SECONDS} s`}
              </PixelButton>
              {drill.active && <PixelButton onClick={stopDrill}>Arrêter</PixelButton>}
            </div>
            <div className="field">
              <span className="t-label">Changer de paire</span>
              <div className="pair-list">
                {candidates.slice(0, 6).map((c) => {
                  const a = voicingById(c.pair.a);
                  const b = voicingById(c.pair.b);
                  if (!a || !b) return null;
                  const on = pair && pair.pair.a === c.pair.a && pair.pair.b === c.pair.b;
                  return (
                    <Chip
                      key={`${c.pair.a}|${c.pair.b}`}
                      selected={Boolean(on)}
                      small
                      onClick={() => { setPairKey(`${c.pair.a}|${c.pair.b}`); setDrillStats(null); setDrillSaved(false); }}
                    >
                      {fmtChord(a.chord, settings.chordNotation)}{a.chord === b.chord ? ` ${shapeOf(a)}` : ''}
                      {' → '}
                      {fmtChord(b.chord, settings.chordNotation)}{a.chord === b.chord ? ` ${shapeOf(b)}` : ''}
                    </Chip>
                  );
                })}
              </div>
            </div>
            {!micOn && (
              <p className="t-small ko">
                L’enchaînement se mesure au micro : sans lui, aucun temps de changement ne peut être daté. Le QCM
                reste disponible sans matériel.
              </p>
            )}
            {micOn && <MicStrip engine={engine} notation={settings.noteNotation} thresholdDb={input.thresholds[input.source]} tolerance={input.centsTolerance} tuning={tuning} a4={input.a4} />}
            {feedback && <p className={`t-small ${feedback.ok ? 'ok' : 'ko'}`}>{feedback.text}</p>}

            {drillStats && (
              <div className="drill-result">
                <p className="stat-line">
                  <strong>{drillStats.changes}</strong> changement{drillStats.changes > 1 ? 's' : ''} mesuré{drillStats.changes > 1 ? 's' : ''} ·{' '}
                  <strong>{drillStats.medianMs !== null ? `${(drillStats.medianMs / 1000).toFixed(2).replace('.', ',')} s` : '—'}</strong> de médiane ·{' '}
                  {drillStats.perMinute} / min
                </p>
                <p className="t-small">
                  {drillStats.clean} propre{drillStats.clean > 1 ? 's' : ''} (≤ {(CHANGE_CLEAN_MS / 1000).toFixed(1).replace('.', ',')} s),{' '}
                  {drillStats.fluent} fluide{drillStats.fluent > 1 ? 's' : ''} (≤ {(CHANGE_FLUENT_MS / 1000).toFixed(1).replace('.', ',')} s) —{' '}
                  <strong>{changeGrade(drillStats.perMinute).label}</strong>.
                </p>
                <p className="t-small t-dim">{changeGrade(drillStats.perMinute).advice}</p>
                <p className="t-small t-dim">
                  {drillSaved
                    ? 'Enchaînement enregistré : la part de changements propres est le score de la tentative.'
                    : 'Aucun changement n’a été mesuré : rien n’est enregistré, et rien n’est perdu.'}
                </p>
                <div className="row">
                  <PixelButton variant="ghost" onClick={() => setStep('integrer')}>Intégrer →</PixelButton>
                </div>
              </div>
            )}
            {!drillStats && !drill.active && (
              <p className="t-small t-dim">
                Alterne <strong>{voicingA ? fmtChord(voicingA.chord, settings.chordNotation) : '…'}</strong> et{' '}
                <strong>{voicingB ? fmtChord(voicingB.chord, settings.chordNotation) : '…'}</strong>, en ne jouant que
                la note repère de chacun
                {markers ? ` (corde ${tuning.strings.length - markers.a.string}${markers.a.bass ? ' à vide' : `, case ${markers.a.fret}`} puis corde ${tuning.strings.length - markers.b.string}${markers.b.bass ? ' à vide' : `, case ${markers.b.fret}`})` : ''}.
                Un repère juste = un changement dans le temps.
              </p>
            )}
          </Panel>
          <Panel className="span-5" accent="cyan" label="Ce que la mesure veut dire">
            <p className="t-small">
              Le temps affiché est mesuré entre <strong>deux notes repères</strong>, avec la même horloge : la latence
              du micro s’annule dans la différence, il n’y a donc rien à corriger.
            </p>
            <p className="t-small t-dim">
              Repères : 20 changements par minute = correct, 30 à 40 = fluide (les « one-minute changes » de
              l’enseignement classique). En dessous de 10, le geste se cherche encore : c’est normal les
              premières semaines.
            </p>
            <p className="t-small t-dim">
              Limite assumée : une seule note par accord est écoutée. Une corde étouffée au milieu de l’accord ne
              sera vue qu’en phase 5 — c’est pourquoi l’enchaînement ne rend jamais un accord « appris » à lui seul.
            </p>
          </Panel>
          {scorePair && (
            <Panel className="span-12" accent="violet" label="Les deux accords en tablature">
              <TabView
                score={scorePair}
                notes={settings.noteNotation}
                chords={settings.chordNotation}
                annotation="degree"
                mode="wrap"
                scale="auto"
                reduceMotion={settings.reduceMotion}
                player={player.current}
                transport={transport}
              />
              <div className="row">
                <PixelButton onClick={() => void play(scorePair, { metronome: true })}>▶ Écouter avec métronome</PixelButton>
              </div>
            </Panel>
          )}
        </>
      )}

      {step === 'integrer' && (
        <>
          <Panel className="span-7" accent="green" label="Une progression, en mesure">
            <p className="t-body">
              Un accord seul n’est pas de la musique. Choisis une progression jouable avec tes accords, mets le
              métronome et joue une mesure par accord. L’app ne t’écoute pas encore en plaqué : tu déclares.
            </p>
            <p className="t-small">
              <strong>{prog.title}</strong> · {prog.key} · {prog.romans.join(' – ')} — {prog.why}
            </p>
            {/* les actions d'abord : au premier écran d'un téléphone, il faut pouvoir écouter ou déclarer
                sans faire défiler trois fois (leçon de la revue de la 4a) */}
            <div className="row">
              <Switch checked={metronome} onChange={setMetronome} label="Métronome" />
              <PixelButton variant="primary" onClick={() => void play(scoreProg, { metronome })}>▶ Écouter</PixelButton>
              <PixelButton
                onClick={() => {
                  writeAttempt({ kind: 'strum', correct: null, total: null, seconds: 0, chordId: undefined, progressionId: prog.id });
                  setProgSaved(true);
                }}
              >
                Je l’ai jouée
              </PixelButton>
            </div>
            <div className="field">
              <span className="t-label">Changer de progression</span>
              <div className="pair-list">
                {progCandidates.slice(0, 6).map((c) => (
                  <Chip
                    key={c.progression.id}
                    selected={prog.id === c.progression.id}
                    small
                    onClick={() => { setProgId(c.progression.id); setProgTempo(c.progression.tempo); setProgPattern(c.progression.pattern); setProgSaved(false); }}
                  >
                    {c.progression.title}
                    {c.playable ? '' : ` · ${c.missing.length} à apprendre`}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="t-label">Motif de strum · tempo {progTempo} BPM</span>
              <Segmented<StrumPatternId>
                value={progPattern}
                onChange={setProgPattern}
                label="Motif de strumming"
                options={[
                  { value: 'quarters', label: PATTERN_LABEL.quarters },
                  { value: 'eighths', label: PATTERN_LABEL.eighths },
                  { value: 'universal', label: PATTERN_LABEL.universal },
                ]}
              />
              <input
                className="range"
                type="range"
                min={50}
                max={110}
                step={5}
                value={progTempo}
                onChange={(e) => setProgTempo(Number(e.target.value))}
                aria-label="Tempo de la progression"
              />
              <p className="t-small t-dim">
                {arrowsOf(progPattern)} · les réglages s’appliquent au prochain ▶
              </p>
            </div>
            {status && <p className="t-small t-dim">{status}</p>}
            {progSaved && (
              <p className="t-small ok">
                Progression enregistrée comme <strong>activité déclarée</strong> : elle compte pour la série, jamais
                comme preuve de justesse. Le journal garde le statut « non vérifié ».
              </p>
            )}
          </Panel>
          <Panel className="span-5" accent="yellow" label="Choisir sa progression">
            <p className="t-small">
              Les progressions sont classées par ce qu’elles demandent : celles qui n’utilisent que des accords
              appris d’abord. Aucune ne commence par un barré.
            </p>
            <ul className="module-facts">
              {progCandidates.slice(0, 4).map((c) => (
                <li key={c.progression.id} className="t-small t-dim">
                  {c.progression.title} — {c.playable ? 'tous les accords sont appris' : `${c.missing.length} accord(s) à apprendre`}
                </li>
              ))}
            </ul>
            <p className="t-small t-dim">
              Le I–IV–V (rock-A) et le vi–IV–I–V (pop-Em) couvrent une grande partie du répertoire : les savoir
              par cœur, c’est déjà pouvoir accompagner une chanson.
            </p>
            <div className="row">
              <PixelButton variant="quiet" onClick={() => navigate('chordquiz')}>Sans matériel · QCM</PixelButton>
              <PixelButton variant="quiet" onClick={() => navigate('accords')}>Retour au parcours</PixelButton>
            </div>
          </Panel>
          {scoreProg && (
            <Panel className="span-12" accent="magenta" label="La progression en tablature">
              <TabView
                score={scoreProg}
                notes={settings.noteNotation}
                chords={settings.chordNotation}
                annotation="degree"
                mode="wrap"
                scale="auto"
                reduceMotion={settings.reduceMotion}
                player={player.current}
                transport={transport}
              />
            </Panel>
          )}
        </>
      )}
    </main>
  );
}
