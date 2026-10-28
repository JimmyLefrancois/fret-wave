/**
 * Accueil — lanceur (branche ui/hub-lanceur).
 *
 * L'élève ouvre l'app guitare en main et regarde l'écran à un mètre : l'accueil répond à « je fais
 * quoi, là ? » par **une seule action**, choisie depuis le journal (`hubPlan`) :
 *  1. une révision due ; sinon 2. reprendre le dernier module touché (gamme ou accord) ; sinon
 *  3. commencer (accorder, puis écouter la gamme).
 * Le reste se range dessous : les deux portes, le dernier accomplissement (la liste complète se déplie)
 * et les règles de comptage, repliées. Rien n'est inventé ici : tout vient de `fretwave.attempts.v1`.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { navigate } from '../app/router';
import { setScaleSelection, useScaleSelection } from '../app/scaleSession';
import { setChordSelection } from '../app/chordSession';
import { useSettings } from '../app/settings';
import { dailyActivity, heroSteps, hubPlan, isHeroShortcut, micHeardBefore, tuneStepDone, reviewSummary, scaleStep } from '../app/hubPlan';
import { Panel, PixelButton } from '../app/ui';
import { positionLabelPlain, resolveScale } from '../modules/gammes/resolve';
import { accomplishments, headline, nextStreakMilestone, type Accomplishment } from '../modules/gammes/accomplishments';
import { chordProgress, learnedChordIds, nextChord, palierOf } from '../modules/accords/recommend';
import { VOICINGS } from '../data/voicings';
import { readTuningRecord } from '../core/input/tuningGuide';
import { fmtChord } from '../core/theory';
import {
  DUE_CAP, dueNow, loadJournal, nodeIdOf, progressStore, streak, summarizeDay,
  type Attempt,
} from '../core/progress';

/** Objectif proposé : 3 activités (une écoute ou un exercice), pas 3 « clics ». */
export const DAILY_GOAL = 3;

/** Date relative courte : « il y a 12 min », « hier », « 3 j », puis la date. */
export function whenLabel(ts: number, now: number): string {
  const d = now - ts;
  if (d < 60_000) return 'à l’instant';
  if (d < 3_600_000) return `il y a ${Math.round(d / 60_000)} min`;
  if (d < 86_400_000) return `il y a ${Math.round(d / 3_600_000)} h`;
  const days = Math.round(d / 86_400_000);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(ts));
}

/** Glyphe du genre d'accomplissement (lisible, pas décoratif). */
const ACC_GLYPH: Record<Accomplishment['kind'], string> = {
  perfect: '★', pass: '✓', learned: '◆', mastered: '✦', chord: '♪', streak: '≡',
};

/** Rouvre une tentative (nœud) sur l'écran d'entraînement, à la bonne position. */
export function openAttempt(a: Attempt): void {
  const resolved = resolveScale({
    scaleId: a.scaleId, tonic: a.tonic, tuningId: a.tuningId, system: a.system as never, positionIndex: 0,
  });
  const idx = resolved.positions.findIndex((p) => (p.formIndex ?? p.index) === a.formIndex);
  setScaleSelection({
    scaleId: a.scaleId,
    tonic: resolved.tonic,
    tuningId: resolved.tuning.id,
    system: resolved.selection.system,
    positionIndex: Math.max(0, idx),
  });
  navigate('training');
}

function openChord(voicingId: string): void {
  setChordSelection({ voicingId });
  navigate('chord');
}

