/**
 * Les **accomplissements** : ce qui mérite d'être relu sur l'accueil, tiré du journal et de rien d'autre.
 *
 * Un journal de 2 000 tentatives ne se lit pas ; une liste de « +10 XP » non plus. Ici, chaque entrée
 * est un **franchissement** mesuré, avec sa date et le détail qui la rend vérifiable :
 *  - `perfect`  : série sans une erreur ni une case révélée (100 % au premier essai) ;
 *  - `pass`     : série réussie à ≥ 80 % (le seuil de `PASS`, le même que la maîtrise) ;
 *  - `learned`  : la forme devient « apprise » au sens de la maîtrise (2 réussites sur 2 jours) ;
 *  - `mastered` : elle devient « maîtrisée » (révision tenue à 16 jours) ;
 *  - `chord`    : un accord passe à « appris » (3 vérifications propres sur 2 jours, D45) ;
 *  - `streak`   : 3, 7, 14 ou 30 jours d'affilée.
 *
 * Rien n'est stocké en double : tout se recalcule depuis `fretwave.attempts.v1`. Les franchissements
 * de maîtrise sont retrouvés par **rejeu** — on avance dans le journal et on regarde l'état du nœud
 * avant/après chaque tentative, avec les mêmes fonctions que le hub (`summarizeNodes`, `stateOf`).
 */
import {
  PASS, isVerified, nodeIdOf, scoreOf, streak, summarizeNodes, xpForAttempt,
  type Attempt, type NodeState,
} from '../../core/progress';
import { fmtChord } from '../../core/theory';
import type { NoteNotation } from '../../core/theory';
import { positionLabelPlain, resolveScale } from './resolve';
import { VOICINGS } from '../../data/voicings';

export type AccomplishmentKind = 'perfect' | 'pass' | 'learned' | 'mastered' | 'chord' | 'streak';

export interface Accomplishment {
  /** Clé stable : même entrée d'un rendu à l'autre. */
  id: string;
  kind: AccomplishmentKind;
  ts: number;
  /** « Sans faute », « Forme apprise »… */
  title: string;
  /** Ce sur quoi ça porte : « La mineure pentatonique · Box 1 · cases 5–8 ». */
  subject: string;
  /** La mesure : « 100 % au premier essai · de mémoire ». */
  detail: string;
  /** Détail secondaire (grille tenue, XP), montré seulement dans la liste dépliée. */
  extra?: string;
  accent: 'green' | 'yellow' | 'magenta' | 'cyan' | 'violet';
  /** Tentative d'origine (en mémoire seulement) : l'accueil peut rouvrir l'exercice. */
  attempt?: Attempt;
}

export const ACCOMPLISHMENT_LABEL: Readonly<Record<AccomplishmentKind, string>> = {
  perfect: 'Sans faute',
  // « série » est réservé aux jours d'affilée : un exercice réussi est un « passage »
  pass: 'Passage réussi',
  learned: 'Forme apprise',
  mastered: 'Forme maîtrisée',
  chord: 'Accord appris',
  streak: 'Série de jours',
};

export const STREAK_MILESTONES = [3, 7, 14, 30] as const;

/** Prochain palier de série au-dessus de `days`, ou `null` quand le dernier est franchi. */
export function nextStreakMilestone(days: number): number | null {
  return STREAK_MILESTONES.find((m) => m > days) ?? null;
}

function levelLabel(a: Attempt): string {
  // mots d'élève, pas codes de niveau : « N2 » ne dit rien à un débutant
  if (a.kind === 'recall' || a.level === 3) return 'de mémoire';
  if (a.kind === 'cold') return 'Pose à froid';
  if (a.kind === 'transition') return 'Enchaînement';
  if (a.kind === 'qcm') return 'Sans instrument';
  return 'exercice à trous';
}

/** Sujet lisible d'une tentative de gamme : titre + position (la même résolution que les écrans). */
function scaleSubject(a: Attempt, notation: NoteNotation): string {
  const r = resolveScale({ scaleId: a.scaleId, tonic: a.tonic, tuningId: a.tuningId, system: a.system as never, positionIndex: 0 });
  const idx = r.positions.findIndex((p) => (p.formIndex ?? p.index) === a.formIndex);
  // « Position N », comme sur le héros de l'accueil : un débutant ne cherche pas une « box »
  return `${r.title} · ${positionLabelPlain(idx >= 0 ? r.positions[idx]! : null, notation)}`;
}

/**
 * Nom d'accord affichable depuis l'identifiant de doigté (« Am-x02210 » → « Am ») ; un identifiant
 * illisible (vieux journal, import) s'affiche tel quel au lieu de tout faire tomber.
 */
function chordName(id: string, notation: NoteNotation): string {
  const symbol = VOICINGS.find((v) => v.id === id)?.chord ?? id;
  try {
    return fmtChord(symbol, notation);
  } catch {
    return id;
  }
}

/** Sujet lisible d'une tentative d'accord. */
function chordSubject(a: Attempt, notation: NoteNotation): string {
  if (a.progressionId) return `Progression ${a.progressionId}`;
  if (a.chordIdB) return `${chordName(a.chordId ?? '', notation)} → ${chordName(a.chordIdB, notation)}`;
  return chordName(a.chordId ?? '', notation);
}

/**
 * Franchissements de maîtrise, trouvés par rejeu : pour chaque nœud, on avance dans ses tentatives et
 * on note le passage à `learned` puis à `mastered`.
 */
