/**
 * Hub d'accueil — version phase 2. Trois choses seulement, mais **toutes calculées depuis le journal** :
 *  1. ce qui a été fait aujourd'hui (écoutes et exercices réels, précision réelle) ;
 *  2. ce qui est dû (Leitner) et ce que l'app propose de réviser maintenant ;
 *  3. où on en est (XP plafonné par jour, série, formes apprises, badges).
 * Aucun compteur décoratif : un chiffre affiché ici se retrouve dans `fretwave.attempts.v1`.
 */
import { useMemo, useState } from 'react';
import { navigate } from '../app/router';
import { setScaleSelection, useScaleSelection } from '../app/scaleSession';
import { useSettings } from '../app/settings';
import { Bar, Chip, Panel, PixelButton, PixelIcon } from '../app/ui';
import { MODULES } from '../modules/registry';
import { ENTRY_POINTS, type EntryPoint } from '../modules/gammes/content';
import { positionLabel, resolveScale } from '../modules/gammes/resolve';
import { intervalStyle } from '../core/tab';
import { fmtNote } from '../core/theory';
import {
  DAILY_XP_CAP, badgeStatus, cardsFrom, dueNow, loadJournal, nodeIdOf, progressStore, streak, stringWeakness,
  summarizeDay, summarizeNodes, weakTonics, xpSummary, type Attempt, type NodeStats,
} from '../core/progress';
import { unseenTonic } from '../modules/gammes/transpose';
import { buildReviewQueue } from '../modules/gammes/review';
import { chordProgress, learnedChordIds, nextChord } from '../modules/accords/recommend';
import { fmtChord } from '../core/theory';

/** Repère de lecture du diagnostic par corde (accordage standard, de la plus grave à la plus aiguë). */
const STRING_LABEL_FR = ['Mi grave', 'La', 'Ré', 'Sol', 'Si', 'Mi aigu'];

