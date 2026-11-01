/**
 * Séquences avec **palier automatique de tempo** (lot « mémoire et vitesse », MUSIC_DESIGN §3.5) —
 * logique pure : jugement d'une passe, règles du palier, tempo de reprise, rappel de pause.
 *
 * C'est un exercice de **technique** : la tablature est visible. Il ne prouve donc pas qu'on sait la
 * forme, il prouve qu'on la **joue à tempo**.
 *
 * Règles du palier (demandées, pas inventées) :
 *  - départ au dernier tempo validé pour cette forme et ce motif, sinon 60 BPM (croches) ;
 *  - **+4 BPM** après **2 passes consécutives** à ≥ 95 % avec le tempo tenu (ce tempo est alors « validé ») ;
 *  - **−5 BPM** après **2 échecs consécutifs**, sans jamais descendre sous le tempo de départ ;
 *  - bornes 40-200 BPM.
 *
 * **Gamme en boucle** (D125) : la gamme tourne sans pause et sans jugement, au tempo choisi ; en option,
 * le tempo monte de 5 BPM toutes les N répétitions, que ce soit bien joué ou non, et le décompte revient
 * avant chaque hausse pour donner le nouveau tempo.
 *
 * **Au micro, mode tolérant** (D126) : chaque tour est jugé sans jamais couper la gamme. Le tempo ne monte
 * qu'après N tours propres d'affilée ; sinon on relance au même tempo jusqu'à ce que ça passe.
 */
import type { Target } from '../../core/input/match';
import type { Attempt, LoopRun } from '../../core/progress';
import { PPQ, type SequencePattern } from '../../core/tab';
import { COUNT_IN_TICKS, scoreBlind, type BlindMark, type HeardNote } from './blind';

export const LADDER_START = 60;
export const LADDER_MIN = 40;
export const LADDER_MAX = 200;
export const LADDER_UP = 4;
export const LADDER_DOWN = 5;
/** Précision exigée pour une passe réussie (le seuil « propre » de l'app). */
export const PASS_CLEAN = 0.95;
/** Part des notes justes qui doivent tomber en place pour que le tempo soit « tenu ». */
export const IN_TIME_SHARE = 0.9;
/** Écart toléré à la place de la note, en fraction de croche (après retrait du décalage constant). */
export const IN_TIME_WINDOW = 0.5;
/** Rappel doux de pause : au-delà, la précision baisse et la tension monte. */
export const PAUSE_AFTER_MS = 10 * 60_000;

export interface PassResult {
  correct: number;
  total: number;
  accuracy: number;
  /** Les notes justes sont-elles en place, à ce tempo ? */
  inTime: boolean;
  missedStrings: number[];
  /** Passe réussie : propre (≥ 95 %) **et** en place. */
  ok: boolean;
}

/**
 * Juge une passe. `heard[].t` = secondes depuis le premier temps de la passe (après le décompte).
 * La mise en place se juge note à note : chaque attaque juste est comparée à sa place (rang × croche),
 * **après retrait de l'écart médian** — un décalage constant est la latence de la chaîne ou un départ un
 * peu tardif, pas un défaut de tempo ; ce qui compte, c'est de ne pas traîner ni presser.
 */
export function judgePass(
  targets: readonly Target[], heard: readonly HeardNote[], bpm: number, opts: { centsTolerance: number },
): PassResult {
  const eighth = 30 / Math.max(1, bpm);
  // à tempo rapide, une même note revient vite : le rebond se juge à l'échelle de la croche
  const sc = scoreBlind(targets, heard, { centsTolerance: opts.centsTolerance, finished: true, dedupeSeconds: Math.min(0.4, eighth * 0.6) });
  const offsets = targets.flatMap((t, i) => (sc.times[t.key] === undefined ? [] : [sc.times[t.key]! - i * eighth]));
  let inTime = false;
  if (offsets.length >= 2) {
    const sorted = [...offsets].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1]!;
    const placed = offsets.filter((o) => Math.abs(o - median) <= IN_TIME_WINDOW * eighth).length;
    inTime = placed / offsets.length >= IN_TIME_SHARE;
  }
  const accuracy = sc.total > 0 ? sc.correct / sc.total : 0;
  return { correct: sc.correct, total: sc.total, accuracy, inTime, missedStrings: sc.missedStrings, ok: accuracy >= PASS_CLEAN && inTime };
}

