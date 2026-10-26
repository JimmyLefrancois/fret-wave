import { describe, expect, it } from 'vitest';
import { compatibleSystems, systemsFor } from '../src/core/theory/systems';
import { SCALES } from '../src/core/theory/scales';

describe('compatibilité gamme ↔ système de positions', () => {
  it('diatoniques : 3NPS + CAGED', () => {
    for (const id of ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian']) {
      expect(compatibleSystems(id)).toEqual(['3nps', 'caged']);
    }
  });

  it('pentatoniques : boxes (+ CAGED option), jamais 3NPS', () => {
    expect(compatibleSystems('pentatonic-minor')).toEqual(['caged', 'boxes']);
    expect(systemsFor('pentatonic-minor').find((s) => s.system === '3nps')!.available).toBe(false);
  });

  it('blues : boxes + note de blues', () => {
    expect(compatibleSystems('blues-minor')).toEqual(['boxes']);
    expect(compatibleSystems('blues-major')).toEqual(['boxes']);
  });

  it('harmonique et mélodique : 3NPS seulement, CAGED refusé avec raison', () => {
    for (const id of ['harmonic-minor', 'melodic-minor', 'phrygian-dominant', 'altered']) {
      expect(compatibleSystems(id)).toEqual(['3nps']);
      expect(systemsFor(id).find((s) => s.system === 'caged')!.note).toBeTruthy();
    }
  });

  it('symétriques et bebop : systèmes propres', () => {
    for (const id of ['whole-tone', 'diminished-wh', 'diminished-hw', 'augmented']) expect(compatibleSystems(id)).toEqual(['symmetric']);
    for (const id of ['bebop-dominant', 'bebop-major']) expect(compatibleSystems(id)).toEqual(['passing-note']);
  });

  it('chaque gamme du catalogue a au moins un système', () => {
    for (const s of SCALES) expect(compatibleSystems(s.id).length, s.id).toBeGreaterThan(0);
  });
});
