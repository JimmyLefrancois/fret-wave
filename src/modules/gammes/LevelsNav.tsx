/**
 * Chemin d'une forme en quatre niveaux (Découvrir, Trous, Rappel, Improviser).
 *
 * Commun aux pages Jouer et Entraînement : la tuile courante est cerclée et non cliquable, les autres
 * sont à un toucher. Le composant ne navigue pas lui-même : chaque page dit ce que veut dire « aller
 * au niveau N » (changer de route, ou changer de niveau sur place).
 */
export type PathLevel = 1 | 2 | 3 | 4;

const LEVELS: { n: PathLevel; title: string; hint: string }[] = [
  { n: 1, title: 'Découvrir', hint: 'avec le son' },
  { n: 2, title: 'Trous', hint: 'compléter les notes masquées' },
  { n: 3, title: 'Rappel', hint: 'tout de mémoire, tablature cachée' },
  { n: 4, title: 'Improviser', hint: 'sur un accompagnement' },
];

export function LevelsNav(props: { current: PathLevel; onSelect: (level: PathLevel) => void }) {
  const { current, onSelect } = props;
  return (
    <nav className="levels" aria-label="Niveaux de travail">
      {LEVELS.map((l) => {
        const body = (
          <>
            <span className="level-n">N{l.n}</span>
            <span className="level-t">{l.title}</span>
            <span className="level-s">{l.hint}{l.n === current && <span className="level-here"> · tu es ici</span>}</span>
          </>
        );
        return l.n === current ? (
          <div key={l.n} className="level here" aria-current="step">{body}</div>
        ) : (
          <button key={l.n} type="button" className="level" onClick={() => onSelect(l.n)}>{body}</button>
        );
      })}
    </nav>
  );
}
