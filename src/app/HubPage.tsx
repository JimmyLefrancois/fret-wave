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
import { dueReviewCards } from '../modules/gammes/review';
import { dailyActivity, dayGoalText, heroAction, heroSteps, hubPlan, learnedScaleForms, regressedScaleForms, isHeroShortcut, micHeardBefore, tuneStepDone, reviewSummary, scaleStep } from '../app/hubPlan';
import { Panel, PixelButton } from '../app/ui';
import { positionLabelPlain, resolveScale } from '../modules/gammes/resolve';
import { accomplishments, headline, nextStreakMilestone, type Accomplishment } from '../modules/gammes/accomplishments';
import { chordProgress, learnedChordIds, nextChord, palierOf } from '../modules/accords/recommend';
import { VOICINGS } from '../data/voicings';
import { readTuningRecord } from '../core/input/tuningGuide';
import { fmtChord } from '../core/theory';
import {
  DUE_CAP, loadJournal, nodeIdOf, progressStore, streak, summarizeDay,
  type Attempt,
} from '../core/progress';
import * as clock from '../core/clock';

/** Objectif proposé : 3 exercices vérifiés par jour (une écoute ne compte pas), pas 3 « clics ». */
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
/** Action secondaire de la carte : un bouton ordinaire, opaque, à la même taille que les autres (D75). */
function Switch({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <PixelButton onClick={onClick}>{children}</PixelButton>;
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

/** Barre de progression pixel : une proportion réelle, lisible sans le chiffre mais jamais sans lui. */
function PathBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <span className="path-bar" aria-hidden="true">
      <span className="path-fill" style={{ width: `${pct}%` }} />
    </span>
  );
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
  const now = useMemo(() => clock.nowDate(), []);
  const day = useMemo(() => summarizeDay(journal, now), [journal, now]);
  const st = useMemo(() => streak(journal, now), [journal, now]);
  // seules les cartes de gammes s'ouvrent d'ici : un accord a son propre écran. Le compte est `reviewCount`
  // (DUE_CAP au plus aujourd'hui) ; la séance en fait 5, son bilan propose la suite (D97)
  const due = useMemo(() => dueReviewCards(journal, now.getTime()).slice(0, DUE_CAP), [journal, now]);
  const activity = dailyActivity(day);
  const goal = dayGoalText(activity, DAILY_GOAL);
  const feats = useMemo(() => accomplishments(journal, { limit: 10, notation: settings.noteNotation, chordNotation: settings.chordNotation }), [journal, settings.noteNotation, settings.chordNotation]);
  // parcours d'accords : le compte et le prochain accord, calculés par le module Accords
  const chordLearned = useMemo(() => learnedChordIds(journal), [journal]);
  const chordCount = chordProgress(chordLearned);
  const chordNext = useMemo(() => nextChord(chordLearned), [chordLearned]);
  const plan = useMemo(
    () => hubPlan(journal, due, chordLearned, chordNext?.voicingId ?? null, (id) => VOICINGS.some((v) => v.id === id)),
    [journal, due, chordLearned, chordNext],
  );
  const nextMilestone = nextStreakMilestone(st.days);
  const scaleForms = useMemo(() => learnedScaleForms(journal), [journal]);
  const regressed = useMemo(() => regressedScaleForms(journal), [journal]);
  const scaleFormsHere = useMemo(() => learnedScaleForms(journal, sel.scaleId, resolved.selection.system), [journal, sel.scaleId, resolved.selection.system]);
  const formTotal = resolved.positions.length;
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
  // porte unique (D97) : la séance, à froid, jamais la forme seule en exercice à trous
  const review = () => navigate('review');

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
  const action = heroAction(plan, { step, firstStep: firstSteps?.current ?? null });
  const heroGo = () => (action.route === 'chord' ? openChord(action.voicingId) : navigate(action.route));
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
            {plan.review.count >= DUE_CAP && ` (${DUE_CAP} au plus aujourd’hui)`}
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
          label="Reprendre l’accord"
        >
          <h3 className="home-title">{chordName(resume.voicingId)}</h3>
          <p className="t-small">
            {/* le code du palier (« P2 ») est interne : l'élève lit son titre */}
            Accord{palier ? ` · ${palier.title}` : ''}
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
          {/* refus déjà donné : le navigateur ne redemandera pas, il faut le dire et dire où le rétablir */}
          {micPermission === 'denied' && (
            <p className="t-small home-blocked" role="status">
              Le micro est bloqué pour ce site. Touche le cadenas à gauche de l’adresse, autorise le micro, puis
              recharge la page.
            </p>
          )}
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
        label={resume.kind === 'start' ? 'Commencer' : 'Continuer la gamme'}
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
          {/* jauge et série sur une plaque opaque (D75) : leur contraste ne dépend plus du décor */}
          <div className="home-status">
            <p className="home-day">
              <span className="day-cells" aria-hidden="true">
                {Array.from({ length: DAILY_GOAL }, (_, i) => (
                  <span key={i} className={`day-cell ${i < activity ? 'on' : ''}`} />
                ))}
              </span>
              <span className={`day-text${goal.reached ? ' day-done' : ''}`}>{goal.text}</span>
            </p>
            {/* série et prochain cap (« palier » est réservé au parcours d'accords) sur leur propre ligne, ensemble : un seul sujet, jamais une ligne orpheline */}
            {/* la série commence à deux jours (MUSIC_DESIGN §17.3) : ni « 0 » ni « 1 jour d'affilée » */}
            {st.days > 1 && (
              <p className="day-streak">
                {`Série : ${st.days} jours d’affilée`}
              {nextMilestone !== null && <span className="day-next"> · prochain cap : {nextMilestone} jours</span>}
              </p>
            )}
          </div>
        </div>
      </header>

      {hero}

      {/* parcours : les deux modules en une bande, chacun avec sa progression réelle (mêmes seuils que la maîtrise) */}
      <Panel className="span-12 home-path" label="Parcours">
        <ul className="path-list">
          <li>
            <button type="button" className="path-row" onClick={() => navigate('gammes')}>
              <span className="path-name t-label">Gammes</span>
              <span className="path-what">
                {resolved.title}
                <span className="path-count">
                  {scaleFormsHere} forme{scaleFormsHere > 1 ? 's' : ''} apprise{scaleFormsHere > 1 ? 's' : ''} sur {formTotal}
                  {scaleForms > scaleFormsHere ? ` · ${scaleForms} en tout` : ''}
                </span>
              </span>
              <PathBar done={scaleFormsHere} total={formTotal} />
            </button>
          </li>
          <li>
            <button type="button" className="path-row" onClick={() => navigate('accords')}>
              <span className="path-name t-label">Accords</span>
              <span className="path-what">
                {chordCount.done} accord{chordCount.done > 1 ? 's' : ''} appris sur {chordCount.total}
                {/* le héros montre déjà un accord : un second conseil (« prochain ») le contredirait */}
                {chordNext && resume.kind !== 'chord' && (
                  <span className="path-count">prochain : {fmtChord(chordNext.chord, settings.chordNotation)}</span>
                )}
              </span>
              <PathBar done={chordCount.done} total={chordCount.total} />
            </button>
          </li>
        </ul>
        {regressed > 0 && (
          <p className="t-small t-dim">
            {regressed} forme{regressed > 1 ? 's' : ''} repassée{regressed > 1 ? 's' : ''} en apprentissage : « apprise » exige
            maintenant une réussite sur la position entière, de mémoire (N3) ou jouée au micro. Rien n’est effacé, le compte
            est recalculé depuis tes tentatives.
          </p>
        )}
      </Panel>

      {/* le panneau n'existe qu'à partir de la première réussite : pas de case vide au premier écran */}
      {latest && (
        <Panel className="span-12 home-acc" label="Dernière réussite">
          <ul className="acc-list">
            <AccRow f={latest} now={now.getTime()} />
          </ul>
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
              de 80 % de trous justes au premier essai, une forme n’est « apprise » qu’après deux réussites sur deux jours,
              dont une sur la position entière, de mémoire (N3) ou jouée au micro. Un essai fait juste après avoir revu la
              forme est enregistré, mais ne compte pas.
            </p>
            <p className="t-small t-dim">
            L’objectif du jour et la série comptent les exercices vérifiés : une écoute n’y entre pas, un grattage déclaré non plus.
          </p>
          <p className="t-small t-dim">{DUE_CAP} révisions au plus aujourd’hui : après quelques jours d’absence, le retard ne s’accumule pas.</p>
          </details>
        </Panel>
      )}

      <p className="home-foot t-small t-dim">
        <button type="button" onClick={() => navigate('audio')}>Crédits audio</button>
      </p>
    </main>
  );
}
