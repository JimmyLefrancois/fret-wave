/**
 * Simulateur de progression (développement seulement) : un **élève virtuel** suit le parcours du module
 * Gammes jour après jour et écrit des tentatives réalistes dans un journal. Comme tout (maîtrise, Leitner,
 * XP, série, badges, hub) se recalcule depuis le journal, on observe la réaction de l'app sans jouer des
 * semaines.
 *
 * Le modèle de l'élève est volontairement simple et documenté ici : c'est un outil d'observation, pas une
 * règle de l'app. Aucune règle musicale, barème ni seuil n'est défini ici : on appelle ceux de l'app.
 */
import {
  DAY, dayKey, hash32, newAttemptId, nodeIdOf, summarizeNodes,
  PASS, type Attempt, type AttemptKind, type AttemptLevel,
} from '../core/progress';
import { generatePositions, TUNINGS, type NoteName, type Position, type PositionSystem } from '../core/theory';
import { SEQUENCE_PATTERNS } from '../core/tab/generators';
import { mulberry32, HOLES_RATIO, MIN_HOLES } from '../modules/gammes/exercise';
import { capStep, type FormStep } from '../modules/gammes/curriculum';
import { dailySession } from '../app/hubPlan';

const HOUR = 3_600_000;

/** Fin fixe des rapports et des invariants (29 oct. 2026, 19 h) : un rapport stable d'un jour à l'autre. */
export const FIXED_END = new Date(2026, 9, 29, 19, 0).getTime();

export interface Persona {
  id: string;
  label: string;
  /** Ce que la persona met à l'épreuve dans l'app. */
  summary: string;
  /** Durée simulée par défaut (jours). */
  days: number;
  /** L'élève pratique-t-il ce jour-là ? (`day` part de 0, `date` est son minuit local) */
  practices(day: number, date: Date, rng: () => number): boolean;
  /** Séries de travail par jour de pratique, révisions dues non comprises. */
  sessions: number;
  /** Joue au micro (sinon au pavé : vérifié, mais jamais une réussite forte au niveau 2). */
  mic: boolean;
  /** Précision de départ sur une forme jamais vue (0-1). */
  skill: number;
  /** Gain de précision par série déjà jouée sur la forme (croît en racine). */
  learnRate: number;
  /** Perte de précision par jour sans toucher la forme. */
  forgetPerDay: number;
  /** Corde fragile (0 = la plus grave, 4 = Si) : cases manquées plus souvent. */
  weakString?: number;
  /** Travaille la vitesse : grille au rappel, séquences, séries à l'aveugle. */
  speed?: boolean;
  /** Improvise sur les formes apprises. */
  impro?: boolean;
  /** Fait les révisions dues proposées par l'accueil. */
  reviews: boolean;
  scaleId: string;
  tonic: NoteName;
  system: PositionSystem;
}

const weekdays = (_day: number, _date: Date, rng: () => number) => rng() < 6 / 7;

export const PERSONAS: readonly Persona[] = [
  {
    id: 'regulier', label: 'Débutant régulier',
    summary: 'Six jours sur sept, au micro, fait ses révisions : le parcours nominal.',
    days: 30, practices: weekdays, sessions: 3, mic: true, skill: 0.55, learnRate: 0.08, forgetPerDay: 0.01,
    reviews: true, scaleId: 'pentatonic-minor', tonic: 'A', system: 'boxes',
  },
  {
    id: 'decrocheur', label: 'Décrocheur',
    summary: 'Dix jours réguliers, douze jours de pause, puis reprise : régression et cartes en retard.',
    days: 30, practices: (d, _date, rng) => (d < 10 || d >= 22) && rng() < 0.9, sessions: 3, mic: true,
    skill: 0.55, learnRate: 0.08, forgetPerDay: 0.025, reviews: true,
    scaleId: 'pentatonic-minor', tonic: 'A', system: 'boxes',
  },
  {
    id: 'si-fragile', label: 'Corde de Si fragile',
    summary: 'Régulier, mais rate souvent la corde de Si : diagnostic par corde et formes qui stagnent.',
    days: 30, practices: weekdays, sessions: 3, mic: true, skill: 0.5, learnRate: 0.06, forgetPerDay: 0.01,
    weakString: 4, reviews: true, scaleId: 'pentatonic-minor', tonic: 'A', system: 'boxes',
  },
  {
    id: 'sans-micro', label: 'Sans micro',
    summary: 'Tout au pavé : seul le rappel de mémoire (N3) peut rendre une forme « apprise ».',
    days: 30, practices: weekdays, sessions: 3, mic: false, skill: 0.55, learnRate: 0.08, forgetPerDay: 0.01,
    reviews: true, scaleId: 'pentatonic-minor', tonic: 'A', system: 'boxes',
  },
  {
    id: 'week-end', label: 'Joueur du week-end',
    summary: 'Samedi et dimanche seulement, sans révisions : série, objectif du jour et cartes en retard.',
    days: 42, practices: (_d, date) => date.getDay() === 0 || date.getDay() === 6, sessions: 5, mic: true, skill: 0.55, learnRate: 0.08,
    forgetPerDay: 0.015, reviews: false, scaleId: 'pentatonic-minor', tonic: 'A', system: 'boxes',
  },
  {
    id: 'avance', label: 'Avancé micro et grille',
    summary: 'Tous les jours, grille, séquences, aveugle, impro : vers « maîtrisée » et la vitesse vérifiée.',
    days: 45, practices: () => true, sessions: 4, mic: true, skill: 0.78, learnRate: 0.06, forgetPerDay: 0.005,
    speed: true, impro: true, reviews: true, scaleId: 'pentatonic-minor', tonic: 'A', system: 'boxes',
  },
];

