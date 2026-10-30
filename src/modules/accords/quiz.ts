/**
 * Mode **sans matériel** (phase 4b) — QCM de reconnaissance et reconstruction d'un accord en tablature.
 *
 * Pourquoi ce mode existe : tout le reste du module demande une guitare et un micro. Dans le métro, en
 * voyage, ou simplement les jours où l'instrument n'est pas là, il reste une compétence réelle à
 * travailler — **savoir ce qu'on lit**. Ce n'est pas la même chose que savoir le jouer, et l'app ne les
 * confond jamais : un QCM écrit un nœud `acc:savoir:*` (connaissance), jamais `acc:accord:*` (geste).
 *
 * Les distracteurs ne sont pas tirés au hasard : ce sont les **confusions réelles** d'un débutant
 * (Em/E, Am/C, D/Dsus2, G/Em, D/F♯/D…). Une question dont les quatre réponses sont « Do, Sol, Ré, Mib »
 * ne teste rien ; une question qui oppose Em et E teste l'écoute de la tierce.
 *
 * Génération **déterministe** (graine explicite, pas de `Math.random`) : un même round est rejouable, et
 * donc testable.
 */
import { interpretChord } from '../../core/theory/chords';
import type { NoteName } from '../../core/theory/types';
import type { Voicing } from '../../core/theory/voicings';
import { progressionToScore } from '../../core/tab/generators';
import type { TabScore } from '../../core/tab/model';
import { VOICINGS } from '../../data/voicings';
import { mainlineChordIds } from './curriculum';

export type QuizKind = 'name' | 'notes' | 'hole';

export const QUIZ_KINDS: readonly QuizKind[] = ['name', 'notes', 'hole'];

export const KIND_LABEL: Readonly<Record<QuizKind, string>> = {
  name: 'Reconnaître l’accord écrit',
  notes: 'Reconstituer ses notes',
  hole: 'Retrouver une case',
};

/** Confusions réelles entre accords voisins (même famille, même basse, un doigt d'écart). */
export const CONFUSIONS: readonly (readonly [string, string])[] = [
  ['Em', 'E'],
  ['Em', 'Em7'],
  ['Asus2', 'Am'],
  ['Asus2', 'A'],
  ['Am', 'A'],
  ['Am', 'C'],
  ['C', 'Cmaj7'],
  ['C', 'Cadd9'],
  ['G', 'Em'],
  ['G', 'G7'],
  ['G', 'G/B'],
  ['D', 'Dsus2'],
  ['D', 'Dsus4'],
  ['D', 'Dm'],
  ['D', 'D7'],
  ['D', 'D/F#'],
  ['E', 'E7'],
  ['A', 'A7'],
  ['A7', 'E7'],
  ['Dsus2', 'Dsus4'],
  ['Asus4', 'A'],
  ['Esus4', 'E'],
  ['C7', 'C'],
  ['Gmaj7', 'G'],
  ['Dmaj7', 'D'],
  ['B7', 'Bm7'],
  ['Bm', 'Bm7'],
  ['F', 'Fmaj7'],
  ['C/G', 'C'],
  ['C/E', 'C'],
  ['C/G', 'C/E'],
  ['E5', 'E'],
  ['A5', 'A'],
  ['D5', 'D'],
  ['G5', 'G'],
  ['C5', 'C'],
];

/** Voisins d'un symbole d'accord, dans l'ordre de la table (déterministe). */
export function confusionsOf(symbol: string): string[] {
  const out: string[] = [];
  for (const [a, b] of CONFUSIONS) {
    if (a === symbol && !out.includes(b)) out.push(b);
    if (b === symbol && !out.includes(a)) out.push(a);
  }
  return out;
}

export type QuizOption =
  | { kind: 'chord'; symbol: string }
  | { kind: 'notes'; notes: NoteName[] }
  | { kind: 'fret'; fret: number };

export interface QuizQuestion {
  id: string;
  kind: QuizKind;
  voicingId: string;
  /** Symbole de l'accord visé (le modèle ; l'UI le met en forme selon le réglage). */
  chord: string;
  prompt: string;
  options: QuizOption[];
  /** Rang de la bonne réponse dans `options`. */
  answer: number;
  /** Explication donnée après la réponse — c'est là que se joue l'apprentissage. */
  explain: string;
  /** Tablature anonyme (sans nom d'accord) pour « reconnaître » et « retrouver une case ». */
  score: TabScore | null;
  /** Corde dont la case est masquée (kind `hole`). */
  hole?: { string: number; fret: number };
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) : mêmes graines, mêmes questions. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function voicingOf(id: string): Voicing | null {
  return VOICINGS.find((v) => v.id === id) ?? null;
}

