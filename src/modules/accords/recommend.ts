/**
 * Recommandation du prochain accord (phase 4a) — le « système adaptatif » du brief, réduit à ce qui
 * peut être **justifié** aujourd'hui : prérequis physiques, proximité de doigté, transitions que
 * l'accord débloque. Rien d'inventé : la difficulté vient de `difficulty` saisi dans la base, les
 * doigts communs sont calculés sur les cases, et le nombre de transitions est compté dans le
 * curriculum.
 *
 * L'écran affiche **pourquoi** : un élève qui ne comprend pas la recommandation ne la suit pas.
 */
import { VOICINGS } from '../../data/voicings';
import { chordIdOfNode, type Attempt } from '../../core/progress/journal';
import { summarizeNodes } from '../../core/progress/mastery';
import type { Voicing } from '../../core/theory/voicings';
import { CURRICULUM, entryOf, mainlineChordIds, palierOfVoicing, type Palier } from './curriculum';

/** Palier suivant non terminé, dans l'ordre du parcours (hors branche). */
export function nextPalierIndex(learned: ReadonlySet<string>): number {
  const mainline = CURRICULUM.filter((p) => !p.branch);
  const idx = mainline.findIndex((p) => p.entries.some((e) => !learned.has(e.voicingId)));
  // tout est appris : plus aucun palier n'est « en cours » (l'index sort du tableau)
  return idx === -1 ? mainline.length : idx;
}

export interface PalierState {
  palier: Palier;
  status: 'done' | 'current' | 'later';
  /** Nombre d'accords appris dans ce palier. */
  done: number;
  total: number;
  /** Pourquoi il est fermé / ouvert, à afficher tel quel. */
  reason: string;
}

/** État de chaque palier (le parcours n'est jamais bloquant : un palier « plus tard » reste ouvrable). */
export function palierStates(learned: ReadonlySet<string>): PalierState[] {
  const mainline = CURRICULUM.filter((p) => !p.branch);
  const current = nextPalierIndex(learned);
  return CURRICULUM.map((palier) => {
    const done = palier.entries.filter((e) => learned.has(e.voicingId)).length;
    const total = palier.entries.length;
    const pos = mainline.indexOf(palier);
    if (palier.branch) {
      return {
        palier, done, total,
        status: done === total && total > 0 ? 'done' : 'later',
        reason: 'branche optionnelle : elle s’ouvre quand tu veux, elle ne bloque rien',
      };
    }
    // un palier sans accord (P0 : matériel, posture, une note nette) n'est « franchi » que si quelque
    // chose a été fait ; sinon c'est par là qu'on commence
    if (total === 0) {
      return {
        palier, done, total,
        status: learned.size === 0 ? 'current' : 'done',
        reason: learned.size === 0 ? 'à faire une fois : matériel et posture, aucun accord à former' : 'matériel validé',
      };
    }
    if (pos < current) return { palier, done, total, status: 'done', reason: 'palier franchi' };
    if (pos === current && done < total) return { palier, done, total, status: 'current', reason: 'le palier où tu en es' };
    const prev = mainline[pos - 1];
    return {
      palier, done, total, status: 'later',
      reason: prev ? `s’ouvre après « ${prev.title} » — tu peux toujours entrer quand même` : 'à venir',
    };
  });
}

export type ChordStatus = 'locked' | 'available' | 'learning' | 'learned';

export interface ChordCard {
  voicing: Voicing;
  entry: { why: string; prereq: string[] };
  palier: Palier;
  status: ChordStatus;
  /** Accords prérequis qui manquent (noms lisibles). */
  missing: string[];
  /** Transitions que cet accord ouvre avec les accords déjà connus. */
  transitions: number;
}

function chordLabel(voicingId: string): string {
  return VOICINGS.find((v) => v.id === voicingId)?.chord ?? voicingId;
}

/**
 * État de tous les accords du curriculum. `learned` = nœuds `acc:accord:*` à l'état appris ou maîtrisé ;
 * `started` = au moins une vérification enregistrée (une leçon commencée n'est pas une leçon apprise).
 */
