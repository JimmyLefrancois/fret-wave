/**
 * État d'une forme de gamme (MUSIC_DESIGN §3.4, §5) : **recalculé depuis le journal**, rien n'est stocké à
 * part les tentatives. Un nœud = une forme lue dans un mode (`gam:lecture:scale:system:form`), indépendante
 * de la tonique : la tonique est une preuve séparée, pour ne pas faire réviser 12 fois la même forme.
 *
 * Depuis D128, cet état ne s'affiche plus : il dit seulement à la révision si une forme est assez tenue
 * pour être rappelée dans une autre tonique (D97). Les seuils ne changent pas :
 *  - réussite = ≥ 80 % de notes justes **au premier essai** ;
 *  - « apprise » = 2 réussites sur **2 jours différents**, dont une **réussite forte** : la position
 *    entière, de mémoire ou jouée au micro ;
 *  - « maîtrisée » = apprise **et** palier de Leitner ≥ 5 **et** dernière tentative réussie.
 */
import { dayKey, isFullPosition, isProof, nodeIdOf, scoreOf, zoneOf, type Attempt } from './journal';
import { cardsFrom } from './scheduler';

export const PASS = 0.8;
/** Réussites fortes exigées pour qu'une forme de gamme soit « apprise ». */
export const SCALE_STRONG = 1;

export type NodeState = 'learning' | 'learned' | 'mastered';

export interface NodeStats {
  nodeId: string;
  scaleId: string;
  system: string;
  formIndex: number;
  /** Toniques travaillées (orthographe modèle) et zones du manche (cases 0-4, 5-9, 10-14 …). */
  tonics: string[];
  zones: number[];
  state: NodeState;
}

/** Série de lecture d'une forme (trous ou rappel), pas une impro, un accord ou une séquence. */
function isFormSeries(a: Attempt): boolean {
  return a.module !== 'accords' && (a.kind === 'holes' || a.kind === 'recall');
}

/** Réussite **forte** : ≥ 80 %, position entière, de mémoire (N3) ou jouée au micro (N2). */
export function isStrongSuccess(a: Attempt): boolean {
  if (!isFormSeries(a) || !isProof(a) || (scoreOf(a) ?? 0) < PASS || !isFullPosition(a)) return false;
  return a.level >= 3 || a.mic === true;
}

export function stateOf(opts: {
  successes: number; successDays: number; strongSuccesses: number; last: number; box: number | null;
}): NodeState {
  const learned = opts.successes >= 2 && opts.successDays >= 2 && opts.strongSuccesses >= SCALE_STRONG;
  if (!learned) return 'learning';
  return opts.box !== null && opts.box >= 5 && opts.last >= PASS ? 'mastered' : 'learned';
}

/** Une entrée par forme de gamme vérifiée. Les nœuds d'accord et d'impro de l'ancien journal sont ignorés. */
export function summarizeNodes(attempts: readonly Attempt[]): NodeStats[] {
  const cards = new Map(cardsFrom(attempts).map((c) => [c.nodeId, c] as const));
  const groups = new Map<string, Attempt[]>();
  for (const a of attempts) {
    if (!isProof(a) || !isFormSeries(a)) continue;
    const id = nodeIdOf(a);
    if (!id.startsWith('gam:lecture:')) continue;
    const list = groups.get(id);
    if (list) list.push(a);
    else groups.set(id, [a]);
  }
  return [...groups].map(([nodeId, list]) => {
    const sorted = [...list].sort((x, y) => x.ts - y.ts);
    const successes = sorted.filter((a) => (scoreOf(a) ?? 0) >= PASS);
    const first = sorted[0]!;
    return {
      nodeId,
      scaleId: first.scaleId,
      system: first.system,
      formIndex: first.formIndex,
      tonics: [...new Set(sorted.map((a) => a.tonic))],
      zones: [...new Set(sorted.map((a) => zoneOf(a.fretMin)))].sort((x, y) => x - y),
      state: stateOf({
        successes: successes.length,
        successDays: new Set(successes.map((a) => dayKey(a.ts))).size,
        strongSuccesses: sorted.filter(isStrongSuccess).length,
        last: scoreOf(sorted[sorted.length - 1]!) ?? 0,
        box: cards.get(nodeId)?.box ?? null,
      }),
    };
  });
}