function AccRow({ f, now, full = false }: { f: Accomplishment; now: number; full?: boolean }) {
  return (
    <li className={`acc-row acc-${f.accent}`}>
      <span className="acc-glyph" aria-hidden="true">{ACC_GLYPH[f.kind]}</span>
      <span className="acc-body">
        <span className="acc-head">
          <span className="acc-title">{f.title}</span>
          <span className="acc-when">{whenLabel(f.ts, now)}</span>
        </span>
        <span className="acc-line">
          <span className="acc-subject">{f.subject}</span>
          <span className="acc-detail"> · {f.detail}</span>
        </span>
        {/* grille tenue, XP : seulement dans la liste dépliée, la ligne de tête reste lisible */}
        {full && f.extra && <span className="acc-extra">{f.extra}</span>}
      </span>
      {f.attempt && f.kind !== 'streak' && (
        <button
          type="button"
          className="acc-open"
          onClick={() => openAttempt(f.attempt!)}
          aria-label={`Rejouer : ${f.subject}`}
          title="Rejouer cette forme"
        >
          ▶
        </button>
      )}
    </li>
  );
}

/**
 * Changer de sujet (une autre forme, une autre gamme) : discret, **après** l'action dans l'ordre de
 * tabulation et à portée du pouce, au lieu d'un coin opposé du panneau.
 */
