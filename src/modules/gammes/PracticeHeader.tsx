import { setScaleSelection } from '../../app/scaleSession';
import { useSettings } from '../../app/settings';
import { PixelButton } from '../../app/ui';
import { TUNINGS, fmtNote, getScale, tonicSpellings } from '../../core/theory';
import { SCALE_GROUPS } from './content';
import { type ResolvedScale } from './resolve';
import { ScaleTabs, type ScaleTab } from './ScaleTabs';

/** Les réglages communs précèdent l'outil ; ils ne changent jamais pendant une prise. */
export function PracticeHeader({ scale: r, current, disabled = false }: { scale: ResolvedScale; current: ScaleTab; disabled?: boolean }) {
  const settings = useSettings();
  return <header className="practice-head">
    <h1 className="page-title">{r.title}</h1>
    <fieldset className="practice-selectors" disabled={disabled}>
      <legend className="sr-only">Choisir la gamme</legend>
      <label><span className="sr-only">Tonique</span><select aria-label="Tonique" value={r.selection.tonic} onChange={e => setScaleSelection({ tonic: e.target.value, positionIndex: 0 })}>
        {Array.from({ length: 12 }, (_, pc) => tonicSpellings(r.def, pc)).flat().map(n => <option key={n} value={n}>{fmtNote(n, settings.noteNotation)}</option>)}
      </select></label>
      <label><span className="sr-only">Gamme</span><select aria-label="Gamme" value={r.def.id} onChange={e => setScaleSelection({ scaleId: e.target.value, positionIndex: 0 })}>
        {SCALE_GROUPS.map(g => <optgroup key={g.id} label={g.title}>{g.scaleIds.map(id => <option key={id} value={id}>{getScale(id).nameFr}</option>)}</optgroup>)}
      </select></label>
      <label><span className="sr-only">Accordage</span><select aria-label="Accordage" value={r.tuning.id} onChange={e => setScaleSelection({ tuningId: e.target.value, positionIndex: 0 })}>
        {Object.values(TUNINGS).map(t => <option key={t.id} value={t.id}>{t.nameFr}</option>)}
      </select></label>
    </fieldset>
    <ScaleTabs current={current} />
  </header>;
}

/** Position précédente / suivante. Avec `onStep`, la page décide du geste (Découvrir boucle) ; sinon on s'arrête aux bords. */
export function PositionStepper({ scale: r, disabled = false, onStep }: { scale: ResolvedScale; disabled?: boolean; onStep?: (delta: number) => void }) {
  const i = r.selection.positionIndex;
  const n = r.positions.length;
  const step = (delta: number) => onStep ? onStep(delta) : setScaleSelection({ positionIndex: Math.min(n - 1, Math.max(0, i + delta)) });
  return <div className="position-stepper">
    <PixelButton variant="quiet" onClick={() => step(-1)} disabled={disabled || (onStep ? n < 2 : i === 0)}>‹ Position</PixelButton>
    <span className="t-label pos-count">{i + 1} / {n}</span>
    <PixelButton variant="quiet" onClick={() => step(1)} disabled={disabled || (onStep ? n < 2 : i >= n - 1)}>Position ›</PixelButton>
  </div>;
}

export function PositionRail({ scale: r, disabled = false, onSelect }: { scale: ResolvedScale; disabled?: boolean; onSelect?: (index: number) => void }) {
  return <nav className="position-rail" aria-label="Positions de la gamme">
    {r.positions.map((p, i) => <button key={p.id} type="button" disabled={disabled} aria-label={`Position ${i + 1}`} aria-current={i === r.selection.positionIndex ? 'true' : undefined}
      className={i === r.selection.positionIndex ? 'on' : ''} onClick={() => onSelect ? onSelect(i) : setScaleSelection({ positionIndex: i })}>
      {String(i + 1).padStart(2, '0')}
    </button>)}
  </nav>;
}
