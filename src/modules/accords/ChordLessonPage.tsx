/**
 * Leçon d'accord (phase 4a) — écran « apprendre un accord de zéro ».
 *
 * Quatre étapes du cycle du brief, et elles sont dans cet ordre pour une raison :
 *  1. **Découvrir** — on entend avant de poser. Plaqué puis arpégé, depuis **la même forme** que la tab
 *     (un accord dont l'audio ne correspond pas à la tablature n'apprend rien) ;
 *  2. **Construire** — un doigt à la fois. La boîte se remplit au rythme des doigts ; au micro, on attend
 *     la note de la corde qu'on vient de poser (P1 de la phase 3 appliqué aux accords : « joue la case
 *     que je montre »). C'est ici que se joue la compréhension de la forme ;
 *  3. **Vérifier** — corde par corde, dans l'ordre grave → aiguë. Chaque corde est comparée à la hauteur
 *     attendue ; une corde étouffée, un doigt mal placé (15-40 ¢ bas) et une guitare désaccordée donnent
 *     trois messages différents. C'est la seule étape **vérifiée** ;
 *  4. **Plaquer** — le geste complet. Déclaré, jamais certifié : la validation d'un accord plaqué demande
 *     l'analyse polyphonique de la phase 5, et prétendre le contraire serait un mensonge de l'app.
 *
 * « Appris » n'est pas décidé ici : la tentative part au journal, et la maîtrise se recalcule (3 arpèges
 * propres sur 2 jours différents).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { setChordSelection, useChordSelection } from '../../app/chordSession';
import { useSettings } from '../../app/settings';
import { ChordBoxView } from '../../app/ChordBoxView';
import { MicStrip } from '../../app/MicStrip';
import { TabView } from '../../app/TabView';
import { Panel, PixelButton, Switch, Chip } from '../../app/ui';
import { AudioEngine } from '../../core/audio/engine';
import { TabPlayer } from '../../core/audio/tabPlayer';
import { describeInputError, type InputEngine, type InputFrame } from '../../core/input/engine';
import { noteNameOf } from '../../core/input/match';
import { useInputSettings } from '../../core/input/settings';
import { ensureInputEngine, inputEngineIfAny, windowFor } from '../../app/inputSession';
import { chordToScore, type TabScore } from '../../core/tab';
import { fingerSteps, FINGER_NAME } from '../../core/theory/chordFingers';
import { fmtChord, fmtNote, fmtStringLabel } from '../../core/theory';
import { interpretChord } from '../../core/theory/chords';
import { TUNINGS } from '../../core/theory/tunings';
import { voicingById } from '../../data/voicings';
import {
  appendAttempt, loadJournal, newAttemptId, nodeIdOf, progressStore, readAttempts, summarizeNodes, xpForAttempt,
  type Attempt,
} from '../../core/progress';
import { entryOf, palierOfVoicing } from './curriculum';
import {
  LESSON_STEPS, MAX_TRIES, adviceFor, applyVerdict, arpeggioCheck, attemptFromCheck, checkSummary,
  judgeString, mutedAdvice, newCheck, type ArpeggioCheck, type LessonStep, type StringOutcome,
} from './lesson';
import { learnedChordIds, nextChord } from './recommend';

function ordinal(i: number): string {
  return ['①', '②', '③', '④', '⑤', '⑥'][i] ?? String(i + 1);
}

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

  const steps = useMemo(() => fingerSteps(v), [v]);
  const checks = useMemo(() => arpeggioCheck(v, tuning), [v, tuning]);
  const buildChecks = useMemo(() => {
    const byKey = new Map(checks.map((c) => [`${c.string}:${c.fret}`, c] as const));
    return steps.map((s) => byKey.get(`${s.string}:${s.fret}`)).filter((c): c is ArpeggioCheck => c !== undefined);
  }, [checks, steps]);
  const summary = checkSummary(check, checks);
  const buildDone = buildIndex >= buildChecks.length;

  const nodeStats = useMemo(
    () => summarizeNodes(journal).find((n) => n.nodeId === nodeIdOf({ scaleId: '', system: 'accord', formIndex: 0, chordId: v.id })) ?? null,
    [journal, v.id],
  );
  const learned = useMemo(() => learnedChordIds(journal), [journal]);
  const next = useMemo(() => nextChord(learned), [learned]);

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

  const play = async (score: TabScore | null) => {
    if (!score) return;
    const p = player.current!;
    try {
      await p.init(); // dans le geste : le contexte audio se réveille ici
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

  const acted = useRef<{ midi: number; at: number } | null>(null);

  /** Une fenêtre du micro : on ne juge qu'une note stable, une seule fois par attaque. */
  const handleFrame = (f: InputFrame) => {
    const note = f.stable;
    if (!note) return;
    setHeard({ note: fmtNote(noteNameOf(note.midi), settings.noteNotation), cents: note.cents, db: f.rmsDb });
    if (!f.isNew && !f.onset) return;
    const now = performance.now();
    if (acted.current && acted.current.midi === note.midi && now - acted.current.at < 450) return;

    const target = step === 'construire' ? buildChecks[buildIndex] : step === 'verifier' ? checks[check.index] : null;
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
    const res = applyVerdict(check, target, verdict);
    setCheck(res.state);
    const advice = adviceFor(verdict, target, ctx, naming);
    if (advice) setFeedback({ ok: advice.code === 'dead' || advice.code === 'tune', text: advice.text });
    else if (verdict.kind === 'fill') setFeedback({ ok: true, text: `${naming.noteLabel} · ${target.fret === 0 ? 'à vide' : `case ${target.fret}`} — juste${Math.abs(verdict.cents) > 8 ? ` (${verdict.cents > 0 ? '+' : ''}${Math.round(verdict.cents)} ¢)` : ''}` });
  };

  const onFrameRef = useRef(handleFrame);
  onFrameRef.current = handleFrame;

  // --- enregistrement de la vérification (une seule fois)
  const verifyStart = useRef(0);
  useEffect(() => {
    if (step === 'verifier' && verifyStart.current === 0) verifyStart.current = performance.now();
    if (step !== 'verifier' || !summary.done || saved) return;
    const seconds = verifyStart.current ? (performance.now() - verifyStart.current) / 1000 : 0;
    record(micOn ? 'arpeggio' : 'strum', attemptFromCheck(summary, seconds));
    setSaved(micOn ? 'arpeggio' : 'strum');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, summary.done, saved, micOn]);

  function record(kind: 'arpeggio' | 'strum', r: { correct: number | null; total: number | null; missedStrings: number[]; seconds: number }) {
    const node = nodeIdOf({ scaleId: '', system: 'accord', formIndex: 0, chordId: v.id });
    const attempt: Attempt = {
      id: newAttemptId(Date.now(), node, readAttempts(progressStore()).length),
      ts: Date.now(),
      kind,
      scaleId: '',
      tonic: '',
      tuningId: v.tuningId,
      system: 'accord',
      positionId: v.id,
      formIndex: 0,
      level: 1,
      strings: tuning.strings.length,
      // une déclaration n'est pas une vérification : aucun chiffre de justesse n'entre au journal sous
      // ce statut, sinon un « je l'ai bien joué » compterait comme une preuve (D5, MUSIC_DESIGN §4.6)
      correct: kind === 'strum' ? null : r.correct,
      total: kind === 'strum' ? null : r.total,
      seconds: r.seconds,
      fretMin: Math.min(...v.frets.filter((x): x is number => x !== null && x > 0), 0),
      missedStrings: r.missedStrings,
      tempoOk: false,
      module: 'accords',
      chordId: v.id,
    };
    const after = appendAttempt(progressStore(), attempt);
    setJournal(after);
    return xpForAttempt(attempt);
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

  const pendingStrings = step === 'construire' ? buildChecks.slice(buildIndex + 1).map((c) => c.string) : [];
  const highlight = step === 'construire' ? buildChecks[buildIndex]?.string ?? null : null;
  const palier = palierOfVoicing(v.id);
  const entry = entryOf(v.id)?.entry ?? null;

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

      {/* Quatre étapes, une seule rangée : sur 390 px un segment long par étape passait à la ligne et
          poussait le bouton d'action sous la barre de navigation. */}
      <nav className="step-nav" aria-label="Étape de la leçon">
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
            <span className="step-label">{s.title}</span>
          </button>
        ))}
      </nav>
      <p className="t-small t-dim step-goal">
        {LESSON_STEPS.find((s) => s.id === step)?.goal}
        {'. '}
        <label className="step-box-toggle">
          <input type="checkbox" checked={showBox} onChange={(e) => setShowBox(e.target.checked)} /> boîte d’accord
        </label>
      </p>

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
                      <span className="t-dim">({info.degrees[i]})</span></span>
                  ))}
                </p>
                <p className="t-small">
                  {info.quality.nameFr === 'mineur'
                    ? 'C’est la tierce mineure (♭3) qui rend l’accord mineur : une case sous la tierce majeure du même accord.'
                    : info.quality.nameFr === 'majeur'
                      ? 'La tierce majeure (3) rend l’accord majeur ; la quinte (5) est la note la plus stable après la fondamentale.'
                      : `Formule : ${info.degrees.join(' ')} — ${info.quality.nameFr}.`}
                </p>
                {entry && <p className="t-small t-dim">{entry.why}</p>}
                <p className="t-small t-dim">
                  {v.frets.filter((f) => f !== null).length} cordes jouées
                  {v.frets.some((f) => f === 0) ? `, dont ${v.frets.filter((f) => f === 0).length} à vide` : ''}
                  {v.frets.some((f) => f === null) ? ` · ${v.frets.filter((f) => f === null).length} étouffée${v.frets.filter((f) => f === null).length > 1 ? 's' : ''}` : ''}
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
                      <span className="t-small t-dim"> — {c.note} ({c.fn})</span>
                    </span>
                    <span className={`tag ${done ? 'tag-on' : ''}`}>{done ? 'posé' : now ? 'à poser' : ''}</span>
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
                      <strong>{c.fret === 0 ? 'à vide' : `case ${c.fret}`}</strong> · {fmtNote(c.note, settings.noteNotation)} ({c.fn})
                      {c.finger ? ` · doigt ${c.finger}` : ''}
                      {check.cents[c.key] !== undefined && outcome ? <span className="t-small t-dim"> · {check.cents[c.key]! > 0 ? '+' : ''}{check.cents[c.key]!} ¢</span> : null}
                      {check.tries[c.key] && !outcome ? <span className="t-small t-dim"> · {MAX_TRIES - check.tries[c.key]!} essai(s)</span> : null}
                    </span>
                    <span className={`tag ${outcome === 'ok' ? 'tag-on' : ''}`}>
                      {outcome === 'ok' ? 'juste' : outcome === 'wrong' ? 'révélée' : outcome === 'tuning' ? 'désaccordée' : now ? 'à jouer' : ''}
                    </span>
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
                    ? 'Vérification enregistrée (vérifiée au micro). « Appris » demande 3 vérifications propres sur 2 jours différents.'
                    : saved === 'strum'
                      ? 'Déclaration enregistrée : elle compte comme activité, jamais comme preuve (statut « non vérifié »).'
                      : ''}
                </p>
                <div className="row">
                  <PixelButton variant="primary" onClick={() => { setStep('plaquer'); }}>Plaquer →</PixelButton>
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
              l’analyse polyphonique arrive en phase 5. Ici, tu déclares — et le journal garde la distinction.
            </p>
            <div className="row">
              <PixelButton variant="primary" onClick={() => void play(scoreStrum)}>▶ Écouter plaqué</PixelButton>
              <PixelButton onClick={() => void play(scoreBoth)}>▶ Écouter arpégé</PixelButton>
            </div>
            <div className="row">
              <PixelButton
                onClick={() => {
                  record('strum', { correct: null, total: null, missedStrings: [], seconds: 0 });
                  setSaved('strum');
                  setFeedback({ ok: true, text: 'Plaqué déclaré. Il ne rentre pas dans « appris » tant qu’il n’est pas entendu.' });
                }}
              >
                Je l’ai plaqué proprement
              </PixelButton>
              <PixelButton variant="quiet" onClick={() => setFeedback({ ok: false, text: 'Pas de validation déclarée : c’est la bonne réponse quand ça frise. Reviens quand ça sonne.' })}>
                Pas encore
              </PixelButton>
            </div>
            {feedback && <p className={`t-small ${feedback.ok ? 'ok' : 'ko'}`}>{feedback.text}</p>}
            {nodeStats && (
              <p className="t-small t-dim">
                {nodeStats.attempts} vérification{nodeStats.attempts > 1 ? 's' : ''} · {nodeStats.successes} propre{nodeStats.successes > 1 ? 's' : ''} ·
                {' '}{nodeStats.successDays} jour{nodeStats.successDays > 1 ? 's' : ''} · maîtrise {Math.round(nodeStats.mastery * 100)} %
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
              <p className="t-small">Tout le parcours principal est appris : place aux transitions et au tempo (4b, phase 5).</p>
            )}
            <p className="t-small t-dim">
              « Appris » : 3 arpèges propres sur 2 jours différents. Rien ne se débloque par un clic — mais rien
              ne se bloque non plus : tous les accords restent ouvrables.
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
    </main>
  );
}
