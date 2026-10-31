/**
 * Opérations du panneau DEV sur le stockage local (développement seulement) : sauvegarde du **vrai**
 * journal avant toute simulation, chargement d'une persona, ajout d'une série à la main, radiographie
 * de l'état dérivé. Logique pure (le stockage est passé en argument) : le panneau React ne fait que l'UI.
 */
import {
  badgeStatus, cardsFrom, dueCards, exportText, newAttemptId, nodeIdOf, parseImport,
  readAttempts, streak, summarizeDay, summarizeNodes, writeAttempts, xpSummary,
  type Attempt, type AttemptLevel,
} from '../core/progress';
import { accomplishments } from '../modules/gammes/accomplishments';
import type { KeyValueStore } from '../core/audio/mixer';
import { generatePositions, TUNINGS, type NoteName, type PositionSystem } from '../core/theory';
import { dailyActivity, hubPlan, reviewLine } from '../app/hubPlan';
import { simulate, type Persona, type SimSelection } from './simulate';
import { SCALE_SELECTION_KEY } from '../app/scaleSession';

/** Copie du vrai journal, prise avant la première simulation ; vide = aucune sauvegarde en cours. */
export const BACKUP_KEY = 'fretwave.dev.backup';

export function hasBackup(store: KeyValueStore | null): boolean {
  return !!store?.getItem(BACKUP_KEY);
}

/**
 * Sauvegarde le journal courant **seulement s'il n'y en a pas déjà une** : charger trois personas de
 * suite ne doit jamais écraser le vrai journal par une simulation. Rend `true` si une copie a été prise.
 */
export function backupJournal(store: KeyValueStore | null, now: Date): boolean {
  if (!store || hasBackup(store)) return false;
  store.setItem(BACKUP_KEY, exportText(readAttempts(store), now));
  return true;
}

/** Remet le vrai journal en place et efface la sauvegarde. Rend le nombre de tentatives restaurées, ou `null`. */
export function restoreJournal(store: KeyValueStore | null): number | null {
  const raw = store?.getItem(BACKUP_KEY);
  if (!store || !raw) return null;
  const r = parseImport(raw);
  if (r.error) return null;
  writeAttempts(store, r.attempts);
  store.setItem(BACKUP_KEY, '');
  return r.attempts.length;
}

/** Remplace le journal par celui d'une persona (après sauvegarde du vrai). */
export function loadPersona(store: KeyValueStore | null, persona: Persona, opts: { end: number; days?: number; seed?: number }): Attempt[] {
  backupJournal(store, new Date(opts.end));
  // la gamme que la persona travaille le dernier soir : l'accueil la propose, comme chez l'élève (constat 35)
  let sel: SimSelection | null = null;
  const journal = simulate(persona, { ...opts, onDay: (_day, _end, _j, s) => { sel = s; } });
  writeAttempts(store, journal);
  if (sel) store?.setItem(SCALE_SELECTION_KEY, JSON.stringify({ ...(sel as SimSelection), positionIndex: 0 }));
  return journal;
}

/** Vide le journal (après sauvegarde du vrai) : l'accueil d'un premier lancement. */
export function clearJournal(store: KeyValueStore | null, now: Date): void {
  backupJournal(store, now);
  writeAttempts(store, []);
}

export type SeriesKind = 'listen' | 'holes' | 'recall' | 'blind' | 'sequence' | 'impro';

export interface SeriesSpec {
  kind: SeriesKind;
  /** Précision au premier essai (0-1). Ignorée pour une écoute. */
  score: number;
  mic: boolean;
  /** Position entière (sinon trois cordes graves). */
  full: boolean;
  /** Débit de la grille (notes/min), 0 = sans grille. Pour une séquence : meilleur tempo validé (BPM). */
  grid: number;
  /** Grille tenue. */
  tempoOk: boolean;
  /** Essai fait juste après avoir revu la forme (pas une preuve). */
  afterReveal: boolean;
}

export interface SeriesTarget {
  scaleId: string;
  tonic: string;
  tuningId: string;
  system: string;
  positionIndex: number;
}