export interface LadderState {
  bpm: number;
  /** Tempo de départ de la session : plancher du palier. */
  start: number;
  okStreak: number;
  failStreak: number;
  /** Meilleur tempo validé (deux passes réussies d'affilée), `null` si aucun. */
  best: number | null;
  passes: number;
}

const clamp = (v: number) => Math.max(LADDER_MIN, Math.min(LADDER_MAX, Math.round(v)));

export function ladderStart(bpm: number): LadderState {
  const b = clamp(bpm);
  return { bpm: b, start: b, okStreak: 0, failStreak: 0, best: null, passes: 0 };
}

/** Palier après une passe. */
export function ladderStep(s: LadderState, ok: boolean): LadderState {
  const passes = s.passes + 1;
  if (ok) {
    const okStreak = s.okStreak + 1;
    if (okStreak >= 2) {
      // deux passes propres d'affilée : ce tempo est validé, on monte
      return { ...s, passes, okStreak: 0, failStreak: 0, best: Math.max(s.best ?? 0, s.bpm), bpm: clamp(s.bpm + LADDER_UP) };
    }
    return { ...s, passes, okStreak, failStreak: 0 };
  }
  const failStreak = s.failStreak + 1;
  if (failStreak >= 2) {
    // deux échecs : on redescend, jamais sous le départ de la session
    return { ...s, passes, okStreak: 0, failStreak: 0, bpm: Math.max(s.start, clamp(s.bpm - LADDER_DOWN)) };
  }
  return { ...s, passes, okStreak: 0, failStreak };
}

/** Tempo de reprise : le dernier tempo validé **au micro** pour cette forme et ce motif, sinon 60. */
export function startTempo(
  journal: readonly Attempt[],
  form: { scaleId: string; system: string; formIndex: number },
  pattern: SequencePattern,
): number {
  let best: { ts: number; bpm: number } | null = null;
  for (const a of journal) {
    if (a.kind !== 'sequence' || a.pattern !== pattern || a.mic !== true || typeof a.bpmBest !== 'number') continue;
    if (a.scaleId !== form.scaleId || a.system !== form.system || a.formIndex !== form.formIndex) continue;
    if (!best || a.ts > best.ts) best = { ts: a.ts, bpm: a.bpmBest };
  }
  return clamp(best?.bpm ?? LADDER_START);
}

/** Hausse de tempo de la gamme en boucle, et pas du réglage du tempo de base. */
export const LOOP_STEP = 5;
/** Répétitions maximum entre deux hausses (0 = tempo fixe). */
export const LOOP_EVERY_MAX = 20;

/** Une répétition de plus : `passes` les compte, le tempo monte à chaque multiple de `every` (0 = jamais). */
export function loopStep(s: LadderState, every: number): LadderState {
  const passes = s.passes + 1;
  return { ...s, passes, bpm: every > 0 && passes % every === 0 ? clamp(s.bpm + LOOP_STEP) : s.bpm };
}

/** La fin de la répétition en cours fera-t-elle monter le tempo ? Si oui, le décompte la suit. */
export function loopRises(s: LadderState, every: number): boolean {
  return loopStep(s, every).bpm !== s.bpm;
}

/** Verdict d'un tour de gamme au micro. */
export interface TourResult {
  correct: number;
  total: number;
  /** Notes justes mais nettement hors de leur place. */
  offTime: number;
  /** Notes fausses ou manquées. */
  errors: number;
  missedStrings: number[];
  /** Aucune note fausse, manquée ou hors tempo. */
  clean: boolean;
  /** Retard constant mesuré sur ce tour (s), `null` s'il y a trop peu de notes pour le dire. */
  lag: number | null;
  /** Détail note à note, pour le journal d'analyse. */
  notes: TourNote[];
}