/**
 * Tablature **anonyme** : la pile est dessinée sans le nom de l'accord ni chiffrage (sinon la question
 * « quel accord est-ce ? » donnerait sa réponse au-dessus de la portée). Le X des cordes étouffées
 * reste : il fait partie de l'écriture qu'on apprend à lire.
 */
export function anonymousScore(v: Voicing, hole?: { string: number; fret: number }): TabScore {
  const score = progressionToScore([v], { tempo: 60, pattern: 'quarters' });
  const measures = score.measures.map((m) => {
    const { label: _drop, ...rest } = m;
    // le trou n'est percé que dans la **première** pile : les frappes suivantes sont dessinées en
    // « simile » (flèche seule), donc une case masquée plus loin ne se verrait pas
    // le nom porté par l'événement s'efface aussi : le layout le dessine en priorité sur l'étiquette
    // de mesure, et « Quel accord est écrit ? » affichait sa réponse au-dessus de la portée
    const events = rest.events.map(({ chord: _name, ...ev }, i) => ({
      ...ev,
      notes: ev.notes.map((n) => (hole && i === 0 && n.string === hole.string ? { ...n, hidden: true } : n)),
    }));
    return { ...rest, events };
  });
  return { ...score, id: `quiz:${v.id}`, measures, meta: { chord: '' } };
}

function distinctSymbols(symbol: string, pool: readonly string[]): string[] {
  return pool.filter((s) => s !== symbol && !hasSamePitches(s, symbol));
}

/** Deux accords qui produisent exactement les mêmes notes ne peuvent pas se départager en QCM. */
function hasSamePitches(a: string, b: string): boolean {
  try {
    const pa = interpretChord(a).pitchClasses.map((n) => ((n % 12) + 12) % 12).sort((x, y) => x - y);
    const pb = interpretChord(b).pitchClasses.map((n) => ((n % 12) + 12) % 12).sort((x, y) => x - y);
    return pa.length === pb.length && pa.every((p, i) => p === pb[i]);
  } catch {
    return false;
  }
}

/** Mélange déterministe (Fisher-Yates avec le PRNG) : renvoie les indices dans le nouvel ordre. */
function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export interface QuizRequest {
  kind: QuizKind;
  voicingId: string;
  seed: number;
}

/**
 * Construit une question. Les distracteurs viennent des confusions réelles, complétées par les autres
 * accords du parcours (même palier d'abord) — jamais d'un accord qui n'existe pas.
 */
