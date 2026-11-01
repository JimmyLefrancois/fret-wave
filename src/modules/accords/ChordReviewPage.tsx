/**
 * Séance de révision des accords (D139). La suite d'écrans est celle des gammes (`coldReview.ts`) : un essai à
 * froid qui compte, puis sous 80 % « Regarde la forme » et un rattrapage qui ne compte pas. Le micro entend une
 * note à la fois : l'accord se joue arpégé, corde par corde, de mémoire (`chordReview.ts`).
 *
 * Une tentative n'est écrite qu'une fois toutes les cordes passées. Une seule mise en page, bureau et téléphone :
 * pas de tablature à faire tenir, rien ne justifie le passage en paysage.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChordBoxView } from '../../app/ChordBoxView';
import { navigate } from '../../app/router';
import { useSettings } from '../../app/settings';
import { Panel, PixelButton } from '../../app/ui';
import type { InputFrame } from '../../core/input/engine';
import { noteNameOf } from '../../core/input/match';
import { useInputSettings } from '../../core/input/settings';
import {
  appendAttempt, cardOf, cardsFrom, PASS, progressStore, readAttempts, readChordMarks, type Attempt,
} from '../../core/progress';
import { fmtChord, fmtNote } from '../../core/theory';
import * as clock from '../../core/clock';
import { VOICINGS } from '../../data/voicings';
import { coldNext, countsAsProof, lookRemaining, retryLine, type ColdStep } from '../gammes/coldReview';
import { nextDay, reviewDelayText } from '../gammes/review';
import {
  buildChordQueue, chordAttempt, chordHoles, chordNodeId, judgeChordNote, moreChordsDue, REVIEW_MAX, type ChordTarget,
} from './chordReview';
import { useReviewMic } from './useReviewMic';

type HoleMark = 'right' | 'revealed';

interface Result {
  accuracy: number;
  revealed: number;
  errors: number;
  proof: boolean;
}

/** Cordes de la grave à l'aiguë : la casse distingue les deux Mi. */
const STRING_NAMES = ['Mi', 'La', 'Ré', 'Sol', 'Si', 'mi'];

