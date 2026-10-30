/**
 * Module Gammes — l'écran unique : **choisir, puis voir les positions et agir dessus**.
 *
 * Avant (phase 1-4), quatre panneaux numérotés (gamme, tonique, système de positions, position) et
 * deux boutons en bas : il fallait comprendre « système de positions » et « CAGED / 3NPS » avant de
 * pouvoir jouer une seule note, et le choix de la position était séparé de l'action.
 *
 * Maintenant : deux rangées de pastilles (la tonique, la gamme), puis **la liste des positions**, chaque
 * ligne portant ses deux gestes — « Découvrir » (niveau 1 : la tablature s'affiche et s'écoute) et
 * « S'exercer » (le micro vérifie chaque note). L'accordage et le système de positions passent dans un
 * repli : ce sont des réglages, pas des étapes.
 */
import { useMemo } from 'react';
import { navigate } from '../../app/router';
import { setScaleSelection, useScaleSelection } from '../../app/scaleSession';
import { useSettings } from '../../app/settings';
import { Chip, Panel, Segmented } from '../../app/ui';
import {
  TUNINGS, degreeLabels, fmtNote, getScale, tonicSpellings, type PositionSystem,
} from '../../core/theory';
import { SCALE_GROUPS } from './content';
import { fmtDegree, positionLabelPlain, resolveScale, scaleGroupOf, scaleTitle } from './resolve';


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
  const group = scaleGroupOf(selection.scaleId, selection.groupId);

  const set = (patch: Parameters<typeof setScaleSelection>[0]) => setScaleSelection(patch);
  const resetPosition = { positionIndex: 0 };
  /** Choisit une position puis ouvre l'écran voulu : un seul geste par ligne. */
  const open = (index: number, where: 'scale' | 'training') => {
    setScaleSelection({ positionIndex: index });
    navigate(where);
  };

  return (
    <main className="shell">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate('hub')} aria-label="Retour à l’accueil">‹</button>
        <div>
          <h1 className="page-title">Gammes</h1>
          <p className="t-small t-dim">Choisis la gamme, puis la position.</p>
        </div>
      </header>

      <Panel className="span-5 panel-fill" accent="magenta" label="1 · La gamme">
        <p className="t-label tonics-label">Tonique</p>
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
        <Segmented
          size="sm"
          label="Famille de gammes"
          value={group.id}
          onChange={(id) => {
            const g = SCALE_GROUPS.find((x) => x.id === id)!;
            set({ groupId: g.id, scaleId: g.scaleIds[0]!, ...resetPosition });
          }}
          options={SCALE_GROUPS.map((g) => ({ value: g.id, label: g.short, note: g.title }))}
        />
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
              </button>
            );
          })}
        </div>
        <p className="chosen-line">
          <strong>{scaleTitle(r.def, r.tonic, settings.noteNotation)}</strong>
          <span className="t-small t-dim"> · {r.formula}</span>
          {r.parent ? <span className="t-small t-dim"> · {r.parent}</span> : null}
        </p>
      </Panel>

      <Panel
        className="span-7"
        accent="violet"
        label={`2 · Les positions (${r.positions.length})`}
        right={<span className="tag">{SYSTEM_LABEL[r.selection.system]}</span>}
      >
        {r.positions.length === 0 ? (
          <p className="t-small t-dim">Aucune position pour cet accordage : choisis un autre système dans les réglages ci-dessous.</p>
        ) : (
          <>
            <ul className="pos-list">
              {r.positions.map((p, i) => (
                <li key={p.id} className={`pos-item ${i === r.selection.positionIndex ? 'on' : ''}`}>
                  <span className="pos-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <span className="pos-body">
                    <span className="pos-label">{positionLabelPlain(p, settings.noteNotation)}</span>
                    <span className="t-small t-dim">départ sur le {fmtDegree(p.notes[0]?.degree ?? '1')} · {p.notes.length} notes</span>
                  </span>
                  <span className="pos-acts">
                    <button type="button" className="pos-act" onClick={() => open(i, 'scale')}>Découvrir</button>
                    <button type="button" className="pos-act primary" onClick={() => open(i, 'training')}>S’exercer</button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <details className="adv-settings">
          <summary className="t-label">Accordage et système de positions</summary>
          <div className="panel-foot tuning-foot">
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
            <p className="t-small t-dim">
              {r.tuning.strings.length} cordes · {r.tuning.strings.map((s) => fmtNote(s.replace(/-?\d+$/, ''), settings.noteNotation)).join(' ')}
            </p>
          </div>
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
          <p className="t-small t-dim">
            « Boxes » = une forme par degré de départ. « 3 notes par corde » = trois notes sur chaque corde, plus
            horizontal. Les systèmes grisés ne s’appliquent pas à cette gamme — la raison est écrite.
          </p>
        </details>
      </Panel>
    </main>
  );
}
