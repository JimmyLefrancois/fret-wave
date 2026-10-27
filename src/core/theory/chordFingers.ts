/**
 * Doigtés d'accord (phase 4a) : la dette laissée par la 1d — la rangée « doigté » du modèle était vide
 * depuis la 1b, donc l'étape « Construire un doigt à la fois » était bloquée faute de données.
 *
 * Rien n'est calculé ici : **les doigtés sont saisis** (`src/data/voicings.ts`), parce qu'une heuristique
 * se trompe dès qu'un accord admet plusieurs doigtés conventionnels (G en 2-1-3 ou 3-2-4, A en 1-2-3
 * serré ou en mini-barré). Ce module les **relit** : chaque geste est vérifié par une règle mécanique,
 * et l'ordre de pose est déduit (barré, puis index, majeur, annulaire, auriculaire — cordes graves
 * d'abord). Un doigté faux ne se voit pas à l'écran ; il se voit à la main de l'élève.
 */
import type { Finger, Voicing } from './voicings';

export interface FingerStep {
  string: number;
  fret: number;
  /**
   * Doigt numérique (1 à 4). Le pouce (`T`) n'est pas un pas de construction : il n'apparaît pas dans
   * les formes ouvertes enseignées ici.
   */
  finger: number;
  /** Rang de pose (0 = premier geste). */
  order: number;
  /** Le geste est un barré (l'index couvre plusieurs cordes d'un coup). */
  isBarre: boolean;
}

function numeric(f: Finger | null | undefined): number | null {
  return typeof f === 'number' && f > 0 ? f : null;
}

/**
 * Étapes de construction d'un accord, dans l'ordre où on les fait à l'oral :
 * le barré d'abord (il porte la forme), puis les doigts par numéro croissant, cordes graves → aiguës.
 * Un doigt posé sur deux cordes à la même case sans barré déclaré (rare) ne produit qu'une étape par
 * corde : on apprend le geste, pas la théorie du barré.
 */
export function fingerSteps(v: Voicing): FingerStep[] {
  if (!v.fingers) return [];
  const raw: Omit<FingerStep, 'order'>[] = [];
  v.frets.forEach((fret, string) => {
    if (fret === null || fret === 0) return;
    const finger = v.fingers?.[string];
    const n = numeric(finger);
    if (n === null || finger === 'T') return;
    raw.push({ string, fret, finger: n, isBarre: v.barre?.fret === fret && v.barre.finger === finger });
  });
  raw.sort((a, b) => Number(b.isBarre) - Number(a.isBarre) || a.finger - b.finger || a.string - b.string);
  return raw.map((s, order) => ({ ...s, order }));
}

/**
 * Relecture mécanique d'un doigté. Liste des fautes (vide = doigté cohérent).
 *
 * Règles : un doigt = une case (sauf le barré, qui tient une seule case sur plusieurs cordes) ;
 * une corde à vide ou étouffée ne porte pas de doigt ; quatre doigts au plus ; le doigt posé sur la
 * case la plus basse est l'index ou le majeur (on ne commence pas une forme avec l'annulaire) ;
 * les cordes du barré sont bien au doigt du barré.
 */
export function validateFingers(v: Voicing): string[] {
  const errs: string[] = [];
  const tag = `${v.id} (${v.chord})`;
  const f = v.fingers;
  if (!f) return [`${tag} : aucun doigté saisi`];
  if (f.length !== v.frets.length) return [`${tag} : ${f.length} doigtés pour ${v.frets.length} cordes`];

  v.frets.forEach((fret, s) => {
    const finger = f[s] ?? null;
    if (fret === null || fret === 0) {
      if (numeric(finger) !== null) errs.push(`${tag} : corde ${s} ${fret === null ? 'étouffée' : 'à vide'} mais doigt ${String(finger)}`);
      return;
    }
    if (numeric(finger) === null && finger !== 'T') errs.push(`${tag} : corde ${s} case ${fret} sans doigté`);
  });

  // un doigt = une case (le barré ne change rien : sa case est la sienne sur plusieurs cordes)
  const byFinger = new Map<number, Set<number>>();
  v.frets.forEach((fret, s) => {
    const n = numeric(f[s] ?? null);
    if (fret === null || fret === 0 || n === null) return;
    const set = byFinger.get(n) ?? new Set<number>();
    set.add(fret);
    byFinger.set(n, set);
  });
  for (const [finger, frets] of byFinger) {
    if (frets.size > 1) errs.push(`${tag} : doigt ${finger} sur ${frets.size} cases (${[...frets].join(', ')})`);
  }
  if (byFinger.size > 4) errs.push(`${tag} : ${byFinger.size} doigts (4 au plus)`);

  // le doigt de la case la plus basse est l'index ou le majeur
  const fretted = v.frets.flatMap((fret, s) => (fret !== null && fret > 0 ? [{ s, fret, finger: numeric(f[s] ?? null) }] : []));
  if (fretted.length > 0) {
    const low = Math.min(...fretted.map((x) => x.fret));
    const lowFingers = fretted.filter((x) => x.fret === low).map((x) => x.finger);
    if (!lowFingers.some((n) => n === 1 || n === 2)) {
      errs.push(`${tag} : la case ${low} est tenue par ${lowFingers.map((n) => `doigt ${String(n)}`).join(', ')} (index ou majeur attendu)`);
    }
  }

  // cordes du barré : au doigt du barré, à sa case
  if (v.barre) {
    const b = v.barre;
    const from = Math.min(b.fromString, b.toString);
    const to = Math.max(b.fromString, b.toString);
    for (let s = from; s <= to; s++) {
      if (v.frets[s] === b.fret && numeric(f[s] ?? null) !== numeric(b.finger)) {
        errs.push(`${tag} : corde ${s} au barré case ${b.fret} mais doigt ${String(f[s])} (barré = doigt ${String(b.finger)})`);
      }
    }
  }
  return errs;
}

/** Nom français d'un doigt (affichage pédagogique). */
export const FINGER_NAME: Readonly<Record<string, string>> = {
  1: 'index',
  2: 'majeur',
  3: 'annulaire',
  4: 'auriculaire',
  T: 'pouce',
};
