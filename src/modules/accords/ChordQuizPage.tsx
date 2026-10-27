/**
 * Module Accords — **sans matériel** (phase 4b, `#/accords/qcm`).
 *
 * Trois types de questions, tirées des vraies confusions d'un débutant :
 *  - **reconnaître** l'accord écrit en tablature (sans son nom, évidemment) ;
 *  - **reconstituer** ses notes (majeure ou mineure ? quelle tierce ?) ;
 *  - **retrouver** une case manquante dans la forme (le trou est dessiné).
 *
 * Ce que le QCM n'est pas : une preuve de jeu. Chaque réponse est écrite au journal sous un nœud
 * `acc:savoir:*` — la connaissance, pas le geste. Un accord ne devient jamais « appris » parce qu'on a
 * su le lire : c'est la règle posée en 4a (une auto-évaluation ne devient pas une preuve), appliquée
 * ici à l'autre bout de l'échelle.
 */
import { useMemo, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { useSettings } from '../../app/settings';
import { TabView } from '../../app/TabView';
import { Bar, Chip, Panel, PixelButton } from '../../app/ui';
import { fmtChord, fmtNote } from '../../core/theory';
import {
  appendAttempt, loadJournal, newAttemptId, progressStore, readAttempts, summarizeNodes,
  type Attempt,
} from '../../core/progress';
import { KIND_LABEL, QUIZ_KINDS, quizRound, type QuizKind, type QuizOption } from './quiz';
import { mainlineChordIds } from './curriculum';
import { learnedChordIds, startedChordIds } from './recommend';

/**
 * Les accords sur lesquels on interroge : ceux que l'élève a **déjà rencontrés** (appris ou commencés).
 * Poser une question sur Fmaj7 barré à quelqu'un qui n'a pas encore ouvert Fa ne teste rien — c'est de
 * la devinette. Sans historique, on part des six premiers accords du parcours.
 */
function quizPool(attempts: readonly Attempt[]): string[] {
  const met = [...new Set([...learnedChordIds(attempts), ...startedChordIds(attempts)])];
  return met.length >= 3 ? met : mainlineChordIds().slice(0, 6);
}

export function ChordQuizPage() {
  const settings = useSettings();
  const [seed, setSeed] = useState(() => Math.floor(Date.now() / 1000) % 1000);
  const [kinds, setKinds] = useState<QuizKind[]>([...QUIZ_KINDS]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [journal, setJournal] = useState<Attempt[]>(() => loadJournal(progressStore()));
  const [round, setRound] = useState(0);
  // le vivier est figé **au début de la manche** : répondre ne doit pas changer les questions en cours
  const journalRef = useRef(journal);
  journalRef.current = journal;
  const pool = useMemo(() => quizPool(journalRef.current), [round, seed]); // eslint-disable-line react-hooks/exhaustive-deps

  const questions = useMemo(
    () => quizRound({ count: 6, seed, kinds: kinds.length ? kinds : [...QUIZ_KINDS], voicingIds: pool }),
    [seed, kinds, pool],
  );
  const q = questions[Math.min(index, questions.length - 1)]!;
  const total = questions.length;
  const finished = index >= total;
  const score = answers.filter(Boolean).length;

  const learned = useMemo(() => learnedChordIds(journal), [journal]);
  const savoirs = useMemo(() => summarizeNodes(journal).filter((n) => n.nodeKind === 'savoir'), [journal]);

  function labelOf(o: QuizOption): string {
    if (o.kind === 'chord') return fmtChord(o.symbol, settings.chordNotation);
    if (o.kind === 'notes') return o.notes.map((n) => fmtNote(n, settings.noteNotation)).join(' · ');
    return o.fret === 0 ? 'à vide (0)' : `case ${o.fret}`;
  }

  function answer(optionIndex: number) {
    if (picked !== null) return;
    const correct = optionIndex === q.answer;
    setPicked(optionIndex);
    setAnswers((a) => [...a, correct]);
    // une réponse au QCM est vérifiée (l'app connaît la bonne réponse) mais c'est du **savoir** : elle
    // n'entre jamais dans le nœud de la forme, qui exige un geste
    const attempt: Attempt = {
      id: newAttemptId(Date.now(), `acc:savoir:${q.voicingId}`, readAttempts(progressStore()).length),
      ts: Date.now(),
      kind: 'qcm',
      scaleId: '',
      tonic: '',
      tuningId: 'standard',
      system: 'accord',
      positionId: q.voicingId,
      formIndex: 0,
      level: 1,
      strings: 6,
      correct: correct ? 1 : 0,
      total: 1,
      seconds: 0,
      fretMin: 0,
      missedStrings: [],
      tempoOk: false,
      module: 'accords',
      chordId: q.voicingId,
    };
    setJournal(appendAttempt(progressStore(), attempt));
  }

  function next() {
    setPicked(null);
    setIndex((i) => i + 1);
  }

  function restart() {
    setSeed(Math.floor(Date.now() / 1000) % 1000);
    setRound((r) => r + 1);
    setIndex(0);
    setPicked(null);
    setAnswers([]);
  }

  const xpTotal = useMemo(() => answers.length, [answers.length]);

  return (
    <main className="shell">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate('accords')} aria-label="Retour au parcours d’accords">‹</button>
        <div>
          <h1 className="page-title">Sans matériel</h1>
          <p className="t-small t-dim">Lire un accord, sans guitare</p>
        </div>
        <span className="tag">{finished ? `${score} / ${total}` : `${Math.min(index + 1, total)} / ${total}`}</span>
      </header>

      <p className="t-small span-12">
        Six questions sur ce qu’un accord <strong>écrit</strong> veut dire. C’est le seul entraînement du module qui
        ne demande ni instrument ni micro — et il ne vaut pas une preuve de jeu : il travaille la lecture, pas le geste.
      </p>

      <Panel className="span-7" accent="cyan" label={finished ? 'Résultat' : KIND_LABEL[q.kind]}>
        {!finished ? (
          <>
            <div className="quiz-head">
              <p className="t-body">{q.prompt}</p>
              <Chip small onClick={restart}>Nouvelle série</Chip>
            </div>
            <Bar value={answers.length} max={total} accent="cyan" />
            {q.score && (
              <div className="quiz-tab">
                <TabView
                  score={q.score}
                  notes={settings.noteNotation}
                  chords={settings.chordNotation}
                  annotation="none"
                  mode="wrap"
                  scale="auto"
                  reduceMotion={settings.reduceMotion}
                  player={null}
                  transport="stopped"
                />
              </div>
            )}
            <div className="quiz-options">
              {q.options.map((o, i) => {
                const isPicked = picked === i;
                const isAnswer = i === q.answer;
                const cls = picked === null ? '' : isAnswer ? 'right' : isPicked ? 'wrong' : 'muted';
                return (
                  <button
                    key={`${q.id}-${i}`}
                    type="button"
                    className={`quiz-option ${cls}`}
                    disabled={picked !== null}
                    aria-pressed={isPicked}
                    onClick={() => answer(i)}
                  >
                    <span className="quiz-letter">{'ABCD'[i]}</span>
                    <span className="quiz-label">{labelOf(o)}</span>
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <>
                <p className={`t-small ${picked === q.answer ? 'ok' : 'ko'}`}>
                  {picked === q.answer ? 'Juste.' : 'Non — la bonne réponse est en vert.'}
                </p>
                <p className="t-small t-dim">{q.explain}</p>
                <div className="row">
                  <PixelButton variant="primary" onClick={next}>{index + 1 >= total ? 'Voir le résultat' : 'Suivante →'}</PixelButton>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <p className="stat-line"><strong>{score} / {total}</strong> réponses justes</p>
            <p className="t-small">
              {score === total
                ? 'Sans faute : tu lis les accords comme un guitariste qui n’a pas besoin de sa guitare.'
                : score >= total - 1
                  ? 'Une hésitation : relis l’explication de la question ratée, c’est là qu’est le savoir.'
                  : 'Ce n’est pas grave : le QCM travaille la lecture, le geste se travaille à la guitare. Rejoue la série.'}
            </p>
            <p className="t-small t-dim">
              Chaque réponse est écrite au journal sous un nœud « savoir » — elle ne rend jamais un accord
              « appris » : la forme s’apprend au micro, pas au QCM. {xpTotal} réponse{xpTotal > 1 ? 's' : ''} enregistrée{xpTotal > 1 ? 's' : ''}.
            </p>
            <div className="row">
              <PixelButton variant="primary" onClick={restart}>Nouvelle série</PixelButton>
              <PixelButton onClick={() => navigate('chord')}>Retour à la leçon</PixelButton>
            </div>
          </>
        )}
      </Panel>

      <Panel className="span-5" accent="violet" label="Comment c’est corrigé">
        <p className="t-small">
          Les distracteurs ne sont pas tirés au hasard : ce sont les <strong>confusions réelles</strong> — Mi
          mineur contre Mi majeur, La mineur contre Do, Ré contre Ré sus2. Une question qui opposerait Do et
          Mi♭ ne testerait rien.
        </p>
        <div className="field">
          <span className="t-label">Types de questions</span>
          <div className="pair-list">
            {QUIZ_KINDS.map((k) => (
              <Chip
                key={k}
                small
                selected={kinds.includes(k)}
                onClick={() => {
                  const next = kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k];
                  if (next.length === 0) return; // au moins un type : sinon il n'y a pas d'exercice
                  setKinds(next);
                  setRound((r) => r + 1);
                  setIndex(0);
                  setPicked(null);
                  setAnswers([]);
                }}
              >
                {KIND_LABEL[k]}
              </Chip>
            ))}
          </div>
        </div>
        <ul className="module-facts">
          <li className="t-small t-dim">Reconnaître : la tablature est dessinée <strong>sans le nom</strong> de l’accord.</li>
          <li className="t-small t-dim">Reconstituer : les trois ou quatre notes de l’accord, avec sa tierce.</li>
          <li className="t-small t-dim">Retrouver : une case est masquée dans la pile (pointillés).</li>
        </ul>
        <p className="t-small t-dim">
          Le tirage est déterministe pour une manche donnée : rejouer ne triche pas, et deux séances
          différentes ne posent pas les mêmes questions.
        </p>
        <p className="t-small t-dim">
          Notions de lecture travaillées : <strong>{savoirs.length}</strong>
          {savoirs.length > 0 ? ` · ${savoirs.filter((n) => n.state === 'learned' || n.state === 'mastered').length} su${savoirs.filter((n) => n.state === 'learned' || n.state === 'mastered').length > 1 ? 's' : ''} avec deux bonnes réponses sur deux jours` : ''}.
        </p>
      </Panel>

      <Panel className="span-12" accent="yellow" label="Ce que tu sais déjà lire">
        <p className="t-small t-dim">
          {learned.size > 0
            ? `${learned.size} accord${learned.size > 1 ? 's' : ''} appris au micro : ${[...learned].map((id) => fmtChord(id.split('-')[0]!, settings.chordNotation)).join(' · ')}.`
            : 'Aucun accord n’est encore validé au micro : le QCM peut servir à préparer la première leçon.'}
        </p>
      </Panel>
    </main>
  );
}
