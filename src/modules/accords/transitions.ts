/**
 * Étape **Enchaîner** (phase 4b) — les transitions entre accords, mesurées.
 *
 * Le vrai apprentissage commence au **changement** d'accord : un débutant sait souvent former Em, et
 * se bloque entre Em et Am. On mesure donc autre chose qu'une forme : le temps que la main met pour
 * passer d'un accord à l'autre.
 *
 * Comment, honnêtement, en monophonie : on ne mesure pas contre le métronome (il faudrait l'onset de la
 * phase 5) mais **entre deux basses entendues**. L'élève alterne A puis B ; chaque basse juste horodatée
 * par le même détecteur donne un intervalle. Deux avantages : la latence d'entrée **s'annule** dans la
 * différence (aucune compensation à supposer), et la mesure ne dépend d'aucune horloge de lecture.
 * Ce que ça ne prouve pas : que les six cordes sonnent — seule la basse est écoutée (phase 5). L'écran
 * le dit, et c'est pour cela que la transition ne rend jamais un accord « appris » à elle seule.
 *
 * La basse n'est pas choisie au hasard : c'est la note qui identifie le mieux la forme (la plus grave
 * de l'accord, celle qu'on entend en premier dans un arpège, celle qui porte le nom).
 */
import { CURRICULUM, FIRST_CHORDS, allChordIds, palierOfVoicing, type Palier } from './curriculum';
import { progressionToScore } from '../../core/tab/generators';
import type { TabScore } from '../../core/tab/model';
import type { Voicing } from '../../core/theory/voicings';
import { TUNINGS } from '../../core/theory/tunings';
import { fretToMidi } from '../../core/theory/fretboard';
import { VOICINGS } from '../../data/voicings';
import { arpeggioCheck } from './lesson';
import { FINGER_NAME } from '../../core/theory/chordFingers';
import { medianOf } from '../../core/progress/mastery';

/** Un changement d'accord « propre » : deux secondes. Au-delà, la musique s'arrête d'attendre. */
export const CHANGE_CLEAN_MS = 2000;
/** Un changement « fluide » : sous 1,5 s, la pulsation passe sans trou (MUSIC_DESIGN §4.7). */
export const CHANGE_FLUENT_MS = 1500;
/** Deux détections plus rapprochées sont la même attaque : la corde qui sonne est vue plusieurs fois. */
export const CHANGE_MIN_GAP_MS = 250;

export function transitionNodeId(a: string, b: string): string {
  return `acc:transition:${a}>${b}`;
}

export interface TransitionPair {
  a: string;
  b: string;
  palierId: string;
  /** Positions identiques (corde + case) entre les deux formes : ce qui ne bouge pas. */
  shared: number;
}

/** Cordes/cases tenues par les deux formes : c'est la mémoire du geste, et le meilleur prédicteur. */
export function sharedPositions(a: Voicing, b: Voicing): number {
  let n = 0;
  for (let s = 0; s < Math.max(a.frets.length, b.frets.length); s++) {
    const fa = a.frets[s];
    const fb = b.frets[s];
    if (fa === null || fa === undefined || fa === 0) continue;
    if (fa === fb) n++;
  }
  return n;
}

/**
 * Doigts pivots d'un changement : même doigt, même corde, même case dans les deux formes. Ils restent
 * posés ; les autres se lèvent et se reposent. Plus exigeant que `sharedPositions` : Em → Am partage la
 * case 2 de la corde de Ré, mais avec l'annulaire puis le majeur (doigtés de la base), donc rien ne
 * reste posé.
 */
export function pivotFingers(a: Voicing, b: Voicing): number[] {
  const out: number[] = [];
  for (let s = 0; s < Math.min(a.frets.length, b.frets.length); s++) {
    const fa = a.frets[s];
    const fing = a.fingers?.[s];
    if (fa === null || fa === undefined || fa === 0 || typeof fing !== 'number') continue;
    if (b.frets[s] === fa && b.fingers?.[s] === fing && !out.includes(fing)) out.push(fing);
  }
  return out.sort((x, y) => x - y);
}

