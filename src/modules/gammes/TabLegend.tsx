/**
 * Légende de la tablature : ce que veut dire l'anneau qui clignote.
 *
 * Le halo pulsé des pastilles marque les **notes caractéristiques** de la gamme (♭6 pour la mineure
 * naturelle, ♭5 pour le blues mineur, ♯4 pour le lydien…). C'est le repère pédagogique central de
 * l'écran — la question « c'est quoi les cases qui brillent ? » est un défaut d'écran, pas de cours.
 *
 * Mise en page (2e passe) : une phrase de prose posée à même le décor ne se lisait pas (et, au bureau,
 * elle tombait dans une seule colonne de la grille de page). La légende est maintenant une **bande**
 * sur fond de panneau, avec à gauche la **pastille réelle** — même couleur de fonction que la portée —
 * entourée d'un anneau qui pulse comme dans la tablature. On montre le repère au lieu de le décrire.
 */
import { useMemo } from 'react';
import type { ScaleDef } from '../../core/theory';
import { legendFor } from './resolve';

export function TabLegend(props: { def: ScaleDef; readonly?: boolean }) {
  const { def, readonly = false } = props;
  const chars = useMemo(() => legendFor(def).filter((i) => i.characteristic), [def]);

  if (chars.length === 0) {
    return (
      <div className="tab-legend">
        <span className="tab-legend-body">
          <span className="tab-legend-title">Aucune note caractéristique</span>
          <span className="tab-legend-note">Rien ne clignote sur cette gamme : toutes ses notes ont le même poids.</span>
        </span>
      </div>
    );
  }

  const plural = chars.length > 1;
  return (
    <div className="tab-legend">
      <span className="tab-legend-keys" aria-hidden="true">
        {chars.map((c) => (
          <span
            key={c.fn}
            className={`tab-legend-keywrap ${readonly ? 'still' : ''}`}
            style={{ ['--ring' as never]: c.fill }}
          >
            <span className="tab-legend-key" style={{ background: c.fill, color: c.digit }}>{c.fn}</span>
          </span>
        ))}
      </span>
      <span className="tab-legend-body">
        <span className="tab-legend-title">{plural ? 'Notes caractéristiques' : 'Note caractéristique'}</span>
        <span className="tab-legend-note">
          {plural ? 'Les anneaux clignotent' : 'L’anneau clignote'} dans la portée :{' '}
          {plural ? 'ce sont elles qui donnent' : 'c’est elle qui donne'} sa couleur à la gamme
          {plural ? '' : ' et la distingue de sa voisine'}.
        </span>
      </span>
    </div>
  );
}