/** Échéance lisible ; jamais « dans 0 min ». */
function dueIn(ts: number, now: number): string {
  const minutes = Math.round((ts - now) / 60_000);
  if (minutes < 60) return `dans ${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `dans ${hours} h`;
  return `dans ${Math.round(hours / 24)} j`;
}

/** Objectif proposé : 3 activités (une écoute ou un exercice), pas 3 « clics ». */
export const DAILY_GOAL = 3;

function minutes(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  return `${Math.round(seconds / 60)} min`;
}

/** Ouvre un point d'entrée : sélection écrite, position de la forme visée, écran niveau 1. */
export function openEntryPoint(p: EntryPoint): void {
  const resolved = resolveScale({
    scaleId: p.scaleId, tonic: p.tonic, tuningId: 'standard', system: p.system, positionIndex: 0,
  });
  const target = p.shape ? resolved.positions.findIndex((x) => x.shape === p.shape) : 0;
  setScaleSelection({
    scaleId: p.scaleId,
    tonic: resolved.tonic,
    system: p.system,
    positionIndex: Math.max(0, target),
  });
  navigate('scale');
}

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

/** Ouvre la même **forme** dans une autre tonique (transposition, MUSIC_DESIGN §3.1). */
export function openSameFormIn(node: NodeStats, tonic: string): void {
  const resolved = resolveScale({
    scaleId: node.scaleId, tonic, tuningId: 'standard', system: node.system as never, positionIndex: 0,
  });
  const idx = resolved.positions.findIndex((p) => (p.formIndex ?? p.index) === node.formIndex);
  setScaleSelection({
    scaleId: node.scaleId,
    tonic: resolved.tonic,
    tuningId: resolved.tuning.id,
    system: resolved.selection.system,
    positionIndex: Math.max(0, idx),
  });
  navigate('training');
}

/** Écrit une fausse tentative ? Jamais : le hub ne fabrique rien, il lit. */
export function HubPage() {
  const settings = useSettings();
  const sel = useScaleSelection();
  const resolved = useMemo(() => resolveScale(sel, settings.noteNotation), [sel, settings.noteNotation]);
  const [journal] = useState<Attempt[]>(() => loadJournal(progressStore()));
  const now = useMemo(() => new Date(), []);
  const day = useMemo(() => summarizeDay(journal, now), [journal, now]);
  const xp = useMemo(() => xpSummary(journal, now), [journal, now]);
  const st = useMemo(() => streak(journal, now), [journal, now]);
  const allNodes = useMemo(() => summarizeNodes(journal), [journal]);
  // le hub des gammes ne compte que les nœuds de gammes : les accords ont leur propre panneau
  const nodes = useMemo(() => allNodes.filter((n) => n.module === 'gammes'), [allNodes]);
  const learned = nodes.filter((n) => n.state === 'learned' || n.state === 'mastered').length;
  const mastered = nodes.filter((n) => n.state === 'mastered').length;
  // même règle pour les cartes dues : une carte d'accord ne s'ouvre pas sur un écran de gamme
  const due = useMemo(() => dueNow(journal, now.getTime()).filter((c) => !c.nodeId.startsWith('acc:')), [journal, now]);
  const chordDue = useMemo(() => dueNow(journal, now.getTime()).filter((c) => c.nodeId.startsWith('acc:')), [journal, now]);
  const chordLearned = useMemo(() => learnedChordIds(journal), [journal]);
  const chordNext = useMemo(() => nextChord(chordLearned), [chordLearned]);
  const chordCount = chordProgress(chordLearned);
  const allCards = useMemo(() => cardsFrom(journal), [journal]);
  const nextDue = useMemo(() => allCards.filter((c) => c.due > now.getTime()).sort((a, b) => a.due - b.due)[0] ?? null, [allCards, now]);
  const weak = useMemo(() => stringWeakness(journal)[0] ?? null, [journal]);
  const mix = useMemo(() => buildReviewQueue(journal, now.getTime()), [journal, now]);
  // une forme vue dans une seule zone du manche : on propose de la transposer, pas de la réviser à l'identique
  const tonicGap = useMemo(() => {
    const node = weakTonics(nodes)[0] ?? null;
    if (!node) return null;
    const tonic = unseenTonic(node.scaleId, node.tonics);
    return tonic ? { node, tonic } : null;
  }, [nodes]);
  const badges = useMemo(() => badgeStatus(journal, now), [journal, now]);
  // une déclaration (« je l'ai plaqué ») est une activité, jamais une preuve : elle compte ici, pas dans l'XP
  const activity = day.listens + day.exercises + day.selfAssessed;
  const last = nodes[0] ?? null;

  const review = () => {
    const card = due[0];
    if (!card) return;
    const a = [...journal].reverse().find((x) => nodeIdOf(x) === card.nodeId && x.correct !== null);
    if (a) openAttempt(a);
    else navigate('training');
  };

  return (
    <main className="shell">
      <header className="hero">
        <p className="hero-kicker t-label">gammes &amp; accords · progression</p>
        <h1 className="hero-title">FRETWAVE</h1>
        <p className="hero-sub">
          <span>
            APPRENDRE LA GUITARE
            <br />
            EN TABLATURE
          </span>
        </p>
        <p className="hero-hint t-label">↓ 31 gammes · 5 systèmes · N1 à N3 · accords corde par corde</p>
      </header>

      <Panel className="span-5 panel-fill" accent="cyan" label="Aujourd’hui" right={<span className="badge">{activity} / {DAILY_GOAL}</span>}>
        <p className="stat-line">
          <strong>{day.listens}</strong> écoute{day.listens > 1 ? 's' : ''} · <strong>{day.exercises}</strong> exercice{day.exercises > 1 ? 's' : ''}
          {day.selfAssessed > 0 ? ` · ${day.selfAssessed} déclaration${day.selfAssessed > 1 ? 's' : ''}` : ''}
          {day.seconds > 0 ? ` · ${minutes(day.seconds)}` : ''}
        </p>
        <Bar value={Math.min(activity, DAILY_GOAL)} max={DAILY_GOAL} accent="cyan" />
        <p className="t-small">
          {activity === 0
            ? 'Rien d’enregistré aujourd’hui : une écoute complète ou une série de trous compte pour une activité.'
            : activity >= DAILY_GOAL
              ? 'Objectif atteint. La suite utile, c’est la révision proposée à droite.'
              : `Encore ${DAILY_GOAL - activity} activité${DAILY_GOAL - activity > 1 ? 's' : ''} pour l’objectif.`}
        </p>
        {day.accuracy !== null && (
          <p className="t-small">
            Précision du jour : <strong>{Math.round(day.accuracy * 100)} %</strong> ({day.correct} / {day.holes} trous au premier essai).
          </p>
        )}
        <div className="panel-foot">
          <PixelButton variant="quiet" onClick={() => navigate('settings')}>Réglages</PixelButton>
          <PixelButton variant="quiet" onClick={() => navigate('audio')}>Crédits audio</PixelButton>
        </div>
      </Panel>

      <Panel
        className="span-7"
        accent="magenta"
        label="Révision du jour"
        right={<span className="badge">{due.length}</span>}
      >
        <p className="t-small">
          Calculée par la répétition espacée (Leitner, 6 boîtes) à partir de tes tentatives réelles. Plafond de 8 cartes
          par session : une absence ne crée pas de dette impossible.
        </p>
        {due.length === 0 ? (
          <p className="t-body">
            {journal.length === 0
              ? 'Aucune carte : le journal est vide. Commence par une écoute (niveau 1) puis une série de trous (niveau 2).'
              : 'Rien n’est dû maintenant. La prochaine échéance apparaîtra ici — en attendant, une nouvelle série est plus utile que de réviser à vide.'}
          </p>
        ) : (
          <div className="review-list">
            {due.slice(0, 3).map((card) => {
              const lastA = [...journal].reverse().find((x) => nodeIdOf(x) === card.nodeId);
              const r = lastA ? resolveScale({ scaleId: lastA.scaleId, tonic: lastA.tonic, tuningId: lastA.tuningId, system: lastA.system as never, positionIndex: 0 }) : null;
              const idx = lastA && r ? r.positions.findIndex((p) => (p.formIndex ?? p.index) === lastA.formIndex) : -1;
              return (
                <div key={card.nodeId} className="review-row">
                  <div className="review-body">
                    <span className="review-title">{r ? r.title : card.nodeId}</span>
                    <span className="t-small t-dim">
                      {r && idx >= 0 ? positionLabel(r.positions[idx] ?? null, settings.noteNotation) : 'position'}
                      {' · '}boîte {card.box} · dernière fois {Math.round(card.lastScore * 100)} %
                    </span>
                  </div>
                  {lastA && (
                    <Chip small onClick={() => openAttempt(lastA)}>ouvrir</Chip>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="row">
          <PixelButton variant="primary" onClick={review} disabled={due.length === 0}>Réviser maintenant</PixelButton>
          <PixelButton onClick={() => navigate('review')} disabled={mix.length === 0}>
            Session mélangée{mix.length > 0 ? ` (${mix.length})` : ''}
          </PixelButton>
          <PixelButton variant="quiet" onClick={() => navigate('training')}>Nouvelle série</PixelButton>
        </div>
        {mix.length > 0 && (
          <p className="t-small t-dim">
            Mélange proposé : {mix.map((t) => `${t.title} · ${t.positionLabel}`).join(' · ')}. Des formes différentes
            d’affilée retiennent mieux que la même rejouée.
          </p>
        )}
        {nextDue && (
          <p className="t-small t-dim">
            Prochaine échéance : {dueIn(nextDue.due, now.getTime())} (boîte {nextDue.box} sur 6).
            La revoyure rapprochée est voulue : c’est elle qui fixe une forme apprise le soir même.
          </p>
        )}
      </Panel>

      <Panel className="span-5" accent="yellow" label="Niveau" right={<span className="tag">{st.days > 0 ? `${st.days} j${st.days > 1 ? 's' : ''} d’affilée` : 'série à lancer'}</span>}>
        <p className="stat-line"><strong>{xp.total}</strong> XP au total · <strong>{xp.today}</strong> / {DAILY_XP_CAP} aujourd’hui</p>
        <Bar value={xp.today} max={DAILY_XP_CAP} accent="yellow" />
        <p className="t-small">
          Seuls les exercices vérifiés rapportent de l’XP (10 par série de trous, 15 par rappel, +5 à ≥ 95 % de précision).
          Une écoute ne rapporte rien : elle n’est pas vérifiée.
        </p>
        <p className="t-small">
          <strong>{nodes.length}</strong> forme{nodes.length > 1 ? 's' : ''} travaillée{nodes.length > 1 ? 's' : ''} ·{' '}
          <strong>{learned}</strong> apprise{learned > 1 ? 's' : ''} · <strong>{mastered}</strong> maîtrisée{mastered > 1 ? 's' : ''}
          {last ? ` · la plus avancée : ${Math.round(last.mastery * 100)} %` : ''}
        </p>
        <p className="t-small t-dim">
          « Apprise » = 2 réussites (≥ 80 %) sur 2 jours différents. « Maîtrisée » = apprise + révision tenue à 16 jours.
        </p>
        {weak && (
          <p className="t-small">
            Corde à travailler : <strong>{STRING_LABEL_FR[weak.string] ?? `corde ${weak.string + 1}`}</strong> —{' '}
            {weak.misses} case{weak.misses > 1 ? 's' : ''} manquée{weak.misses > 1 ? 's' : ''} sur {weak.attempts} tentative{weak.attempts > 1 ? 's' : ''}.
          </p>
        )}
        {tonicGap && (
          <>
            <p className="t-small">
              Cette forme n’a encore été jouée qu’en {tonicGap.node.tonics.map((t) => fmtNote(t, settings.noteNotation)).join(', ')} :
              la savoir, c’est savoir la <strong>transposer</strong>. Même motif, autre case.
            </p>
            <div className="row">
              <PixelButton variant="quiet" onClick={() => openSameFormIn(tonicGap.node, tonicGap.tonic)}>
                Même forme en {fmtNote(tonicGap.tonic, settings.noteNotation)}
              </PixelButton>
            </div>
          </>
        )}
      </Panel>

      <Panel
        className="span-7"
        accent="magenta"
        label="Reprendre"
        right={<Chip small onClick={() => navigate('gammes')}>Changer</Chip>}
      >
        <h3 className="card-title">{resolved.title}</h3>
        <p className="t-small">
          {positionLabel(resolved.position, settings.noteNotation)}
          {resolved.formula ? ` · ${resolved.formula}` : ''}
        </p>
        {resolved.parent && <p className="t-small t-dim">{resolved.parent}</p>}
        <div className="row">
          <PixelButton variant="primary" onClick={() => navigate('scale')}>
            ▶ Écouter
          </PixelButton>
          <PixelButton onClick={() => navigate('training')}>Se tester</PixelButton>
          <PixelButton variant="quiet" onClick={() => navigate('gammes')}>
            Choisir une gamme
          </PixelButton>
        </div>
      </Panel>

      <Panel className="span-5" accent="cyan" label="Accords" right={<span className="badge">{chordCount.done} / {chordCount.total}</span>}>
        {chordNext ? (
          <>
            <h3 className="card-title">{fmtChord(chordNext.chord, settings.chordNotation)}</h3>
            <p className="t-small">palier {chordNext.palier.id} · {chordNext.why}</p>
            <p className="t-small t-dim">Pourquoi : {chordNext.reason}.</p>
            <div className="row">
              <PixelButton variant="primary" onClick={() => navigate('chord')}>Reprendre cette leçon</PixelButton>
              <PixelButton variant="quiet" onClick={() => navigate('accords')}>Le parcours</PixelButton>
            </div>
            {chordDue.length > 0 && (
              <p className="t-small t-dim">{chordDue.length} accord{chordDue.length > 1 ? 's' : ''} dont la révision est due.</p>
            )}
          </>
        ) : (
          <>
            <p className="t-body">Le parcours d’accords ouvert est terminé : place aux transitions et au tempo (4b, phase 5).</p>
            <div className="row"><PixelButton onClick={() => navigate('accords')}>Voir le parcours</PixelButton></div>
          </>
        )}
        <p className="t-small t-dim">
          Chaque corde est vérifiée au micro, une par une. Un accord plaqué déclaré n’est jamais certifié : c’est la phase 5 qui saura l’écouter.
        </p>
      </Panel>

      <div className="col-5">
        <Panel accent="cyan" label="Par où commencer">
          <p className="t-small">Trois portes d’entrée, dans l’ordre où je les enseignerais.</p>
          <div className="entries">
            {ENTRY_POINTS.map((p, i) => (
              <button key={p.title} type="button" className="entry" onClick={() => openEntryPoint(p)}>
                <span className="entry-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="entry-body">
                  <span className="entry-title">{p.title}</span>
                  <span className="entry-why">{p.why}</span>
                </span>
                <span className="entry-go" aria-hidden="true">▶</span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="span-7" accent="yellow" label="Badges">
        <p className="t-small">Chacun dit ce qu’il récompense ; il ne s’allume que si le journal le prouve.</p>
        <div className="badges">
          {badges.map((b) => (
            <div key={b.id} className={`badge-item ${b.earned ? 'on' : ''}`} title={b.why}>
              <span className="badge-item-dot" aria-hidden="true">{b.earned ? '★' : '·'}</span>
              <span className="badge-item-body">
                <span className="badge-item-title">{b.title}</span>
                <span className="t-small t-dim">{b.why}</span>
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="span-7" accent="violet" label="Modules">
        <p className="t-small">Deux modules jouables, deux déclarés — l’état est écrit, pas suggéré.</p>
        <div className="modules">
          {MODULES.map((m) => (
            <article key={m.id} className={`module ${m.status}`} style={{ ['--accent' as never]: `var(--${m.accent})` }}>
              <PixelIcon name={m.icon} size={28} color={`var(--${m.accent})`} />
              <div className="module-body">
                <div className="module-head">
                  <h3>{m.title}</h3>
                  <span className={`tag ${m.status === 'available' ? 'tag-on' : ''}`}>{m.statusLabel}</span>
                </div>
                <p className="t-small">{m.tagline}</p>
                {m.facts && m.facts.length > 0 && (
                  <ul className="module-facts">
                    {m.facts.map((f) => <li key={f} className="t-small t-dim">{f}</li>)}
                  </ul>
                )}
                {m.status === 'available' && m.route && (
                  <PixelButton variant="ghost" className="wide" onClick={() => navigate(m.route!)}>
                    Entrer
                  </PixelButton>
                )}
              </div>
            </article>
          ))}
        </div>
      </Panel>

      <Panel className="span-5 colour-key" accent="green" label="Le code couleur">
        <p className="t-small">
          La couleur d’une pastille donne la <strong>fonction</strong> de la note, jamais sa place sur le manche — et elle ne change
          pas d’une ambiance à l’autre.
        </p>
        <div className="key-row">
          {['1', '2', '3', '4', '5', '6', '7'].map((fn) => {
            const stl = intervalStyle(fn);
            return (
              <span key={fn} className="key-pill" style={{ background: stl.fill, color: stl.digit }}>{fn}</span>
            );
          })}
        </div>
        <p className="t-small t-dim">
          Un bémol assombrit la pastille et pose une encoche en bas ; un dièse l’éclaircit et pose l’encoche en haut. Ainsi ♭3 et 3
          ne se confondent pas, et ♯4 et ♭5 non plus : ce ne sont pas les mêmes fonctions.
        </p>
      </Panel>

      <p className="t-small t-dim foot-note">
        Journal local ({journal.length} tentative{journal.length > 1 ? 's' : ''}, plafond 2 000) : exportable et importable depuis les réglages.
        Rien n’est envoyé sur un serveur. Les chiffres de ce hub sont recalculés à chaque ouverture depuis ce journal.
      </p>
    </main>
  );
}