function fingerList(fingers: readonly number[]): string {
  // « l'index », « l'annulaire », « l'auriculaire », mais « le majeur »
  const names = fingers.map((f) => {
    const n = FINGER_NAME[String(f)] ?? `doigt ${f}`;
    return /^[aeiouéè]/.test(n) ? `l’${n}` : `le ${n}`;
  });
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}

/**
 * Le conseil du changement, en une phrase : quels doigts restent posés et lesquels bougent. Le doigt
 * pivot est ce qui rend un changement court (Do → La mineur : l'index et le majeur ne bougent pas).
 */
export function pivotSentence(a: Voicing, b: Voicing): string {
  const pivots = pivotFingers(a, b);
  const used = (v: Voicing) => [...new Set((v.fingers ?? []).flatMap((f) => (typeof f === 'number' ? [f] : [])))];
  const inA = used(a);
  const others = used(b).filter((f) => !pivots.includes(f)).sort((x, y) => x - y);
  // un doigt déjà posé dans A qui change de place « bouge » ; un doigt absent de A « se pose »
  const moved = others.filter((f) => inA.includes(f));
  const added = others.filter((f) => !inA.includes(f));
  if (pivots.length === 0) {
    return 'Aucun doigt ne reste posé : forme l’accord en l’air, puis pose tous les doigts ensemble.';
  }
  const stay = fingerList(pivots);
  const stays = pivots.length > 1 ? 'restent posés' : 'reste posé';
  const cap = stay.charAt(0).toUpperCase() + stay.slice(1);
  if (others.length === 0) return `${cap} ${stays} : il suffit de lever les autres doigts.`;
  const parts: string[] = [];
  if (moved.length) parts.push(moved.length === 1 && !added.length ? `seul ${fingerList(moved)} bouge` : `${fingerList(moved)} ${moved.length > 1 ? 'bougent' : 'bouge'}`);
  if (added.length) parts.push(`${parts.length ? '' : 'il suffit de '}${parts.length ? `${fingerList(added)} ${added.length > 1 ? 'se posent' : 'se pose'}` : `poser ${fingerList(added)}`}`);
  return `${cap} ${stays} : ${parts.join(', et ')}.`;
}

/**
 * Toutes les paires du curriculum, **une seule fois** (Em→Am et Am→Em ne sont qu'un exercice : on
 * alterne de toute façon). L'ordre du parcours est conservé : c'est celui de l'utilité musicale.
 */
export function allTransitionPairs(): TransitionPair[] {
  const seen = new Set<string>();
  const out: TransitionPair[] = [];
  for (const palier of CURRICULUM) {
    for (const [a, b] of palier.transitions) {
      const key = [a, b].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const va = VOICINGS.find((v) => v.id === a);
      const vb = VOICINGS.find((v) => v.id === b);
      if (!va || !vb) continue;
      out.push({ a, b, palierId: palier.id, shared: sharedPositions(va, vb) });
    }
  }
  return out;
}

export type TransitionTier = 'ready' | 'learning' | 'new';

export interface TransitionCandidate {
  pair: TransitionPair;
  tier: TransitionTier;
  /** Pourquoi cet enchaînement est proposé maintenant, à afficher tel quel. */
  reason: string;
}

/**
 * Enchaînements proposés : ceux dont **les deux accords sont appris** d'abord, puis ceux où l'un des
 * deux est déjà travaillé, puis le reste du parcours, **dans l'ordre du parcours** (c'est l'ordre
 * d'utilité musicale : Em→Am avant D/F♯→D). Rien n'est jamais verrouillé : un élève qui n'a qu'un
 * accord peut déjà s'entraîner au changement (c'est exactement le début difficile).
 */
