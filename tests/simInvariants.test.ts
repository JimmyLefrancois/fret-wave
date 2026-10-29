/**
 * Invariants du simulateur (docs/PLAN_CONSTATS.md, lot 0) : chaque constat devient une assertion. Celles
 * qui échouent aujourd'hui sont en `it.fails` et se retournent au lot qui les traite.
 *
 * Mesure à **17 h le lendemain** (l'heure où la persona revient) ; I4 se mesure à 23 h le jour même ; I2 à
 * 17 h les jours de pratique, avant la première série.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { DUE_CAP, dayKey, streak, summarizeNodes, weekStreak, zoneOf, type Attempt } from '../src/core/progress';
import { buildReviewQueue, dueToday, reviewCount, triedColdToday, type ReviewTarget } from '../src/modules/gammes/review';
import { resolveScale } from '../src/modules/gammes/resolve';
import { absenceDays, dailySession, pathCounts, pathCountText, returnLines, type DailySession } from '../src/app/hubPlan';
import { FIXED_END, PERSONAS, simulate, type Persona, type SimSelection } from '../src/dev/simulate';

const HOUR = 3_600_000;
const DAY = 86_400_000;

interface Snapshot { day: number; dayEnd: number; journal: Attempt[]; practiced: boolean; sel: SimSelection }

const runs = new Map<string, Snapshot[]>();
function snapshots(p: Persona): Snapshot[] {
  let out = runs.get(p.id);
  if (out) return out;
  const list: Snapshot[] = [];
  simulate(p, {
    end: FIXED_END,
    onDay: (day, dayEnd, j, sel) => {
      const key = dayKey(dayEnd);
      list.push({ day, dayEnd, journal: [...j], practiced: j.some((a) => dayKey(a.ts) === key), sel });
    },
  });
  runs.set(p.id, list);
  out = list;
  return out;
}

/** Le lendemain à 17 h (calendrier local : un changement d'heure ne décale pas l'heure de retour). */
function nextAfternoon(dayEnd: number): number {
  const d = new Date(dayEnd + 1);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 17).getTime();
}

const dueLecture = dueToday;

/**
 * Séance proposée en arrivant, les jours de pratique : journal de la veille, gamme de la veille au soir,
 * à 17 h (la persona commence à 17 h au plus tôt).
 */
function arrivals(p: Persona): { day: number; session: DailySession }[] {
  const snaps = snapshots(p);
  const start: SimSelection = { scaleId: p.scaleId, tonic: p.tonic, system: p.system, tuningId: 'standard' };
  return snaps.filter((s) => s.practiced).map((s) => {
    const prev = snaps[s.day - 1];
    const d = new Date(s.dayEnd);
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 17).getTime();
    return { day: s.day, session: dailySession(prev?.journal ?? [], t, prev?.sel ?? start) };
  });
}

/** Zone du manche où tombe la position de la cible (sa tonique, sa forme). */
function zoneOfTarget(t: ReviewTarget): number | null {
  const pos = resolveScale(t.selection).positions[t.selection.positionIndex];
  return pos ? zoneOf(pos.fretMin) : null;
}

const OTHER_ZONE = /^(vue dans une seule zone|même dessin, autre case)/;

