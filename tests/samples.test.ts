import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_LICENSES, SampleSet, dbToGain, layerFor, parseManifest, velocityGain, type SampleEntry, type SampleManifest,
} from '../src/core/audio/sampleBank';
import { DEFAULT_BASE_VELOCITY } from '../src/core/tab';
import { TUNINGS, fretToMidi } from '../src/core/theory';

const DIR = join(__dirname, '..', 'public', 'samples');
const load = (id: string): SampleManifest => parseManifest(JSON.parse(readFileSync(join(DIR, id, 'manifest.json'), 'utf8')));
const IDS = ['nylon', 'electric'];

const NAMES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** « Cs4 » → 61, « Gf2 » → 42, « E2_mf1 » → 40 (f = bémol, s = dièse : pas de confusion avec les lettres). */
function midiOfFile(file: string): number {
  const m = /^([A-G])([sf]?)(\d)/.exec(file)!;
  return 12 * (Number(m[3]) + 1) + NAMES[m[1]!]! + (m[2] === 's' ? 1 : m[2] === 'f' ? -1 : 0);
}

function entry(midi: number, layer: SampleEntry['layer'] = 'mf', variant = 1, cents = 0, gainDb = 0): SampleEntry {
  return { midi, layer, variant, file: `n${midi}_${layer}${variant}.flac`, sourceFile: 'x', bytes: 1, sha256: '', durationS: 1, measuredCents: cents, pitchClarity: 1, gainDb };
}
function manifest(samples: SampleEntry[], maxShift = 3): SampleManifest {
  return {
    id: 't', nameFr: 't', format: 'flac', sampleRate: 44100, maxShiftSemitones: maxShift, releaseS: 0.3, trimDb: 0,
    license: { spdx: 'CC0-1.0', url: 'u', file: 'LICENSE.txt', attributionRequired: false },
    source: { title: 't', author: 'a', url: 'u', download: 'd', version: '1', recording: 'r' },
    modifications: [], samples, totalBytes: samples.length,
  };
}

describe('choix de l\'échantillon (pur)', () => {
  const set = new SampleSet(manifest([entry(40), entry(43), entry(46)]));

  it('prend l\'échantillon le plus proche, à égalité le plus aigu (on ralentit plutôt qu\'on n\'accélère)', () => {
    expect(set.plan(40, 0.7)!.entry.midi).toBe(40);
    expect(set.plan(41, 0.7)!.entry.midi).toBe(40);
    expect(set.plan(42, 0.7)!.entry.midi).toBe(43);
    expect(set.nearestRoot(44.5)).toBe(46); // 44,5 est à égale distance de 43 et 46 (1,5)… le plus aigu l'emporte
  });

  it('vitesse de lecture = 2^((écart·100 − écart mesuré + désaccord)/1200)', () => {
    const s = new SampleSet(manifest([entry(40, 'mf', 1, 10)]));
    expect(s.plan(40, 0.7)!.rate).toBeCloseTo(2 ** (-10 / 1200), 12); // échantillon 10 cents trop haut → on le ralentit
    expect(s.plan(42, 0.7)!.rate).toBeCloseTo(2 ** ((200 - 10) / 1200), 12);
    expect(s.plan(40, 0.7, 0, 25)!.rate).toBeCloseTo(2 ** (15 / 1200), 12);
    // une octave au-dessus d'un échantillon exact : exactement ×2
    const exact = new SampleSet(manifest([entry(40), entry(52)], 12));
    expect(exact.plan(52, 0.7)!.rate).toBe(1);
    expect(new SampleSet(manifest([entry(40)], 12)).plan(52, 0.7)!.rate).toBe(2);
  });

  it('hors plage → null (le moteur bascule sur la synthèse) ; la plage dépend de maxShiftSemitones', () => {
    expect(set.range).toEqual({ lo: 37, hi: 49 });
    expect(set.plan(36, 0.7)).toBeNull();
    expect(set.plan(37, 0.7)).not.toBeNull();
    expect(set.plan(49, 0.7)).not.toBeNull();
    expect(set.plan(50, 0.7)).toBeNull();
  });

  it('gain = gain de nivellement × niveau de la banque × gain de vélocité', () => {
    const s = new SampleSet(manifest([entry(40, 'mf', 1, 0, -6)]));
    expect(s.plan(40, 1)!.gain).toBeCloseTo(dbToGain(-6) * velocityGain(1, false), 12);
    const t = new SampleSet({ ...manifest([entry(40, 'mf', 1, 0, -6)]), trimDb: 7 });
    expect(t.plan(40, 1)!.gain).toBeCloseTo(dbToGain(1) * velocityGain(1, false), 12);
  });
});