export function getPersona(id: string): Persona | null {
  return PERSONAS.find((p) => p.id === id) ?? null;
}

export interface SimOptions {
  /** Jours simulés (défaut : ceux de la persona). */
  days?: number;
  /** Instant de fin : le dernier jour simulé est celui-ci (défaut : maintenant). */
  end?: number;
  seed?: number;
  /**
   * Appelé à la fin de chaque jour simulé, pratiqué ou non (rapport chronologique), avec la gamme que
   * l'élève travaille ce soir-là (elle change quand il relève un défi).
   */
  onDay?: (day: number, dayEnd: number, journal: readonly Attempt[], sel: SimSelection) => void;
}

/** La gamme travaillée : ce que l'accueil a en sélection. */
export interface SimSelection { scaleId: string; tonic: NoteName; system: PositionSystem; tuningId: string }

/** Une forme jouée, dans une gamme et une tonique, avec son nœud de lecture. */
interface Form {
  position: Position;
  formIndex: number;
  node: string;
  notes: number;
  scaleId: string;
  tonic: NoteName;
  system: PositionSystem;
}

function formsOf(sel: { scaleId: string; tonic: NoteName; system: PositionSystem }): Form[] {
  const tuning = TUNINGS.standard!;
  return generatePositions(sel.scaleId, sel.tonic, tuning, sel.system).map((position) => {
    const formIndex = position.formIndex ?? position.index;
    return {
      position, formIndex, scaleId: sel.scaleId, tonic: sel.tonic, system: sel.system,
      node: nodeIdOf({ scaleId: sel.scaleId, system: sel.system, formIndex }),
      notes: position.notes.length,
    };
  });
}

