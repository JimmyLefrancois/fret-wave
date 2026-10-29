/**
 * Rapport chronologique d'une simulation (développement seulement) : jour après jour, ce que l'app
 * montrerait à l'élève virtuel (objectif du jour, XP, série, révisions dues, action proposée par
 * l'accueil, état de chaque forme), puis des **constats** repérés automatiquement pour nourrir l'UX.
 *
 * Tout passe par les fonctions de l'app : le rapport n'a aucune règle à lui.
 */
import {
  DAILY_XP_CAP, cardsFrom, dayKey, dueCards, isProof, streak, stringWeakness, summarizeDay, summarizeNodes,
  xpForAttempt, type Attempt, type NodeState,
} from '../core/progress';
import { dailyActivity, dayGoalText, hubPlan, reviewSummary } from '../app/hubPlan';
import { simulate, type Persona, type SimOptions } from './simulate';

/** Objectif du jour de l'accueil (`DAILY_GOAL` de `HubPage.tsx`, qui ne s'importe pas hors navigateur). */
export const SIM_DAILY_GOAL = 3;

export interface DayRow {
  day: number;
  date: string;
  practiced: boolean;
  /** Tentatives écrites ce jour-là, par genre (« holes ×3, recall ×2 »). */
  kinds: string;
  exercises: number;
  goal: string;
  /** XP gagné avant plafond, et après. */
  xpRaw: number;
  xp: number;
  streak: number;
  /** Cartes de gammes dues en fin de journée (ce que l'accueil montre le lendemain matin). */
  due: number;
  /** Parmi elles, celles déjà jouées le jour même (palier 1 = 10 min : elles reviennent le soir). */
  dueToday: number;
  /** Action principale de l'accueil en fin de journée (23 h 59 : ce que voit l'élève après sa séance). */
  hero: string;
  /** État de chaque forme, dans l'ordre du manche : `·` disponible, `a` en cours, `A` apprise, `M` maîtrisée, `M+` vitesse vérifiée. */
  forms: string[];
  /** Essais « refais après avoir regardé » (exclus de la preuve). */
  retries: number;
}

export interface SimReport {
  persona: Persona;
  rows: DayRow[];
  formLabels: string[];
  findings: string[];
  journal: Attempt[];
}

const STATE_MARK: Readonly<Record<NodeState, string>> = { available: '·', learning: 'a', learned: 'A', mastered: 'M' };

export function simReport(persona: Persona, opts: Omit<SimOptions, 'onDay'> = {}): SimReport {
  const rows: DayRow[] = [];
  let formOrder: number[] = [];
  const journal = simulate(persona, {
    ...opts,
    onDay: (day, dayEnd, j) => {
      const now = new Date(dayEnd);
      const key = dayKey(dayEnd);
      const mine = j.filter((a) => dayKey(a.ts) === key);
      const xpRaw = mine.reduce((s, a) => s + xpForAttempt(a), 0);
      const nodes = summarizeNodes(j).filter((n) => n.nodeId.startsWith('gam:lecture:'));
      if (!formOrder.length) formOrder = [...new Set(mine.filter((a) => a.kind !== 'listen').map((a) => a.formIndex))];
      for (const n of nodes) if (!formOrder.includes(n.formIndex)) formOrder.push(n.formIndex);
      // même filtre que l'accueil (HubPage) : tout ce qui n'est pas un accord, impro comprise
      const due = dueCards(cardsFrom(j), dayEnd).filter((c) => !c.nodeId.startsWith('acc:'));
      const plan = hubPlan(j, due, new Set(), null);
      const counts = new Map<string, number>();
      for (const a of mine) counts.set(a.kind, (counts.get(a.kind) ?? 0) + 1);
      const day0 = summarizeDay(j, now);
      rows.push({
        day, date: key, practiced: mine.length > 0,
        kinds: [...counts].map(([k, v]) => `${k} ×${v}`).join(', '),
        exercises: dailyActivity(day0),
        goal: dayGoalText(dailyActivity(day0), SIM_DAILY_GOAL).reached ? 'oui' : 'non',
        xpRaw, xp: Math.min(DAILY_XP_CAP, xpRaw),
        streak: streak(j, now).days,
        due: due.length,
        dueToday: due.filter((c) => dayKey(c.lastTs) === key).length,
        hero: plan.review
          ? `À réviser (${plan.review.count}) — ${reviewSummary(plan.review.first)}`
          : plan.resume.kind === 'start' ? 'Commencer' : 'Reprendre la gamme',
        forms: formOrder.map((f) => {
          const n = nodes.find((x) => x.formIndex === f);
          if (!n) return '·';
          return STATE_MARK[n.state] + (n.speedVerified ? '+' : '');
        }),
        retries: mine.filter((a) => a.afterReveal).length,
      });
    },
  });
  // les premiers jours ont été écrits avant de connaître toutes les formes : on complète la colonne
  for (const r of rows) while (r.forms.length < formOrder.length) r.forms.push('·');
  return { persona, rows, formLabels: formOrder.map((f) => `F${f}`), findings: findingsOf(rows, formOrder, journal), journal };
}

function firstDay(rows: readonly DayRow[], pred: (r: DayRow) => boolean): number | null {
  return rows.find(pred)?.day ?? null;
}

