/**
 * Invariants du simulateur (docs/PLAN_CONSTATS.md, lot 0) : chaque constat devient une assertion. Celles
 * qui échouent aujourd'hui sont en `it.fails` et se retournent au lot qui les traite.
 *
 * Mesure à **17 h le lendemain** (l'heure où la persona revient) ; I4 se mesure à 23 h le jour même.
 */
import { describe, expect, it } from 'vitest';
import { DUE_CAP, dayKey, summarizeNodes, zoneOf, type Attempt } from '../src/core/progress';
import { buildReviewQueue, dueReviewCards, triedColdToday, type ReviewTarget } from '../src/modules/gammes/review';
import { resolveScale } from '../src/modules/gammes/resolve';
import { FIXED_END, PERSONAS, simulate, type Persona } from '../src/dev/simulate';

const HOUR = 3_600_000;
const DAY = 86_400_000;

interface Snapshot { day: number; dayEnd: number; journal: Attempt[]; practiced: boolean }

const runs = new Map<string, Snapshot[]>();
function snapshots(p: Persona): Snapshot[] {
  let out = runs.get(p.id);
  if (out) return out;
  const list: Snapshot[] = [];
  simulate(p, {
    end: FIXED_END,
    onDay: (day, dayEnd, j) => {
      const key = dayKey(dayEnd);
      list.push({ day, dayEnd, journal: [...j], practiced: j.some((a) => dayKey(a.ts) === key) });
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

const dueLecture = dueReviewCards;

/** Zone du manche où tombe la position de la cible (sa tonique, sa forme). */
function zoneOfTarget(t: ReviewTarget): number | null {
  const pos = resolveScale(t.selection).positions[t.selection.positionIndex];
  return pos ? zoneOf(pos.fretMin) : null;
}

const OTHER_ZONE = /^(vue dans une seule zone|même dessin, autre case)/;

describe('invariants du simulateur', () => {
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
        const announced = Math.min(dueLecture(s.journal, now).length, DUE_CAP);
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

  it.fails('I4 une séance finie ne se rouvre pas le soir même', () => {
    const faults: string[] = [];
    for (const p of PERSONAS) {
      for (const s of snapshots(p)) {
        if (!s.practiced) continue;
        const evening = s.dayEnd + 1 - HOUR;
        if (buildReviewQueue(s.journal, evening).some((t) => triedColdToday(s.journal, t.nodeId, evening))) faults.push(`${p.id} J${s.day + 1}`);
      }
    }
    expect(faults).toEqual([]);
  });
});