function Switch({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <PixelButton variant="quiet" className="home-switch" onClick={onClick}>{children}</PixelButton>;
}

/**
 * État de l'autorisation micro selon le navigateur (`null` si l'API ne répond pas) : un fait observé,
 * mis à jour si l'élève l'accorde dans un autre onglet.
 */
function useMicPermission(): string | null {
  const [state, setState] = useState<string | null>(null);
  useEffect(() => {
    let status: PermissionStatus | null = null;
    const update = () => setState(status?.state ?? null);
    navigator.permissions?.query({ name: 'microphone' as PermissionName })
      .then((s) => { status = s; update(); s.addEventListener('change', update); })
      .catch(() => setState(null));
    return () => status?.removeEventListener('change', update);
  }, []);
  return state;
}

/** L'action du héros : le seul bouton primaire de la page, et le raccourci Espace/Entrée qui la lance. */
function HeroGo({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <PixelButton variant="primary" onClick={onClick} keyShortcuts="Space Enter">
      {children}
      <kbd className="home-key" aria-hidden="true">Espace</kbd>
    </PixelButton>
  );
}

export function HubPage() {
  const settings = useSettings();
  const sel = useScaleSelection();
  const resolved = useMemo(() => resolveScale(sel, settings.noteNotation), [sel, settings.noteNotation]);
  const [journal] = useState<Attempt[]>(() => loadJournal(progressStore()));
  const now = useMemo(() => new Date(), []);
  const day = useMemo(() => summarizeDay(journal, now), [journal, now]);
  const st = useMemo(() => streak(journal, now), [journal, now]);
  // seules les cartes de gammes s'ouvrent d'ici : un accord a son propre écran
  const due = useMemo(() => dueNow(journal, now.getTime()).filter((c) => !c.nodeId.startsWith('acc:')), [journal, now]);
  const activity = dailyActivity(day);
  const feats = useMemo(() => accomplishments(journal, { limit: 10, notation: settings.noteNotation }), [journal, settings.noteNotation]);
  // parcours d'accords : le compte et le prochain accord, calculés par le module Accords
  const chordLearned = useMemo(() => learnedChordIds(journal), [journal]);
  const chordCount = chordProgress(chordLearned);
  const chordNext = useMemo(() => nextChord(chordLearned), [chordLearned]);
  const plan = useMemo(
    () => hubPlan(journal, due, chordLearned, chordNext?.voicingId ?? null, (id) => VOICINGS.some((v) => v.id === id)),
    [journal, due, chordLearned, chordNext],
  );
  const nextMilestone = nextStreakMilestone(st.days);
  const micHeard = micHeardBefore(journal);
  const micHint = !micHeard && (
    <div className="home-mic">
      <p className="t-small">
        Première fois au micro ? Passe d’abord par l’accordeur : il demande l’accès au micro et montre ce qu’il entend.
      </p>
      <PixelButton onClick={() => navigate('tuner')}>Accordeur</PixelButton>
    </div>
  );

  const resume = plan.resume;
  // « Une autre » fait tourner les cartes dues, dans l'ordre de la file (la plus en retard d'abord)
  const [reviewIdx, setReviewIdx] = useState(0);
  const reviewCard = plan.review ? due[reviewIdx % due.length] ?? plan.review.first : null;
  // la dernière tentative du nœud dû : elle rouvre la bonne gamme à la bonne position
  const reviewAttempt = reviewCard
    ? [...journal].reverse().find((x) => nodeIdOf(x) === reviewCard.nodeId && x.correct !== null) ?? null
    : null;
  const reviewScale = reviewAttempt
    ? resolveScale({ scaleId: reviewAttempt.scaleId, tonic: reviewAttempt.tonic, tuningId: reviewAttempt.tuningId, system: reviewAttempt.system as never, positionIndex: 0 }, settings.noteNotation)
    : null;
  const reviewPos = reviewAttempt && reviewScale
    ? reviewScale.positions.find((p) => (p.formIndex ?? p.index) === reviewAttempt.formIndex) ?? null
    : null;
  // « Dernière activité » ne répète pas la carte due : même gamme, même tonique, même forme = même geste
  const sameAsReview = resume.kind === 'scale' && !!reviewAttempt
    && reviewAttempt.scaleId === sel.scaleId && reviewAttempt.tonic === resolved.tonic
    && reviewAttempt.formIndex === (resolved.position?.formIndex ?? resolved.position?.index);
  const review = () => (reviewAttempt ? openAttempt(reviewAttempt) : navigate('training'));

  // un voicing retiré des données (vieux journal) ne doit pas faire tomber l'accueil : on montre l'id tel quel
  const chordName = (id: string) => {
    const v = VOICINGS.find((x) => x.id === id);
    return v ? fmtChord(v.chord, settings.chordNotation) : id;
  };
  const resumeTitle = resume.kind === 'chord' ? chordName(resume.voicingId) : resolved.title;
  const resumeGo = () => (resume.kind === 'chord' ? openChord(resume.voicingId) : navigate('scale'));
  const scaleLine = `${positionLabelPlain(resolved.position, settings.noteNotation)}${resolved.formula ? ` · ${resolved.formula}` : ''}`;

  // gamme : écouter tant qu'elle ne l'a jamais été, puis la jouer au micro (réécouter passe en second)
  const step = scaleStep(journal, sel.scaleId, resolved.tonic);
  // premier pas (journal vide, ou micro jamais entendu) : accorder d'abord, sur un fait observé
  const micPermission = useMicPermission();
  const tuneDone = tuneStepDone(micPermission, readTuningRecord(progressStore()) !== null);
  const firstSteps = plan.review || resume.kind === 'chord'
    ? null
    : resume.kind === 'start'
      ? heroSteps('listen', tuneDone)
      : step === 'play' && !micHeard
        ? heroSteps('play', tuneDone)
        : null;
  const STEP: Record<'tune' | 'listen' | 'play', { text: string; action: string; go: () => void }> = {
    tune: { text: 'Accorder la guitare (et autoriser le micro)', action: '▶ Accordeur', go: () => navigate('tuner') },
    listen: { text: 'Écouter la gamme', action: '▶ Écouter', go: () => navigate('scale') },
    play: { text: 'Jouer la gamme au micro', action: '▶ Jouer au micro', go: () => navigate('training') },
  };
  // ce que lance le raccourci : toujours le bouton primaire affiché
  const heroGo = plan.review
    ? review
    : resume.kind === 'chord'
      ? () => openChord(resume.voicingId)
      : firstSteps
        ? STEP[firstSteps.current].go
        : step === 'play'
          ? () => navigate('training')
          : () => navigate('scale');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isHeroShortcut(e, e.target as HTMLElement | null)) return;
      e.preventDefault();
      heroGo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [heroGo]);

  const hero = (() => {
    if (plan.review) {
      return (
        <Panel
          className="span-12 home-go"
          accent="magenta"
          label="À réviser"
        >
          <h3 className="home-title">{reviewScale ? reviewScale.title : 'Révision du jour'}</h3>
          {reviewPos && <p className="t-small">{positionLabelPlain(reviewPos, settings.noteNotation)}</p>}
          <p className="t-small home-why">
            {reviewSummary(reviewCard!)} · {whenLabel(reviewCard!.lastTs, now.getTime())}
            <br />
            {plan.review.count > 1
              ? `Forme ${(reviewIdx % plan.review.count) + 1} sur ${plan.review.count} à revoir aujourd’hui`
              : 'La seule forme à revoir aujourd’hui'}
            {/* la file est plafonnée : on le dit là où le compte s'affiche, pas dans un repli */}
            {plan.review.count >= DUE_CAP && ` (${DUE_CAP} au plus par séance)`}
          </p>
          <div className="row home-actions">
            <HeroGo onClick={review}>▶ Réviser maintenant</HeroGo>
            {plan.review.count > 1 && <Switch onClick={() => setReviewIdx((i) => i + 1)}>Une autre forme</Switch>}
          </div>
          {resume.kind !== 'start' && !sameAsReview && (
            <div className="home-resume">
              <span className="t-small">Dernière activité : <strong>{resumeTitle}</strong></span>
              <PixelButton onClick={resumeGo}>Reprendre</PixelButton>
            </div>
          )}
        </Panel>
      );
    }
    if (resume.kind === 'chord') {
      const palier = palierOf(resume.voicingId);
      return (
        <Panel
          className="span-12 home-go"
          accent="magenta"
          label="Continuer"
        >
          <h3 className="home-title">{chordName(resume.voicingId)}</h3>
          <p className="t-small">
            Accord{palier ? ` · étape ${palier.id} « ${palier.title} »` : ''}
          </p>
          <div className="row home-actions">
            <HeroGo onClick={() => openChord(resume.voicingId)}>▶ Ouvrir la leçon</HeroGo>
            <Switch onClick={() => navigate('accords')}>Changer d’accord</Switch>
          </div>
          {micHint}
        </Panel>
      );
    }
    const changeScale = <Switch onClick={() => navigate('gammes')}>Changer de gamme</Switch>;
    const stepsBlock = firstSteps && (() => {
      const other = firstSteps.steps.find((x) => x.id !== firstSteps.current)!;
      return (
        <>
          <ol className="home-steps">
            {firstSteps.steps.map((x, i) => (
              <li key={x.id} className={x.done ? 'done' : x.id === firstSteps.current ? 'current' : ''}>
                <span className="home-step-n" aria-hidden="true">{x.done ? '✓' : i + 1}</span>
                <span className="home-step-text">
                  {STEP[x.id].text}
                  {x.done && <span className="sr-only"> (fait)</span>}
                </span>
              </li>
            ))}
          </ol>
          <div className="row home-actions">
            <HeroGo onClick={STEP[firstSteps.current].go}>{STEP[firstSteps.current].action}</HeroGo>
            {/* l'autre étape reste à portée : réaccorder, ou passer outre en connaissance de cause */}
            {other.done && firstSteps.current === 'play'
              ? <PixelButton onClick={() => navigate('scale')}>Réécouter</PixelButton>
              : <PixelButton onClick={STEP[other.id].go}>{STEP[other.id].action.replace('▶ ', '')}</PixelButton>}
            {changeScale}
          </div>
        </>
      );
    })();
    return (
      <Panel
        className="span-12 home-go"
        accent="magenta"
        label={resume.kind === 'start' ? 'Commencer' : 'Continuer'}
      >
        <h3 className="home-title">{resolved.title}</h3>
        <p className="t-small">{scaleLine}</p>
        {stepsBlock || (
          <div className="row home-actions">
            {step === 'listen' ? (
              <>
                <HeroGo onClick={() => navigate('scale')}>▶ Écouter</HeroGo>
                <PixelButton onClick={() => navigate('training')}>Jouer au micro</PixelButton>
              </>
            ) : (
              <>
                <HeroGo onClick={() => navigate('training')}>▶ Jouer au micro</HeroGo>
                <PixelButton onClick={() => navigate('scale')}>Réécouter</PixelButton>
              </>
            )}
            {changeScale}
          </div>
        )}
      </Panel>
    );
  })();

  const { latest, rest: older } = headline(feats);

  return (
    <main className="shell">
      <header className="home-hero">
        <div className="home-hero-bottom">
          <h1 className="home-hero-title">Fretwave</h1>
          <p className="home-tagline t-label">Apprendre la guitare en tablature</p>
          <p className="home-day">
            <span className="day-cells" aria-hidden="true">
              {Array.from({ length: DAILY_GOAL }, (_, i) => (
                <span key={i} className={`day-cell ${i < activity ? 'on' : ''}`} />
              ))}
            </span>
            <span className="day-text">{Math.min(activity, DAILY_GOAL)} / {DAILY_GOAL} écoutes ou exercices aujourd’hui</span>
            {st.days > 0 && (
              <span className="day-text day-streak">{st.days} {st.days > 1 ? 'jours' : 'jour'} d’affilée</span>
            )}
          </p>
        </div>
      </header>

      {hero}

      <div className="span-6 home-door">
        <button type="button" className="door" onClick={() => navigate('gammes')}>
          <span className="door-kicker">Gammes</span>
          <span className="door-title">Une gamme, ses positions</span>
          <span className="door-sub">Choisis la gamme, puis la position : elle s’ouvre en tablature.</span>
        </button>
      </div>

      <div className="span-6 home-door">
        <button type="button" className="door" onClick={() => navigate('accords')}>
          <span className="door-kicker">Accords</span>
          <span className="door-title">Les plaquer, les enchaîner</span>
          <span className="door-sub">
            {chordCount.done} / {chordCount.total} appris · doigt par doigt, puis corde par corde au micro.
            {/* le héros montre déjà un accord : un second conseil (« Prochain ») le contredirait */}
            {chordNext && resume.kind !== 'chord' ? ` Prochain : ${fmtChord(chordNext.chord, settings.chordNotation)}.` : ''}
          </span>
        </button>
      </div>

      <Panel className="span-12 home-acc" label="Dernière réussite">
        {latest ? (
          <ul className="acc-list">
            <AccRow f={latest} now={now.getTime()} />
          </ul>
        ) : (
          <p className="t-small">Rien encore : ta première série réussie apparaîtra ici.</p>
        )}
        {nextMilestone !== null && (
          <p className="t-small home-next">
            Prochain palier : <strong>{nextMilestone} jours d’affilée</strong>
            {st.days > 0 ? ` (encore ${nextMilestone - st.days})` : ''}
          </p>
        )}
        {older.length > 0 && (
          <details className="more-opts">
            <summary>{older.length} de plus</summary>
            <ul className="acc-list">
              {older.map((f) => <AccRow key={f.id} f={f} now={now.getTime()} full />)}
            </ul>
          </details>
        )}
        <details className="more-opts">
          <summary>Comment ça compte ?</summary>
          <p className="t-small t-dim">
            Tout est calculé depuis tes tentatives enregistrées, jamais compté à part : un passage n’est réussi qu’au-dessus
            de 80 % de trous justes au premier essai, une forme n’est « apprise » qu’après deux réussites sur deux jours.
          </p>
          <p className="t-small t-dim">8 révisions au plus par séance : après quelques jours d’absence, le retard ne s’accumule pas.</p>
        </details>
      </Panel>

      <p className="home-foot t-small t-dim">
        <button type="button" onClick={() => navigate('audio')}>Crédits audio</button>
      </p>
    </main>
  );
}