/** La forme qu'ouvre une étape (ou une cible de révision) : sa gamme, sa tonique, sa position. */
function formAt(sel: { scaleId: string; tonic: string; system: PositionSystem; positionIndex: number }): Form | null {
  return formsOf({ scaleId: sel.scaleId, tonic: sel.tonic as NoteName, system: sel.system })[sel.positionIndex] ?? null;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Séries de vitesse de l'avancé sur une forme déjà apprise (le reste du parcours suit la séance du jour). */
type Step = 'listen' | 'n2-full' | 'n3' | 'n3-grid' | 'blind' | 'sequence' | 'impro';

function speedStep(p: Persona, rng: () => number): Step {
  const r = rng();
  if (p.impro && r < 0.2) return 'impro';
  if (r < 0.45) return 'sequence';
  if (r < 0.6) return 'blind';
  return 'n3-grid';
}

/** Ce que l'élève joue pour une étape de la séance : écouter, trous sur la position entière (D91), de mémoire. */
function stepOf(s: FormStep): Step {
  return s.level === 1 ? 'listen' : s.level === 2 ? 'n2-full' : 'n3';
}

/**
 * Rejoue `persona` sur `days` jours et rend le journal produit (trié, déterministe pour une graine).
 * Chaque jour pratiqué, l'élève suit la **séance du jour** de l'accueil (D98) : les révisions dues (à
 * froid, rattrapage sous 80 %), puis l'étape suivante, puis le défi (il change de gamme ou de tonique).
 * L'avancé ajoute des séries de vitesse sur les formes apprises.
 */
export function simulate(persona: Persona, opts: SimOptions = {}): Attempt[] {
  const days = opts.days ?? persona.days;
  const end = opts.end ?? Date.now();
  const endDay = new Date(end);
  // minuit local de chaque jour, en calendrier : un jour de changement d'heure ne dure pas 24 h
  const midnight = (day: number) => new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() - (days - 1) + day).getTime();
  const rng = mulberry32((opts.seed ?? 1) ^ hash32(persona.id));
  let sel: SimSelection = { scaleId: persona.scaleId, tonic: persona.tonic, system: persona.system, tuningId: 'standard' };
  const journal: Attempt[] = [];
  // vitesse atteinte en séquence, par forme (le palier monte avec la pratique)
  const bpm = new Map<number, number>();
  let gridNpm = 100;

  const skillOn = (form: Form, t: number, level: AttemptLevel): number => {
    const mine = journal.filter((a) => a.formIndex === form.formIndex && a.scaleId === form.scaleId
      && a.system === form.system && a.correct !== null);
    const last = mine.length ? mine[mine.length - 1]!.ts : t;
    const idle = (t - last) / DAY;
    const levelCost = level >= 3 ? 0.08 : 0;
    const noise = (rng() - 0.5) * 0.16;
    return clamp01(persona.skill + persona.learnRate * Math.sqrt(mine.length) - persona.forgetPerDay * idle - levelCost + noise);
  };

  const push = (a: Omit<Attempt, 'id' | 'scaleId' | 'tonic' | 'tuningId' | 'system' | 'positionId' | 'fretMin'>, form: Form): Attempt => {
    const full: Attempt = {
      id: '', scaleId: form.scaleId, tonic: form.tonic, tuningId: 'standard', system: form.system,
      positionId: form.position.id, fretMin: form.position.fretMin, ...a,
    };
    full.id = newAttemptId(full.ts, nodeIdOf(full), journal.length);
    journal.push(full);
    // dernière tonique jouée par forme (une forme de lecture ; la vitesse la rejoue dans cette tonique)
    if (full.kind === 'holes' || full.kind === 'recall') lastByNode.set(nodeIdOf(full), full);
    return full;
  };
  const lastByNode = new Map<string, Attempt>();

  /** Une série de lecture (trous N2 ou rappel N3) ; rend sa précision. */
  const series = (form: Form, t: number, o: {
    level: 2 | 3; segment: 'strings3' | 'updown'; afterReveal?: boolean; grid?: number; blind?: boolean; boost?: number;
  }): number => {
    const full = o.segment === 'updown';
    const notes = full ? 2 * form.notes - 1 : Math.ceil(form.notes / 2);
    const total = o.level >= 3 ? notes : Math.max(MIN_HOLES, Math.round(notes * HOLES_RATIO));
    let acc = skillOn(form, t, o.level) + (o.boost ?? 0);
    const weak = persona.weakString;
    const weakHit = weak !== undefined && (full || weak < 3) && rng() < 0.7;
    if (weakHit) acc -= 0.12;
    if (o.grid) acc -= Math.max(0, (o.grid - gridNpm) / 400);
    acc = clamp01(acc);
    const correct = Math.round(acc * total);
    const misses = new Set<number>();
    if (weakHit && correct < total) misses.add(weak!);
    for (let i = misses.size; i < Math.min(3, total - correct); i++) misses.add(Math.floor(rng() * (full ? 6 : 3)));
    const tempoOk = o.grid !== undefined && correct / total >= 0.9 && rng() < 0.8;
    push({
      ts: t, kind: o.level >= 3 ? 'recall' : 'holes', formIndex: form.formIndex, level: o.level,
      strings: full ? 6 : 3, correct, total, seconds: Math.round(total * (o.level >= 3 ? 2.5 : 4)),
      missedStrings: [...misses], tempoOk,
      ...(o.afterReveal ? { afterReveal: true as const } : {}),
      ...(persona.mic || o.blind ? { mic: true as const } : {}),
      ...(full ? { fullPosition: true as const } : {}),
      ...(o.grid ? { gridNpm: o.grid } : {}),
      ...(o.blind ? { blind: true as const } : {}),
    }, form);
    if (o.grid && tempoOk) gridNpm = Math.min(200, gridNpm + 8);
    return correct / total;
  };

  const play = (step: Step, form: Form, t: number): number => {
    switch (step) {
      case 'listen':
        push({
          ts: t, kind: 'listen', formIndex: form.formIndex, level: 1, strings: 6, correct: null, total: null,
          seconds: 40, missedStrings: [], tempoOk: false,
        }, form);
        return 40;
      case 'n2-full': series(form, t, { level: 2, segment: 'updown' }); return 90;
      case 'n3': series(form, t, { level: 3, segment: 'updown' }); return 90;
      case 'n3-grid': series(form, t, { level: 3, segment: 'updown', grid: gridNpm }); return 90;
      case 'blind': series(form, t, { level: 3, segment: 'updown', grid: gridNpm, blind: true }); return 90;
      case 'sequence': {
        const cur = bpm.get(form.formIndex) ?? 60;
        const acc = skillOn(form, t, 2);
        const best = acc >= 0.85 ? cur : undefined;
        if (best !== undefined) bpm.set(form.formIndex, Math.min(160, cur + 6));
        const total = 40;
        push({
          ts: t, kind: 'sequence' as AttemptKind, formIndex: form.formIndex, level: 4, strings: 6,
          correct: persona.mic ? Math.round(acc * total) : null, total: persona.mic ? total : null,
          seconds: 180, missedStrings: [], tempoOk: best !== undefined,
          pattern: SEQUENCE_PATTERNS[Math.floor(rng() * SEQUENCE_PATTERNS.length)]!, bpmStart: cur,
          ...(best !== undefined && persona.mic ? { bpmBest: best } : {}),
          passes: 4, fullPosition: true, ...(persona.mic ? { mic: true as const } : {}),
        }, form);
        return 180;
      }
      case 'impro': {
        const notes = 30 + Math.floor(rng() * 30);
        push({
          ts: t, kind: 'impro', formIndex: form.formIndex, level: 5, strings: 6,
          correct: Math.round(notes * clamp01(0.4 + rng() * 0.4)), total: notes,
          seconds: 120, missedStrings: [], tempoOk: rng() < 0.6,
        }, form);
        return 120;
      }
    }
  };

  for (let day = 0; day < days; day++) {
    const dayStart = midnight(day);
    if (persona.practices(day, new Date(dayStart), rng)) {
      let t = dayStart + (17 + Math.floor(rng() * 4)) * HOUR + Math.floor(rng() * 60) * 60_000;
      const gap = () => { t += (1 + Math.floor(rng() * 3)) * 60_000; };

      // 1. révisions de la séance du jour (rappel à froid, position entière) ; un échec ouvre « regarde, puis refais »
      if (persona.reviews) {
        for (const target of dailySession(journal, t, sel).review) {
          const form = formAt(target.selection);
          if (!form) continue;
          const acc = series(form, t, { level: 3, segment: 'updown' });
          t += 90_000; gap();
          if (acc < PASS) {
            series(form, t, { level: 3, segment: 'updown', afterReveal: true, boost: 0.2 });
            t += 90_000; gap();
          }
        }
      }

      // 2. séries de travail : l'étape suivante de la séance, ou le défi ; l'avancé mêle de la vitesse
      for (let s = 0; s < persona.sessions; s++) {
        // la vitesse se travaille sur toutes les formes apprises, pas seulement celles de la gamme en cours
        // (sinon chaque défi remettait le compteur à zéro : constat 32)
        const learned: Form[] = [];
        for (const n of summarizeNodes(journal)) {
          if (!n.nodeId.startsWith('gam:lecture:') || (n.state !== 'learned' && n.state !== 'mastered')) continue;
          const last = lastByNode.get(n.nodeId);
          const f = last ? formsOf({ scaleId: n.scaleId, tonic: last.tonic, system: n.system as PositionSystem }).find((x) => x.formIndex === n.formIndex) : null;
          if (f) learned.push(f);
        }
        let session = dailySession(journal, t, sel);
        if (persona.speed && learned.length > 0 && (rng() < 0.4 || (!session.next && !session.cap))) {
          t += play(speedStep(persona, rng), learned[Math.floor(rng() * learned.length)]!, t) * 1000; gap();
          continue;
        }
        // un défi sur une autre gamme : l'élève la sélectionne, la séance repart de sa position 1
        if (!session.next && session.cap?.kind === 'scale') {
          sel = { scaleId: session.cap.scaleId, tonic: session.cap.tonic, system: session.cap.system, tuningId: 'standard' };
          session = dailySession(journal, t, sel);
        }
        const step = session.next ?? (session.cap ? capStep(session.cap) : null);
        // « reviens demain » : la séance est faite
        if (!step) break;
        const form = formAt(step.selection);
        if (!form) break;
        // même dessin ailleurs (2ᵉ tonique, transposition) : l'élève le joue de mémoire
        const kind: Step = session.cap && !session.next ? 'n3' : stepOf(step);
        t += play(kind, form, t) * 1000; gap();
        // l'écoute ouvre la forme : la série qui suit est le premier essai du jour
        if (kind === 'listen') {
          const after = dailySession(journal, t, sel).next;
          const f = after ? formAt(after.selection) : null;
          if (after && f && after.level > 1) { t += play(stepOf(after), f, t) * 1000; gap(); }
        }
      }
    }
    // le dernier jour s'arrête à `end` : charger une persona à 19 h n'écrit pas les séries de 20 h
    opts.onDay?.(day, midnight(day + 1) - 1, day === days - 1 ? journal.filter((x) => x.ts <= end) : journal, sel);
  }
  return journal.filter((x) => x.ts <= end);
}

/** Jours distincts où le journal a une tentative (contrôle rapide d'une simulation). */
export function activeDays(journal: readonly Attempt[]): number {
  return new Set(journal.map((a) => dayKey(a.ts))).size;
}