export function ChordReviewPage() {
  const settings = useSettings();
  const input = useInputSettings();
  const [queue, setQueue] = useState<ChordTarget[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [journal, setJournal] = useState<Attempt[]>(() => readAttempts(progressStore()));
  const [marks, setMarks] = useState<Record<string, HoleMark>>({});
  const [errors, setErrors] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [coldStep, setColdStep] = useState<ColdStep>('cold');
  const [retake, setRetake] = useState(false);
  const [lookStart, setLookStart] = useState<number | null>(null);
  const [now, setNow] = useState(() => clock.now());
  const [sessionDone, setSessionDone] = useState<{ forms: number; accuracy: number; retries: number } | null>(null);
  const sessionAcc = useRef({ forms: 0, accuracy: 0, retries: 0 });
  const startedAt = useRef<number | null>(null);
  const micFills = useRef(0);
  /** Anti-rebond : une même hauteur ne produit qu'un verdict toutes les 400 ms. */
  const acted = useRef<{ midi: number; at: number } | null>(null);
  const onFrame = useRef<(f: InputFrame) => void>(() => {});
  const mic = useReviewMic(onFrame);

  const target = queue[qIndex] ?? null;
  const voicing = target?.voicing ?? null;
  const holes = useMemo(() => (voicing ? chordHoles(voicing) : []), [voicing]);
  const name = voicing ? fmtChord(voicing.chord, settings.chordNotation) : '';
  const proofless = (!countsAsProof(coldStep) && coldStep !== 'next') || retake;
  const coldActive = coldStep === 'cold' || coldStep === 'retry';
  const activeKey = result ? null : holes.find((h) => !marks[h.key])?.key ?? null;
  const done = Object.keys(marks).length;

  const resetRound = useCallback(() => {
    setMarks({});
    setErrors({});
    setFeedback(null);
    setResult(null);
    startedAt.current = null;
    micFills.current = 0;
    acted.current = null;
  }, []);

  const startSession = useCallback(() => {
    const attempts = readAttempts(progressStore());
    const q = buildChordQueue(VOICINGS, attempts, readChordMarks(progressStore()), clock.now(), REVIEW_MAX);
    setJournal(attempts);
    setQueue(q);
    setQIndex(0);
    setSessionDone(null);
    setColdStep('cold');
    setRetake(false);
    setLookStart(null);
    sessionAcc.current = { forms: 0, accuracy: 0, retries: 0 };
    resetRound();
    setStarted(true);
  }, [resetRound]);

  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    startSession();
  }, [startSession]);

  const finish = (finalMarks: Record<string, HoleMark>, errorCount: Record<string, number>) => {
    if (!voicing) return;
    const correct = Object.values(finalMarks).filter((m) => m === 'right').length;
    const total = holes.length;
    const accuracy = total > 0 ? correct / total : 0;
    const t = clock.now();
    const attempt = chordAttempt(voicing, {
      now: t,
      seq: readAttempts(progressStore()).length,
      correct,
      total,
      seconds: startedAt.current ? Math.round((t - startedAt.current) / 1000) : 0,
      missedStrings: [...new Set(Object.keys(errorCount).map((k) => Number(k.split(':')[1])))],
      afterReveal: proofless,
      mic: micFills.current > 0,
    });
    setJournal(appendAttempt(progressStore(), attempt));
    setResult({
      accuracy,
      revealed: Object.values(finalMarks).filter((m) => m === 'revealed').length,
      errors: Object.values(errorCount).reduce((s, n) => s + n, 0),
      proof: !proofless,
    });
    const acc = sessionAcc.current;
    if (!proofless) {
      const forms = acc.forms + 1;
      sessionAcc.current = { ...acc, forms, accuracy: (acc.accuracy * acc.forms + accuracy) / forms };
    } else if (coldStep === 'retry') {
      sessionAcc.current = { ...acc, retries: acc.retries + 1 };
    }
    if (coldActive) setColdStep(coldNext(coldStep, { type: 'finished', accuracy }));
  };

  const touch = () => {
    startedAt.current ??= clock.now();
  };

  const applyRight = (key: string) => {
    const hole = holes.find((h) => h.key === key);
    if (!hole) return;
    touch();
    const next = { ...marks, [key]: 'right' as HoleMark };
    setMarks(next);
    setFeedback({ ok: true, text: `${fmtNote(hole.note, settings.noteNotation)} — juste` });
    if (Object.keys(next).length === holes.length) {
      setFeedback(null);
      finish(next, errors);
    }
  };

  const applyWrong = (key: string, heard: string | null) => {
    const hole = holes.find((h) => h.key === key);
    if (!hole) return;
    touch();
    const count = (errors[key] ?? 0) + 1;
    const nextErrors = { ...errors, [key]: count };
    setErrors(nextErrors);
    const heardText = heard ? `tu joues ${heard} · ` : '';
    if (count < 2) {
      setFeedback({ ok: false, text: `${heardText}non — réessaie (encore une erreur et je révèle la note)` });
      return;
    }
    const next = { ...marks, [key]: 'revealed' as HoleMark };
    setMarks(next);
    setFeedback({ ok: false, text: `${heardText}c’était la case ${hole.fret}, corde de ${STRING_NAMES[hole.string] ?? ''}` });
    if (Object.keys(next).length === holes.length) {
      setFeedback(null);
      finish(next, nextErrors);
    }
  };

  /** Une fenêtre du micro : on ne juge qu'une note stable, et une seule fois par attaque. */
  onFrame.current = (f: InputFrame) => {
    if (result || !voicing || coldStep === 'look') return;
    const note = f.stable;
    if (!note || (!f.isNew && !f.onset)) return;
    const at = performance.now();
    const prev = acted.current;
    if (prev && prev.midi === note.midi && at - prev.at < 400) return;
    acted.current = { midi: note.midi, at };
    const heard = fmtNote(noteNameOf(note.midi), settings.noteNotation);
    const verdict = judgeChordNote(voicing, note.midi + note.cents / 100, new Set(Object.keys(marks)), {
      centsTolerance: input.centsTolerance,
      activeKey,
    });
    switch (verdict.kind) {
      case 'fill':
        micFills.current += 1;
        applyRight(verdict.target.key);
        break;
      case 'tuning':
        setFeedback({ ok: false, text: `${Math.abs(verdict.cents).toFixed(0)} cents ${verdict.cents > 0 ? 'haut' : 'bas'} : ce n’est pas ta mémoire, c’est l’accord — passe par l’accordeur.` });
        break;
      case 'octave':
        setFeedback({ ok: false, text: 'une octave d’écart avec la note visée (le micro se trompe parfois sur les cordes graves) : rejoue la note seule, un peu plus fort.' });
        break;
      case 'wrong':
        applyWrong(verdict.target.key, heard);
        break;
      case 'outside':
        setFeedback({ ok: false, text: `entendu ${heard} : cette note n’est pas dans la forme.` });
        break;
      case 'repeat':
        setFeedback({ ok: true, text: `${heard} est déjà trouvée — passe à une autre corde.` });
        break;
      case 'empty':
        break;
    }
  };

  const beginRetry = useCallback(() => {
    setColdStep('retry');
    setLookStart(null);
    resetRound();
  }, [resetRound]);

  useEffect(() => {
    if (coldStep !== 'look' || lookStart === null) return;
    const t = window.setInterval(() => {
      setNow(clock.now());
      if (lookRemaining(lookStart, clock.now(), settings.lookSeconds) === 0) beginRetry();
    }, 250);
    return () => window.clearInterval(t);
  }, [coldStep, lookStart, settings.lookSeconds, beginRetry]);

  const nextInQueue = () => {
    const next = qIndex + 1;
    if (next >= queue.length) {
      setSessionDone({ ...sessionAcc.current });
      setResult(null);
      return;
    }
    setQIndex(next);
    setColdStep('cold');
    setRetake(false);
    setLookStart(null);
    resetRound();
  };

  const nextReview = useMemo(
    () => (result && voicing ? cardOf(cardsFrom(journal), chordNodeId(voicing.id)) : null),
    [result, voicing, journal],
  );

  // crochet de vérification (développement uniquement), jamais en production
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __chordReview?: unknown }).__chordReview = {
      queue, qIndex, marks, result, sessionDone, coldStep,
      answer: (ok: boolean) => {
        if (activeKey) (ok ? applyRight : applyWrong)(activeKey, null as never);
      },
      nextInQueue,
    };
  });

  const back = <button type="button" className="back" onClick={() => navigate('hub')} aria-label="Retour à l’accueil">‹</button>;

  if (started && queue.length === 0) {
    return (
      <main className="shell">
        <header className="page-head">
          {back}
          <div><h1 className="page-title">Révision des accords</h1></div>
        </header>
        <Panel accent="green" label="Révision">
          <p className="t-body">Aucun accord à réviser pour l’instant.</p>
          <p className="t-small">Coche « Je connais cet accord » dans la liste : il sera proposé ici, sauf si tu coches aussi « Ne pas réviser ».</p>
          <div className="row">
            <PixelButton variant="primary" onClick={() => navigate('accords')}>Liste d’accords</PixelButton>
          </div>
        </Panel>
      </main>
    );
  }
  if (!target || !voicing) return null;

  const more = sessionDone ? moreChordsDue(VOICINGS, journal, readChordMarks(progressStore()), clock.now()) : 0;
  const showShape = (result !== null && coldStep !== 'look') || (coldStep === 'look' && lookStart !== null);

  return (
    <main className="shell"><div className="hub-surface">
        <header className="page-head chord-review-head">
          {back}
          <div className="chord-review-title">
            <h1 className="page-title">{name}</h1>
            <p className="t-small t-dim">Arpégé, chaque corde une fois · {coldStep === 'retry' ? 'rattrapage, il ne compte pas' : 'de mémoire, seul ce premier essai compte'}</p>
          </div>
          {!sessionDone && !mic.on && (
            <PixelButton variant="primary" className="mic-spark" onClick={() => mic.setOn(true)} disabled={mic.busy}>▶ Ouvrir le micro</PixelButton>
          )}
        </header>

        <Panel
          className="span-12"
          accent="green"
          active
          label={sessionDone ? 'Session terminée' : `Accord ${qIndex + 1} sur ${queue.length}${coldActive ? ' · à froid' : ''}`}
          right={sessionDone ? undefined : <span className="badge">{done} / {holes.length} notes</span>}
        >
        <div className="chord-review-body">
          {sessionDone ? (
            <>
              <p className="stat-line">
                <strong>{sessionDone.forms}</strong> accord{sessionDone.forms > 1 ? 's' : ''} · précision moyenne{' '}
                <strong>{Math.round(sessionDone.accuracy * 100)} %</strong>
              </p>
              <p className="t-small">Les échéances sont recalculées : l’accueil les affiche.</p>
              {retryLine(sessionDone.retries) && <p className="t-small">{retryLine(sessionDone.retries)}</p>}
              <div className="row">
                {more > 0 && <PixelButton variant="primary" onClick={startSession}>Encore {more} accord{more > 1 ? 's' : ''} dû{more > 1 ? 's' : ''}</PixelButton>}
                <PixelButton variant={more > 0 ? 'quiet' : 'primary'} onClick={() => navigate('hub')}>Accueil</PixelButton>
              </div>
            </>
          ) : (
            <>
              <ol className="chord-recall" aria-label="Cordes à jouer">
                {holes.map((h) => (
                  <li key={h.key} className={marks[h.key] ?? (h.key === activeKey ? 'active' : '')}>{STRING_NAMES[h.string] ?? h.string + 1}</li>
                ))}
              </ol>
              {feedback && (
                <p className={`verdict ${feedback.ok ? 'ok' : 'no'}`} role="status">
                  <span className="verdict-mark" aria-hidden="true">{feedback.ok ? '✓' : '✕'}</span>
                  {feedback.text}
                </p>
              )}
              {mic.error && <p className="t-small mic-line-error" role="alert">{mic.error}</p>}
              {mic.busy && <p className="t-small t-dim">ouverture du périphérique…</p>}
              {showShape && <ChordBoxView voicing={voicing} maxScale={3} />}
              {result ? (
                <>
                  {!result.proof && <p className="t-label">Rattrapage</p>}
                  <p className={`stat-line ${result.accuracy < PASS ? 'miss' : ''}`}>
                    <strong>{Math.round(result.accuracy * 100)} %</strong> de notes justes au premier essai · {result.revealed} révélée{result.revealed > 1 ? 's' : ''} · {result.errors} erreur{result.errors > 1 ? 's' : ''}
                  </p>
                  <p className="t-small">
                    {!result.proof
                      ? 'Essai de rattrapage : enregistré, sans effet sur la révision.'
                      : nextReview ? `Tentative enregistrée · ${reviewDelayText(Math.max(nextReview.due, nextDay(clock.now())) - clock.now())}.` : 'Tentative enregistrée.'}
                  </p>
                  {coldStep === 'look' ? (
                    <>
                      <p className="t-small">
                        {lookStart === null
                          ? `Sous les 80 % : regarde la forme ${settings.lookSeconds} s, puis rejoue-la de mémoire — ce second essai ne compte pas.`
                          : `Regarde la forme : elle se masque dans ${lookRemaining(lookStart, now, settings.lookSeconds)} s.`}
                      </p>
                      <div className="row">
                        {lookStart === null
                          ? <PixelButton variant="primary" onClick={() => { setLookStart(clock.now()); setNow(clock.now()); }}>▶ Regarde la forme ({settings.lookSeconds} s)</PixelButton>
                          : <PixelButton variant="primary" onClick={beginRetry}>J’ai vu, masquer</PixelButton>}
                        <PixelButton variant="quiet" onClick={nextInQueue}>Passer · accord suivant</PixelButton>
                      </div>
                    </>
                  ) : (
                    <div className="row">
                      <PixelButton variant="primary" onClick={nextInQueue}>
                        {qIndex + 1 >= queue.length ? 'Terminer la session' : 'Accord suivant'}
                      </PixelButton>
                      <PixelButton variant="quiet" onClick={() => { setRetake(true); resetRound(); }}>Refaire celui-ci</PixelButton>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="t-small t-dim">{target.reason}</p>
                  <PixelButton variant="quiet" onClick={nextInQueue}>Passer · accord suivant</PixelButton>
                </>
              )}
            </>
          )}
        </div>
        </Panel>
    </div></main>
  );
}
