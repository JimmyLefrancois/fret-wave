/**
 * Simulateur (dev) : chaque persona écrit un journal que l'app accepte tel quel, déterministe pour une
 * graine, et qui met bien à l'épreuve ce que la persona annonce. Horloge : décalage lu sans exception.
 */
import { describe, expect, it } from 'vitest';
import { PERSONAS, activeDays, getPersona, simulate } from '../src/dev/simulate';
import { normalizeAttempt, stringWeakness, summarizeNodes } from '../src/core/progress';
import { CLOCK_OFFSET_KEY, readClockOffset } from '../src/core/clock';

const END = new Date(2026, 9, 29, 22, 0, 0).getTime();

describe('simulate', () => {
  it.each(PERSONAS.map((p) => [p.id, p] as const))('%s : tentatives valides, triées, dans la fenêtre', (_id, p) => {
    const j = simulate(p, { end: END });
    expect(j.length).toBeGreaterThan(10);
    for (const a of j) expect(normalizeAttempt(a)).toEqual(a);
    for (let i = 1; i < j.length; i++) expect(j[i]!.ts).toBeGreaterThan(j[i - 1]!.ts);
    expect(j[j.length - 1]!.ts).toBeLessThan(END + 86_400_000);
    expect(new Set(j.map((a) => a.id)).size).toBe(j.length);
  });

  it('n’écrit rien après l’instant de fin', () => {
    const end = new Date(2026, 9, 29, 18, 0, 0).getTime();
    for (const p of PERSONAS) expect(simulate(p, { end }).every((a) => a.ts <= end)).toBe(true);
  });

  it('est déterministe pour une graine', () => {
    const p = getPersona('regulier')!;
    expect(simulate(p, { end: END, seed: 7 })).toEqual(simulate(p, { end: END, seed: 7 }));
  });

  it('le décrocheur ne pratique pas pendant sa pause', () => {
    const j = simulate(getPersona('decrocheur')!, { end: END });
    expect(activeDays(j)).toBeLessThan(22);
  });

  it('le régulier finit par apprendre une forme', () => {
    const nodes = summarizeNodes(simulate(getPersona('regulier')!, { end: END }));
    expect(nodes.some((n) => n.state === 'learned' || n.state === 'mastered')).toBe(true);
  });

  it('la corde de Si ressort au diagnostic', () => {
    expect(stringWeakness(simulate(getPersona('si-fragile')!, { end: END }))[0]?.string).toBe(4);
  });

  it('sans micro, aucune tentative ne porte le drapeau micro', () => {
    expect(simulate(getPersona('sans-micro')!, { end: END }).some((a) => a.mic)).toBe(false);
  });

  it('le joueur du week-end ne joue que le samedi et le dimanche', () => {
    for (const a of simulate(getPersona('week-end')!, { end: END })) expect([0, 6]).toContain(new Date(a.ts).getDay());
  });

  it('onDay est appelé une fois par jour simulé', () => {
    const p = getPersona('week-end')!;
    let n = 0;
    simulate(p, { end: END, days: 14, onDay: () => { n++; } });
    expect(n).toBe(14);
  });
});

describe('clock', () => {
  const store = (v: string | null) => ({ getItem: (k: string) => (k === CLOCK_OFFSET_KEY ? v : null), setItem: () => {} });
  it('lit le décalage, 0 si absent ou illisible', () => {
    expect(readClockOffset(store('86400000'))).toBe(86_400_000);
    expect(readClockOffset(store(null))).toBe(0);
    expect(readClockOffset(store('abc'))).toBe(0);
    expect(readClockOffset(null)).toBe(0);
  });
});
