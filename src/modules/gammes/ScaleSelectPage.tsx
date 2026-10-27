/**
 * Module Gammes — sélection (BRIEF.md §2 « Sélection », PROJECT.md §6.2).
 * Cinq décisions, dans l'ordre où on les prend : la gamme, la tonique (avec le mode parent),
 * l'accordage, le système de positions (avec la table de compatibilité) et la position.
 * Tout est dérivé du moteur (`resolveScale`) : aucune liste écrite en dur dans l'écran.
 */
import { useMemo } from 'react';
import { navigate } from '../../app/router';
import { setScaleSelection, useScaleSelection } from '../../app/scaleSession';
import { useSettings } from '../../app/settings';
import { Chip, Panel, PixelButton, Segmented } from '../../app/ui';
import {
  TUNINGS, degreeLabels, fmtNote, getScale, tonicSpellings, type PositionSystem,
} from '../../core/theory';
import { SCALE_GROUPS } from './content';
import { fmtDegree, positionLabel, resolveScale, scaleTitle } from './resolve';

const SYSTEM_LABEL: Record<PositionSystem, string> = {
  '3nps': '3 notes par corde',
  caged: 'CAGED',
  boxes: 'Boxes',
  symmetric: 'Motifs symétriques',
  'passing-note': 'Position + note de passage',
};

export function ScaleSelectPage() {
  const settings = useSettings();
  const selection = useScaleSelection();
  const r = useMemo(() => resolveScale(selection, settings.noteNotation), [selection, settings.noteNotation]);
  const group = SCALE_GROUPS.find((g) => g.scaleIds.includes(selection.scaleId)) ?? SCALE_GROUPS[0]!;

  const set = (patch: Parameters<typeof setScaleSelection>[0]) => setScaleSelection(patch);
  const resetPosition = { positionIndex: 0 };

  return (
    <main className="shell">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate('hub')} aria-label="Retour au hub">‹</button>
        <div>
          <h1 className="page-title">Gammes</h1>
          <p className="t-small t-dim">Choisis, écoute, repère la tonique</p>
        </div>
        <span className="tag tag-on">N1</span>
      </header>

      <Panel accent="magenta" label="1 · Gamme">
        <Segmented
          size="sm"
          label="Famille de gammes"
          value={group.id}
          onChange={(id) => {
            const g = SCALE_GROUPS.find((x) => x.id === id)!;
            set({ scaleId: g.scaleIds[0]!, ...resetPosition });
          }}
          options={SCALE_GROUPS.map((g) => ({ value: g.id, label: g.short, note: g.title }))}
        />
        <p className="t-small t-dim group-note">{group.note}</p>
        <div className="scale-list">
          {group.scaleIds.map((id) => {
            const def = getScale(id);
            const on = selection.scaleId === id;
            return (
              <button
                key={id}
                type="button"
                className={`scale-row ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => set({ scaleId: id, ...resetPosition })}
              >
                <span className="scale-name">{def.nameFr}</span>
                <span className="scale-deg">{degreeLabels(def).map(fmtDegree).join(' ')}</span>
                <span className="scale-n">{def.intervals.length} notes</span>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel accent="cyan" label="2 · Tonique">
        <div className="tonics">
          {Array.from({ length: 12 }, (_, pc) => tonicSpellings(r.def, pc)).map((names) =>
            names.map((n) => (
              <Chip
                key={n}
                selected={r.selection.tonic === n}
                onClick={() => set({ tonic: n, ...resetPosition })}
                title={names.length > 1 ? `${names.map((x) => fmtNote(x, settings.noteNotation)).join(' ou ')} : même son, deux orthographes` : undefined}
              >
                {fmtNote(n, settings.noteNotation)}
              </Chip>
            )),
          )}
        </div>
        <div className="context-box">
          <p className="card-title">{scaleTitle(r.def, r.tonic, settings.noteNotation)}</p>
          <p className="t-small">{r.formula}</p>
          {r.parent && <p className="t-small t-dim">{r.parent}</p>}
        </div>
        {r.hint && <p className="t-small hint">{r.hint}</p>}
      </Panel>

      <Panel label="3 · Accordage">
        <div className="field">
          <label htmlFor="tuning" className="t-label">Accordage</label>
          <select
            id="tuning"
            value={r.tuning.id}
            onChange={(e) => set({ tuningId: e.target.value, ...resetPosition })}
          >
            {Object.values(TUNINGS).map((t) => (
              <option key={t.id} value={t.id}>{t.nameFr}</option>
            ))}
          </select>
        </div>
        <p className="t-small t-dim">
          {r.tuning.strings.length} cordes · {r.tuning.strings.map((s) => fmtNote(s.replace(/-?\d+$/, ''), settings.noteNotation)).join(' ')}
        </p>
      </Panel>

      <Panel accent="violet" label="4 · Système de positions">
        <div className="system-list">
          {r.support.map((s) => {
            const on = r.selection.system === s.system;
            return (
              <button
                key={s.system}
                type="button"
                className={`system-row ${on ? 'on' : ''}`}
                disabled={!s.available}
                aria-pressed={on}
                onClick={() => set({ system: s.system, ...resetPosition })}
              >
                <span className="radio" aria-hidden="true" />
                <span className="system-body">
                  <span className="system-name">
                    {SYSTEM_LABEL[s.system]}
                    {s.available && s.count ? <em> · {s.count} formes</em> : null}
                  </span>
                  {s.note && <span className="system-note">{s.note}</span>}
                </span>
                {!s.available && <span className="tag">indispo</span>}
              </button>
            );
          })}
        </div>
        <p className="t-small t-dim">Les systèmes grisés ne s’appliquent pas à cette gamme — la raison est écrite.</p>
      </Panel>

      <Panel label="5 · Position">
        <div className="positions">
          {r.positions.map((p, i) => (
            <Chip key={p.id} small selected={r.selection.positionIndex === i} onClick={() => set({ positionIndex: i })}>
              {positionLabel(p, settings.noteNotation)}
            </Chip>
          ))}
        </div>
        {r.positions.length === 0 && (
          <p className="t-small t-dim">Aucune position pour cet accordage : essaie un autre système.</p>
        )}
      </Panel>

      <div className="cta-block">
        <PixelButton variant="primary" className="wide" onClick={() => navigate('scale')}>
          ▶ Écouter cette gamme
        </PixelButton>
      </div>
    </main>
  );
}