export interface TourNote {
  target: Target;
  mark: BlindMark;
  /** Écart de l'attaque à sa place (s), absent si la note n'est pas juste. */
  offset?: number;
}

/**
 * Attaques d'un tour, en temps relatif à sa première note. La fenêtre suit le retard `lag` de la chaîne
 * micro : sans lui, la dernière note, entendue en retard, tomberait dans le tour suivant et y passerait
 * pour une fausse première note. `null` (retard pas encore mesuré) : la fin de la fenêtre reste ouverte, le
 * jugement s'arrête de lui-même à la dernière note attendue.
 */
export function heardInTour(heard: readonly HeardNote[], tour: number, notes: number, bpm: number, lag: number | null = null): HeardNote[] {
  const eighth = 30 / Math.max(1, bpm);
  const start = tour * notes * eighth + (lag ?? 0);
  const end = start + (notes - 0.5) * eighth + (lag === null ? Math.max(eighth, 0.4) : 0);
  const origin = tour * notes * eighth;
  return heard
    .filter((h) => h.t >= start - eighth / 2 && h.t < end)
    .map((h) => ({ midi: h.midi, t: h.t - origin }));
}

/** Juge un tour : comme une passe, le décalage constant (médian) est retiré avant de regarder la mise en place. */
export function judgeTour(
  targets: readonly Target[], heard: readonly HeardNote[], bpm: number, opts: { centsTolerance: number; window?: number },
): TourResult {
  const eighth = 30 / Math.max(1, bpm);
  const sc = scoreBlind(targets, heard, { centsTolerance: opts.centsTolerance, finished: true, dedupeSeconds: Math.min(0.4, eighth * 0.6) });
  const offsets = targets.flatMap((t, i) => (sc.times[t.key] === undefined ? [] : [sc.times[t.key]! - i * eighth]));
  const median = [...offsets].sort((a, b) => a - b)[offsets.length >> 1] ?? 0;
  const offTime = offsets.filter((o) => Math.abs(o - median) > (opts.window ?? IN_TIME_WINDOW) * eighth).length;
  const errors = sc.total - sc.correct;
  const notes = targets.map((target, i): TourNote => {
    const at = sc.times[target.key];
    return { target, mark: sc.marks[target.key] ?? 'missed', ...(at === undefined ? {} : { offset: at - i * eighth }) };
  });
  return {
    correct: sc.correct, total: sc.total, offTime, errors, missedStrings: sc.missedStrings, clean: errors === 0 && offTime === 0,
    lag: offsets.length >= 3 ? median : null, notes,
  };
}

/** Notes de fin de tour : toutes manquées, c'est que le joueur s'est arrêté, pas qu'il s'est trompé. */
export const ABANDON_NOTES = 3;

export interface TourRow {
  bpm: number;
  result: TourResult;
}

/** Tours gardés à la fin de la session : ceux qui suivent le moment où le joueur a posé la guitare ne comptent pas. */
export function playedTours(rows: readonly TourRow[]): TourRow[] {
  let end = rows.length;
  while (end > 0 && rows[end - 1]!.result.notes.slice(-ABANDON_NOTES).every((n) => n.mark === 'missed')) end--;
  return rows.slice(0, end);
}

export interface LoopBilan {
  tours: number;
  clean: number;
  errors: number;
  offTime: number;
  /** Part de notes justes sur toute la session (0-1). */
  accuracy: number;
  bestStreak: number;
  bpmStart: number;
  bpmEnd: number;
  /** Propre ou non, tour par tour. */
  strip: boolean[];
  byBpm: { bpm: number; tours: number; clean: number; errors: number }[];
  /** Les cases les plus souvent ratées, de la pire à la moins pire. */
  weak: { string: number; fret: number; count: number }[];
}

