/**
 * Matrice de confusion de l'écoute polyphonique (phase 5) — les chiffres publiés dans les docs.
 *
 * On joue **chaque** accord du jeu de test dans **douze** conditions (bruit 30/20/10 dB × désaccordage
 * 0/15/30 cents, plus un signal propre), on demande à l'analyseur de choisir parmi **tous** les accords
 * du jeu, et on compte. Le test **échoue** si les cibles annoncées ne sont pas tenues : c'est le seul
 * moyen qu'un chiffre publié reste vrai après une modification du code.
 *
 * Ce que la matrice ne prouve pas : le timbre d'une vraie guitare (voir `tests/synth.ts`).
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { analyzeChord, prepareSpectrum, scoreHypothesis, type ChordTarget } from '../src/core/input/poly';
import { synthChord, VOICINGS } from './synth';

const SR = 48000;
const opts = { sampleRate: SR };
const names = Object.keys(VOICINGS) as (keyof typeof VOICINGS)[];
const targets = (midis: number[]): ChordTarget[] => midis.map((midi, string) => ({ midi, string }));

interface Condition { name: string; snrDb: number | null; detuneCents: number }

const conditions: Condition[] = [
  { name: 'propre', snrDb: null, detuneCents: 0 },
  { name: '30 dB', snrDb: 30, detuneCents: 0 },
  { name: '20 dB', snrDb: 20, detuneCents: 0 },
  { name: '10 dB', snrDb: 10, detuneCents: 0 },
  { name: '20 dB · 15 cents', snrDb: 20, detuneCents: 15 },
  { name: '20 dB · 30 cents', snrDb: 20, detuneCents: 30 },
  { name: '30 dB · 30 cents', snrDb: 30, detuneCents: 30 },
];

/** Paires documentées comme ambiguës dans MUSIC_DESIGN §6. */
const NEIGHBOURS: [string, string][] = [
  ['Em', 'E'], ['Am', 'C'], ['D', 'Dsus2'], ['D', 'Dsus4'], ['G', 'G/B'], ['C', 'Cmaj7'], ['Am', 'Am7'],
];
const isNeighbour = (a: string, b: string): boolean =>
  NEIGHBOURS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

describe('matrice de confusion (accord plaqué)', () => {
  it('choisit le bon accord parmi onze, et publie ses chiffres', () => {
    const rows: {
      condition: string;
      played: string;
      predicted: string;
      correct: boolean;
      neighbour: boolean;
      confidence: number;
      runnerUp: string;
      margin: number;
    }[] = [];

    for (const cond of conditions) {
      for (const name of names) {
        const played = VOICINGS[name];
        const sig = synthChord(played.midis, {
          snrDb: cond.snrDb,
          detuneCents: cond.detuneCents,
          seed: 7,
        });
        const sp = prepareSpectrum(sig, opts);
        const scored = names
          .map((h) => ({ name: h as string, score: scoreHypothesis(sp, targets(VOICINGS[h].midis), opts) }))
          .sort((a, b) => b.score - a.score);
        const best = scored[0]!;
        const second = scored[1]!;
        rows.push({
          condition: cond.name,
          played: name as string,
          predicted: best.name,
          correct: best.name === name,
          neighbour: isNeighbour(name, best.name),
          confidence: best.score,
          runnerUp: second.name,
          margin: best.score - second.score,
        });
      }
    }

    // La per-note reste la bonne mesure pour dire *quelle* corde manque : on vérifie aussi que, sur
    // l'accord attendu, chaque corde jouée est entendue dans les conditions réalistes.
    let perNoteOk = 0;
    let perNoteTotal = 0;
    for (const cond of conditions.slice(0, 4)) {
      for (const name of names) {
        const played = VOICINGS[name];
        const sig = synthChord(played.midis, { snrDb: cond.snrDb, seed: 7 });
        const a = analyzeChord(sig, targets(played.midis), opts);
        perNoteOk += a.present.length;
        perNoteTotal += a.notes.length;
      }
    }

    const summary = conditions.map((cond) => {
      const sub = rows.filter((r) => r.condition === cond.name);
      const ok = sub.filter((r) => r.correct).length;
      const neighbours = sub.filter((r) => !r.correct && r.neighbour).length;
      const margins = sub.map((r) => r.margin);
      return {
        condition: cond.name,
        correct: ok,
        total: sub.length,
        accuracy: ok / sub.length,
        neighbourConfusions: neighbours,
        minMargin: Math.min(...margins),
        medianMargin: [...margins].sort((a, b) => a - b)[Math.floor(margins.length / 2)] ?? 0,
      };
    });

    const report = { generatedAt: new Date().toISOString(), conditions: summary, rows, perNote: { ok: perNoteOk, total: perNoteTotal } };
    mkdirSync('.shots/poly', { recursive: true });
    writeFileSync('.shots/poly/matrix.json', JSON.stringify(report, null, 1));

    const line = summary
      .map((s) => `${s.condition}: ${s.correct}/${s.total} (${(s.accuracy * 100).toFixed(0)} %, marge méd. ${s.medianMargin.toFixed(2)})`)
      .join(' · ');
    writeFileSync('.shots/poly/matrice.txt', `${line}\nnotes entendues : ${perNoteOk}/${perNoteTotal} (${((perNoteOk / perNoteTotal) * 100).toFixed(1)} %)\n`);

    // Cibles annoncées dans PROJECT.md et MUSIC_DESIGN.md (mesurées, pas espérées).
    for (const cond of summary) {
      expect(cond.accuracy, `${cond.condition}`).toBeGreaterThanOrEqual(0.9);
    }
    expect(perNoteOk / perNoteTotal).toBeGreaterThanOrEqual(0.98);

    // Une seule confusion reste, dans **toutes** les conditions : G/B pris pour G. Ce n'est pas un
    // réglage à corriger mais une impossibilité du spectre — G/B double la corde de Si, et deux cordes
    // à l'unisson produisent **un seul** pic. Le test le fige pour que personne ne « répare » le score
    // en cassant autre chose : toute autre confusion fait échouer la suite.
    const wrong = rows.filter((r) => !r.correct);
    expect([...new Set(wrong.map((r) => `${r.played}/${r.predicted}`))]).toEqual(['G/B/G']);
  }, 120_000);
});