export function transitionCandidates(learned: ReadonlySet<string>, started: ReadonlySet<string> = new Set()): TransitionCandidate[] {
  const pairs = allTransitionPairs();
  const out: (TransitionCandidate & { order: number })[] = [];
  pairs.forEach((pair, order) => {
    out.push({ ...describePair(pair, learned, started), order });
  });
  const rank: Record<TransitionTier, number> = { ready: 0, learning: 1, new: 2 };
  return out.sort((x, y) => rank[x.tier] - rank[y.tier] || x.order - y.order);
}

/** Niveau et raison d'un enchaînement : la même règle pour une paire du parcours ou choisie par l'élève. */
function describePair(pair: TransitionPair, learned: ReadonlySet<string>, started: ReadonlySet<string>): TransitionCandidate {
  const knownA = learned.has(pair.a);
  const knownB = learned.has(pair.b);
  const tier: TransitionTier = knownA && knownB ? 'ready' : knownA || knownB || started.has(pair.a) || started.has(pair.b) ? 'learning' : 'new';
  const reason = tier === 'ready'
    ? pair.shared > 0
      ? `${pair.shared} doigt${pair.shared > 1 ? 's' : ''} en commun : le changement est court`
      : 'aucun doigt en commun : c’est le changement coûteux, à travailler tôt'
    : tier === 'learning'
      ? 'un des deux accords est déjà travaillé — l’enchaînement révèle ce qui manque'
      : 'aucun des deux n’est encore vérifié ; le faire maintenant sert de découverte';
  return { pair, tier, reason };
}

// ---------------------------------------------------------------------------
// Accord cible choisi par l'élève (D107)
// ---------------------------------------------------------------------------

/**
 * L'enchaînement depuis l'accord de la leçon vers n'importe quel accord du parcours, décrit comme une
 * paire du curriculum (doigts communs, niveau, raison). `null` si l'un des deux voicings est inconnu
 * ou si c'est le même accord.
 */
export function transitionTo(
  fromId: string,
  toId: string,
  learned: ReadonlySet<string>,
  started: ReadonlySet<string> = new Set(),
): TransitionCandidate | null {
  if (fromId === toId) return null;
  const a = VOICINGS.find((v) => v.id === fromId);
  const b = VOICINGS.find((v) => v.id === toId);
  if (!a || !b) return null;
  const palierId = palierOfVoicing(toId)?.id ?? palierOfVoicing(fromId)?.id ?? '';
  return describePair({ a: fromId, b: toId, palierId, shared: sharedPositions(a, b) }, learned, started);
}

/** Les partenaires d'un accord dans les transitions du parcours, dans l'ordre d'utilité. */
export function curriculumPartners(fromId: string): string[] {
  const out: string[] = [];
  for (const p of allTransitionPairs()) {
    const other = p.a === fromId ? p.b : p.b === fromId ? p.a : null;
    if (other && !out.includes(other)) out.push(other);
  }
  return out;
}

export interface TargetOptions {
  /** Proposés en premier, en pastilles. */
  priority: string[];
  /** Tous les autres accords du parcours, dans l'ordre du parcours (liste déroulante). */
  others: string[];
  /** Vrai tant que « Mes premiers accords » sont proposés en tête. */
  firstChordsFirst: boolean;
}

/**
 * Accords cibles proposés depuis l'accord de la leçon. Tant que les huit « premiers accords » ne sont
 * pas **tous appris et maîtrisés**, ce sont eux qu'on propose d'abord (ce sont les changements des
 * chansons) ; ensuite, la priorité revient aux transitions du parcours pour cet accord. Rien n'est
 * exclu : tout le reste du parcours reste choisissable.
 */
export function targetOptions(
  fromId: string,
  learned: ReadonlySet<string>,
  mastered: ReadonlySet<string>,
): TargetOptions {
  const firstIds = FIRST_CHORDS.map((c) => c.voicingId);
  const firstChordsFirst = !firstIds.every((id) => learned.has(id) && mastered.has(id));
  const priority = (firstChordsFirst ? firstIds : curriculumPartners(fromId)).filter((id) => id !== fromId);
  const others = allChordIds().filter((id) => id !== fromId && !priority.includes(id));
  return { priority, others, firstChordsFirst };
}

