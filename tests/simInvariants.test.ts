/**
 * Invariants du simulateur (docs/PLAN_CONSTATS.md) : chaque constat est devenu une assertion, verte depuis
 * le lot qui l'a traité. Les règles vivent dans `src/dev/invariants.ts`, que le rapport affiche aussi.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { DUE_CAP, streak, weekStreak, type Attempt } from '../src/core/progress';
import { buildReviewQueue, dueToday } from '../src/modules/gammes/review';
import { resolveScale } from '../src/modules/gammes/resolve';
import { absenceDays, returnLines } from '../src/app/hubPlan';
import { FIXED_END, PERSONAS, type Persona } from '../src/dev/simulate';
import { arrivals, checkInvariants, snapshotsOf, type DaySnapshot, type InvariantResult } from '../src/dev/invariants';

const DAY = 86_400_000;
const snaps = new Map<string, DaySnapshot[]>();
const results = new Map<string, InvariantResult[]>();
const persona = (id: string) => PERSONAS.find((p) => p.id === id)!;
const result = (p: Persona, id: string) => results.get(p.id)!.find((r) => r.id === id)!;

describe('invariants du simulateur', () => {
  // les 6 simulations, une fois pour tous les invariants (plusieurs secondes quand toute la suite tourne)
  beforeAll(() => {
    for (const p of PERSONAS) {
      const s = snapshotsOf(p, { end: FIXED_END });
      snaps.set(p.id, s);
      results.set(p.id, checkInvariants(p, s));
    }
  }, 120_000);

  it.each(['I1', 'I1 bis', 'I1 ter', 'I2', 'I2 bis', 'I3', 'I4', 'I5', 'I6'])('%s tenu pour chaque persona', (id) => {
    for (const p of PERSONAS) expect(result(p, id).faults, `${p.id} ${id}`).toEqual([]);
  });

  it('les invariants sont vraiment exercés (sinon ils ne prouveraient rien)', () => {
    const total = (id: string) => PERSONAS.reduce((n, p) => n + result(p, id).checked, 0);
    expect(total('I1')).toBeGreaterThan(10);
    expect(total('I3')).toBeGreaterThan(10);
    // I6 s'applique au joueur du week-end (2 jours chaque semaine), pas au décrocheur (pause de 12 jours)
    expect(result(persona('week-end'), 'I6').checked).toBeGreaterThan(0);
    expect(result(persona('decrocheur'), 'I6').checked).toBe(0);
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
    const announced = Math.min(dueToday(j, now).length, DUE_CAP);
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

  it('I5 décrocheur : accueilli à son retour (J23) ; régulier et joueur du week-end (semaines tenues) : jamais', () => {
    const lines = (p: Persona) => arrivals(p, snaps.get(p.id)!).map((d) => {
      const absence = absenceDays(d.journal, d.t);
      return { day: d.day, lines: returnLines(absence, dueToday(d.journal, d.t.getTime()).length, 0, streak(d.journal, d.t).days, weekStreak(d.journal, d.t).weeks) };
    });
    const back = lines(persona('decrocheur')).find((d) => d.day >= 22)!;
    expect(back.day).toBe(22);
    expect(back.lines[0]).toMatch(/^Content de te revoir/);
    expect(lines(persona('regulier')).filter((d) => d.lines.length > 0)).toEqual([]);
    // D101 : 5 jours sans jouer chaque semaine, mais la série de semaines tient → pas d'accueil chaque samedi
    // (seulement au tout début, avant la première semaine pleine)
    const weekend = lines(persona('week-end')).filter((d) => d.lines.length > 0);
    expect(weekend.length).toBeLessThanOrEqual(1);
  });

  it('I6 week-end : la série de jours, inchangée, casse toujours', () => {
    const days = snaps.get('week-end')!.map((s) => streak(s.journal, new Date(s.dayEnd)).days);
    let breaks = 0;
    for (let i = 1; i < days.length; i++) if (days[i - 1]! > 1 && days[i] === 0) breaks++;
    expect(breaks).toBeGreaterThan(0);
  });
});