/** Tentative fabriquée à la main sur la forme sélectionnée, ou `null` si la forme n'existe pas. */
export function seriesAttempt(spec: SeriesSpec, sel: SeriesTarget, ts: number, seq: number): Attempt | null {
  const tuning = TUNINGS[sel.tuningId];
  if (!tuning) return null;
  const positions = generatePositions(sel.scaleId, sel.tonic as NoteName, tuning, sel.system as PositionSystem);
  const pos = positions[Math.min(sel.positionIndex, positions.length - 1)];
  if (!pos) return null;
  const formIndex = pos.formIndex ?? pos.index;
  const strings = tuning.strings.length;
  const notes = spec.full ? 2 * pos.notes.length - 1 : Math.ceil(pos.notes.length / 2);
  const level: AttemptLevel = spec.kind === 'listen' ? 1 : spec.kind === 'impro' ? 5 : spec.kind === 'sequence' ? 4
    : spec.kind === 'recall' || spec.kind === 'blind' ? 3 : 2;
  const total = spec.kind === 'listen' ? null
    : spec.kind === 'impro' || spec.kind === 'sequence' ? 40
    : level >= 3 ? notes : Math.max(2, Math.round(notes * 0.35));
  const verified = total !== null && (spec.kind !== 'sequence' || spec.mic);
  const score = Math.max(0, Math.min(1, spec.score));
  const kind = spec.kind === 'blind' ? 'recall' : spec.kind;
  const base: Attempt = {
    id: '', ts, kind, scaleId: sel.scaleId, tonic: sel.tonic, tuningId: sel.tuningId, system: sel.system,
    positionId: pos.id, formIndex, level, strings: spec.full || kind !== 'holes' ? strings : 3,
    correct: verified ? Math.round(score * total!) : null, total: verified ? total : null,
    seconds: spec.kind === 'listen' ? 40 : 90, fretMin: pos.fretMin,
    missedStrings: score < 1 && verified ? [Math.floor((1 - score) * 10) % strings] : [],
    tempoOk: spec.tempoOk,
  };
  const a: Attempt = { ...base };
  if (spec.afterReveal && verified) a.afterReveal = true;
  if ((spec.mic || spec.kind === 'blind') && verified) a.mic = true;
  if (spec.full && (kind === 'holes' || kind === 'recall' || kind === 'sequence')) a.fullPosition = true;
  if (spec.kind === 'blind') a.blind = true;
  if (spec.kind === 'sequence') {
    a.pattern = 'g3';
    a.bpmStart = 60;
    a.passes = 4;
    if (verified && spec.grid >= 40) a.bpmBest = Math.min(200, spec.grid);
  } else if (spec.grid >= 20 && (kind === 'holes' || kind === 'recall')) {
    a.gridNpm = spec.grid;
  }
  a.id = newAttemptId(ts, nodeIdOf(a), seq);
  return a;
}

/** Ajoute une série au journal stocké (après sauvegarde du vrai). */
export function addSeries(store: KeyValueStore | null, spec: SeriesSpec, sel: SeriesTarget, now: Date): Attempt | null {
  backupJournal(store, now);
  const journal = readAttempts(store);
  const a = seriesAttempt(spec, sel, now.getTime(), journal.length);
  if (!a) return null;
  writeAttempts(store, [...journal, a]);
  return a;
}

/** Radiographie : ce que l'app calcule depuis le journal, y compris ce que l'élève ne voit pas. */
export interface Xray {
  attempts: number;
  today: { exercises: number; listens: number; accuracy: number | null };
  xp: { total: number; today: number; cap: number };
  streak: number;
  hero: string;
  due: { nodeId: string; box: number; due: number; summary: string }[];
  nodes: { nodeId: string; state: string; speed: boolean; box: number | null; successes: number; successDays: number; strong: number; mastery: number; last: number }[];
  badges: { title: string; earned: boolean }[];
  feats: string[];
}

export function xray(journal: readonly Attempt[], now: Date): Xray {
  const t = now.getTime();
  const cards = cardsFrom(journal);
  const due = dueCards(cards, t).filter((c) => !c.nodeId.startsWith('acc:'));
  const plan = hubPlan(journal, due, new Set(), null);
  const day = summarizeDay(journal, now);
  const xp = xpSummary(journal, now);
  return {
    attempts: journal.length,
    today: { exercises: dailyActivity(day), listens: day.listens, accuracy: day.accuracy },
    xp: { total: xp.total, today: xp.today, cap: xp.cap },
    streak: streak(journal, now).days,
    hero: plan.review ? `À réviser (${plan.review.count})` : plan.resume.kind === 'start' ? 'Commencer' : plan.resume.kind === 'chord' ? 'Reprendre l’accord' : 'Reprendre la gamme',
    due: due.map((c) => {
      const line = reviewLine(c, journal, t);
      return { nodeId: c.nodeId, box: c.box, due: c.due, summary: `${line.reason} · ${line.trend}` };
    }),
    nodes: summarizeNodes(journal).filter((n) => n.nodeId.startsWith('gam:')).map((n) => ({
      nodeId: n.nodeId, state: n.state, speed: n.speedVerified, box: n.box, successes: n.successes,
      successDays: n.successDays, strong: n.strongSuccesses, mastery: n.mastery, last: n.last,
    })),
    badges: badgeStatus(journal, now).map((b) => ({ title: b.title, earned: b.earned })),
    feats: accomplishments(journal, { limit: 8 }).map((f) => `${f.title} — ${f.subject}`),
  };
}
