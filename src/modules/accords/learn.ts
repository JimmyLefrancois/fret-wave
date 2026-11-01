/** Suggestions de découverte : les coches orientent le choix, elles ne prouvent aucune maîtrise. */
import type { ChordMarks } from '../../core/progress/chordMarks';
import type { Voicing } from '../../core/theory/voicings';

export const BASIC_CHORDS = ['Em', 'Am', 'E', 'A', 'D', 'Dm', 'C', 'G'] as const;

type Rule = { chord: string; needs: string[]; bases: number; reason: string };
// Petits pas explicites. Les couleurs plus tardives demandent six bases, pas les huit :
// une base manquante ne bloque jamais toute la découverte. Les barrés ont leur marchepied.
const RULES: readonly Rule[] = [
  { chord: 'Em7', needs: ['Em'], bases: 0, reason: 'Une première couleur à explorer à partir de Mi mineur, avec un seul doigt posé.' },
  { chord: 'Asus2', needs: ['Em'], bases: 0, reason: 'La même paire de doigts que Mi mineur, décalée d’une corde.' },
  { chord: 'Am7', needs: ['Am'], bases: 0, reason: 'Une variante de La mineur à deux doigts.' },
  { chord: 'E7', needs: ['E'], bases: 0, reason: 'Tu connais Mi majeur : découvre sa septième en levant un doigt.' },
  { chord: 'A7', needs: ['A'], bases: 0, reason: 'Une septième ouverte pour compléter La majeur.' },
  { chord: 'Dsus2', needs: ['D'], bases: 0, reason: 'Tu connais Ré : libère la corde aiguë pour découvrir cette couleur.' },
  { chord: 'Dsus4', needs: ['D'], bases: 0, reason: 'Une autre couleur de Ré, en changeant la note sur la corde aiguë.' },
  { chord: 'Cmaj7', needs: ['C'], bases: 0, reason: 'Tu connais Do : cette forme s’obtient en levant l’index.' },
  { chord: 'D7', needs: ['D'], bases: 6, reason: 'Tes accords de base se diversifient : ajoute la septième de Ré.' },
  { chord: 'Dmaj7', needs: ['D'], bases: 6, reason: 'Une nouvelle disposition des doigts pour enrichir Ré.' },
  { chord: 'G7', needs: ['G'], bases: 6, reason: 'Tu connais Sol : explore sa septième ouverte.' },
  { chord: 'Gmaj7', needs: ['G'], bases: 6, reason: 'Une nouvelle couleur à partir de Sol.' },
  { chord: 'Cadd9', needs: ['C'], bases: 6, reason: 'Tu connais Do et au moins six accords de base : ajoute maintenant une neuvième.' },
  { chord: 'C7', needs: ['C'], bases: 6, reason: 'Un quatrième doigt enrichit la forme de Do que tu connais.' },
  { chord: 'B7', needs: ['E', 'Am'], bases: 6, reason: 'Tes bases sont installées : essaie cette forme ouverte à quatre doigts.' },
  { chord: 'Asus4', needs: ['A'], bases: 6, reason: 'Une nouvelle couleur pour compléter La majeur.' },
  { chord: 'Esus4', needs: ['E'], bases: 6, reason: 'Élargis les couleurs de Mi avec cette forme ouverte.' },
  { chord: 'G/B', needs: ['G', 'C'], bases: 6, reason: 'À essayer entre Sol et Do : Sol → Sol/Si → Do fait avancer la basse.' },
  { chord: 'D/F#', needs: ['D', 'G'], bases: 6, reason: 'À essayer entre Ré et Sol : Ré → Ré/Fa♯ → Sol fait monter la basse.' },
  { chord: 'C/G', needs: ['C', 'G'], bases: 6, reason: 'À essayer dans Do → Do/Sol → Sol : la basse prépare Sol.' },
  { chord: 'Fmaj7', needs: ['C'], bases: 6, reason: 'Une première forme de Fa sans barré pour préparer la suite.' },
  { chord: 'F', needs: ['Fmaj7'], bases: 6, reason: 'Après Fa majeur 7, essaie Fa sur quatre cordes avec un mini-barré.' },
  { chord: 'Bm7', needs: ['Am'], bases: 6, reason: 'Une forme de Si mineur 7 sans barré complet, avant Si mineur.' },
  { chord: 'Bm', needs: ['Bm7'], bases: 6, reason: 'Tu connais Si mineur 7 : aborde maintenant le barré de Si mineur.' },
  { chord: 'E5', needs: ['Em'], bases: 0, reason: 'Garde les trois cordes graves de Mi mineur pour découvrir un power chord.' },
  { chord: 'A5', needs: ['A'], bases: 0, reason: 'Un power chord construit sur les trois cordes graves jouées de La.' },
  { chord: 'D5', needs: ['D'], bases: 0, reason: 'Un power chord à partir de Ré, sans jouer la corde aiguë.' },
  { chord: 'G5', needs: ['E5'], bases: 6, reason: 'Déplace la forme du power chord pour jouer Sol plus haut sur le manche.' },
  { chord: 'C5', needs: ['A5'], bases: 6, reason: 'Déplace la forme du power chord pour jouer Do plus haut sur le manche.' },
];

