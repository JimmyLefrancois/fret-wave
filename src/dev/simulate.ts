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
  DAY, dayKey, dueNow, hash32, isProof, newAttemptId, nodeIdOf, scoreOf, summarizeNodes,
  PASS, type Attempt, type AttemptKind, type AttemptLevel, type NodeStats,
} from '../core/progress';
import { generatePositions, TUNINGS, type NoteName, type Position, type PositionSystem } from '../core/theory';
import { SEQUENCE_PATTERNS } from '../core/tab/generators';
import { mulberry32, HOLES_RATIO, MIN_HOLES } from '../modules/gammes/exercise';

const HOUR = 3_600_000;

export interface Persona {
  id: string;
  label: string;
  /** Ce que la persona met à l'épreuve dans l'app. */
  summary: string;
  /** Durée simulée par défaut (jours). */
  days: number;
  /** L'élève pratique-t-il ce jour-là ? (`day` part de 0) */
  practices(day: number, rng: () => number): boolean;
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

const weekdays = (_day: number, rng: () => number) => rng() < 6 / 7;

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
    days: 30, practices: (d, rng) => (d < 10 || d >= 22) && rng() < 0.9, sessions: 3, mic: true,
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
    days: 42, practices: (d) => d % 7 >= 5, sessions: 5, mic: true, skill: 0.55, learnRate: 0.08,
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
  /** Appelé à la fin de chaque jour simulé, pratiqué ou non (rapport chronologique). */
  onDay?: (day: number, dayEnd: number, journal: readonly Attempt[]) => void;
}

/** Une forme jouée dans le parcours, avec son nœud de lecture. */
interface Form {
  position: Position;
  formIndex: number;
  node: string;
  notes: number;
}

