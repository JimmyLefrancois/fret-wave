/**
 * Légende sous la tablature : ce que veut dire l'anneau qui clignote.
 *
 * Le halo pulsé des pastilles marque les **notes caractéristiques** de la gamme (♭6 pour la mineure
 * naturelle, ♭5 pour le blues mineur, ♯4 pour le lydien…). C'est le repère pédagogique central de
 * l'écran — et il n'était expliqué qu'en bas de la page Découvrir, jamais sur l'écran d'exercice :
 * la question « c'est quoi les cases qui brillent ? » est un défaut d'écran, pas une question de cours.
 *
 * La pastille de la légende reprend la couleur de fonction de la note (même code que la tablature).
 */
import { useMemo } from 'react';
import type { ScaleDef } from '../../core/theory';
import { legendFor } from './resolve';

export function TabLegend(props: { def: ScaleDef }) {
  const { def } = props;
  const chars = useMemo(() => legendFor(def).filter((i) => i.characteristic), [def]);

  if (chars.length === 0) {
    return (
      <p className="tab-legend t-small t-dim">
        Aucune pastille ne clignote sur cette gamme : elle n’a pas de note caractéristique mise en avant.
      </p>
    );
  }

  const one = chars.length === 1;
  return (
    <p className="tab-legend t-small">
      <span className="tab-legend-key" aria-hidden="true">◌</span>
      {one ? ' Anneau clignotant = la note caractéristique : ' : ' Anneaux clignotants = les notes caractéristiques : '}
      {chars.map((c, i) => (
        <span key={c.fn}>
          {i > 0 ? ' et ' : ''}
          <span className="legend-pill" style={{ background: c.fill, color: c.digit }}>{c.fn}</span>
        </span>
      ))}
      <span className="t-dim">
        {one
          ? ' — c’est elle qui donne sa couleur à la gamme et la distingue de sa voisine.'
          : ' — ce sont elles qui donnent sa couleur à la gamme.'}
      </span>
    </p>
  );
}
