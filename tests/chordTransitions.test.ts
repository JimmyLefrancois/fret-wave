import { describe, expect, it } from 'vitest';
import {
  CHANGE_CLEAN_MS, CHANGE_FLUENT_MS, allTransitionPairs, bassOf, changeGrade, changeStats, detectChanges,
  markersOf, pairScore, sharedPositions, transitionCandidates, transitionNodeId,
} from '../src/modules/accords/transitions';
import { CURRICULUM } from '../src/modules/accords/curriculum';
import { voicingById } from '../src/data/voicings';
import { validateScore } from '../src/core/tab/model';

const Em = voicingById('Em-022000')!;
const Am = voicingById('Am-x02210')!;
const Em7 = voicingById('Em7-020000')!;
const C = voicingById('C-x32010')!;
const GoverB = voicingById('GoverB-x20003')!;

/** Suite de basses alternées : une note par changement, à intervalle fixe. */
function alternating(bassA: number, bassB: number, gapMs: number, count: number) {
  const out: { midi: number; at: number }[] = [];
  for (let i = 0; i < count; i++) out.push({ midi: i % 2 === 0 ? bassA : bassB, at: i * gapMs });
  return out;
}

describe('Enchaîner — les paires du parcours', () => {
  it('les paires du curriculum existent, une seule fois, dans les deux formes', () => {
    const pairs = allTransitionPairs();
    expect(pairs.length).toBeGreaterThanOrEqual(15);
    const keys = pairs.map((p) => [p.a, p.b].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of pairs) {
      expect(voicingById(p.a), p.a).toBeDefined();
      expect(voicingById(p.b), p.b).toBeDefined();
    }
    // toutes les transitions déclarées dans le curriculum sont couvertes
    const declared = CURRICULUM.flatMap((pal) => pal.transitions.map(([a, b]) => [a, b].sort().join('|')));
    for (const d of declared) expect(keys).toContain(d);
  });

  it('les doigts communs se comptent sur les cases, pas sur les noms', () => {
    expect(sharedPositions(Em, Em7)).toBe(1); // corde de La, case 2
    expect(sharedPositions(Em, Am)).toBe(1); // corde de Ré, case 2
    expect(sharedPositions(Am, C)).toBe(2); // cordes de Ré (case 2) et de Si (case 1)
    expect(sharedPositions(Em, C)).toBe(1); // corde de Sol à vide, tenue par personne mais commune
  });

  it('les paires dont les deux accords sont appris passent devant', () => {
    const learned = new Set(['Em-022000', 'Am-x02210']);
    const cands = transitionCandidates(learned);
    const ready = cands.filter((c) => c.tier === 'ready');
    expect(ready.length).toBeGreaterThan(0);
    expect(ready.every((c) => learned.has(c.pair.a) && learned.has(c.pair.b))).toBe(true);
    expect(cands[0]!.tier).toBe('ready');
    // aucun candidat n'est jamais exclu : le débutant qui n'a qu'un accord a de quoi s'entraîner
    expect(cands.some((c) => c.tier === 'new')).toBe(true);
  });

  it('la basse est la note la plus grave réellement jouée', () => {
    expect(bassOf(Em)).toEqual({ string: 0, fret: 0, midi: 40 });
    expect(bassOf(Am)).toEqual({ string: 1, fret: 0, midi: 45 });
    expect(bassOf(GoverB)!.midi).toBe(47); // Si, pas Sol : c'est ce qui fait l'accord
  });

  it('deux basses différentes : le repère est la basse', () => {
    const m = markersOf(Em, Am)!;
    expect(m.a.bass).toBe(true);
    expect(m.b.bass).toBe(true);
    expect(m.a.midi).toBe(40); // Mi grave
    expect(m.b.midi).toBe(45); // La
  });

  it('même basse (Em → Em7) : le repère est la première corde qui change', () => {
    // Em 022000 et Em7 020000 : la corde de Mi grave ne bouge pas, la corde de Sol passe de 2 à 0
    const m = markersOf(Em, Em7)!;
    expect(m.a.bass).toBe(false);
    expect(m.a.string).toBe(2);
    expect(m.a.midi).toBe(52); // Mi3 (case 2 de la corde de Sol)
    expect(m.b.midi).toBe(50); // Ré3 (à vide)
  });

  it('chaque paire du parcours a une note repère utilisable', () => {
    for (const p of allTransitionPairs()) {
      const a = voicingById(p.a)!;
      const b = voicingById(p.b)!;
      const m = markersOf(a, b);
      expect(m, `${p.a} → ${p.b}`).not.toBeNull();
      expect(m!.a.midi, `${p.a} → ${p.b}`).not.toBe(m!.b.midi);
    }
  });

  it('la tablature de l’exercice est valide : deux mesures, une par accord', () => {
    const score = pairScore(Em, Am);
    expect(score.kind).toBe('progression');
    expect(score.measures).toHaveLength(2);
    expect(() => validateScore(score)).not.toThrow();
    expect(transitionNodeId(Em.id, Am.id)).toBe('acc:transition:Em-022000>Am-x02210');
  });
});

