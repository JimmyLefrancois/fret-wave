/**
 * Vérification « le son joué = la tablature » à partir des notes réellement déclenchées par le lecteur (journal
 * `TabPlayer.triggered`) : compare, corde par corde, les hauteurs jouées à celles du score (hors notes étouffées).
 */
import type { TabScore } from '../tab/model';
import type { TriggeredNote } from './tabPlayer';

export interface VerifyResult {
  ok: boolean;
  expected: number;
  played: number;
  /** Notes du score non jouées / jouées en trop (clé « corde:hauteur »). */
  missing: string[];
  extra: string[];
}

const key = (string: number, midi: number) => `${string}:${midi}`;

export function verifyTriggered(score: TabScore, triggered: readonly Pick<TriggeredNote, 'string' | 'midi'>[]): VerifyResult {
  const want = new Map<string, number>();
  for (const m of score.measures) for (const e of m.events) if (e.kind === 'notes') for (const n of e.notes) {
    if (!n.muted) want.set(key(n.string, n.midi), (want.get(key(n.string, n.midi)) ?? 0) + 1);
  }
  const got = new Map<string, number>();
  for (const t of triggered) got.set(key(t.string, t.midi), (got.get(key(t.string, t.midi)) ?? 0) + 1);
  const missing: string[] = [], extra: string[] = [];
  for (const [k, n] of want) for (let i = 0; i < n - (got.get(k) ?? 0); i++) missing.push(k);
  for (const [k, n] of got) for (let i = 0; i < n - (want.get(k) ?? 0); i++) extra.push(k);
  const sum = (m: Map<string, number>) => [...m.values()].reduce((s, x) => s + x, 0);
  return { ok: missing.length === 0 && extra.length === 0, expected: sum(want), played: sum(got), missing, extra };
}
