/**
 * La gamme posée sur une corde, comme une règle graduée : treize cases de la fondamentale à l'octave, les
 * pastilles aux couleurs de la tablature. On voit la structure (où sont les écarts) sans avoir à lire la
 * formule, et la formule se vérifie en comptant les cases.
 */
import { useMemo } from 'react';
import { stepFormula, type ScaleDef } from '../../core/theory';
import { rulerSlots } from './resolve';

export function ScaleRuler(props: { def: ScaleDef }) {
  const { def } = props;
  const slots = useMemo(() => rulerSlots(def), [def]);
  return (
    <div className="ruler" role="img" aria-label={`Écarts en cases sur une corde : ${stepFormula(def).join(', ')}`}>
      {slots.map((s, i) => (s
        ? <span key={i} className="ruler-pill" style={{ background: s.fill, color: s.digit }}>{s.fn}</span>
        : <span key={i} className="ruler-tick" />))}
    </div>
  );
}