function masteryTransitions(attempts: readonly Attempt[], notation: NoteNotation): Accomplishment[] {
  const byNode = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const id = nodeIdOf(a);
    const list = byNode.get(id) ?? [];
    list.push(a);
    byNode.set(id, list);
  }
  const out: Accomplishment[] = [];
  for (const [nodeId, list] of byNode) {
    const ordered = [...list].sort((x, y) => x.ts - y.ts);
    const chordNode = nodeId.startsWith('acc:accord') || nodeId.startsWith('acc:transition');
    let before: NodeState = 'available';
    for (let i = 0; i < ordered.length; i += 1) {
      const a = ordered[i]!;
      const stats = summarizeNodes(ordered.slice(0, i + 1)).find((n) => n.nodeId === nodeId);
      if (!stats) continue;
      const after = stats.state;
      if (after === before) continue;
      const reachedMastered = after === 'mastered' && before !== 'mastered';
      const reachedLearned = after === 'learned' && before === 'learning';
      if (reachedMastered || reachedLearned) {
        out.push({
          id: `${nodeId}:${reachedMastered ? 'mastered' : 'learned'}:${a.ts}`,
          kind: chordNode ? 'chord' : reachedMastered ? 'mastered' : 'learned',
          ts: a.ts,
          title: ACCOMPLISHMENT_LABEL[chordNode ? 'chord' : reachedMastered ? 'mastered' : 'learned'],
          subject: chordNode ? chordSubject(a, notation) : scaleSubject(a, notation),
          detail: reachedMastered
            ? 'révision tenue à 16 jours'
            : chordNode
              ? '3 vérifications propres sur 2 jours'
              : '2 réussites sur 2 jours',
          accent: reachedMastered || chordNode ? 'green' : 'violet',
          attempt: a,
        });
      }
      before = after;
    }
  }
  return out;
}

/** Paliers de série (3 / 7 / 14 / 30 jours), datés au dernier exercice du jour concerné. */
function streakMilestones(attempts: readonly Attempt[]): Accomplishment[] {
  const lastByDay = new Map<string, Attempt>();
  for (const a of attempts) {
    if (!isVerified(a)) continue;
    const d = new Date(a.ts);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const prev = lastByDay.get(key);
    if (!prev || a.ts > prev.ts) lastByDay.set(key, a);
  }
  const out: Accomplishment[] = [];
  for (const last of lastByDay.values()) {
    const days = streak(attempts, new Date(last.ts)).days;
    if (!(STREAK_MILESTONES as readonly number[]).includes(days)) continue;
    out.push({
      id: `streak:${days}:${last.ts}`,
      kind: 'streak',
      ts: last.ts,
      title: ACCOMPLISHMENT_LABEL.streak,
      subject: `${days} jours d’affilée`,
      // `streak()` compte tout jour actif, écoute comprise : le détail le dit tel quel
      detail: 'au moins une écoute ou un exercice chaque jour',
      accent: 'cyan',
    });
  }
  return out;
}

/**
 * Ce que l'accueil met en tête : la dernière réussite **mesurée** (une série, une forme, un accord),
 * pas un palier de jours qui ne dit rien de ce qu'on a joué. À défaut, le plus récent tel quel.
 * `rest` garde les autres dans l'ordre, sans doublon.
 */
export function headline(list: readonly Accomplishment[]): { latest: Accomplishment | null; rest: Accomplishment[] } {
  const latest = list.find((e) => e.kind !== 'streak') ?? list[0] ?? null;
  return { latest, rest: list.filter((e) => e !== latest) };
}

export interface AccomplishmentOptions {
  limit?: number;
  notation?: NoteNotation;
}

/**
 * Les `limit` derniers accomplissements, du plus récent au plus ancien.
 * Une tentative vérifiée produit au plus une entrée (`perfect` ou `pass`), et seuls les
 * franchissements de maîtrise produisent en plus `learned` / `mastered` / `chord`.
 */
export function accomplishments(attempts: readonly Attempt[], opts: AccomplishmentOptions = {}): Accomplishment[] {
  const { limit = 10, notation = 'fr' } = opts;
  const transitions = masteryTransitions(attempts, notation);
  const out: Accomplishment[] = [...transitions, ...streakMilestones(attempts)];
  // la tentative qui a fait franchir un palier de maîtrise ne compte qu'une fois : c'est le palier
  // qui est la nouvelle, pas la série qui l'a provoqué
  const causedTransition = new Set(transitions.map((t) => t.attempt?.id).filter(Boolean));

  for (const a of attempts) {
    if (!isVerified(a)) continue;
    if (causedTransition.has(a.id)) continue;
    const score = scoreOf(a) ?? 0;
    if (score < PASS) continue;
    const perfect = score >= 1;
    const xp = xpForAttempt(a);
    const chord = a.module === 'accords';
    out.push({
      id: `${a.id}:${perfect ? 'perfect' : 'pass'}`,
      kind: perfect ? 'perfect' : 'pass',
      ts: a.ts,
      title: ACCOMPLISHMENT_LABEL[perfect ? 'perfect' : 'pass'],
      subject: chord ? chordSubject(a, notation) : scaleSubject(a, notation),
      detail: `${Math.round(score * 100)}\u00a0% au premier essai · ${levelLabel(a)}`,
      // le détail technique (grille, XP) vient en second : il ne fait pas la ligne principale
      extra: [
        a.tempoOk && (a.kind === 'holes' || a.kind === 'recall') ? 'grille tenue' : null,
        xp > 0 ? `+${xp} XP` : null,
      ].filter(Boolean).join(' · ') || undefined,
      accent: perfect ? 'yellow' : 'magenta',
      attempt: a,
    });
  }

  // dédoublonnage par id, tri du plus récent au plus ancien, puis coupe
  const seen = new Set<string>();
  return out
    .sort((x, y) => y.ts - x.ts)
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .slice(0, Math.max(0, limit));
}
