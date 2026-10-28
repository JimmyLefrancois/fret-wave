/**
 * Accueil — refonte « simplicité » (branche ui/simplification).
 *
 * L'ancien hub alignait dix panneaux de prose (aujourd'hui, révision, niveau, reprise, accords, badges,
 * modules, code couleur…) : on ne savait pas par où commencer, ni où faire un exercice. Celui-ci ne
 * garde que **ce qui sert à agir** :
 *  1. une seule action évidente : reprendre la gamme en cours, en l'écoutant ou en la jouant au micro ;
 *  2. deux portes : choisir une gamme et sa position, accorder la guitare ;
 *  3. la révision, uniquement quand quelque chose est réellement dû.
 * Les compteurs détaillés (XP, niveau, badges, modules, code couleur) sont retirés de l'accueil : ils
 * restent dans le journal et dans les réglages. Rien n'est inventé ici : tout vient de `fretwave.attempts.v1`.
 */
import { useMemo, useState } from 'react';
import { navigate } from '../app/router';
import { setScaleSelection, useScaleSelection } from '../app/scaleSession';
import { useSettings } from '../app/settings';
import { Chip, Panel, PixelButton } from '../app/ui';
import { positionLabelPlain, resolveScale } from '../modules/gammes/resolve';
import { accomplishments, type Accomplishment } from '../modules/gammes/accomplishments';
import { chordProgress, learnedChordIds, nextChord } from '../modules/accords/recommend';
import { fmtChord } from '../core/theory';
import {
  dueNow, loadJournal, nodeIdOf, progressStore, streak, summarizeDay, xpSummary,
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

export function HubPage() {
  const settings = useSettings();
  const sel = useScaleSelection();
  const resolved = useMemo(() => resolveScale(sel, settings.noteNotation), [sel, settings.noteNotation]);
  const [journal] = useState<Attempt[]>(() => loadJournal(progressStore()));
  const now = useMemo(() => new Date(), []);
  const day = useMemo(() => summarizeDay(journal, now), [journal, now]);
  const xp = useMemo(() => xpSummary(journal, now), [journal, now]);
  const st = useMemo(() => streak(journal, now), [journal, now]);
  // seules les cartes de gammes s'ouvrent d'ici : un accord a son propre écran
  const due = useMemo(() => dueNow(journal, now.getTime()).filter((c) => !c.nodeId.startsWith('acc:')), [journal, now]);
  const activity = day.listens + day.exercises + day.selfAssessed;
  const feats = useMemo(() => accomplishments(journal, { limit: 10, notation: settings.noteNotation }), [journal, settings.noteNotation]);
  // parcours d'accords : le compte et le prochain accord, calculés par le module Accords
  const chordLearned = useMemo(() => learnedChordIds(journal), [journal]);
  const chordCount = chordProgress(chordLearned);
  const chordNext = useMemo(() => nextChord(chordLearned), [chordLearned]);

  const review = () => {
    const card = due[0];
    if (!card) return;
    const a = [...journal].reverse().find((x) => nodeIdOf(x) === card.nodeId && x.correct !== null);
    if (a) openAttempt(a);
    else navigate('training');
  };

  return (
    <main className="shell">
      <header className="home-hero">
        <p className="home-kicker t-label">Apprendre la guitare en tablature</p>
        <div className="home-hero-bottom">
          <h1 className="home-hero-title">Fretwave</h1>
          <p className="home-hero-line">
            {activity} / {DAILY_GOAL} activités aujourd’hui · {xp.total} XP
            {st.days > 0 ? ` · ${st.days} j d’affilée` : ''}
          </p>
        </div>
      </header>

      <Panel
        className="span-12 home-go"
        accent="magenta"
        label="Continuer"
        right={<Chip small onClick={() => navigate('gammes')}>Changer</Chip>}
      >
        <h2 className="home-title">{resolved.title}</h2>
        <p className="t-small">{positionLabelPlain(resolved.position, settings.noteNotation)}{resolved.formula ? ` · ${resolved.formula}` : ''}</p>
        <div className="row home-actions">
          <PixelButton variant="primary" onClick={() => navigate('scale')}>▶ Découvrir</PixelButton>
          <PixelButton onClick={() => navigate('training')}>S’exercer au micro</PixelButton>
        </div>
      </Panel>

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
            {chordNext ? ` Prochain : ${fmtChord(chordNext.chord, settings.chordNotation)}.` : ''}
          </span>
        </button>
      </div>

      {due.length > 0 && (
        <Panel className="span-12" accent="yellow" label="À réviser" right={<span className="badge">{due.length}</span>}>
          <div className="review-list">
            {due.slice(0, 3).map((card) => {
              const lastA = [...journal].reverse().find((x) => nodeIdOf(x) === card.nodeId);
              const r = lastA
                ? resolveScale({ scaleId: lastA.scaleId, tonic: lastA.tonic, tuningId: lastA.tuningId, system: lastA.system as never, positionIndex: 0 })
                : null;
              const idx = lastA && r ? r.positions.findIndex((p) => (p.formIndex ?? p.index) === lastA.formIndex) : -1;
              return (
                <div key={card.nodeId} className="review-row">
                  <div className="review-body">
                    <span className="review-title">{r ? r.title : card.nodeId}</span>
                    <span className="t-small t-dim">
                      {r && idx >= 0 ? positionLabelPlain(r.positions[idx] ?? null, settings.noteNotation) : 'position'}
                      {' · '}boîte {card.box}
                    </span>
                  </div>
                  {lastA && <PixelButton variant="quiet" onClick={() => openAttempt(lastA)}>Ouvrir</PixelButton>}
                </div>
              );
            })}
          </div>
          <div className="row">
            <PixelButton variant="primary" onClick={review}>Réviser maintenant</PixelButton>
          </div>
          <p className="t-small t-dim">Plafond de 8 cartes par session : une absence ne crée pas de dette impossible.</p>
        </Panel>
      )}

      <Panel
        className="span-12"
        accent="green"
        label="Derniers accomplissements"
        right={<span className="badge">{feats.length}</span>}
      >
        {feats.length === 0 ? (
          <p className="t-small t-dim">
            Rien encore. La première série réussie à 80 % apparaîtra ici, puis chaque forme apprise,
            chaque sans-faute et chaque palier de jours d’affilée.
          </p>
        ) : (
          <ul className="acc-list">
            {feats.map((f) => (
              <li key={f.id} className={`acc-row acc-${f.accent}`}>
                <span className="acc-glyph" aria-hidden="true">{ACC_GLYPH[f.kind]}</span>
                <span className="acc-body">
                  <span className="acc-head">
                    <span className="acc-title">{f.title}</span>
                    <span className="acc-when">{whenLabel(f.ts, now.getTime())}</span>
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
            ))}
          </ul>
        )}
        <p className="t-small t-dim">
          Calculés depuis tes tentatives enregistrées, jamais comptés à part : une série ne compte qu’au-dessus de 80 % de trous
          justes au premier essai, une forme n’est « apprise » qu’après deux réussites sur deux jours.
        </p>
      </Panel>

      <p className="home-foot t-small t-dim">
        <button type="button" onClick={() => navigate('settings')}>Réglages</button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={() => navigate('audio')}>Crédits audio</button>
      </p>
    </main>
  );
}
