/**
 * Nom accessible d'une tablature (lecteur d'écran) : le canvas n'a pas d'autre texte.
 *
 * Un emplacement vide (niveaux 2-3) est lu « ? » : énumérer ses notes donnerait la réponse de
 * l'exercice à l'oreille, et l'exercice ne prouverait plus rien.
 */
import { fmtNote, type NoteNotation } from '../theory';
import type { TabScore } from './model';

export function describeScore(score: TabScore, notation: NoteNotation): string {
  const notes = score.measures.flatMap((m) => m.events.flatMap((e) => e.notes));
  const names = notes
    .map((n) => (n.hidden ? '?' : fmtNote(n.note, notation)))
    .slice(0, 24)
    .join(' ');
  const holes = notes.filter((n) => n.hidden).length;
  const chords = [...new Set(score.measures.map((m) => m.label?.chord).filter(Boolean))].join(', ');
  return `Tablature ${score.stringCount} cordes, ${score.measures.length} mesures${chords ? `, accords ${chords}` : ''}`
    + `${holes ? `, ${holes} emplacement${holes > 1 ? 's' : ''} à compléter` : ''}. Notes : ${names}`;
}
