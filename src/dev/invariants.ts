/**
 * Invariants du simulateur (docs/PLAN_CONSTATS.md) : ce que l'app doit tenir pour chaque élève virtuel, jour
 * après jour. Une seule source pour le test (`tests/simInvariants.test.ts`) et le rapport, qui les affiche en
 * tête de chaque persona (développement seulement).
 *
 * Mesures : **17 h le lendemain** (l'heure où la persona revient) ; I4 à 23 h le jour même ; I2 et I5 à
 * 17 h les jours de pratique, avant la première série. I7 (barre de réponse au téléphone) est un contrôle
 * Playwright à part : `tools/answer-bar-check.mjs`.
 */
import { DUE_CAP, dayKey, streak, summarizeNodes, weekStreak, zoneOf, type Attempt } from '../core/progress';
import { buildReviewQueue, dueToday, reviewCount, triedColdToday } from '../modules/gammes/review';
import { resolveScale } from '../modules/gammes/resolve';
import { absenceDays, dailySession, pathCounts, pathCountText, returnLines, type DailySession } from '../app/hubPlan';
import { simulate, type Persona, type SimOptions, type SimSelection } from './simulate';

export interface DaySnapshot { day: number; dayEnd: number; journal: Attempt[]; practiced: boolean; sel: SimSelection }

export interface InvariantResult {
  id: string;
  label: string;
  /** Jours (ou fenêtres) fautifs : vide = tenu. */
  faults: string[];
  /** Cas réellement rencontrés (un invariant jamais exercé ne prouve rien). */
  checked: number;
}

/** Journal, pratique et gamme de chaque soir simulé. */
export function snapshotsOf(persona: Persona, opts: Omit<SimOptions, 'onDay'> = {}): DaySnapshot[] {
  const list: DaySnapshot[] = [];
  simulate(persona, {
    ...opts,
    onDay: (day, dayEnd, j, sel) => {
      const key = dayKey(dayEnd);
      list.push({ day, dayEnd, journal: [...j], practiced: j.some((a) => dayKey(a.ts) === key), sel });
    },
  });
  return list;
}

const HOUR = 3_600_000;
const OTHER_ZONE = /^(vue dans une seule zone|même dessin, autre case)/;

/** Le lendemain à 17 h (calendrier local : un changement d'heure ne décale pas l'heure de retour). */
function nextAfternoon(dayEnd: number): number {
  const d = new Date(dayEnd + 1);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 17).getTime();
}

/** Ce que voit l'élève en arrivant, les jours de pratique : journal et gamme de la veille, à 17 h. */
export function arrivals(persona: Persona, snaps: readonly DaySnapshot[]): {
  day: number; t: Date; journal: Attempt[]; session: DailySession;
}[] {
  const start: SimSelection = { scaleId: persona.scaleId, tonic: persona.tonic, system: persona.system, tuningId: 'standard' };
  return snaps.filter((s) => s.practiced).map((s) => {
    const prev = snaps[s.day - 1];
    const d = new Date(s.dayEnd);
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 17);
    const journal = prev?.journal ?? [];
    return { day: s.day, t, journal, session: dailySession(journal, t.getTime(), prev?.sel ?? start) };
  });
}

const J = (s: { day: number }) => `J${s.day + 1}`;

