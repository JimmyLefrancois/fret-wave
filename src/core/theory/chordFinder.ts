/**
 * Doigtés calculés (D129) : toutes les formes jouables d'un accord sur le manche, pour le dictionnaire.
 *
 * On parcourt des fenêtres de 4 cases et on garde ce qu'une main peut poser : toutes les notes de l'accord
 * (voir `omissible`), la fondamentale à la basse, quatre doigts au plus,
 * un barré à l'index, une corde étouffée au plus au milieu de l'accord. Six cordes et quatre doigts ne jouent
 * pas un accord à 6 ou 7 notes : on y lâche d'abord la quinte juste, puis la neuvième, puis la tierce d'un 11. Rien n'est relu à la main :
 * `tests/chordFinder.test.ts` passe chaque forme par `validateVoicing` et `validateFingers`.
 */
import { interpretChord, type ChordInfo } from './chords';
import { fretToMidi } from './fretboard';
import { TUNINGS, type Tuning } from './tunings';
import type { Finger, Voicing } from './voicings';

const pcOf = (midi: number) => ((midi % 12) + 12) % 12;
/** Case la plus haute où commence une fenêtre : au-delà, la même forme revient une octave plus haut. */
const LAST_WINDOW = 12;
/** Une corde à vide n'accompagne que les premières cases : plus haut, juste en théorie, absurde sous la main. */
const OPEN_MAX_FRET = 5;
const SPAN = 3;

/** Doigts d'une forme, ou `null` si elle demande plus de quatre doigts. */
function fingering(frets: readonly (number | null)[]): Pick<Voicing, 'fingers' | 'barre'> | null {
  const held = frets.flatMap((f, s) => (f !== null && f > 0 ? [{ s, f }] : []));
  if (held.length === 0) return { fingers: frets.map(() => null) };
  const low = Math.min(...held.map((h) => h.f));
  const atLow = held.filter((h) => h.f === low);
  const from = atLow[0]!.s;
  const to = atLow[atLow.length - 1]!.s;
  // un barré couvre ses cordes : aucune d'elles ne peut sonner à vide ni rester étouffée
  const canBarre = atLow.length >= 2 && frets.slice(from, to + 1).every((f) => f !== null && f >= low);
  const rest = held.filter((h) => !(canBarre && h.f === low)).sort((a, b) => a.f - b.f || a.s - b.s);
  if (rest.length + (canBarre ? 1 : 0) > 4) return null;
  const fingers: (Finger | null)[] = frets.map(() => null);
  if (canBarre) for (const h of atLow) fingers[h.s] = 1;
  rest.forEach((h, i) => { fingers[h.s] = (i + (canBarre ? 2 : 1)) as Finger; });
  return { fingers, ...(canBarre ? { barre: { fret: low, fromString: from, toString: to, finger: 1 as const } } : {}) };
}

function difficulty(fingersUsed: number, barreStrings: number, lowFret: number): Voicing['difficulty'] {
  const d = fingersUsed + (barreStrings >= 5 ? 2 : barreStrings > 0 ? 1 : 0) + (lowFret > 7 ? 1 : 0);
  return Math.max(1, Math.min(5, d)) as Voicing['difficulty'];
}

/** Degrés qu'une forme peut laisser de côté, et combien au plus : ce qui définit l'accord reste. */
function omissible(info: ChordInfo): { degrees: Set<string>; max: number } {
  const iv = info.quality.intervals;
  const out = new Set<string>();
  iv.forEach((name, i) => {
    const higher = iv.some((x) => /^1[13]/.test(x));
    const major11 = iv.includes('11P') && name === '3M';
    if ((iv.length >= 4 && name === '5P') || (higher && name === '9M') || major11) out.add(info.degrees[i]!);
  });
  return { degrees: out, max: Math.max(1, iv.length - 4) };
}

interface Found { voicing: Voicing; score: number; low: number }