export interface ChordSuggestion { voicing: Voicing; reason: string }

/** Un symbole connu compte une seule fois, même avec plusieurs doigtés cochés. */
export function chordSuggestions(pool: readonly Voicing[], marks: ChordMarks): ChordSuggestion[] {
  const known = new Set(pool.filter(v => marks.known.includes(v.id)).map(v => v.chord));
  const baseCount = BASIC_CHORDS.filter(c => known.has(c)).length;
  const forms = new Map<string, Voicing>();
  for (const v of pool) {
    if (v.tuningId !== 'standard' || v.family === 'triad3' || known.has(v.chord) || marks.noReview.includes(v.id)) continue;
    const prev = forms.get(v.chord);
    if (!prev || v.difficulty < prev.difficulty) forms.set(v.chord, v);
  }
  const knownForms = pool.filter(v => marks.known.includes(v.id));
  const sharedNotes = (v: Voicing) => Math.max(0, ...knownForms.map(k =>
    v.frets.filter((f, i) => f !== null && f > 0 && k.frets[i] === f).length));
  const basics = BASIC_CHORDS.flatMap(chord => {
    const voicing = forms.get(chord);
    if (!voicing) return [];
    const reason = chord === 'Em' && known.size === 0
      ? 'Deux doigts et six cordes à jouer : un premier accord pour commencer.'
      : chord === 'E' && known.has('Em')
        ? 'Tu connais Mi mineur : Mi majeur reprend cette position avec un doigt supplémentaire.'
        : 'Complète tes huit accords de base avec cette forme ouverte.';
    return [{ voicing, reason }];
  }).sort((a, b) => a.voicing.difficulty - b.voicing.difficulty || sharedNotes(b.voicing) - sharedNotes(a.voicing));
  const colors = RULES.flatMap(rule => {
    const voicing = forms.get(rule.chord);
    // Les raisons portent sur la forme la plus simple (Em7 à un doigt, Fa mini-barré).
    const easiest = pool.filter(v => v.chord === rule.chord && v.family !== 'triad3')
      .reduce<Voicing | undefined>((best, v) => !best || v.difficulty < best.difficulty ? v : best, undefined);
    return voicing && voicing.id === easiest?.id && baseCount >= rule.bases && rule.needs.every(c => known.has(c))
      ? [{ voicing, reason: rule.reason }] : [];
  });
  return [...basics, ...colors];
}

/** Rotation locale à la popup ; aucun refus n'est enregistré dans la progression. */
export function nextChordSuggestion(suggestions: readonly ChordSuggestion[], seen: readonly string[]): ChordSuggestion | null {
  return suggestions.find(s => !seen.includes(s.voicing.id))
    ?? suggestions.find(s => s.voicing.id !== seen.at(-1))
    ?? suggestions[0] ?? null;
}