export function checkInvariants(persona: Persona, snaps: readonly DaySnapshot[]): InvariantResult[] {
  const out: InvariantResult[] = [];
  const add = (id: string, label: string, faults: string[], checked: number) => out.push({ id, label, faults, checked });

  // I1, I1 bis, I1 ter, I3 : le lendemain à 17 h
  const i1: string[] = []; const i1bis: string[] = []; const i1ter: string[] = []; const i3: string[] = [];
  let n1 = 0; let n1bis = 0; let n3 = 0;
  for (const s of snaps) {
    const now = nextAfternoon(s.dayEnd);
    const nodes = summarizeNodes(s.journal);
    const byId = new Map(nodes.map((n) => [n.nodeId, n] as const));
    const queue = buildReviewQueue(s.journal, now);
    if (queue.length) n1++;
    for (const t of queue) {
      if (t.mode === 'practice' && byId.get(t.nodeId)?.state !== 'learning') i1.push(`${J(s)} ${t.nodeId}`);
      if (!OTHER_ZONE.test(t.reason)) continue;
      n1bis++;
      const pos = resolveScale(t.selection).positions[t.selection.positionIndex];
      if (!pos || (byId.get(t.nodeId)?.zones ?? []).includes(zoneOf(pos.fretMin))) i1bis.push(`${J(s)} ${t.nodeId}`);
    }
    const cold = buildReviewQueue(s.journal, now, DUE_CAP).filter((t) => t.mode === 'cold').length;
    if (cold !== reviewCount(s.journal, now)) i1ter.push(J(s));
    const due = new Set(dueToday(s.journal, now).map((c) => c.nodeId));
    const prefix = `gam:lecture:${s.sel.scaleId}:${s.sel.system}:`;
    if (nodes.some((n) => n.nodeId.startsWith(prefix) && due.has(n.nodeId) && (n.state === 'learned' || n.state === 'mastered'))) {
      n3++;
      const c = pathCounts(s.journal, now, s.sel.scaleId, s.sel.system);
      const total = resolveScale({ ...s.sel, positionIndex: 0 }).positions.length;
      if (!pathCountText(c.learned, c.mastered, c.due, total).includes('à rafraîchir')) i3.push(J(s));
    }
  }
  add('I1', 'la session ne propose jamais une forme apprise non due', i1, n1);
  add('I1 bis', 'toute raison « autre zone » est tenue', i1bis, n1bis);
  add('I1 ter', 'compte de l’accueil = rappels à froid de la journée', i1ter, snaps.length);

  // I2 : sur 7 jours de pratique d'affilée, au moins une étape ou un défi (en arrivant)
  const arr = arrivals(persona, snaps);
  const i2: string[] = [];
  for (let i = 0; i + 7 <= arr.length; i++) {
    const win = arr.slice(i, i + 7);
    if (!win.some((d) => d.session.next || d.session.cap)) i2.push(`${J(win[0]!)}-${J(win[6]!)}`);
  }
  add('I2', '7 jours de pratique → au moins une étape ou un défi', i2, Math.max(0, arr.length - 6));
  add('I2 bis', 'chaque jour de pratique : une étape ou un défi', arr.filter((d) => !d.session.next && !d.session.cap).map(J), arr.length);
  add('I3', 'forme apprise due → « à rafraîchir » dans le Parcours', i3, n3);

  // I4 : à 23 h, rien de ce qui a été rappelé à froid aujourd'hui ne se rouvre
  const practiced = snaps.filter((s) => s.practiced);
  const i4 = practiced.filter((s) => {
    const evening = s.dayEnd + 1 - HOUR;
    const session = dailySession(s.journal, evening, s.sel);
    return [...buildReviewQueue(s.journal, evening), ...session.review].some((t) => triedColdToday(s.journal, t.nodeId, evening));
  }).map(J);
  add('I4', 'une session finie ne se rouvre pas le soir même', i4, practiced.length);

  // I5 : message de retour exactement à partir de 3 jours d'absence, si la série de semaines est tombée (D101)
  const i5 = arr.filter((d) => {
    const absence = absenceDays(d.journal, d.t);
    const weeks = weekStreak(d.journal, d.t).weeks;
    const lines = returnLines(absence, dueToday(d.journal, d.t.getTime()).length, 0, streak(d.journal, d.t).days, weeks);
    return (lines.length > 0) !== (absence >= 3 && weeks === 0);
  }).map(J);
  add('I5', '≥ 3 jours d’absence, semaines tombées → message de retour ; jamais sinon', i5, arr.length);

  // I6 : pour qui joue au moins 2 jours chaque semaine pleine (le joueur du week-end), la série de semaines
  // ne retombe jamais à 0 une fois lancée ; une vraie pause (le décrocheur) la casse, à juste titre
  const weekOf = (ts: number) => { const d = new Date(ts); return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime()); };
  const byWeek = new Map<string, DaySnapshot[]>();
  for (const s of snaps) byWeek.set(weekOf(s.dayEnd), [...(byWeek.get(weekOf(s.dayEnd)) ?? []), s]);
  const firstPlay = snaps.findIndex((s) => s.practiced);
  const fullWeeks = [...byWeek.values()].filter((w) => w.length === 7 && w[0]!.day >= firstPlay);
  const steady = firstPlay >= 0 && fullWeeks.every((w) => w.filter((s) => s.practiced).length >= 2);
  const weeks = snaps.map((s) => weekStreak(s.journal, new Date(s.dayEnd)).weeks);
  const first = weeks.findIndex((w) => w > 0);
  const i6 = steady && first >= 0 ? snaps.slice(first).filter((_s, i) => weeks[first + i] === 0).map(J) : [];
  add('I6', 'joueur régulier par semaine : série de semaines jamais cassée', i6, steady ? snaps.length : 0);
  return out;
}

/** « Invariants : I1 ✓ · I2 ✗ (3 : J12-J18…) » : en tête de chaque persona dans le rapport. */
export function invariantsLine(results: readonly InvariantResult[]): string {
  return 'Invariants : ' + results.map((r) => (r.faults.length
    ? `${r.id} ✗ (${r.faults.length} : ${r.faults.slice(0, 3).join(', ')}${r.faults.length > 3 ? '…' : ''})`
    : `${r.id} ✓`)).join(' · ') + '.';
}
