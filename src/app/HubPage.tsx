/**
 * Hub d'accueil (BRIEF.md §1, PROJECT.md §6.1). Trois choses seulement, mais vraies :
 *  1. l'objectif du jour, compté depuis le journal de pratique local (pas d'XP inventée) ;
 *  2. « reprendre » : la gamme laissée en cours, telle qu'elle a été choisie ;
 *  3. trois portes d'entrée pédagogiques + l'état franc des modules.
 */
import { useMemo, useState } from 'react';
import { navigate } from '../app/router';
import { setScaleSelection, useScaleSelection } from '../app/scaleSession';
import { useSettings } from '../app/settings';
import { Bar, Chip, Panel, PixelButton, PixelIcon } from '../app/ui';
import { MODULES } from '../modules/registry';
import { ENTRY_POINTS, type EntryPoint } from '../modules/gammes/content';
import { positionLabel, resolveScale } from '../modules/gammes/resolve';
import { practiceStore, readLog, summarizeDay } from '../core/progress/practiceLog';
import { intervalStyle } from '../core/tab';

/** Objectif proposé : 3 écoutes. Pas de réglage avant la phase 2 (répétition espacée). */
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

export function HubPage() {
  const settings = useSettings();
  const sel = useScaleSelection();
  const resolved = useMemo(() => resolveScale(sel, settings.noteNotation), [sel, settings.noteNotation]);
  const [log] = useState(() => readLog(practiceStore()));
  const day = useMemo(() => summarizeDay(log, new Date()), [log]);

  return (
    <main className="shell">
      <header className="hero">
        <p className="hero-kicker t-label">phase 1d · hub</p>
        <h1 className="hero-title">FRETWAVE</h1>
        <p className="hero-sub">
          <span>
            APPRENDRE LA GUITARE
            <br />
            EN TABLATURE
          </span>
        </p>
        <p className="hero-hint t-label">↓ 31 gammes · 5 systèmes · N1</p>
      </header>

      <Panel className="span-5 panel-fill" accent="cyan" label="Objectif du jour" right={<span className="badge">{day.count} / {DAILY_GOAL}</span>}>
        <p className="stat-line">
          <strong>{day.distinct}</strong> gamme{day.distinct > 1 ? 's' : ''} écoutée{day.distinct > 1 ? 's' : ''}
          {day.seconds > 0 ? ` · ${minutes(day.seconds)}` : ''}
        </p>
        <Bar value={Math.min(day.count, DAILY_GOAL)} max={DAILY_GOAL} accent="cyan" />
        <p className="t-small">
          {day.count === 0
            ? 'Rien d’enregistré aujourd’hui : une écoute complète compte pour une.'
            : day.count >= DAILY_GOAL
              ? 'Objectif atteint. Les niveaux 2 et 3 arrivent en phase 2.'
              : `Encore ${DAILY_GOAL - day.count} écoute${DAILY_GOAL - day.count > 1 ? 's' : ''} pour l’objectif.`}
        </p>
        <div className="panel-foot">
          <PixelButton variant="quiet" onClick={() => navigate('settings')}>Réglages</PixelButton>
          <PixelButton variant="quiet" onClick={() => navigate('audio')}>Crédits audio</PixelButton>
        </div>
      </Panel>

      <Panel
        className="span-7"
        accent="magenta"
        label="Reprendre"
        right={<Chip small onClick={() => navigate('gammes')}>changer</Chip>}
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
          <PixelButton variant="quiet" onClick={() => navigate('gammes')}>
            Choisir une gamme
          </PixelButton>
        </div>
      </Panel>

      <div className="col-5">
      <section className="section">
          <h2 className="section-title t-label">Par où commencer</h2>
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
        </section>
      </div>

      <section className="section span-7">
        <h2 className="section-title t-label">Modules</h2>
        <p className="t-small">Un module jouable aujourd’hui, trois déclarés — l’état est écrit, pas suggéré.</p>
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
      </section>

      <section className="section span-5 colour-key">
        <h2 className="section-title t-label">Le code couleur</h2>
        <p className="t-small">
          La couleur d’une pastille donne la <strong>fonction</strong> de la note, jamais sa place sur le manche — et elle ne change
          pas d’une ambiance à l’autre.
        </p>
        <div className="key-row">
          {['1', '2', '3', '4', '5', '6', '7'].map((fn) => {
            const st = intervalStyle(fn);
            return (
              <span key={fn} className="key-pill" style={{ background: st.fill, color: st.digit }}>{fn}</span>
            );
          })}
        </div>
        <p className="t-small t-dim">
          Un bémol assombrit la pastille et pose une encoche en bas ; un dièse l’éclaircit et pose l’encoche en haut. Ainsi ♭3 et 3
          ne se confondent pas, et ♯4 et ♭5 non plus : ce ne sont pas les mêmes fonctions.
        </p>
      </section>

      <p className="t-small t-dim foot-note">
        Seul le journal d’écoute est enregistré pour l’instant (localement, sur cet appareil).
        XP, séries et répétition espacée arrivent en phase 2 — je n’affiche pas de compteurs décoratifs.
      </p>
    </main>
  );
}
