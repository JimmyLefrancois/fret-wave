import { describe, expect, it } from 'vitest';
import { VOICINGS, voicingById } from '../src/data/voicings';
import { fingerSteps, validateFingers, FINGER_NAME } from '../src/core/theory/chordFingers';
import type { Voicing } from '../src/core/theory/voicings';

function v(id: string): Voicing {
  const found = voicingById(id);
  if (!found) throw new Error(`voicing absent : ${id}`);
  return found;
}

describe('doigtés d’accord — données saisies, relues par règle', () => {
  it('chaque voicing de la base porte un doigté saisi et cohérent', () => {
    const bad: string[] = [];
    for (const voicing of VOICINGS) {
      const errs = validateFingers(voicing);
      if (errs.length) bad.push(...errs);
    }
    expect(bad).toEqual([]);
    expect(VOICINGS.every((x) => x.fingers && x.fingers.length === x.frets.length)).toBe(true);
  });

  it('les doigtés sont ceux qu’on enseigne (pas une heuristique)', () => {
    expect(v('Em-022000').fingers).toEqual([null, 2, 3, null, null, null]);
    expect(v('G-320003').fingers).toEqual([2, 1, null, null, null, 3]); // convention 2-1-3
    expect(v('Am-x02210').fingers).toEqual([null, null, 2, 3, 1, null]);
    expect(v('D-xx0232').fingers).toEqual([null, null, null, 1, 3, 2]); // index, annulaire, majeur
    expect(v('C-x32010').fingers).toEqual([null, 3, 2, null, 1, null]);
    // mini-barré : l'index couvre les deux cordes aiguës à la case 1
    expect(v('F-xx3211').fingers).toEqual([null, null, 3, 2, 1, 1]);
    // barré complet : l'index est sur les six cordes à la case 1
    expect(v('F-133211').fingers).toEqual([1, 3, 4, 2, 1, 1]);
  });

  it('une corde à vide ne porte pas de doigt, une corde étouffée non plus', () => {
    const broken: Voicing = { ...v('Em-022000'), fingers: [1, 2, 3, null, null, null] };
    expect(validateFingers(broken).join(' ')).toContain('à vide mais doigt 1');
    const muted: Voicing = { ...v('Am-x02210'), fingers: [1, null, 2, 3, 1, null] };
    expect(validateFingers(muted).join(' ')).toContain('étouffée mais doigt 1');
  });

  it('un doigt ne peut pas tenir deux cases (sauf le barré, qui n’en tient qu’une)', () => {
    const broken: Voicing = { ...v('E-022100'), fingers: [null, 1, 1, null, null, null] }; // doigt 1 sur cases 2 et 2 : OK
    expect(validateFingers(broken).filter((e) => e.includes('cases'))).toEqual([]);
    const worse: Voicing = { ...v('E-022100'), fingers: [null, 2, 2, 2, null, null] };
    expect(validateFingers(worse).join(' ')).toContain('doigt 2 sur 2 cases');
  });

  it('chaque corde frettée porte un doigt, et la case la plus basse est tenue par l’index ou le majeur', () => {
    const missing: Voicing = { ...v('E-022100'), fingers: [null, 2, 3, null, null, null] };
    expect(validateFingers(missing).join(' ')).toContain('sans doigté');
    // forme de Mi mineur tenue avec l'annulaire et l'auriculaire : physiquement possible, mais ce n'est
    // pas comme ça qu'on l'enseigne (aucun doigt sur la case la plus basse n'est l'index ou le majeur)
    const odd: Voicing = { ...v('Em-022000'), fingers: [null, 3, 4, null, null, null] };
    expect(validateFingers(odd).join(' ')).toContain('index ou majeur attendu');
  });

  it('une corde du barré doit porter le doigt du barré à sa case', () => {
    const wrongBarre: Voicing = { ...v('Bm-x24432'), fingers: [null, 2, 3, 4, 2, 2] as Voicing['fingers'] };
    expect(validateFingers(wrongBarre).join(' ')).toContain('barré = doigt 1');
  });

  it('l’ordre de pose : barré d’abord, puis les doigts par numéro, cordes graves d’abord', () => {
    // Em : majeur (corde de La) puis annulaire (corde de Ré)
    expect(fingerSteps(v('Em-022000')).map((s) => [s.finger, s.string])).toEqual([[2, 1], [3, 2]]);
    // F barré : l'index passe en premier, et il porte le barré
    const f = fingerSteps(v('F-133211'));
    expect(f[0]).toMatchObject({ finger: 1, isBarre: true });
    // les quatre cordes tenues par l'index (barré inclus), puis majeur, annulaire, auriculaire
    expect(f.map((s) => s.finger)).toEqual([1, 1, 1, 2, 3, 4]);
    // G 2-1-3 : l'index (1) se pose avant l'annulaire (3), même sur une corde plus aiguë
    expect(fingerSteps(v('G-320003')).map((s) => s.finger)).toEqual([1, 2, 3]);
    // les rangs sont continus et commencent à zéro
    const steps = fingerSteps(v('C7-x32310'));
    expect(steps.map((s) => s.order)).toEqual(steps.map((_, i) => i));
  });

  it('les noms de doigts sont en français', () => {
    expect(FINGER_NAME['1']).toBe('index');
    expect(FINGER_NAME['4']).toBe('auriculaire');
  });
});
