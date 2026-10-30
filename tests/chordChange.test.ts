import { describe, expect, it } from 'vitest';
import { clearLessonStep, pendingLessonStep, requestLessonStep } from '../src/app/chordSession';
import { LESSON_STEPS, parseLessonStep } from '../src/modules/accords/lesson';
import { CHANGE_MISTAKES, CHANGE_RULES, CHANGE_STEPS, CHANGE_WHOLE_SHAPE } from '../src/modules/accords/changeGuide';

describe('ouvrir la leçon sur une étape (D106)', () => {
  it('une étape connue est retenue, tout le reste ouvre Découvrir', () => {
    expect(parseLessonStep('enchainer')).toBe('enchainer');
    expect(parseLessonStep(null)).toBe('decouvrir');
    expect(parseLessonStep('nimporte')).toBe('decouvrir');
    for (const s of LESSON_STEPS) expect(parseLessonStep(s.id)).toBe(s.id);
  });

  it('la demande se lit sans se consommer, puis s’efface une fois servie', () => {
    clearLessonStep();
    expect(pendingLessonStep()).toBeNull();
    requestLessonStep('enchainer');
    // le mode strict de React appelle l'initialiseur deux fois : les deux lectures voient la demande
    expect(pendingLessonStep()).toBe('enchainer');
    expect(pendingLessonStep()).toBe('enchainer');
    clearLessonStep();
    expect(parseLessonStep(pendingLessonStep())).toBe('decouvrir');
  });
});

describe('bloc « Changer d’accord »', () => {
  it('trois règles visibles, une méthode en six étapes dont la dernière ajoute la main droite', () => {
    expect(CHANGE_RULES).toHaveLength(3);
    expect(CHANGE_STEPS).toHaveLength(6);
    expect(CHANGE_STEPS[CHANGE_STEPS.length - 1]).toMatch(/main droite/);
    expect(CHANGE_WHOLE_SHAPE.length).toBeGreaterThan(0);
    expect(CHANGE_MISTAKES.length).toBeGreaterThan(0);
  });
});