/** Forme d'un accord en chiffres (corde grave → aiguë, `x` = étouffée) : lève l'ambiguïté entre deux F. */
export function shapeOf(v: Voicing): string {
  return v.frets.map((f) => (f === null ? 'x' : String(f))).join('');
}

/** Position de la basse d'un accord : la note qui identifie la forme. */
export interface BassNote {
  string: number;
  fret: number;
  midi: number;
}

export function bassOf(v: Voicing): BassNote | null {
  const checks = arpeggioCheck(v);
  const first = checks[0];
  return first ? { string: first.string, fret: first.fret, midi: first.midi } : null;
}

/** Note repère d'un accord dans une paire : ce qu'on écoute pour savoir que la main est arrivée. */
export interface Marker extends BassNote {
  /** Vrai si c'est la basse (le cas normal) ; faux si les deux accords partagent la même basse. */
  bass: boolean;
}

/**
 * Choisit la note repère de chaque accord de la paire.
 *
 * Le cas normal : la **basse** (elle change, et elle porte l'accord). Mais certains enchaînements du
 * parcours ne bougent pas la basse du tout — Em → Em7, F 4 cordes → F barré, C → C7 : la corde grave
 * reste la même note. Écouter la basse y mesurerait une note tenue, pas un changement. On prend alors la
 * **première corde dont la case change** entre les deux formes : c'est là que la main travaille, et
 * c'est la note qui distingue les deux accords à l'oreille.
 */
export function markersOf(a: Voicing, b: Voicing): { a: Marker; b: Marker } | null {
  const ba = bassOf(a);
  const bb = bassOf(b);
  if (!ba || !bb) return null;
  if (ba.midi !== bb.midi) {
    return { a: { ...ba, bass: true }, b: { ...bb, bass: true } };
  }
  const n = Math.min(a.frets.length, b.frets.length);
  for (let s = 0; s < n; s++) {
    const fa = a.frets[s];
    const fb = b.frets[s];
    if (fa === null || fa === undefined || fb === null || fb === undefined) continue;
    if (fa === fb) continue;
    return {
      a: { string: s, fret: fa, midi: fretToMidi(TUNINGS[a.tuningId]!, s, fa), bass: false },
      b: { string: s, fret: fb, midi: fretToMidi(TUNINGS[b.tuningId]!, s, fb), bass: false },
    };
  }
  return null;
}

/** Le même accord, en deux mesures (une par accord) : la tablature de l'exercice. */
export function pairScore(a: Voicing, b: Voicing, opts: { tempo?: number; pattern?: 'quarters' | 'eighths' | 'universal' } = {}): TabScore {
  return progressionToScore([a, b], { tempo: opts.tempo ?? 60, pattern: opts.pattern ?? 'quarters', id: `transition:${a.id}>${b.id}` });
}

// ---------------------------------------------------------------------------
// Mesure des changements
// ---------------------------------------------------------------------------

/** Une note détectée : hauteur en MIDI flottant (cents inclus) et instant en ms. */
export interface ChangeEvent {
  midi: number;
  at: number;
}

export interface ChangeRecord {
  /** Instant du changement (ms, même horloge que les événements). */
  at: number;
  /** Temps depuis l'accord précédent (ms). */
  ms: number;
  /** Accord atteint (`b` pour un changement A→B). */
  to: 'a' | 'b';
}

export interface ChangeDetection {
  changes: ChangeRecord[];
  /** Accord attendu au prochain son (l'alternance en cours). */
  next: 'a' | 'b';
  /** La première basse a-t-elle été entendue ? (départ du chrono) */
  anchored: boolean;
}

/**
 * Détecte les changements dans un flux de notes. Fonction **pure** : on lui donne les notes déjà
 * filtrées (note stable, nouvelle attaque) et les deux basses ; elle rend les intervalles. L'alternance
 * commence sur `a` : la première basse juste ancre le chrono, les suivantes sont des changements.
 */
