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
import { positionLabel, resolveScale } from '../modules/gammes/resolve';
import {
  dueNow, loadJournal, nodeIdOf, progressStore, streak, summarizeDay, xpSummary,
  type Attempt,
} from '../core/progress';

/** Objectif proposé : 3 activités (une écoute ou un exercice), pas 3 « clics ». */
export const DAILY_GOAL = 3;

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

  const review = () => {
    const card = due[0];
    if (!card) return;
    const a = [...journal].reverse().find((x) => nodeIdOf(x) === card.nodeId && x.correct !== null);
    if (a) openAttempt(a);
    else navigate('training');
  };

  return (
    <main className="shell">
      <header className="home-head">
        <div className="home-head-main">
          <h1 className="home-title">Fretwave</h1>
          <p className="t-small t-dim">
            {activity} / {DAILY_GOAL} activités aujourd’hui
            {` · ${xp.total} XP`}
          </p>
        </div>
        {st.days > 0 && <span className="tag tag-on">{st.days} j d’affilée</span>}
      </header>

      <Panel
        className="span-12 home-go"
        accent="magenta"
        label="Continuer"
        right={<Chip small onClick={() => navigate('gammes')}>Changer</Chip>}
      >
        <h2 className="home-title">{resolved.title}</h2>
        <p className="t-small">{positionLabel(resolved.position, settings.noteNotation)}{resolved.formula ? ` · ${resolved.formula}` : ''}</p>
        <div className="row home-actions">
          <PixelButton variant="primary" onClick={() => navigate('scale')}>▶ Découvrir</PixelButton>
          <PixelButton onClick={() => navigate('training')}>S’exercer au micro</PixelButton>
        </div>
        <p className="t-small t-dim">
          Découvrir : la position s’affiche et s’écoute. S’exercer : le micro vérifie chaque note.
        </p>
      </Panel>

      <div className="span-6 home-door">
        <button type="button" className="door" onClick={() => navigate('gammes')}>
          <span className="door-kicker">Apprendre</span>
          <span className="door-title">Une gamme, ses positions</span>
          <span className="door-sub">Choisis la gamme, puis la position : elle s’ouvre en tablature.</span>
        </button>
      </div>

      <div className="span-6 home-door">
        <button type="button" className="door" onClick={() => navigate('tuner')}>
          <span className="door-kicker">Accorder</span>
          <span className="door-title">La guitare, corde par corde</span>
          <span className="door-sub">Au micro ou en USB, avant de jouer — une fausse note d’accordage fausse tout.</span>
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
                      {r && idx >= 0 ? positionLabel(r.positions[idx] ?? null, settings.noteNotation) : 'position'}
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

      <p className="home-foot t-small t-dim">
        <button type="button" onClick={() => navigate('settings')}>Réglages</button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={() => navigate('accords')}>Accords</button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={() => navigate('audio')}>Crédits audio</button>
      </p>
    </main>
  );
}