/** Le bilan affiché au joueur à partir des tours gardés. */
export function loopBilan(rows: readonly TourRow[]): LoopBilan | null {
  if (rows.length === 0) return null;
  const stats = rows.reduce((s, r) => tourRecord(s, r.result), TOURS_START);
  const byBpm = new Map<number, LoopBilan['byBpm'][number]>();
  const weak = new Map<string, LoopBilan['weak'][number]>();
  let correct = 0;
  let total = 0;
  let errors = 0;
  let offTime = 0;
  for (const { bpm, result: r } of rows) {
    correct += r.correct;
    total += r.total;
    errors += r.errors;
    offTime += r.offTime;
    const b = byBpm.get(bpm) ?? { bpm, tours: 0, clean: 0, errors: 0 };
    byBpm.set(bpm, { ...b, tours: b.tours + 1, clean: b.clean + (r.clean ? 1 : 0), errors: b.errors + r.errors + r.offTime });
    for (const n of r.notes) {
      if (n.mark === 'right') continue;
      const key = `${n.target.string}:${n.target.fret}`;
      const w = weak.get(key) ?? { string: n.target.string, fret: n.target.fret, count: 0 };
      weak.set(key, { ...w, count: w.count + 1 });
    }
  }
  return {
    tours: rows.length, clean: stats.clean, errors, offTime, accuracy: total > 0 ? correct / total : 0, bestStreak: stats.bestStreak,
    bpmStart: rows[0]!.bpm, bpmEnd: rows[rows.length - 1]!.bpm,
    strip: rows.map((r) => r.result.clean),
    byBpm: [...byBpm.values()],
    weak: [...weak.values()].sort((a, b) => b.count - a.count).slice(0, 3),
  };
}

/** Les séries d'une session à écrire au journal. En tolérant, rien ne coupe la gamme : une seule série. */
export function sessionRuns(rows: readonly TourRow[]): LoopRun[] {
  const b = loopBilan(rows);
  if (!b) return [];
  return [{ from: b.bpmStart, to: b.bpmEnd, tours: b.tours, clean: b.clean, errors: b.errors + b.offTime, streak: b.bestStreak }];
}

/** Une session de gamme au micro, telle que la lit l'onglet Progression. */
export interface LoopSession {
  ts: number;
  /** Tempo le plus haut atteint. */
  bpm: number;
  /** Plus longue suite de tours propres. */
  streak: number;
  tours: number;
  clean: number;
}

/** Historique de la gamme en boucle au micro sur une forme, du plus ancien au plus récent. */
export function loopHistory(
  journal: readonly Attempt[], form: { scaleId: string; system: string; formIndex: number },
): LoopSession[] {
  return journal
    .filter((a) => a.kind === 'sequence' && a.pattern === 'scale' && a.runs !== undefined
      && a.scaleId === form.scaleId && a.system === form.system && a.formIndex === form.formIndex)
    .map((a) => ({
      ts: a.ts,
      bpm: Math.max(...a.runs!.map((r) => r.to)),
      streak: Math.max(...a.runs!.map((r) => r.streak)),
      tours: a.runs!.reduce((n, r) => n + r.tours, 0),
      clean: a.runs!.reduce((n, r) => n + r.clean, 0),
    }))
    .sort((a, b) => a.ts - b.ts);
}

/** Silence au bout duquel on considère que le joueur a posé la guitare. */
export const SILENCE_STOP_MS = 2000;

/** Le joueur s'est-il arrêté ? Le silence se compte depuis la dernière attaque, ou le premier temps s'il n'a rien joué. */
export function playerStopped(nowMs: number, passStartMs: number, lastAttackMs: number): boolean {
  return nowMs - Math.max(passStartMs, lastAttackMs) >= SILENCE_STOP_MS;
}

/** Un tour tel qu'il a été jugé, avec tout ce que le micro a entendu dans sa fenêtre. */
export interface TourLog {
  tour: number;
  bpm: number;
  /** Retard utilisé pour placer la fenêtre (s). */
  lag: number | null;
  result: TourResult;
  heard: readonly HeardNote[];
  /** Attaques écartées comme clics du métronome. */
  masked: readonly HeardNote[];
  /** Joué après l'arrêt du joueur : absent du score. */
  dropped?: boolean;
}

const ms = (s: number) => `${s >= 0 ? '+' : ''}${Math.round(s * 1000)} ms`;
const attacks = (list: readonly HeardNote[]) =>
  list.map((h) => `${h.t.toFixed(3)} s midi ${h.midi.toFixed(2)}`).join(' ; ') || 'rien';
