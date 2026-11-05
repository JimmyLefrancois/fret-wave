import type { NoteName, NoteNotation, ScaleDef } from '../../core/theory';
import { degreeNotes } from './resolve';

/** Bandeau des degrés (1 ♭3 4 5 ♭7) en pastilles colorées, chaque pastille suivie de sa note. */
export function DegreePills({ def, tonic, notation }: { def: ScaleDef; tonic: NoteName; notation: NoteNotation }) {
  const items = degreeNotes(def, tonic, notation);
  return (
    <div
      className="play-degrees"
      role="img"
      aria-label={`Degrés et notes : ${items.map(({ item, note }) => `${item.name} ${note}`).join(', ')}`}
    >
      {items.map(({ item, note }) => (
        <span key={item.fn} className="degree-cell">
          <span className="legend-pill" style={{ background: item.fill, color: item.digit }}>{item.fn}</span>
          <span className="degree-note">{note}</span>
        </span>
      ))}
    </div>
  );
}