/** Constats repérés sur la chronologie : ce qui mérite un regard UX. */
export function findingsOf(rows: readonly DayRow[], formOrder: readonly number[], journal: readonly Attempt[]): string[] {
  const out: string[] = [];
  const start = firstDay(rows, (r) => r.practiced) ?? 0;
  const practiced = rows.filter((r) => r.practiced);
  const learned = (r: DayRow) => r.forms.some((s) => s.startsWith('A') || s.startsWith('M'));
  const l1 = firstDay(rows, learned);
  out.push(l1 === null
    ? `Aucune forme apprise en ${rows.length} jours (${practiced.length} jours de pratique).`
    : `Première forme apprise à J${l1 + 1}, après ${rows.filter((r) => r.practiced && r.day <= l1).length} jour(s) de pratique.`);
  const last = rows[rows.length - 1];
  if (last) {
    const count = (p: (s: string) => boolean) => last.forms.filter(p).length;
    out.push(`Fin : ${count((s) => s.startsWith('A'))} apprise(s), ${count((s) => s.startsWith('M'))} maîtrisée(s) `
      + `dont ${count((s) => s.endsWith('+'))} vitesse vérifiée, ${count((s) => s === 'a')} en cours, sur ${formOrder.length} forme(s) touchée(s).`);
  }
  const m1 = firstDay(rows, (r) => r.forms.some((s) => s.startsWith('M')));
  if (m1 !== null) out.push(`Première forme maîtrisée à J${m1 + 1}.`);
  const capDays = practiced.filter((r) => r.xpRaw > DAILY_XP_CAP);
  if (capDays.length) {
    const lost = capDays.reduce((s, r) => s + r.xpRaw - r.xp, 0);
    out.push(`Plafond d'XP (${DAILY_XP_CAP}) dépassé ${capDays.length} jour(s) : ${lost} XP non comptés — l'élève le voit-il ?`);
  }
  const missedGoal = practiced.filter((r) => r.goal === 'non');
  if (missedGoal.length) out.push(`${missedGoal.length} jour(s) de pratique sans objectif atteint (écoutes ou séries non vérifiées seulement ?).`);
  const maxDue = Math.max(0, ...rows.map((r) => r.due));
  const allPlayed = practiced.filter((r) => r.due > 0 && r.dueToday === r.due).length;
  if (allPlayed) out.push(`${allPlayed} soir(s) où toutes les dues ont déjà été jouées le jour même.`);
  if (maxDue) out.push(`Pic de ${maxDue} révision(s) due(s) (J${(firstDay(rows, (r) => r.due === maxDue) ?? 0) + 1}).`);
  // accueil : la même action proposée plusieurs jours de pratique d'affilée
  let run = 0; let best = 0; let bestHero = ''; let prev = '';
  for (const r of practiced) {
    const h = r.hero.replace(/\s*—.*$/, '').replace(/\(\d+\)/, '(n)');
    run = h === prev ? run + 1 : 1;
    prev = h;
    if (run > best) { best = run; bestHero = h; }
  }
  if (best >= 5) out.push(`L'accueil propose « ${bestHero} » ${best} jours de pratique d'affilée : l'élève sent-il qu'il avance ?`);
  const retries = rows.reduce((s, r) => s + r.retries, 0);
  if (retries) out.push(`${retries} rattrapage(s) après avoir revu la forme (exclus de la preuve et de l'XP).`);
  let breaks = 0;
  for (let i = 1; i < rows.length; i++) if (rows[i - 1]!.streak > 1 && rows[i]!.streak === 0) breaks++;
  if (breaks) out.push(`Série cassée ${breaks} fois.`);
  const weak = stringWeakness(journal)[0];
  if (weak && weak.attempts >= 5) out.push(`Corde la plus ratée : ${weak.string} (0 = grave), dans ${weak.attempts} série(s) vérifiée(s).`);
  const proofless = journal.filter((a) => a.correct !== null && !isProof(a)).length;
  const verified = journal.filter((a) => a.correct !== null).length;
  out.push(`${journal.length} tentatives, ${verified} vérifiées, ${proofless} sans valeur de preuve, ${start > 0 ? `début à J${start + 1}` : 'début à J1'}.`);
  return out;
}

export function reportMarkdown(r: SimReport): string {
  const head = ['J', 'date', 'genres', 'exos', 'obj.', 'XP (brut)', 'série', 'dues', 'dont jouées auj.', 'accueil, le soir', ...r.formLabels];
  const lines = [
    `## ${r.persona.label} (\`${r.persona.id}\`)`,
    '',
    r.persona.summary,
    '',
    '### Constats',
    '',
    ...r.findings.map((f) => `- ${f}`),
    '',
    '### Chronologie',
    '',
    'Formes : `·` disponible, `a` en cours, `A` apprise, `M` maîtrisée, `+` vitesse vérifiée.',
    '',
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...r.rows.map((d) => `| ${[
      d.day + 1, d.date, d.practiced ? d.kinds : '—', d.exercises, d.goal,
      d.xpRaw > d.xp ? `${d.xp} (${d.xpRaw})` : d.xp, d.streak, d.due, d.dueToday, d.hero, ...d.forms,
    ].join(' | ')} |`),
    '',
  ];
  return lines.join('\n');
}