const MARK_LABEL: Readonly<Record<BlindMark, string>> = { right: 'juste', wrong: 'FAUSSE', missed: 'MANQUÉE' };

/** Texte à copier pour analyser une session : un bloc par tour, note à note. */
export function formatTourLog(head: string, tours: readonly TourLog[]): string {
  const blocks = tours.map((l) => {
    const r = l.result;
    const verdict = r.clean ? 'propre' : `${r.errors} erreur(s), ${r.offTime} hors tempo`;
    return [
      `Tour ${l.tour + 1}${l.dropped ? ' (NON COMPTÉ, arrêt du joueur)' : ''} | ${l.bpm} BPM | fenêtre décalée de ${l.lag === null ? 'non mesuré' : ms(l.lag)} | retard mesuré ${r.lag === null ? '?' : ms(r.lag)} | ${r.correct}/${r.total} | ${verdict}`,
      ...r.notes.map((n, i) => `  ${String(i + 1).padStart(2, '0')} ${n.target.note} midi ${n.target.midi} corde ${n.target.string} case ${n.target.fret} : ${MARK_LABEL[n.mark]}${n.offset === undefined ? '' : ` ${ms(n.offset)}`}`),
      `  entendu : ${attacks(l.heard)}`,
      `  écarté (clic) : ${attacks(l.masked)}`,
    ].join('\n');
  });
  return [head, ...blocks].join('\n\n');
}

/** Cumul des tours jugés d'une session au micro. */
export interface TourStats {
  clean: number;
  errors: number;
  /** Tours propres d'affilée, et le meilleur enchaînement de la session. */
  streak: number;
  bestStreak: number;
  /** Tours propres d'affilée depuis la dernière hausse de tempo. */
  rise: number;
}

export const TOURS_START: TourStats = { clean: 0, errors: 0, streak: 0, bestStreak: 0, rise: 0 };

export function tourRecord(s: TourStats, r: TourResult): TourStats {
  const streak = r.clean ? s.streak + 1 : 0;
  return {
    clean: s.clean + (r.clean ? 1 : 0),
    errors: s.errors + r.errors + r.offTime,
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    rise: r.clean ? s.rise + 1 : 0,
  };
}

/** Le tour qui s'achève peut-il faire monter le tempo ? Si oui, il faut l'entendre jusqu'au bout avant de relancer. */
export function tourDecides(s: TourStats, every: number, bpm: number): boolean {
  return every > 0 && bpm < LADDER_MAX && s.rise + 1 >= every;
}

/** Après un tour décisif : +5 BPM si les N tours propres y sont, sinon le même tempo. */
export function tourRaise(s: TourStats, every: number, bpm: number): { stats: TourStats; bpm: number } {
  if (every <= 0 || s.rise < every) return { stats: s, bpm };
  return { stats: { ...s, rise: 0 }, bpm: clamp(bpm + LOOP_STEP) };
}

/** Répétitions restantes avant la prochaine hausse, `null` si le tempo ne montera plus. */
export function loopLeft(s: LadderState, every: number): number | null {
  if (every <= 0 || s.bpm >= LADDER_MAX) return null;
  return every - (s.passes % every);
}

/** Rang de la note jouée au tick donné (notes en croches), `null` pendant le décompte. */
export function loopNoteIndex(tick: number, notes: number): number | null {
  if (tick < COUNT_IN_TICKS || notes === 0) return null;
  return Math.floor((tick - COUNT_IN_TICKS) / (PPQ / 2)) % notes;
}

/** Temps du décompte à afficher (4, 3, 2, 1) au tick donné, `null` une fois la gamme lancée. */
export function loopCountBeat(tick: number): number | null {
  return tick < COUNT_IN_TICKS ? Math.max(1, Math.ceil((COUNT_IN_TICKS - tick) / PPQ)) : null;
}

export function pauseDue(elapsedMs: number): boolean {
  return elapsedMs >= PAUSE_AFTER_MS;
}
