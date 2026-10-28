/**
 * Improvisation (phase 7) — **où afficher la note qu'on vient de jouer**.
 *
 * Une hauteur existe à plusieurs endroits du manche (le Mi aigu, c'est la corde 1 case 0, la corde 2
 * case 5, la corde 3 case 9…). Sur une tablature de **position**, la bonne réponse n'est pas « la plus
 * grave » ni « la première trouvée » : c'est celle qui **appartient à la position affichée**, et s'il y
 * en a plusieurs, celle qui est **la plus proche de la note précédente** — une ligne mélodique se joue
 * dans un voisinage, pas en sautant d'un bout du manche à l'autre.
 *
 * D'où deux règles, dans cet ordre :
 *  1. ne retenir que les emplacements présents dans la partition (donc dans la position) ;
 *  2. départager par proximité avec la note précédente (même corde d'abord, puis écart de case).
 */
import type { TabScore } from '../tab/model';

export interface PlacedNote {
  string: number;
  fret: number;
  midi: number;
}

/** Toutes les notes de la partition, avec leur corde et leur case. */
export function scoreNotes(score: TabScore): PlacedNote[] {
  const out: PlacedNote[] = [];
  for (const measure of score.measures) {
    for (const event of measure.events) {
      for (const note of event.notes) {
        if (note.muted || note.hidden) continue;
        out.push({ string: note.string, fret: note.fret, midi: note.midi });
      }
    }
  }
  return out;
}

/**
 * Place une hauteur jouée sur la tablature de la position.
 *
 * @param notes les notes de la position (`scoreNotes`)
 * @param midi hauteur entendue
 * @param previous dernier emplacement affiché, pour la continuité de la ligne
 * @returns l'emplacement retenu, ou `null` si la note n'existe pas dans la position (hors gamme)
 */
export function locateInScore(
  notes: readonly PlacedNote[],
  midi: number,
  previous: PlacedNote | null = null,
): PlacedNote | null {
  const exact = notes.filter((n) => n.midi === midi);
  // Une même hauteur peut être écrite à l'octave près dans la position : on accepte la classe de hauteur
  // en dernier recours, sinon une note juste une octave plus haut ne s'allumerait nulle part.
  let candidates = exact.length > 0
    ? exact
    : notes.filter((n) => ((n.midi % 12) + 12) % 12 === ((midi % 12) + 12) % 12);
  if (candidates.length === 0) return null;
  // À défaut d'octave exacte, on garde **l'octave la plus proche** : une note jouée une octave au-dessus
  // de ce qui est écrit doit s'allumer une octave au-dessus, pas sur la corde à vide du bas du manche.
  if (exact.length === 0 && candidates.length > 1) {
    const best = Math.min(...candidates.map((n) => Math.abs(n.midi - midi)));
    candidates = candidates.filter((n) => Math.abs(n.midi - midi) === best);
  }
  if (candidates.length === 1 || !previous) return candidates[0]!;
  // proximité : même corde d'abord, puis écart de case, puis corde la plus proche
  let best = candidates[0]!;
  let bestCost = Infinity;
  for (const c of candidates) {
    const cost = (c.string === previous.string ? 0 : Math.abs(c.string - previous.string) * 2)
      + Math.abs(c.fret - previous.fret);
    if (cost < bestCost) {
      best = c;
      bestCost = cost;
    }
  }
  return best;
}
