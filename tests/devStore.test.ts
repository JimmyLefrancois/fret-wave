/**
 * Panneau DEV : le vrai journal est sauvegardé une seule fois et restauré intact, une série ajoutée à la
 * main est une tentative que l'app accepte, la radiographie lit le journal sans rien inventer.
 */
import { describe, expect, it } from 'vitest';
import { SCALE_SELECTION_KEY } from '../src/app/scaleSession';
import { BACKUP_KEY, addSeries, clearJournal, hasBackup, loadPersona, restoreJournal, seriesAttempt, xray, type SeriesSpec } from '../src/dev/devStore';
import { getPersona } from '../src/dev/simulate';
import { isProof, isStrongSuccess, normalizeAttempt, readAttempts, writeAttempts, type Attempt } from '../src/core/progress';

const NOW = new Date(2026, 9, 29, 20, 0, 0);
const SEL = { scaleId: 'pentatonic-minor', tonic: 'A', tuningId: 'standard', system: 'boxes', positionIndex: 0 };
const SPEC: SeriesSpec = { kind: 'recall', score: 0.9, mic: true, full: true, grid: 0, tempoOk: false, afterReveal: false };

function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
}

function realJournal(): Attempt[] {
  return [seriesAttempt({ ...SPEC, kind: 'holes' }, SEL, NOW.getTime() - 86_400_000, 0)!];
}

describe('devStore', () => {
  it('sauvegarde le vrai journal une seule fois, puis le restaure', () => {
    const s = memStore();
    const real = realJournal();
    writeAttempts(s, real);
    loadPersona(s, getPersona('regulier')!, { end: NOW.getTime() });
    expect(hasBackup(s)).toBe(true);
    // une deuxième persona ne doit pas écraser la sauvegarde par la première simulation
    loadPersona(s, getPersona('avance')!, { end: NOW.getTime() });
    expect(readAttempts(s).length).toBeGreaterThan(10);
    expect(restoreJournal(s)).toBe(1);
    expect(readAttempts(s)).toEqual(real);
    expect(hasBackup(s)).toBe(false);
    expect(s.getItem(BACKUP_KEY)).toBe('');
  });

  it('charger une persona sélectionne la gamme qu’elle travaille (constat 35)', () => {
    const s = memStore();
    loadPersona(s, getPersona('avance')!, { end: NOW.getTime() });
    const sel = JSON.parse(s.getItem(SCALE_SELECTION_KEY)!);
    // l'avancé a quitté la pentatonique mineure pour les défis suivants
    expect(sel.scaleId).not.toBe('pentatonic-minor');
    expect(sel.positionIndex).toBe(0);
  });

  it('restaurer sans sauvegarde ne touche à rien', () => {
    const s = memStore();
    writeAttempts(s, realJournal());
    expect(restoreJournal(s)).toBeNull();
    expect(readAttempts(s)).toHaveLength(1);
  });

  it('vider le journal le sauvegarde d’abord', () => {
    const s = memStore();
    writeAttempts(s, realJournal());
    clearJournal(s, NOW);
    expect(readAttempts(s)).toHaveLength(0);
    expect(restoreJournal(s)).toBe(1);
  });

  it.each(['listen', 'holes', 'recall', 'blind', 'sequence', 'impro'] as const)('série %s : tentative valide', (kind) => {
    const a = seriesAttempt({ ...SPEC, kind, grid: kind === 'sequence' ? 90 : 160, tempoOk: true }, SEL, NOW.getTime(), 3)!;
    expect(normalizeAttempt(a)).toEqual(a);
    expect(a.kind).toBe(kind === 'blind' ? 'recall' : kind);
  });

  it('les drapeaux suivent la consigne : rattrapage, micro, position entière', () => {
    const strong = seriesAttempt(SPEC, SEL, NOW.getTime(), 0)!;
    expect(isStrongSuccess(strong)).toBe(true);
    expect(isProof(seriesAttempt({ ...SPEC, afterReveal: true }, SEL, NOW.getTime(), 0)!)).toBe(false);
    expect(seriesAttempt({ ...SPEC, kind: 'sequence', mic: false }, SEL, NOW.getTime(), 0)!.correct).toBeNull();
    expect(seriesAttempt({ ...SPEC, kind: 'holes', full: false }, SEL, NOW.getTime(), 0)!.fullPosition).toBeUndefined();
  });

  it('ajoute une série au journal stocké', () => {
    const s = memStore();
    expect(addSeries(s, SPEC, SEL, NOW)).not.toBeNull();
    expect(readAttempts(s)).toHaveLength(1);
  });

  it('radiographie d’une persona', () => {
    const j = loadPersona(memStore(), getPersona('regulier')!, { end: NOW.getTime() });
    const x = xray(j, NOW);
    expect(x.attempts).toBe(j.length);
    expect(x.nodes.length).toBeGreaterThan(0);
    expect(x.badges.length).toBeGreaterThan(0);
    expect(x.hero).toMatch(/^(À réviser|Reprendre)/);
  });
});