function evaluate(symbol: string, info: ChordInfo, frets: (number | null)[], tuning: Tuning): Found | null {
  const power = info.quality.id === 'power';
  const played = frets.flatMap((f, s) => (f === null ? [] : [s]));
  if (played.length < (power ? 2 : 4) || (power && played.length > 3)) return null;
  const inner = played[played.length - 1]! - played[0]! + 1 - played.length;
  if (inner > 1 || (power && inner > 0)) return null;
  // le doigt qui étouffe a besoin de voisines jouées : jamais une corde étouffée à côté d'une corde à vide
  if (frets.some((f, s) => f === null && s > played[0]! && s < played[played.length - 1]! && (frets[s - 1] === 0 || frets[s + 1] === 0))) return null;

  const top = Math.max(...frets.map((f) => f ?? 0));
  if (frets.includes(0) && top > OPEN_MAX_FRET) return null;
  // un power chord vit sur les cordes graves, et seule sa basse peut sonner à vide
  if (power && (played[0]! > 2 || played.slice(1).some((s) => frets[s] === 0))) return null;

  const midis = played.map((s) => fretToMidi(tuning, s, frets[s]!));
  if (pcOf(Math.min(...midis)) !== info.pitchClasses[0]) return null;
  const pcs = new Set(midis.map(pcOf));
  const missing = info.degrees.filter((_, i) => !pcs.has(info.pitchClasses[i]!));
  const canDrop = omissible(info);
  if (missing.length > canDrop.max || missing.some((d) => !canDrop.degrees.has(d))) return null;

  const fingerData = fingering(frets);
  if (!fingerData) return null;
  const held = frets.filter((f): f is number => f !== null && f > 0);
  const low = held.length ? Math.min(...held) : 0;
  const used = new Set(fingerData.fingers!.filter((f) => f !== null)).size;
  const barreStrings = fingerData.barre ? fingerData.barre.toString - fingerData.barre.fromString + 1 : 0;
  // une corde à vide sous une main qui monte sonne loin du reste : le barré passe devant
  const farOpen = top > 3 ? frets.filter((f) => f === 0).length : 0;
  const score = low + used * 2 + (6 - played.length) * 2 + inner * 5 + missing.length * 3 + (barreStrings ? 1 : 0) + farOpen * 5;
  return {
    low,
    score,
    voicing: {
      id: `gen-${symbol}-${frets.map((f) => (f === null ? 'x' : f)).join('.')}`,
      chord: symbol,
      tuningId: tuning.id,
      frets,
      family: 'ext',
      difficulty: difficulty(used, barreStrings, low),
      palier: 'calculé',
      omitted: missing,
      ...fingerData,
      ...(missing.length ? { note: `sans le degré ${missing.join(', ')}` } : {}),
    },
  };
}

/** Case la plus basse d'une forme tenue (0 si tout est à vide). */
export function lowFret(v: Pick<Voicing, 'frets'>): number {
  const held = v.frets.filter((f): f is number => f !== null && f > 0);
  return held.length ? Math.min(...held) : 0;
}

/**
 * Formes de `symbol`, de la plus basse à la plus haute du manche : **une par zone**, la meilleure à chaque
 * fois. Deux formes retenues partent à `gap` cases d'écart au moins ; sinon on obtient la même position
 * avec une corde de plus ou de moins. Cinq positions au plus, comme les cinq formes CAGED, en comptant
 * `taken` : les cases de départ des formes saisies.
 */
export function findVoicings(symbol: string, opts: { tuning?: Tuning; gap?: number; max?: number; taken?: readonly number[] } = {}): Voicing[] {
  const tuning = opts.tuning ?? TUNINGS.standard!;
  const { gap = 2, max = 5, taken = [] } = opts;
  const info = interpretChord(symbol);
  const chordPcs = new Set(info.pitchClasses);
  const found = new Map<string, Found>();

  for (let start = 0; start <= LAST_WINDOW; start++) {
    const options = tuning.strings.map((_, s) => {
      const out: (number | null)[] = [null];
      if (chordPcs.has(pcOf(fretToMidi(tuning, s, 0)))) out.push(0);
      for (let f = Math.max(1, start); f <= start + SPAN; f++) if (chordPcs.has(pcOf(fretToMidi(tuning, s, f)))) out.push(f);
      return out;
    });
    const walk = (s: number, frets: (number | null)[]) => {
      if (s === options.length) {
        const key = frets.join();
        if (!found.has(key)) {
          const r = evaluate(symbol, info, [...frets], tuning);
          if (r) found.set(key, r);
        }
        return;
      }
      for (const f of options[s]!) walk(s + 1, [...frets, f]);
    };
    walk(0, []);
  }

  const lows = [...taken];
  const kept = [...found.values()].sort((x, y) => x.score - y.score).filter((r) => {
    if (lows.length >= max || r.low > LAST_WINDOW || lows.some((l) => Math.abs(l - r.low) < gap)) return false;
    lows.push(r.low);
    return true;
  });
  return kept.sort((a, b) => a.low - b.low || a.score - b.score).map((r) => r.voicing);
}