function formsOf(p: Persona): Form[] {
  const tuning = TUNINGS.standard!;
  return generatePositions(p.scaleId, p.tonic, tuning, p.system).map((position) => {
    const formIndex = position.formIndex ?? position.index;
    return {
      position, formIndex,
      node: nodeIdOf({ scaleId: p.scaleId, system: p.system, formIndex }),
      notes: position.notes.length,
    };
  });
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Ce que l'élève fait sur une forme, déduit de ce que le journal dit d'elle (le parcours N1 → N3). */
type Step = 'listen' | 'n2-segment' | 'n2-full' | 'n3' | 'n3-grid' | 'blind' | 'sequence' | 'impro';

function nextStep(p: Persona, form: Form, journal: readonly Attempt[], node: NodeStats | null, rng: () => number): Step {
  const mine = journal.filter((a) => a.formIndex === form.formIndex && a.scaleId === p.scaleId);
  if (!mine.some((a) => a.kind === 'listen')) return 'listen';
  const passed = (pred: (a: Attempt) => boolean) => mine.filter((a) => pred(a) && isProof(a) && (scoreOf(a) ?? 0) >= PASS).length;
  if (passed((a) => a.kind === 'holes' && a.fullPosition !== true) < 2) return 'n2-segment';
  if (passed((a) => a.kind === 'holes' && a.fullPosition === true) < 1) return 'n2-full';
  if (!node || node.state === 'learning' || !p.speed) return 'n3';
  const r = rng();
  if (p.impro && r < 0.2) return 'impro';
  if (r < 0.45) return 'sequence';
  if (r < 0.6) return 'blind';
  return 'n3-grid';
}

/**
 * Rejoue `persona` sur `days` jours et rend le journal produit (trié, déterministe pour une graine).
 * Chaque jour pratiqué : révisions dues d'abord (comme l'accueil les propose), puis séries sur la première
 * forme pas encore apprise, et sur les formes apprises pour la vitesse.
 */
export function simulate(persona: Persona, opts: SimOptions = {}): Attempt[] {
  const days = opts.days ?? persona.days;
  const end = opts.end ?? Date.now();
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  const start = endDay.getTime() - (days - 1) * DAY;
  const rng = mulberry32((opts.seed ?? 1) ^ hash32(persona.id));
  const forms = formsOf(persona);
  const journal: Attempt[] = [];
  // vitesse atteinte en séquence, par forme (le palier monte avec la pratique)
  const bpm = new Map<number, number>();
  let gridNpm = 100;

  const skillOn = (form: Form, t: number, level: AttemptLevel): number => {
    const mine = journal.filter((a) => a.formIndex === form.formIndex && a.correct !== null);
    const last = mine.length ? mine[mine.length - 1]!.ts : t;
    const idle = (t - last) / DAY;
    const levelCost = level >= 3 ? 0.08 : 0;
    const noise = (rng() - 0.5) * 0.16;
    return clamp01(persona.skill + persona.learnRate * Math.sqrt(mine.length) - persona.forgetPerDay * idle - levelCost + noise);
  };

  const push = (a: Omit<Attempt, 'id' | 'scaleId' | 'tonic' | 'tuningId' | 'system' | 'positionId' | 'fretMin'>, form: Form): Attempt => {
    const full: Attempt = {
      id: '', scaleId: persona.scaleId, tonic: persona.tonic, tuningId: 'standard', system: persona.system,
      positionId: form.position.id, fretMin: form.position.fretMin, ...a,
    };
    full.id = newAttemptId(full.ts, nodeIdOf(full), journal.length);
    journal.push(full);
    return full;
  };

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
      case 'n2-segment': series(form, t, { level: 2, segment: 'strings3' }); return 60;
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
          ts: t, kind: 'sequence' as AttemptKind, formIndex: form.formIndex, level: 2, strings: 6,
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
          ts: t, kind: 'impro', formIndex: form.formIndex, level: 4, strings: 6,
          correct: Math.round(notes * clamp01(0.4 + rng() * 0.4)), total: notes,
          seconds: 120, missedStrings: [], tempoOk: rng() < 0.6,
        }, form);
        return 120;
      }
    }
  };

  for (let day = 0; day < days; day++) {
    const dayStart = start + day * DAY;
    if (persona.practices(day, rng)) {
      let t = dayStart + (17 + Math.floor(rng() * 4)) * HOUR + Math.floor(rng() * 60) * 60_000;
      const gap = () => { t += (1 + Math.floor(rng() * 3)) * 60_000; };

      // 1. révisions dues (rappel à froid, position entière) ; un échec ouvre « regarde, puis refais »
      if (persona.reviews) {
        for (const card of dueNow(journal, t).filter((c) => c.nodeId.startsWith('gam:lecture:'))) {
          const form = forms.find((f) => f.node === card.nodeId);
          if (!form) continue;
          const acc = series(form, t, { level: 3, segment: 'updown' });
          t += 90_000; gap();
          if (acc < PASS) {
            series(form, t, { level: 3, segment: 'updown', afterReveal: true, boost: 0.2 });
            t += 90_000; gap();
          }
        }
      }

      // 2. séries de travail : la première forme pas encore apprise, sinon de la vitesse sur une apprise
      for (let s = 0; s < persona.sessions; s++) {
        const nodes = summarizeNodes(journal);
        const byId = new Map(nodes.map((n) => [n.nodeId, n] as const));
        const learning = forms.find((f) => {
          const st = byId.get(f.node)?.state;
          return st !== 'learned' && st !== 'mastered';
        });
        const learned = forms.filter((f) => f !== learning && byId.has(f.node));
        const useLearned = persona.speed && learned.length > 0 && (!learning || rng() < 0.4);
        const form = useLearned ? learned[Math.floor(rng() * learned.length)]! : learning ?? forms[0]!;
        const step = nextStep(persona, form, journal, byId.get(form.node) ?? null, rng);
        t += play(step, form, t) * 1000; gap();
        // l'écoute ouvre la forme : la série qui suit est le premier essai du jour
        if (step === 'listen') { t += play(nextStep(persona, form, journal, null, rng), form, t) * 1000; gap(); }
      }
    }
    opts.onDay?.(day, dayStart + DAY - 1, journal);
  }
  return journal;
}

/** Jours distincts où le journal a une tentative (contrôle rapide d'une simulation). */
export function activeDays(journal: readonly Attempt[]): number {
  return new Set(journal.map((a) => dayKey(a.ts))).size;
}
