/**
 * Étape **Fixer** (phase 4b) — la pose à froid chronométrée.
 *
 * Ce que cette étape corrige : la 4a déclarait un accord « appris » après trois arpèges propres, sans
 * jamais demander de le **poser**. Un élève pouvait donc être « appris » en plaçant lentement six fois
 * de suite. Ici, l'accord est demandé **sans aide**, avec un temps limité, et la passe compte comme
 * preuve (`MUSIC_DESIGN` §4.6).
 *
 * Ce que le micro peut mesurer, et rien de plus : l'instant où la **première corde attendue** sonne
 * juste. On arrête le chrono là — c'est le moment où la main est arrivée — puis la vérification
 * continue corde par corde, sans limite, pour juger la propreté. Le temps mesuré est un temps de
 * **pose**, pas un temps de jeu complet : le dire autrement serait mentir sur ce que l'app sait faire
 * (la validation plaquée est en phase 5).
 *
 * Règles héritées et non négociables : ni le désaccord ni une octave douteuse ne comptent comme une
 * erreur (D36) ; une déclaration sans micro ne peut jamais devenir une preuve.
 */
import {
  arpeggioCheck, checkSummary, MAX_TRIES, type ArpeggioCheck, type CheckState, type CheckSummary,
} from './lesson';
import { CHORD_COLD, PASS } from '../../core/progress/mastery';
import type { Attempt } from '../../core/progress/journal';
import type { Voicing } from '../../core/theory/voicings';
import type { Tuning } from '../../core/theory/tunings';
import { TUNINGS } from '../../core/theory/tunings';

/**
 * Échelle des temps accordés : 8 s pour les premiers accords (la main cherche encore sa forme),
 * 5 s au palier P3, 3 s à partir de P5. Ce sont les valeurs de `MUSIC_DESIGN` §4.6 — des **seuils de
 * prof**, pas une mesure : un débutant met souvent 4 à 6 s sur un Sol les premières semaines.
 */
export const COLD_LADDER = [8, 5, 3] as const;

/** Temps accordé par défaut pour un palier (avant resserrement par les réussites). */
export function coldLimitFor(palierId: string | null | undefined): number {
  const p = palierId ?? '';
  if (p === 'P1' || p === 'P2' || p === 'P2b') return COLD_LADDER[0];
  if (p === 'P3' || p === 'P4') return COLD_LADDER[1];
  return COLD_LADDER[2];
}

/**
 * Temps accordé à la prochaine tentative : le palier donne le plafond, et chaque pose à froid réussie
 * resserre d'un cran (8 → 5 → 3). On ne descend jamais sous 3 s : en dessous, on ne mesure plus un
 * geste, on mesure un réflexe de guitariste confirmé.
 */
export function coldLimit(opts: { palierId?: string | null; passes: number }): number {
  const byPalier = coldLimitFor(opts.palierId);
  const byPasses = COLD_LADDER[Math.min(COLD_LADDER.length - 1, Math.max(0, opts.passes))]!;
  return Math.min(byPalier, byPasses);
}

/** Compteur de poses à froid réussies pour un accord, d'après le journal (même source que la maîtrise). */
export function coldPassesOf(attempts: readonly Attempt[], chordId: string): number {
  return attempts.filter((a) => a.kind === 'cold' && a.chordId === chordId && a.limitSec !== undefined
    && (a.correct ?? 0) / Math.max(1, a.total ?? 1) >= PASS && a.seconds <= (a.limitSec ?? 8)).length;
}

// ---------------------------------------------------------------------------
// La passe : un chrono qui s'arrête à la première corde juste
// ---------------------------------------------------------------------------

export interface ColdRun {
  phase: 'idle' | 'running' | 'done';
  /** Instant du départ (ms, horloge de `performance.now`). */
  startedAt: number;
  limitSec: number;
  /** Instant de la première corde validée, `null` tant que rien ne sonne juste. */
  firstNoteAt: number | null;
  /** Le temps est écoulé **et** la main n'est pas encore arrivée. */
  expired: boolean;
}

export function newColdRun(limitSec: number): ColdRun {
  return { phase: 'idle', startedAt: 0, limitSec, firstNoteAt: null, expired: false };
}

export function startCold(limitSec: number, now: number): ColdRun {
  return { phase: 'running', startedAt: now, limitSec, firstNoteAt: null, expired: false };
}

/**
 * Une corde vient d'être validée. Seule la **première** arrête le chrono : les suivantes se vérifient
 * sans limite (c'est la propreté qu'on juge ensuite, pas la vitesse). Après expiration, plus rien
 * n'arrête le chrono : la pose est perdue pour cette fois, et l'écran le dit.
 */
export function noteSounded(run: ColdRun, now: number): ColdRun {
  if (run.phase !== 'running' || run.expired || run.firstNoteAt !== null) return run;
  return { ...run, firstNoteAt: now };
}

/** Le temps accordé est écoulé sans que la main soit arrivée : la course est perdue, pas la séance. */
export function tickCold(run: ColdRun, now: number): ColdRun {
  if (run.phase !== 'running' || run.firstNoteAt !== null || run.expired) return run;
  return now - run.startedAt > run.limitSec * 1000 ? { ...run, expired: true } : run;
}