describe('couches de vélocité et répétitions', () => {
  const layered = new SampleSet(
    manifest([entry(40, 'p'), entry(40, 'mf', 1), entry(40, 'mf', 2), entry(40, 'mf', 3), entry(40, 'f'), entry(43, 'mf', 1)]),
  );

  it('couche selon la vélocité : p < 0,5 ≤ mf < 0,85 ≤ f', () => {
    expect([0, 0.49, 0.5, 0.84, 0.85, 1].map(layerFor)).toEqual(['p', 'p', 'mf', 'mf', 'f', 'f']);
    expect(layered.plan(40, 0.2)!.entry.layer).toBe('p');
    expect(layered.plan(40, 0.6)!.entry.layer).toBe('mf');
    expect(layered.plan(40, 0.95)!.entry.layer).toBe('f');
  });

  it('la couche suit la vélocité de l\'événement, le gain suit celle de la note', () => {
    const p = layered.plan(40, 0.52, 0, 0, 0.9)!; // corde douce d'un strum fort : couche f, gain de 0,52
    expect(p.entry.layer).toBe('f');
    expect(p.gain).toBeCloseTo(dbToGain(0) * velocityGain(0.52, true), 12);
    expect(layered.plan(40, 0.9, 0, 0, 0.52)!.entry.layer).toBe('mf');
  });

  it('la vélocité de base du jeu reste au milieu de la couche mf, même avec accents et humanisation maximale', () => {
    expect(layerFor(DEFAULT_BASE_VELOCITY)).toBe('mf');
    expect(layerFor(DEFAULT_BASE_VELOCITY * 1.08 * 1.04 * 1.07)).toBe('mf'); // fondamentale + début de mesure + gigue +7 %
    expect(layerFor(DEFAULT_BASE_VELOCITY * 0.93)).toBe('mf');
  });

  it('couche absente pour cette note → la plus proche disponible', () => {
    expect(layered.plan(43, 0.2)!.entry.layer).toBe('mf');
    expect(layered.plan(43, 0.95)!.entry.layer).toBe('mf');
  });

  it('round-robin : le compteur fait défiler les variantes, sans jamais répéter deux fois de suite', () => {
    const seq = [0, 1, 2, 3, 4, 5].map((rr) => layered.plan(40, 0.6, rr)!.entry.variant);
    expect(seq).toEqual([1, 2, 3, 1, 2, 3]);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
    expect(layered.plan(40, 0.6, -1)!.entry.variant).toBe(3);
  });

  it('gain de vélocité : strictement croissant, borné, et plus étendu sans couches', () => {
    for (const layers of [false, true]) {
      const g = [0, 0.25, 0.5, 0.75, 1].map((v) => velocityGain(v, layers));
      for (let i = 1; i < g.length; i++) expect(g[i]!).toBeGreaterThan(g[i - 1]!);
      expect(g[4]).toBeLessThanOrEqual(1);
      expect(g[0]).toBeGreaterThan(0);
    }
    expect(velocityGain(0, false)).toBeLessThan(velocityGain(0, true));
  });
});

describe('manifeste', () => {
  it('refuse un manifeste incomplet ou incohérent', () => {
    expect(() => parseManifest(null)).toThrow();
    expect(() => parseManifest({})).toThrow();
    const ok = manifest([entry(40)]);
    expect(() => parseManifest(ok)).not.toThrow();
    expect(() => parseManifest({ ...ok, samples: [] })).toThrow(/aucun échantillon/);
    expect(() => parseManifest({ ...ok, license: { spdx: 'CC0-1.0' } })).toThrow(/licence/);
    expect(() => parseManifest({ ...ok, samples: [{ ...entry(40), layer: 'ff' }] })).toThrow(/couche/);
    expect(() => parseManifest({ ...ok, samples: [{ ...entry(40), measuredCents: NaN }] })).toThrow(/measuredCents/);
  });
});

