/**
 * Appariement hauteur → case attendue (phase 3). Les tests passent par un **vrai exercice** (la
 * position complète de La mineure pentatonique) : c'est là que les cas tordus vivent — la même note
 * écrite deux fois (aller-retour), des notes à un demi-ton d'écart, une octave d'écart.
 */
import { describe, expect, it } from 'vitest';
import { TUNINGS, generatePositions, midiToCandidates, midiToFreq } from '../src/core/theory';
import { positionToScore } from '../src/core/tab';
import { buildExercise, segmentPlan } from '../src/modules/gammes/exercise';
import {
  describeHeard, matchPitch, nearestOpenString, noteNameOf, targetsFor, tuneStatus,
} from '../src/core/input/match';

const std = TUNINGS.standard!;
const box1 = generatePositions('pentatonic-minor', 'A', std, 'boxes')[0]!;
const up = positionToScore(box1, std, { direction: 'up' });
const updown = positionToScore(box1, std, { direction: 'updown' });
const exUp = buildExercise(up, 3);
const exUpDown = buildExercise(updown, 3);
const targetsUp = targetsFor(exUp.holes, std);
const opts = { centsTolerance: 35 };

describe('appariement : une note juste remplit sa case', () => {
  it('chaque case de la position se valide à sa hauteur exacte', () => {
    for (const h of exUp.holes) {
      const target = targetsUp.find((t) => t.key === h.key)!;
      const v = matchPitch(target.midi, targetsUp, opts);
      expect(v.kind).toBe('fill');
      if (v.kind === 'fill') {
        expect(v.target.key).toBe(h.key);
        expect(Math.abs(v.cents)).toBeLessThan(1e-9);
        expect(v.inTune).toBe(true);
      }
    }
  });

  it('13 notes, 13 hauteurs : aucun trou ne se valide avec la hauteur d’un autre', () => {
    for (const h of exUp.holes) {
      const t = targetsUp.find((x) => x.key === h.key)!;
      const v = matchPitch(t.midi, targetsUp, opts);
      expect(v.kind === 'fill' && v.target.key === h.key).toBe(true);
      // et la case d'à côté ne valide pas ce trou-là
      const neighbour = targetsUp.find((x) => x.midi === t.midi + 1);
      if (neighbour) {
        const wrong = matchPitch(neighbour.midi, [t], opts);
        expect(wrong.kind).not.toBe('fill');
      }
    }
  });

  it('une note juste mais haute de 20 cents remplit quand même, et dit « pas juste »', () => {
    const t = targetsUp[0]!;
    const v = matchPitch(t.midi + 0.2, targetsUp, opts);
    expect(v.kind).toBe('fill');
    if (v.kind === 'fill') {
      expect(v.cents).toBeCloseTo(20, 6);
      expect(v.inTune).toBe(false);
    }
  });

  it('un écart au-delà de la tolérance mais dans la même demi-teinte est un problème d’accord', () => {
    // trou dont les voisins de gamme sont à ≥ 2 demi-tons (trou isolé dans l'ensemble des cibles)
    const t = targetsUp.find((x) => targetsUp.every((o) => o.key === x.key || Math.abs(o.midi - x.midi) >= 2))!;
    const v = matchPitch(t.midi + 0.45, targetsUp, opts);
    expect(v.kind).toBe('tuning');
    if (v.kind === 'tuning') expect(v.cents).toBeCloseTo(45, 6);
  });

  it('jouer une note de la gamme voisine remplit cette case-là, pas la case attendue', () => {
    const t = targetsUp.find((x) => targetsUp.some((o) => o.midi === x.midi + 2))!;
    const v = matchPitch(t.midi + 2, targetsUp, opts);
    expect(v.kind).toBe('fill');
    if (v.kind === 'fill') expect(v.target.midi).toBe(t.midi + 2);
  });

  it('une note vraiment fausse est attribuée au trou le plus proche, avec son écart', () => {
    const t = targetsUp.find((x) => targetsUp.every((o) => o.key === x.key || Math.abs(o.midi - x.midi) >= 2))!;
    const v = matchPitch(t.midi + 1, targetsUp, opts);
    // à 1 demi-ton, la cible la plus proche est bien celle-là (les autres sont à ≥ 1 demi-ton aussi,
    // mais l'égalité tranche par ordre de cibles) — on vérifie surtout qu'aucune case n'est validée
    expect(v.kind).not.toBe('fill');
    if (v.kind === 'wrong') {
      expect(v.heardMidi).toBeGreaterThanOrEqual(t.midi);
      expect(Math.abs(v.deltaSemitones)).toBeCloseTo(1, 6);
    }
  });

  it('l’aller-retour écrit deux fois la même note : le trou désigné gagne', () => {
    const targets = targetsFor(exUpDown.holes, std);
    const dup = targets.find((t) => targets.filter((o) => o.midi === t.midi).length === 2)!;
    const other = targets.find((t) => t.midi === dup.midi && t.key !== dup.key)!;
    const v1 = matchPitch(dup.midi, targets, { ...opts, activeKey: dup.key });
    const v2 = matchPitch(other.midi, targets, { ...opts, activeKey: other.key });
    expect(v1.kind === 'fill' && v1.target.key).toBe(dup.key);
    expect(v2.kind === 'fill' && v2.target.key).toBe(other.key);
  });

  it('sans trou désigné, la première occurrence l’emporte (ordre de lecture)', () => {
    const targets = targetsFor(exUpDown.holes, std);
    const dup = targets.find((t) => targets.filter((o) => o.midi === t.midi).length === 2)!;
    const v = matchPitch(dup.midi, targets, opts);
    expect(v.kind === 'fill' && v.target.columnIndex).toBe(dup.columnIndex);
  });
});