export function chordCards(
  learned: ReadonlySet<string>,
  started: ReadonlySet<string> = new Set(),
): ChordCard[] {
  const out: ChordCard[] = [];
  for (const palier of CURRICULUM) {
    for (const entry of palier.entries) {
      const voicing = VOICINGS.find((v) => v.id === entry.voicingId);
      if (!voicing) continue;
      const missing = entry.prereq.filter((p) => !learned.has(p));
      // l'ordre compte : un accord déjà travaillé n'est jamais présenté comme verrouillé — l'élève l'a
      // commencé, l'app ne va pas lui dire qu'il n'y a pas droit
      const status: ChordStatus = learned.has(entry.voicingId)
        ? 'learned'
        : started.has(entry.voicingId)
          ? 'learning'
          : missing.length > 0
            ? 'locked'
            : 'available';
      out.push({
        voicing,
        entry: { why: entry.why, prereq: entry.prereq },
        palier,
        status,
        missing: missing.map(chordLabel),
        transitions: transitionsWith(entry.voicingId).filter(([, other]) => learned.has(other)).length,
      });
    }
  }
  return out;
}

/** Paires de transitions du curriculum qui concernent un accord (dans un sens ou dans l'autre). */
export function transitionsWith(voicingId: string): [string, string][] {
  return CURRICULUM.flatMap((p) => p.transitions.filter(([a, b]) => a === voicingId || b === voicingId));
}

export interface Recommendation {
  voicingId: string;
  chord: string;
  palier: Palier;
  /** Raison pédagogique de l'accord (pourquoi il est là dans le parcours). */
  why: string;
  /** Raison de le proposer MAINTENANT. */
  reason: string;
}

/**
 * Le prochain accord : le premier du parcours dont les prérequis sont atteints et qui n'est pas appris.
 * `branch: true` ouvre la branche rock (jamais imposée). Retourne `null` quand le parcours principal
 * est terminé — l'écran le dit alors, il n'invente pas un accord.
 */
export function nextChord(learned: ReadonlySet<string>, opts: { branch?: boolean } = {}): Recommendation | null {
  const candidates = CURRICULUM.filter((p) => !p.branch || opts.branch);
  for (const palier of candidates) {
    for (const entry of palier.entries) {
      if (learned.has(entry.voicingId)) continue;
      if (entry.prereq.some((p) => !learned.has(p))) continue;
      const withKnown = transitionsWith(entry.voicingId).filter(([, other]) => learned.has(other));
      const parts: string[] = [];
      if (entry.prereq.length) parts.push(`s’appuie sur ${entry.prereq.map(chordLabel).join(' et ')} (déjà connu)`);
      if (withKnown.length) parts.push(`${withKnown.length} transition${withKnown.length > 1 ? 's' : ''} déjà en place`);
      if (!entry.prereq.length && !withKnown.length) parts.push('le plus simple qui reste dans ce palier');
      if (palier.entries[0]?.voicingId === entry.voicingId) parts.push(`ouvre le palier ${palier.id} « ${palier.title} »`);
      return {
        voicingId: entry.voicingId,
        chord: chordLabel(entry.voicingId),
        palier,
        why: entry.why,
        reason: parts.join(' · '),
      };
    }
  }
  return null;
}

/** Accords « appris » d'après le journal (même source que le hub : rien n'est stocké à part). */
export function learnedChordIds(attempts: readonly Attempt[]): Set<string> {
  const out = new Set<string>();
  for (const node of summarizeNodes(attempts)) {
    if (node.module !== 'accords') continue;
    const id = node.chordId ?? chordIdOfNode(node.nodeId);
    if (id && (node.state === 'learned' || node.state === 'mastered')) out.add(id);
  }
  return out;
}

/** Accords déjà vérifiés au moins une fois (leçon commencée). */
export function startedChordIds(attempts: readonly Attempt[]): Set<string> {
  const out = new Set<string>();
  for (const a of attempts) {
    if (a.module !== 'accords' || !a.chordId || a.kind === 'strum') continue;
    out.add(a.chordId);
  }
  return out;
}

/** Avancement global du parcours principal (affiché sur la carte du hub et l'écran Accords). */
export function chordProgress(learned: ReadonlySet<string>): { done: number; total: number } {
  const ids = mainlineChordIds();
  return { done: ids.filter((id) => learned.has(id)).length, total: ids.length };
}

/** Rappel du palier d'un accord, pour l'en-tête d'une leçon. */
export function palierOf(voicingId: string): Palier | null {
  return palierOfVoicing(voicingId) ?? entryOf(voicingId)?.palier ?? null;
}