describe('échantillons livrés dans public/samples (licence, intégrité, étiquetage, couverture)', () => {
  for (const id of IDS) {
    describe(id, () => {
      const m = load(id);
      const dir = join(DIR, id);

      it('licence documentée et acceptée : texte légal, lisez-moi de la source, SPDX autorisé, source et modifications', () => {
        expect(ACCEPTED_LICENSES).toContain(m.license.spdx);
        expect(m.license.attributionRequired).toBe(false);
        expect(m.license.url).toMatch(/^https:\/\/creativecommons\.org\//);
        expect(existsSync(join(dir, m.license.file))).toBe(true);
        expect(readFileSync(join(dir, m.license.file), 'utf8')).toMatch(/CC0 1\.0 Universal/);
        expect(existsSync(join(dir, 'SOURCE-README.txt'))).toBe(true);
        expect(m.source.url).toMatch(/^https:\/\//);
        expect(m.source.author.length).toBeGreaterThan(3);
        expect(m.source.version.length).toBeGreaterThan(3);
        expect(m.modifications.length).toBeGreaterThan(0);
      });

      it('chaque fichier existe, a la taille et l\'empreinte SHA-256 du manifeste ; total cohérent', () => {
        let total = 0;
        for (const s of m.samples) {
          const f = join(dir, s.file);
          expect(existsSync(f), s.file).toBe(true);
          expect(statSync(f).size, s.file).toBe(s.bytes);
          expect(createHash('sha256').update(readFileSync(f)).digest('hex'), s.file).toBe(s.sha256);
          total += s.bytes;
        }
        expect(total).toBe(m.totalBytes);
        expect(new Set(m.samples.map((s) => s.file)).size).toBe(m.samples.length);
      });

      it('FLAC valide (en-tête fLaC, STREAMINFO) : fréquence et durée conformes au manifeste', () => {
        for (const s of m.samples) {
          const b = readFileSync(join(dir, s.file));
          expect(b.subarray(0, 4).toString('latin1'), s.file).toBe('fLaC');
          // bloc STREAMINFO : 4 octets d'en-tête de bloc, puis 18 octets ; fréquence = 20 bits, canaux = 3 bits, profondeur = 5, total = 36
          const rate = (b[18]! << 12) | (b[19]! << 4) | (b[20]! >> 4);
          const channels = ((b[20]! >> 1) & 7) + 1;
          const total = (b[21]! & 15) * 2 ** 32 + b.readUInt32BE(22);
          expect(rate, s.file).toBe(m.sampleRate);
          expect(channels, s.file).toBe(1);
          expect(Math.abs(total / rate - s.durationS), s.file).toBeLessThan(0.005);
        }
      });

      it('chaque échantillon est étiqueté à la bonne note (nom de fichier = midi) et la mesure de hauteur est plausible', () => {
        for (const s of m.samples) {
          expect(midiOfFile(s.file), s.file).toBe(s.midi);
          expect(Math.abs(s.measuredCents), s.file).toBeLessThan(25); // au-delà, l'étiquette ou la mesure serait suspecte
          expect(s.pitchClarity, s.file).toBeGreaterThan(0.9);
          expect(s.gainDb).toBeGreaterThanOrEqual(-9);
          expect(s.gainDb).toBeLessThanOrEqual(9);
          expect(s.durationS).toBeGreaterThan(0.5);
        }
      });

      it('niveau de banque documenté (trimDb) : entre −3 et +9 dB', () => {
        expect(m.trimDb).toBeGreaterThanOrEqual(-3);
        expect(m.trimDb).toBeLessThanOrEqual(9);
      });

      it('même gain de nivellement pour toutes les couches d\'une même note (la dynamique entre couches est conservée)', () => {
        const byMidi = new Map<number, Set<number>>();
        for (const s of m.samples) byMidi.set(s.midi, (byMidi.get(s.midi) ?? new Set()).add(s.gainDb));
        for (const [midi, gains] of byMidi) expect(gains.size, `midi ${midi}`).toBe(1);
      });
    });
  }

  it('nylon : toutes les notes jouables sur 6, 7 et 8 cordes, cases 0-24, dans tous les accordages, sont couvertes par des échantillons', () => {
    const set = new SampleSet(load('nylon'));
    const missing: number[] = [];
    for (const t of Object.values(TUNINGS)) {
      for (let s = 0; s < t.strings.length; s++) for (let f = 0; f <= 24; f++) {
        const midi = fretToMidi(t, s, f);
        if (!set.covers(midi)) missing.push(midi);
      }
    }
    expect(missing).toEqual([]);
  });

  it('électrique : couvre l\'accordage standard sur 6 cordes (E2 → E6) ; le reste passe par la synthèse de repli', () => {
    const set = new SampleSet(load('electric'));
    const t = TUNINGS.standard!;
    for (let s = 0; s < 6; s++) for (let f = 0; f <= 24; f++) expect(set.covers(fretToMidi(t, s, f)), `corde ${s} case ${f}`).toBe(true);
    expect(set.covers(fretToMidi(TUNINGS.standard8!, 0, 0))).toBe(false); // Fa♯1 : hors plage → synthèse
  });

  it('plan complet : toutes les notes de la guitare standard ont un échantillon, une vitesse de lecture entre 0,79 et 1,27 (≤ 4 demi-tons) et un gain fini', () => {
    for (const id of IDS) {
      const set = new SampleSet(load(id));
      for (let midi = 40; midi <= 88; midi++) {
        for (const v of [0.2, 0.6, 0.95]) {
          const p = set.plan(midi, v)!;
          expect(p, `${id} ${midi}`).not.toBeNull();
          expect(p.rate).toBeGreaterThan(0.79);
          expect(p.rate).toBeLessThan(1.27);
          expect(Number.isFinite(p.gain) && p.gain > 0).toBe(true);
        }
      }
    }
  });
});
