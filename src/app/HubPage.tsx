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
import { useMemo, useState } from 'react';
import { navigate } from '../app/router';
import { setScaleSelection, useScaleSelection } from '../app/scaleSession';
import { setChordSelection } from '../app/chordSession';
import { useSettings } from '../app/settings';
import { hubPlan, micHeardBefore } from '../app/hubPlan';
import { Chip, Panel, PixelButton } from '../app/ui';
import { positionLabelPlain, resolveScale } from '../modules/gammes/resolve';
import { accomplishments, nextStreakMilestone, type Accomplishment } from '../modules/gammes/accomplishments';
import { chordProgress, learnedChordIds, nextChord, palierOf } from '../modules/accords/recommend';
import { VOICINGS } from '../data/voicings';
import { fmtChord } from '../core/theory';
import {
  dueNow, loadJournal, nodeIdOf, progressStore, streak, summarizeDay,
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

function AccRow({ f, now }: { f: Accomplishment; now: number }) {
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
      </span>
      {f.attempt && f.kind !== 'streak' && (
        <button
          type="button"
          className="acc-open"
          onClick={() => openAttempt(f.attempt!)}
          aria-label={`Rejouer : ${f.subject}`}
          title="Rejouer cette forme"
        >
          ▶
        </button>
      )}
    </li>
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
  const activity = day.listens + day.exercises + day.selfAssessed;
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
  const micHint = !micHeardBefore(journal) && (
    <div className="home-mic">
      <p className="t-small">
        Première fois au micro ? Passe d’abord par l’accordeur : il demande l’accès au micro et montre ce qu’il entend.
      </p>
      <PixelButton onClick={() => navigate('tuner')}>Accordeur</PixelButton>
    </div>
  );

  const resume = plan.resume;
  // la dernière tentative du nœud dû : elle rouvre la bonne gamme à la bonne position
  const reviewAttempt = plan.review
    ? [...journal].reverse().find((x) => nodeIdOf(x) === plan.review!.first.nodeId && x.correct !== null) ?? null
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

  const hero = (() => {
    if (plan.review) {
      return (
        <Panel className="span-12 home-go" accent="magenta" label="À réviser" right={<span className="badge">{plan.review.count}</span>}>
          <h3 className="home-title">{reviewScale ? reviewScale.title : 'Révision du jour'}</h3>
          {reviewPos && <p className="t-small">{positionLabelPlain(reviewPos, settings.noteNotation)}</p>}
          <div className="row home-actions">
            <PixelButton variant="primary" onClick={review}>▶ Réviser maintenant</PixelButton>
          </div>
          {resume.kind !== 'start' && !sameAsReview && (
            <div className="home-resume">
              <span className="t-small">Dernière activité : <strong>{resumeTitle}</strong></span>
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
          right={<Chip small onClick={() => navigate('accords')}>Changer</Chip>}
        >
          <h3 className="home-title">{chordName(resume.voicingId)}</h3>
          <p className="t-small">
            Accord{palier ? ` · étape ${palier.id} « ${palier.title} »` : ''}
          </p>
          <div className="row home-actions">
            <PixelButton variant="primary" onClick={() => openChord(resume.voicingId)}>▶ Ouvrir la leçon</PixelButton>
          </div>
          {micHint}
        </Panel>
      );
    }
    if (resume.kind === 'start') {
      return (
        <Panel
          className="span-12 home-go"
          accent="magenta"
          label="Commencer"
          right={<Chip small onClick={() => navigate('gammes')}>Changer</Chip>}
        >
          <h3 className="home-title">{resolved.title}</h3>
          <p className="t-small">{scaleLine}</p>
          <ol className="home-steps">
            <li>
              <span className="home-step-n" aria-hidden="true">1</span>
              <span className="home-step-text">Accorder la guitare</span>
              <PixelButton onClick={() => navigate('tuner')}>Accordeur</PixelButton>
            </li>
            <li>
              <span className="home-step-n" aria-hidden="true">2</span>
              <span className="home-step-text">Écouter la gamme</span>
              <PixelButton variant="primary" onClick={() => navigate('scale')}>▶ Écouter</PixelButton>
            </li>
          </ol>
        </Panel>
      );
    }
    return (
      <Panel
        className="span-12 home-go"
        accent="magenta"
        label="Continuer"
        right={<Chip small onClick={() => navigate('gammes')}>Changer</Chip>}
      >
        <h3 className="home-title">{resolved.title}</h3>
        <p className="t-small">{scaleLine}</p>
        <div className="row home-actions">
          <PixelButton variant="primary" onClick={() => navigate('scale')}>▶ Découvrir</PixelButton>
          <PixelButton onClick={() => navigate('training')}>S’exercer au micro</PixelButton>
        </div>
        {micHint}
      </Panel>
    );
  })();

  const [latest, ...older] = feats;

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
            {st.days > 0 && <span className="day-text day-streak">{st.days} j d’affilée</span>}
          </p>
        </div>
      </header>

      {hero}

      <div className="span-6 home-door">
        <button type="button" className="door" onClick={() => navigate('gammes')}>
          <span className="door-kicker">Apprendre</span>
          <span className="door-title">Une gamme, ses positions</span>
          <span className="door-sub">Choisis la gamme, puis la position : elle s’ouvre en tablature.</span>
        </button>
      </div>

      <div className="span-6 home-door">
        <button type="button" className="door" onClick={() => navigate('accords')}>
          <span className="door-kicker">Accords</span>
          <span className="door-title">Les plaquer, les enchaîner</span>
          <span className="door-sub">
            {chordCount.done} / {chordCount.total} appris · doigt par doigt, puis corde par corde au micro.
            {/* le héros montre déjà un accord : un second conseil (« Prochain ») le contredirait */}
            {chordNext && resume.kind !== 'chord' ? ` Prochain : ${fmtChord(chordNext.chord, settings.chordNotation)}.` : ''}
          </span>
        </button>
      </div>

      <Panel className="span-12 home-acc" label="Dernier accomplissement">
        {latest ? (
          <ul className="acc-list">
            <AccRow f={latest} now={now.getTime()} />
          </ul>
        ) : (
          <p className="t-small">Rien encore : ta première série réussie apparaîtra ici.</p>
        )}
        {nextMilestone !== null && (
          <p className="t-small home-next">
            Prochain palier : <strong>{nextMilestone} jours d’affilée</strong>
            {st.days > 0 ? ` (encore ${nextMilestone - st.days})` : ''}
          </p>
        )}
        {older.length > 0 && (
          <details className="more-opts">
            <summary>Tout voir ({feats.length})</summary>
            <ul className="acc-list">
              {older.map((f) => <AccRow key={f.id} f={f} now={now.getTime()} />)}
            </ul>
          </details>
        )}
        <details className="more-opts">
          <summary>Comment ça compte ?</summary>
          <p className="t-small t-dim">
            Tout est calculé depuis tes tentatives enregistrées, jamais compté à part : une série ne compte qu’au-dessus
            de 80 % de trous justes au premier essai, une forme n’est « apprise » qu’après deux réussites sur deux jours.
          </p>
          <p className="t-small t-dim">8 révisions au plus par séance : après quelques jours d’absence, le retard ne s’accumule pas.</p>
        </details>
      </Panel>

      <p className="home-foot t-small t-dim">
        <button type="button" onClick={() => navigate('audio')}>Crédits audio</button>
      </p>
    </main>
  );
}