export function makeQuestion(req: QuizRequest): QuizQuestion {
  const v = voicingOf(req.voicingId);
  if (!v) throw new Error(`QCM : voicing inconnu « ${req.voicingId} »`);
  const rand = rng(req.seed);
  const info = interpretChord(v.chord);
  const others = distinctSymbols(v.chord, mainlineChordIds().map((id) => voicingOf(id)?.chord ?? '').filter(Boolean));
  const confusions = confusionsOf(v.chord).filter((s) => {
    try {
      interpretChord(s);
      return true;
    } catch {
      return false;
    }
  });
  // les confusions d'abord (de vraies erreurs d'oreille : Em contre E, C contre Am), puis le reste du
  // parcours pour compléter. Deux confusions au maximum : trois fausses réponses toutes tirées du même
  // voisinage rendraient la question devinable par élimination.
  const confPool = [...new Set(confusions.filter((s) => others.includes(s)))];
  const fillPool = others.filter((s) => !confPool.includes(s));
  const fromConf = shuffled(confPool, rand).slice(0, 2);
  const picked = [...fromConf, ...shuffled(fillPool, rand).slice(0, Math.max(0, 3 - fromConf.length))];

  if (req.kind === 'name') {
    const options: QuizOption[] = shuffled([{ kind: 'chord', symbol: v.chord } as QuizOption, ...picked.map((s) => ({ kind: 'chord', symbol: s } as QuizOption))], rand);
    return {
      id: `${req.voicingId}:name:${req.seed}`,
      kind: 'name', voicingId: v.id, chord: v.chord,
      prompt: 'Quel accord est écrit dans cette tablature ?',
      options,
      answer: options.findIndex((o) => o.kind === 'chord' && o.symbol === v.chord),
      explain: `${v.chord} = ${info.notes.join(' · ')} (${info.degrees.join(' ')}). Les autres réponses sont les accords avec lesquels on le confond le plus souvent.`,
      score: anonymousScore(v),
    };
  }

  if (req.kind === 'notes') {
    const answerNotes = info.notes;
    const wrongSets: QuizOption[] = [];
    for (const s of [...confusions, ...others]) {
      let ni;
      try {
        ni = interpretChord(s);
      } catch {
        continue;
      }
      const key = [...ni.notes].sort().join(',');
      if ([...answerNotes].sort().join(',') === key) continue;
      if (wrongSets.some((o) => o.kind === 'notes' && [...o.notes].sort().join(',') === key)) continue;
      wrongSets.push({ kind: 'notes', notes: ni.notes });
      if (wrongSets.length >= 6) break;
    }
    const options = shuffled([{ kind: 'notes', notes: answerNotes } as QuizOption, ...shuffled(wrongSets, rand).slice(0, 3)], rand);
    return {
      id: `${req.voicingId}:notes:${req.seed}`,
      kind: 'notes', voicingId: v.id, chord: v.chord,
      prompt: `Quelles notes composent ${v.chord} ?`,
      options,
      answer: options.findIndex((o) => o.kind === 'notes' && [...o.notes].sort().join(',') === [...answerNotes].sort().join(',')),
      explain: `${v.chord} se construit sur ${info.degrees.join(' ')} : ${info.notes.join(' · ')}. La tierce (${info.degrees.find((d) => d === '3' || d === 'b3') ?? '—'}) décide majeur ou mineur.`,
      score: null,
    };
  }

  // hole : une corde de la forme est masquée, il faut retrouver sa case
  const candidates = v.frets
    .map((fret, string) => ({ fret, string }))
    .filter((c): c is { fret: number; string: number } => c.fret !== null && c.fret > 0);
  const target = candidates[Math.floor(rand() * candidates.length)] ?? candidates[0];
  if (!target) throw new Error(`QCM : ${v.id} n’a aucune case à retrouver`);
  const fretOptions = [...new Set([target.fret, target.fret + 1, target.fret - 1, target.fret + 2])]
    .filter((f) => f >= 0 && f <= 24)
    .slice(0, 4);
  const options = shuffled(fretOptions.map((f) => ({ kind: 'fret', fret: f } as QuizOption)), rand);
  const others2 = v.frets.filter((f, s) => f !== null && f > 0 && s !== target.string).map((f) => f as number);
  return {
    id: `${req.voicingId}:hole:${req.seed}`,
    kind: 'hole', voicingId: v.id, chord: v.chord,
    prompt: `Dans ${v.chord}, quelle case tient la corde n°${v.frets.length - target.string} ?`,
    options,
    answer: options.findIndex((o) => o.kind === 'fret' && o.fret === target.fret),
    explain: `La forme de ${v.chord} est ${v.frets.map((f) => (f === null ? 'x' : String(f))).join(' ')} (corde grave → aiguë) ; les autres cases de la forme sont ${[...new Set(others2)].join(', ') || 'aucune'}.`,
    score: anonymousScore(v, target),
    hole: target,
  };
}

export interface QuizRoundOptions {
  count?: number;
  seed?: number;
  kinds?: readonly QuizKind[];
  /** Accords proposés (par défaut : le parcours principal). */
  voicingIds?: readonly string[];
}

/**
 * Une série de questions : les accords tournent, les trois types alternent. Le tirage est déterministe
 * pour une graine donnée — on peut donc rejouer une série, et un test peut l'affirmer.
 */
export function quizRound(opts: QuizRoundOptions = {}): QuizQuestion[] {
  const count = Math.max(1, Math.min(20, opts.count ?? 6));
  const seed = opts.seed ?? 1;
  const kinds = opts.kinds && opts.kinds.length ? opts.kinds : QUIZ_KINDS;
  const ids = (opts.voicingIds && opts.voicingIds.length ? opts.voicingIds : mainlineChordIds()).slice();
  const rand = rng(seed * 7919 + 13);
  const chosen = shuffled(ids, rand);
  const out: QuizQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const voicingId = chosen[i % chosen.length]!;
    const kind = kinds[i % kinds.length]!;
    out.push(makeQuestion({ kind, voicingId, seed: seed * 1000 + i }));
  }
  return out;
}

/** Score d'une série : justes au premier essai (le journal attend `correct` / `total`). */
export function quizScore(answers: readonly { correct: boolean }[]): { correct: number; total: number } {
  return { correct: answers.filter((a) => a.correct).length, total: answers.length };
}