describe('invariants du simulateur', () => {
  // les 6 simulations, une fois pour tous les invariants (plusieurs secondes quand toute la suite tourne)
  beforeAll(() => { for (const p of PERSONAS) snapshots(p); }, 60_000);

  it('I1 la séance ne propose jamais une forme apprise non due', () => {
    const faults: string[] = [];
    for (const p of PERSONAS) {
      for (const s of snapshots(p)) {
        const now = nextAfternoon(s.dayEnd);
        const state = new Map(summarizeNodes(s.journal).map((n) => [n.nodeId, n.state] as const));
        for (const t of buildReviewQueue(s.journal, now)) {
          if (t.mode === 'practice' && state.get(t.nodeId) !== 'learning') faults.push(`${p.id} J${s.day + 1} ${t.nodeId}`);
        }
      }
    }
    expect(faults).toEqual([]);
  });

  it('I1 bis la raison « une seule zone » est tenue', () => {
    const faults: string[] = [];
    for (const p of PERSONAS) {
      for (const s of snapshots(p)) {
        const now = nextAfternoon(s.dayEnd);
        const zones = new Map(summarizeNodes(s.journal).map((n) => [n.nodeId, n.zones] as const));
        for (const t of buildReviewQueue(s.journal, now)) {
          if (!OTHER_ZONE.test(t.reason)) continue;
          const z = zoneOfTarget(t);
          if (z === null || (zones.get(t.nodeId) ?? []).includes(z)) faults.push(`${p.id} J${s.day + 1} ${t.nodeId}`);
        }
      }
    }
    expect(faults).toEqual([]);
  });

  it('I1 ter le compte annoncé = les rappels à froid de la journée', () => {
    for (const p of PERSONAS) {
      for (const s of snapshots(p)) {
        const now = nextAfternoon(s.dayEnd);
        const announced = reviewCount(s.journal, now);
        const cold = buildReviewQueue(s.journal, now, DUE_CAP).filter((t) => t.mode === 'cold').length;
        expect(cold, `${p.id} J${s.day + 1}`).toBe(announced);
      }
    }
  });

  it('I1 ter, 8 formes dues sur 2 gammes : la séance de 5 puis la suite font les 8 annoncées', () => {
    const now = FIXED_END;
    const j: Attempt[] = [];
    let n = 0;
    const forms = [
      ...[0, 1, 2, 3, 4].map((formIndex) => ({ scaleId: 'pentatonic-minor', tonic: 'A', system: 'boxes', formIndex })),
      ...[0, 1, 2].map((formIndex) => ({ scaleId: 'ionian', tonic: 'C', system: 'caged', formIndex })),
    ];
    for (const f of forms) {
      const pos = resolveScale({ scaleId: f.scaleId, tonic: f.tonic as never, tuningId: 'standard', system: f.system as never, positionIndex: 0 })
        .positions.find((x) => (x.formIndex ?? x.index) === f.formIndex)!;
      // réussite nette il y a 2 jours : boîte 2 (1 j), due aujourd'hui
      j.push({
        id: `f-${n++}`, ts: now - 2 * DAY, kind: 'recall', scaleId: f.scaleId, tonic: f.tonic as never, tuningId: 'standard',
        system: f.system, positionId: pos.id, formIndex: f.formIndex, level: 3, strings: 6, correct: 20, total: 20,
        seconds: 50, fretMin: pos.fretMin, missedStrings: [], tempoOk: false, fullPosition: true,
      });
    }
    const announced = Math.min(dueLecture(j, now).length, DUE_CAP);
    expect(announced).toBe(8);
    // première séance (plafond de la page Révision), chaque forme réussie à froid
    const first = buildReviewQueue(j, now).filter((t) => t.mode === 'cold');
    expect(first).toHaveLength(5);
    const after = [...j];
    first.forEach((t, i) => {
      const base = j.find((a) => `gam:lecture:${a.scaleId}:${a.system}:${a.formIndex}` === t.nodeId)!;
      after.push({ ...base, id: `s-${i}`, ts: now + (i + 1) * 60_000 });
    });
    const second = buildReviewQueue(after, now + 10 * 60_000).filter((t) => t.mode === 'cold');
    expect(first.length + second.length).toBe(announced);
  });

  it('I4 une séance finie ne se rouvre pas le soir même', () => {
    const faults: string[] = [];
    for (const p of PERSONAS) {
      for (const s of snapshots(p)) {
        if (!s.practiced) continue;
        const evening = s.dayEnd + 1 - HOUR;
        const session = dailySession(s.journal, evening, s.sel);
        if ([...buildReviewQueue(s.journal, evening), ...session.review].some((t) => triedColdToday(s.journal, t.nodeId, evening))) {
          faults.push(`${p.id} J${s.day + 1}`);
        }
      }
    }
    expect(faults).toEqual([]);
  });

  it('I2 sur 7 jours de pratique d’affilée, au moins une étape ou un défi proposé', () => {
    const faults: string[] = [];
    for (const p of PERSONAS) {
      const days = arrivals(p);
      for (let i = 0; i + 7 <= days.length; i++) {
        const win = days.slice(i, i + 7);
        if (!win.some((d) => d.session.next || d.session.cap)) faults.push(`${p.id} J${win[0]!.day + 1}-J${win[6]!.day + 1}`);
      }
    }
    expect(faults).toEqual([]);
  });

  it('I2 bis chaque persona reçoit une étape ou un défi à chaque jour de pratique', () => {
    const faults: string[] = [];
    for (const p of PERSONAS) {
      for (const d of arrivals(p)) if (!d.session.next && !d.session.cap) faults.push(`${p.id} J${d.day + 1}`);
    }
    expect(faults).toEqual([]);
  });

  it('I5 retour après ≥ 3 jours d’absence : le message en tête ; jamais sinon', () => {
    const welcome = (p: Persona) => {
      const snaps = snapshots(p);
      return snaps.filter((s) => s.practiced).map((s) => {
        const prev = snaps[s.day - 1];
        const d = new Date(s.dayEnd);
        const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 17);
        const j = prev?.journal ?? [];
        const absence = absenceDays(j, t);
        return { day: s.day, absence, lines: returnLines(absence, dueToday(j, t.getTime()).length, 0, streak(j, t).days, weekStreak(j, t).weeks) };
      });
    };
    const back = welcome(PERSONAS.find((p) => p.id === 'decrocheur')!).find((d) => d.day >= 22)!;
    expect(back.day).toBe(22);
    expect(back.lines[0]).toMatch(/^Content de te revoir/);
    expect(welcome(PERSONAS.find((p) => p.id === 'regulier')!).filter((d) => d.lines.length > 0)).toEqual([]);
    for (const p of PERSONAS) for (const d of welcome(p)) expect(d.lines.length > 0, `${p.id} J${d.day + 1}`).toBe(d.absence >= 3);
  });

  it('I6 week-end : la série de semaines ne casse jamais ; la série de jours, inchangée, casse toujours', () => {
    const snaps = snapshots(PERSONAS.find((p) => p.id === 'week-end')!);
    const weeks = snaps.map((s) => weekStreak(s.journal, new Date(s.dayEnd)).weeks);
    const first = weeks.findIndex((w) => w > 0);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(weeks.slice(first).filter((w) => w === 0)).toEqual([]);
    const days = snaps.map((s) => streak(s.journal, new Date(s.dayEnd)).days);
    let breaks = 0;
    for (let i = 1; i < days.length; i++) if (days[i - 1]! > 1 && days[i] === 0) breaks++;
    expect(breaks).toBeGreaterThan(0);
  });

  it('I3 une forme apprise due se dit « à rafraîchir » dans le Parcours', () => {
    let seen = 0;
    for (const p of PERSONAS) {
      for (const s of snapshots(p)) {
        const now = nextAfternoon(s.dayEnd);
        const due = new Set(dueToday(s.journal, now).map((c) => c.nodeId));
        const prefix = `gam:lecture:${s.sel.scaleId}:${s.sel.system}:`;
        const learnedDue = summarizeNodes(s.journal).some((n) => n.nodeId.startsWith(prefix) && due.has(n.nodeId)
          && (n.state === 'learned' || n.state === 'mastered'));
        if (!learnedDue) continue;
        seen++;
        const c = pathCounts(s.journal, now, s.sel.scaleId, s.sel.system);
        const total = resolveScale({ ...s.sel, positionIndex: 0 }).positions.length;
        expect(pathCountText(c.learned, c.mastered, c.due, total), `${p.id} J${s.day + 1}`).toContain('à rafraîchir');
      }
    }
    // le cas se produit vraiment dans les simulations (sinon l'invariant ne prouverait rien)
    expect(seen).toBeGreaterThan(10);
  });
});
