/**
 * Module Gammes — l'écran d'ouverture de l'app : **ce qui est à réviser, puis choisir, puis agir**.
 *
 * Deux rangées de pastilles (la tonique, la gamme), puis **la liste des positions**, chaque ligne portant
 * ses gestes : « Découvrir » et « Séquences ». L'accordage et le système de positions passent dans un repli :
 * ce sont des réglages, pas des étapes. Au-dessus, le bloc « À réviser » liste les formes dues (D128).
 */
import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../app/router';
import { setScaleSelection, useScaleSelection } from '../../app/scaleSession';
import { useSettings } from '../../app/settings';
import { Chip, Panel, PixelButton, Segmented } from '../../app/ui';
import * as clock from '../../core/clock';
import { JOURNAL_SYNCED, loadJournal, progressStore } from '../../core/progress';
import {
  TUNINGS, degreeLabels, fmtNote, getScale, tonicSpellings, type PositionSystem,
} from '../../core/theory';
import { SCALE_GROUPS } from './content';
import { fmtDegree, positionLabelPlain, resolveScale, scaleGroupOf, scaleTitle } from './resolve';
import { reviewDelayText, reviewSummary } from './review';

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
  // l'app s'ouvre ici : une synchro arrivée après l'affichage peut ajouter des formes dues
  const [synced, setSynced] = useState(0);
  useEffect(() => {
    const on = () => setSynced((n) => n + 1);
    window.addEventListener(JOURNAL_SYNCED, on);
    return () => window.removeEventListener(JOURNAL_SYNCED, on);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const review = useMemo(() => reviewSummary(loadJournal(progressStore()), clock.now()), [synced]);

  const set = (patch: Parameters<typeof setScaleSelection>[0]) => setScaleSelection(patch);
  const resetPosition = { positionIndex: 0 };
  /** Choisit une position puis ouvre l'écran voulu : un seul geste par ligne. */
  const open = (index: number, where: 'scale' | 'sequences') => {
    setScaleSelection({ positionIndex: index });
    navigate(where);
  };

  // naturelles d'abord, altérées dessous ; une hauteur à deux noms garde ses deux boutons
  const tonicNames = Array.from({ length: 12 }, (_, pc) => tonicSpellings(r.def, pc))
    .flatMap((names) => names.map((name) => ({ name, names })));

  return (
    <main className="shell"><div className="catalog-surface">
      <header className="page-head">
        <div>
          <h1 className="page-title">Gammes</h1>
          <p className="t-small t-dim">Choisis la gamme, puis la position.</p>
        </div>
      </header>

      {review.forms.length > 0 ? (
        <Panel className="span-12 review-due" accent="green" active label="À réviser" right={<span className="badge">{review.count}</span>}>
          <ul className="review-forms">
            {review.forms.map((t) => (
              <li key={t.nodeId}>
                <strong>{t.title}</strong>
                <span className="t-small t-dim">{t.positionLabel.split(' · ')[0]} · {t.reason}</span>
              </li>
            ))}
          </ul>
          <PixelButton variant="primary" onClick={() => navigate('review')}>
            ▶ Réviser {review.forms.length > 1 ? `ces ${review.forms.length} formes` : 'cette forme'}
          </PixelButton>
        </Panel>
      ) : review.nextDue !== null && (
        <p className="t-small t-dim review-next">Rien à réviser pour l’instant · {reviewDelayText(review.nextDue - clock.now())}.</p>
      )}

      <Panel className="span-5 panel-fill" accent="magenta" label="1 · La gamme">
        <p className="t-label tonics-label">Tonique</p>
        {[tonicNames.filter((t) => t.name.length === 1), tonicNames.filter((t) => t.name.length > 1)].map((group, i) => group.length > 0 && (
          <div key={i} className={i === 0 ? 'tonics' : 'tonics tonics-alt'}>
            {group.map(({ name: n, names }) => (
              <Chip
                    key={n}
                    selected={r.selection.tonic === n}
                    onClick={() => set({ tonic: n, ...resetPosition })}
                    title={names.length > 1 ? `${names.map((x) => fmtNote(x, settings.noteNotation)).join(' ou ')} : même son, deux orthographes` : undefined}
              >
                {fmtNote(n, settings.noteNotation)}
              </Chip>
            ))}
          </div>
        ))}
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
                    <button type="button" className="pos-act primary" onClick={() => open(i, 'scale')}>Découvrir</button>
                    <button type="button" className="pos-act" onClick={() => open(i, 'sequences')}>Séquences</button>
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
    </div></main>
  );
}
