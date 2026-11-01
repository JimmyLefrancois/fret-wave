/**
 * Les trois outils d'une forme : Découvrir, Séquences, Improviser. L'onglet courant est cerclé et non
 * cliquable, les autres sont à un toucher.
 */
import { navigate, type RouteName } from '../../app/router';

export type ScaleTab = 'scale' | 'sequences' | 'impro';

export const SCALE_TABS: { route: ScaleTab; title: string; hint: string }[] = [
  { route: 'scale', title: 'Découvrir', hint: 'la forme, le son, le manche' },
  { route: 'sequences', title: 'Séquences', hint: 'au métronome, tempo évolutif' },
  { route: 'impro', title: 'Improviser', hint: 'sur un accompagnement' },
];

export function ScaleTabs(props: { current: ScaleTab; onNavigate?: (route: RouteName) => void }) {
  const { current, onNavigate = navigate } = props;
  return (
    <nav className="levels" aria-label="Outils de la gamme">
      {SCALE_TABS.map((t) => {
        const body = (
          <>
            <span className="level-t">{t.title}</span>
            <span className="level-s">{t.hint}</span>
          </>
        );
        return t.route === current ? (
          <div key={t.route} className="level here" aria-current="page">{body}</div>
        ) : (
          <button key={t.route} type="button" className="level" title={t.hint} onClick={() => onNavigate(t.route)}>{body}</button>
        );
      })}
    </nav>
  );
}
