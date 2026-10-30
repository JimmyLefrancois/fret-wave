import { describe, expect, it } from 'vitest';
import { VOICINGS, voicingById } from '../src/data/voicings';
import {
  CURRICULUM, allChordIds, entryOf, mainlineChordIds, palierOfVoicing, voicingFor,
} from '../src/modules/accords/curriculum';
import {
  chordCards, chordProgress, nextChord, palierStates, reviewDelayText, transitionsWith,
} from '../src/modules/accords/recommend';

describe('curriculum des accords ouverts', () => {
  it('chaque accord du parcours existe dans la base et porte un doigté', () => {
    for (const palier of CURRICULUM) {
      for (const entry of palier.entries) {
        const voicing = voicingById(entry.voicingId);
        expect(voicing, `${palier.id} → ${entry.voicingId}`).toBeDefined();
        expect(voicing!.fingers, entry.voicingId).toBeTruthy();
        // le palier du curriculum et celui de la base disent la même chose
        expect(voicing!.palier).toBe(palier.id);
      }
    }
    expect(() => voicingFor('accord-inexistant')).toThrow(/inconnu/);
  });

  it('un prérequis existe, n’est pas soi-même, et vient d’un palier antérieur ou du même', () => {
    const order = CURRICULUM.map((p) => p.id);
    for (const palier of CURRICULUM) {
      for (const entry of palier.entries) {
        for (const prereq of entry.prereq) {
          expect(entry.voicingId).not.toBe(prereq);
          const p = entryOf(prereq);
          expect(p, `prérequis inconnu : ${prereq}`).not.toBeNull();
          expect(order.indexOf(p!.palier.id)).toBeLessThanOrEqual(order.indexOf(palier.id));
        }
      }
    }
  });

  it('une transition ne relie que des accords déjà introduits à ce palier', () => {
    const order = CURRICULUM.map((p) => p.id);
    for (const palier of CURRICULUM) {
      for (const [a, b] of palier.transitions) {
        for (const id of [a, b]) {
          const e = entryOf(id);
          expect(e, `transition vers un accord inconnu : ${id}`).not.toBeNull();
          expect(order.indexOf(e!.palier.id)).toBeLessThanOrEqual(order.indexOf(palier.id));
        }
        expect(a).not.toBe(b);
      }
    }
  });

  it('les identifiants sont uniques et le parcours principal suit les paliers P1 → P4', () => {
    const ids = allChordIds();
    expect(new Set(ids).size).toBe(ids.length);
    const main = mainlineChordIds();
    expect(main[0]).toBe('Em-022000');
    expect(main).toContain('C-x32010');
    expect(main).not.toContain('E5-022xxx'); // la branche rock n'est pas le parcours principal
    expect(palierOfVoicing('G-320003')?.id).toBe('P4');
    expect(entryOf('inconnu')).toBeNull();
  });

  it('la base de voicings ne contient aucun accord de palier absent du curriculum', () => {
    const curriculumPaliers = new Set(CURRICULUM.map((p) => p.id as string));
    for (const v of VOICINGS) {
      if (!curriculumPaliers.has(v.palier)) continue; // P5-P10 : livrés plus tard
      expect(allChordIds(), `${v.id} (${v.palier})`).toContain(v.id);
    }
  });

  it('« power chords » est une branche, explicitement optionnelle', () => {
    const p2b = CURRICULUM.find((p) => p.id === 'P2b')!;
    expect(p2b.branch).toBe(true);
    expect(p2b.prof).toContain('ni le majeur ni le mineur');
  });
});