/** Secondes jusqu'à la première corde juste (ou jusqu'à l'expiration), arrondies au dixième. */
export function coldSeconds(run: ColdRun): number | null {
  if (run.phase === 'idle') return null;
  // une course expirée vaut **juste au-delà** de la limite : arrondir à la limite ferait passer une
  // pose manquée pour une pose réussie à la dernière milliseconde
  const end = run.firstNoteAt ?? (run.expired ? run.startedAt + run.limitSec * 1000 + 100 : null);
  if (end === null) return null;
  return Math.round(((end - run.startedAt) / 1000) * 10) / 10;
}

export interface ColdVerdict {
  passed: boolean;
  /** Statut lisible d'un coup d'œil. */
  status: 'clean' | 'slow' | 'sloppy' | 'missed';
  headline: string;
  detail: string;
}

/**
 * Verdict d'une pose à froid : il faut **les deux** — la main arrive dans le temps **et** l'accord est
 * propre (≥ 80 % des cordes). Une pose rapide et sale n'est pas une pose, c'est un geste raté.
 */
export function coldVerdict(opts: { seconds: number | null; summary: CheckSummary; limitSec: number }): ColdVerdict {
  const { seconds, summary, limitSec } = opts;
  const clean = summary.accuracy >= PASS;
  const inTime = seconds !== null && seconds <= limitSec;
  if (seconds === null) {
    return {
      passed: false, status: 'missed',
      headline: 'Aucune corde n’a sonné juste dans le temps accordé.',
      detail: `Reprends l’étape « Construire » : la forme n’est pas encore dans les doigts. Rien n’est perdu, rien ne se bloque.`,
    };
  }
  const s = `${seconds.toFixed(1).replace('.', ',')} s`;
  if (clean && inTime) {
    return {
      passed: true, status: 'clean',
      headline: `Posé en ${s} — c’est une pose à froid.`,
      detail: `${summary.ok} cordes sur ${summary.total} du premier coup, dans les ${limitSec} s accordées. Cette preuve-là manquait pour « appris ».`,
    };
  }
  if (clean && !inTime) {
    return {
      passed: false, status: 'slow',
      headline: `Propre, mais ${s} pour ${limitSec} s accordées.`,
      detail: 'La main connaît la forme, le réflexe n’est pas là. Refais l’exercice à froid demain : c’est exactement ce que la répétition espacée attend.',
    };
  }
  if (inTime && !clean) {
    return {
      passed: false, status: 'sloppy',
      headline: `Rapide, mais ${summary.ok} cordes justes sur ${summary.total}.`,
      detail: 'Un accord posé vite et sale ne s’entend pas comme un accord. Reprends la corde marquée « révélée » ci-dessous, puis refais la pose.',
    };
  }
  return {
    passed: false, status: 'sloppy',
    headline: `${summary.ok} cordes justes sur ${summary.total}, en ${s}.`,
    detail: `La pose n’est ni propre ni dans les ${limitSec} s. Reviens à « Vérifier » — la pose à froid vient après, pas avant.`,
  };
}

/**
 * Résumé d'une pose pour le journal : mêmes champs qu'un arpège, plus la limite de temps.
 *
 * Les secondes sont **arrondies au supérieur** : le journal ne stocke que des entiers, et un 8,1 s
 * arrondi à 8 s passerait pour une pose réussie en 8 s. Une mesure ne doit jamais flatter.
 */
export function coldAttemptPayload(opts: {
  summary: CheckSummary; seconds: number; limitSec: number;
}): { correct: number; total: number; missedStrings: number[]; seconds: number; limitSec: number } {
  return {
    correct: opts.summary.ok,
    total: opts.summary.total,
    missedStrings: [...new Set(opts.summary.missedStrings)].sort((a, b) => a - b),
    seconds: Math.max(0, Math.ceil(opts.seconds)),
    limitSec: Math.round(opts.limitSec),
  };
}

/**
 * Ce qu'il reste à faire pour que l'accord soit « appris », en une phrase. Sert d'état vide utile :
 * « il te manque une pose à froid » vaut mieux qu'un badge grisé sans explication.
 */
export function coldRequirement(stats: {
  successes: number; coldPasses: number;
}, thresholds: { successes: number; coldPasses: number } = { successes: 3, coldPasses: CHORD_COLD }): string {
  const missingSuccesses = Math.max(0, thresholds.successes - stats.successes);
  const missingCold = Math.max(0, thresholds.coldPasses - stats.coldPasses);
  if (missingSuccesses === 0 && missingCold === 0) return 'Toutes les preuves sont réunies.';
  const parts: string[] = [];
  if (missingSuccesses > 0) parts.push(`${missingSuccesses} vérification${missingSuccesses > 1 ? 's' : ''} propre${missingSuccesses > 1 ? 's' : ''}`);
  if (missingCold > 0) parts.push(`${missingCold} pose${missingCold > 1 ? 's' : ''} à froid`);
  return `Il manque ${parts.join(' et ')}.`;
}

/** Cordes attendues d'une pose à froid : la forme entière, dans l'ordre grave → aiguë (comme Vérifier). */
export function coldChecks(v: Voicing, tuning?: Tuning): ArpeggioCheck[] {
  return arpeggioCheck(v, tuning ?? TUNINGS[v.tuningId]!);
}

export { checkSummary, MAX_TRIES };
export type { CheckState };
