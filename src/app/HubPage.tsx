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

      <Panel accent="cyan" label="Objectif du jour" right={<span className="badge">{day.count} / {DAILY_GOAL}</span>}>
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
      </Panel>

      <Panel
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

      <section className="section">
        <h2 className="section-title t-label">Modules</h2>
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

      <p className="t-small t-dim foot-note">
        Seul le journal d’écoute est enregistré pour l’instant (localement, sur cet appareil).
        XP, séries et répétition espacée arrivent en phase 2 — je n’affiche pas de compteurs décoratifs.
      </p>
    </main>
  );
}