describe('recommandation du prochain accord', () => {
  const learned = (...ids: string[]) => new Set(ids);

  it('de zéro, le premier accord est Mi mineur (deux doigts, tout sonne)', () => {
    const next = nextChord(learned());
    expect(next?.voicingId).toBe('Em-022000');
    expect(next?.palier.id).toBe('P1');
    expect(next?.reason).toContain('étape P1');
  });

  it('après Em, le suivant est Em7 (+1 doigt), pas C', () => {
    expect(nextChord(learned('Em-022000'))?.voicingId).toBe('Em7-020000');
  });

  it('un accord dont le prérequis manque n’est jamais proposé', () => {
    // sans Asus2, Am (P2) reste derrière ; l'app propose la suite de P1
    const next = nextChord(learned('Em-022000'));
    expect(next?.voicingId).not.toBe('Am-x02210');
    expect(next?.voicingId).toBe('Em7-020000');
  });

  it('le parcours avance palier par palier', () => {
    const p1 = ['Em-022000', 'Em7-020000', 'Asus2-x02200', 'Am7-x02010'];
    const next = nextChord(learned(...p1));
    expect(next?.voicingId).toBe('Am-x02210');
    expect(next?.palier.id).toBe('P2');
    expect(next?.reason).toContain('ouvre l’étape P2');
  });

  it('la branche rock ne sort que si on la demande', () => {
    // P1 et P2 terminés : sans la branche, l'app passe au palier suivant (P3)
    const p1p2 = ['Em-022000', 'Em7-020000', 'Asus2-x02200', 'Am7-x02010', 'Am-x02210', 'E-022100', 'A-x02220', 'E7-020100', 'A7-x02020'];
    expect(nextChord(learned(...p1p2))?.palier.id).toBe('P3');
    // avec la branche demandée, le premier power chord devient la proposition — et il dit pourquoi
    const withBranch = nextChord(learned(...p1p2), { branch: true });
    expect(withBranch?.voicingId).toBe('E5-022xxx');
    expect(withBranch?.reason).toContain('ouvre l’étape P2b');
  });

  it('quand tout est appris, l’app ne propose rien plutôt que d’inventer', () => {
    expect(nextChord(learned(...mainlineChordIds()))).toBeNull();
  });

  it('les transitions d’un accord sont trouvées dans les deux sens', () => {
    const key = (p: [string, string]) => [...p].sort().join('>');
    const em = new Set(transitionsWith('Em-022000').map(key));
    const am = new Set(transitionsWith('Am-x02210').map(key));
    expect(em.has(['Em-022000', 'Am-x02210'].sort().join('>'))).toBe(true);
    expect(am.has(['Em-022000', 'Am-x02210'].sort().join('>'))).toBe(true);
    expect(transitionsWith('C7-x32310')).toHaveLength(1); // C7 est entré au curriculum en 4b (C → C7)
    expect(transitionsWith('triad-C-xxx553')).toEqual([]); // P9 : triades, hors parcours (phase 6)
  });

  it('les paliers savent dire où on en est, et pourquoi un suivant est plus tard', () => {
    const states = palierStates(learned());
    expect(states.find((s) => s.palier.id === 'P1')?.status).toBe('current');
    const p2 = states.find((s) => s.palier.id === 'P2')!;
    expect(p2.status).toBe('later');
    expect(p2.reason).toContain('Un ou deux doigts');
    const all = palierStates(learned(...mainlineChordIds()));
    expect(all.filter((s) => !s.palier.branch).every((s) => s.status === 'done')).toBe(true);
  });

  it('les cartes d’accord donnent un état exploitable par l’écran', () => {
    const cards = chordCards(learned('Em-022000'), new Set(['Am7-x02010']));
    const em = cards.find((c) => c.voicing.id === 'Em-022000')!;
    expect(em.status).toBe('learned');
    const am7 = cards.find((c) => c.voicing.id === 'Am7-x02010')!;
    expect(am7.status).toBe('learning');
    const am = cards.find((c) => c.voicing.id === 'Am-x02210')!;
    expect(am.status).toBe('locked');
    expect(am.missing).toEqual(['Asus2']); // le prérequis manquant est nommé
    expect(chordProgress(learned('Em-022000', 'Am-x02210'))).toEqual({ done: 2, total: mainlineChordIds().length });
  });
});

describe('échéance de révision en mots', () => {
  it('minutes, heures puis jours, et « maintenant » une fois l’échéance passée', () => {
    expect(reviewDelayText(-1)).toBe('à réviser maintenant');
    expect(reviewDelayText(10_000)).toBe('révision dans 1 min');
    expect(reviewDelayText(45 * 60_000)).toBe('révision dans 45 min');
    expect(reviewDelayText(5 * 3_600_000)).toBe('révision dans 5 h');
    expect(reviewDelayText(24 * 3_600_000)).toBe('révision dans 1 jour');
    expect(reviewDelayText(3 * 86_400_000)).toBe('révision dans 3 jours');
  });
});