describe('Enchaîner — mesure entre deux basses', () => {
  const opts = { bassA: 40, bassB: 45, centsTolerance: 35 };

  it('la première basse ancre, chaque basse suivante est un changement', () => {
    const det = detectChanges(alternating(40, 45, 1000, 5), opts);
    expect(det.anchored).toBe(true);
    expect(det.changes).toHaveLength(4);
    expect(det.changes.every((c) => c.ms === 1000)).toBe(true);
    expect(det.changes[0]!.to).toBe('b');
    expect(det.changes[1]!.to).toBe('a');
  });

  it('les autres notes de l’accord ne sont pas des changements', () => {
    const events = [
      { midi: 40, at: 0 }, // basse de Em : ancre
      { midi: 52, at: 300 }, // mi aiguë, autre corde : ignorée
      { midi: 45, at: 1000 }, // basse de Am : changement
    ];
    const det = detectChanges(events, opts);
    expect(det.changes).toHaveLength(1);
    expect(det.changes[0]!.ms).toBe(1000);
  });

  it('la même attaque vue deux fois ne compte pas deux fois', () => {
    const det = detectChanges([
      { midi: 40, at: 0 },
      { midi: 45, at: 900 },
      { midi: 45.02, at: 960 }, // même note, 60 ms plus tard : c'est la corde qui résonne
      { midi: 40, at: 1800 },
    ], opts);
    expect(det.changes).toHaveLength(2);
    expect(det.changes[0]!.ms).toBe(900);
  });

  it('une note fausse ne déplace pas l’alternance', () => {
    const det = detectChanges([
      { midi: 40, at: 0 },
      { midi: 41, at: 500 }, // Fa : ni La ni Mi
      { midi: 45, at: 1200 },
    ], opts);
    expect(det.changes).toHaveLength(1);
    expect(det.changes[0]!.ms).toBe(1200);
  });

  it('sans première basse, rien n’est mesuré', () => {
    const det = detectChanges([{ midi: 41, at: 0 }], opts);
    expect(det.anchored).toBe(false);
    expect(det.changes).toEqual([]);
  });
});

describe('Enchaîner — lecture du résultat', () => {
  it('compte les changements propres et fluides, et donne le tempo réel', () => {
    const changes = [800, 1400, 2100, 2600].map((ms, i) => ({ at: i * ms, ms, to: (i % 2 ? 'a' : 'b') as 'a' | 'b' }));
    const stats = changeStats(changes, { durationMs: 30_000 });
    expect(stats.changes).toBe(4);
    expect(stats.clean).toBe(2); // 800 et 1400 ms
    expect(stats.fluent).toBe(2); // 800 et 1400 ms
    expect(stats.medianMs).toBe(1750);
    expect(stats.score).toBe(0.5);
    expect(stats.perMinute).toBe(8);
    expect(CHANGE_CLEAN_MS).toBe(2000);
    expect(CHANGE_FLUENT_MS).toBe(1500);
  });

  it('aucun changement : score nul, pas de médiane inventée', () => {
    const stats = changeStats([], { durationMs: 30_000 });
    expect(stats).toMatchObject({ changes: 0, clean: 0, medianMs: null, score: 0, perMinute: 0 });
  });

  it('les seuils du prof : 20 par minute = correct, 30 = fluide', () => {
    expect(changeGrade(8).label).toBe('lent');
    expect(changeGrade(12).label).toBe('en construction');
    expect(changeGrade(22).label).toBe('correct');
    expect(changeGrade(35).label).toBe('fluide');
  });
});