export function detectChanges(
  events: readonly ChangeEvent[],
  opts: { bassA: number; bassB: number; centsTolerance: number; minGapMs?: number },
): ChangeDetection {
  const tol = opts.centsTolerance;
  const minGap = opts.minGapMs ?? CHANGE_MIN_GAP_MS;
  let expected: 'a' | 'b' = 'a';
  let anchorAt: number | null = null;
  const changes: ChangeRecord[] = [];
  for (const e of [...events].sort((x, y) => x.at - y.at)) {
    const target = expected === 'a' ? opts.bassA : opts.bassB;
    // une hauteur juste pour la basse attendue ; les autres notes de l'accord sont ignorées (on mesure
    // l'arrivée de la main, pas la propreté — c'est l'affaire de « Vérifier »)
    if (Math.abs(e.midi - target) * 100 > tol) continue;
    if (anchorAt !== null && e.at - anchorAt < minGap) continue;
    if (anchorAt === null) {
      anchorAt = e.at;
      expected = expected === 'a' ? 'b' : 'a';
      continue;
    }
    changes.push({ at: e.at, ms: Math.round(e.at - anchorAt), to: expected });
    anchorAt = e.at;
    expected = expected === 'a' ? 'b' : 'a';
  }
  return { changes, next: expected, anchored: anchorAt !== null };
}

export interface ChangeStats {
  /** Changements mesurés. */
  changes: number;
  /** Changements dans le seuil « propre ». */
  clean: number;
  /** Changements « fluides » (le tempo du musicien, pas de l'exercice). */
  fluent: number;
  medianMs: number | null;
  bestMs: number | null;
  worstMs: number | null;
  /** Part de changements propres (0-1) : c'est le score de la tentative. */
  score: number;
  /** Changements par minute, calculés sur la durée réelle de l'exercice. */
  perMinute: number;
}

export function changeStats(changes: readonly ChangeRecord[], opts: { durationMs: number; cleanMs?: number; fluentMs?: number }): ChangeStats {
  const cleanMs = opts.cleanMs ?? CHANGE_CLEAN_MS;
  const fluentMs = opts.fluentMs ?? CHANGE_FLUENT_MS;
  if (changes.length === 0) {
    return { changes: 0, clean: 0, fluent: 0, medianMs: null, bestMs: null, worstMs: null, score: 0, perMinute: 0 };
  }
  const times = changes.map((c) => c.ms);
  const clean = times.filter((t) => t <= cleanMs).length;
  const fluent = times.filter((t) => t <= fluentMs).length;
  const minutes = Math.max(0.25, opts.durationMs / 60_000);
  return {
    changes: changes.length,
    clean,
    fluent,
    medianMs: medianOf(times),
    bestMs: Math.min(...times),
    worstMs: Math.max(...times),
    score: clean / changes.length,
    perMinute: Math.round((changes.length / minutes) * 10) / 10,
  };
}

/** Seuils pédagogiques de lecture du résultat (MUSIC_DESIGN §4.7 : 20 = correct, 30-40 = fluide). */
export function changeGrade(perMinute: number): { label: string; advice: string } {
  if (perMinute >= 30) return { label: 'fluide', advice: 'Les changements passent dans la pulsation : monte le tempo ou ajoute un troisième accord.' };
  if (perMinute >= 20) return { label: 'correct', advice: 'C’est le seuil du jeu en place. Répète demain : c’est la régularité qui installe le geste.' };
  if (perMinute >= 10) return { label: 'en construction', advice: 'Le geste se cherche encore. Reste lent et propre : la vitesse vient de la répétition, pas de la force.' };
  return { label: 'lent', advice: 'Travaille l’enchaînement une minute par jour, sans regarder les doigts. La lenteur initiale est normale.' };
}

/** Palier d'une paire (affichage). */
export function palierOfPair(pair: TransitionPair): Palier | null {
  return CURRICULUM.find((p) => p.id === pair.palierId) ?? null;
}

/** Accordage utilisé par une paire (standard pour tous les accords ouverts). */
export function tuningOfPair(a: Voicing) {
  return TUNINGS[a.tuningId]!;
}