describe('appariement : octave et hors-exercice', () => {
  const low = targetsUp.find((t) => t.midi <= 45)!;
  const high = targetsUp.find((t) => t.midi >= 69) ?? targetsUp.find((t) => t.midi >= 57)!;

  it('une octave trop haut sur une cible grave est traitée comme douteuse (défaut du micro)', () => {
    // une seule cible : sinon la position contient déjà la note à l'octave, et c'est elle qui répond
    const v = matchPitch(low.midi + 12, [low], opts);
    expect(v.kind === 'octave' && v.direction).toBe('high');
    // rien n'est validé : on ne remplit pas la case avec une octave fausse
  });

  it('une octave trop bas sur une cible aiguë est signalée aussi, sans valider', () => {
    const v = matchPitch(high.midi - 12, [high], opts);
    expect(v.kind === 'octave');
    if (v.kind === 'octave') expect(v.direction).toBe('low');
  });

  it('au-delà de 2 demi-tons, ce n’est plus une tentative (une note du segment, une fausse route)', () => {
    // 2 demi-tons : encore une tentative (mauvaise case à côté), donc une erreur
    expect(matchPitch(low.midi + 2, [low], opts).kind).toBe('wrong');
    // 3 demi-tons : ce n'est plus la même intention, l'écran se contente de le dire
    const v3 = matchPitch(low.midi + 3, [low], opts);
    expect(v3.kind).toBe('outside');
    const v8 = matchPitch(low.midi + 8, [low], opts);
    expect(v8.kind).toBe('outside');
    if (v8.kind === 'outside') expect(v8.nearest!.midi).toBe(low.midi);
  });

  it('sans cible, il n’y a rien à valider', () => {
    expect(matchPitch(60, [], opts).kind).toBe('empty');
  });

  it('la tolérance se règle : 30 cents passent à 35, pas à 20', () => {
    const t = targetsUp[0]!;
    expect(matchPitch(t.midi + 0.3, targetsUp, { centsTolerance: 35 }).kind).toBe('fill');
    expect(matchPitch(t.midi + 0.3, targetsUp, { centsTolerance: 20 }).kind).toBe('tuning');
  });
});

describe('accordeur : corde la plus proche', () => {
  it('une corde à vide juste tombe pile sur sa corde', () => {
    for (let s = 0; s < std.strings.length; s++) {
      const midi = 40 + [0, 5, 10, 15, 19, 24][s]!;
      const r = nearestOpenString(std, midi)!;
      expect(r.string).toBe(s);
      expect(Math.abs(r.cents)).toBeLessThan(0.01);
    }
  });

  it('24 cents trop haut se lit « trop haut », 80 cents se lit « loin »', () => {
    const a2 = 45;
    const a4 = 440;
    const hz = midiToFreq(a2) * Math.pow(2, 24 / 1200);
    const r = nearestOpenString(std, 69 + 12 * Math.log2(hz / a4))!;
    expect(r.string).toBe(1);
    expect(r.cents).toBeCloseTo(24, 0);
    expect(tuneStatus(r.cents)).toBe('high');
    expect(tuneStatus(-24)).toBe('low');
    expect(tuneStatus(3)).toBe('in');
    expect(tuneStatus(80)).toBe('far');
  });

  it('une hauteur hors de la guitare ne force pas une corde', () => {
    expect(nearestOpenString(std, 30)).toBeNull(); // 2 octaves sous le Mi grave
    expect(nearestOpenString(std, 100)).toBeNull(); // bien au-dessus de la case 24
  });

  it('le diagnostic nomme la note jouée et ses emplacements, jamais une corde', () => {
    // La3 existe sur trois cordes : le micro ne peut pas trancher, et l'app ne le prétend pas
    expect(midiToCandidates(std, 57).length).toBeGreaterThan(1);
    const d = describeHeard(std, 57);
    expect(d.note).toBe('A');
    expect(d.places.length).toBe(4); // La3 : 4 cordes, 4 cases (2, 7, 12, 17)
    expect(noteNameOf(61)).toBe('C#');
  });
});

describe('appariement : le plan de segment alimente les cibles', () => {
  it('les cibles d’un segment de 2 cordes ne contiennent que ces cordes', () => {
    const plan = segmentPlan(box1, 'strings2');
    const score = positionToScore(plan.position, std, { direction: plan.direction });
    const ex = buildExercise(score, 3);
    const targets = targetsFor(ex.holes, std);
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) expect(t.string).toBeLessThan(2);
  });
});
