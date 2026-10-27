import { describe, expect, it } from 'vitest';
import {
  CHORD_QUALITIES, SCALES, TUNINGS, degreeLabels, fmtChord, fmtNote, fmtStringLabel, generatePositions, fmtPositionLabel,
  tonicSpellings, type ChordNotation, type NoteNotation,
} from '../src/core/theory';
import {
  allGlyphs, allSprites, annotationText, chars, fmtFn, fnToInterval, glyph, hasGlyph, textWidth, chordToScore, positionToScore,
} from '../src/core/tab';
import { VOICINGS } from '../src/data/voicings';

describe('police bitmap 5×7', () => {
  it('chaque glyphe a 7 rangées (9 pour les jambages g j p q y) de même largeur, en # et .', () => {
    for (const [ch, g] of allGlyphs()) {
      expect([7, 9], `rangées de « ${ch} »`).toContain(g.rows.length);
      for (const r of g.rows) {
        expect(r.length, `« ${ch} »`).toBe(g.w);
        expect(/^[#.]+$/.test(r), `« ${ch} »`).toBe(true);
      }
      expect(g.w).toBeLessThanOrEqual(7);
      expect(g.rows.join('').includes('#'), `« ${ch} » vide`).toBe(ch === ' ' ? false : true);
    }
    expect([...allGlyphs().keys()].filter((c) => 'gjpqy'.includes(c)).every((c) => allGlyphs().get(c)!.rows.length === 9)).toBe(true);
    for (const [name, g] of allSprites()) {
      expect(g.rows.length, name).toBe(7);
      expect(g.w, name).toBe(5);
    }
  });

  it('les chiffres 0-9 font 5×7 (lisibles à 2 chiffres) et sont tous distincts', () => {
    const rows = new Set<string>();
    for (const d of '0123456789') {
      expect(glyph(d).w).toBe(5);
      expect(glyph(d).rows.length).toBe(7);
      rows.add(glyph(d).rows.join('/'));
    }
    expect(rows.size).toBe(10);
  });

  it('≥ 2 pixels de différence entre glyphes ressemblants (0/O, 1/I/l, 5/S, 8/B)', () => {
    const diff = (a: string, b: string) => {
      const ga = glyph(a), gb = glyph(b);
      let n = 0;
      for (let r = 0; r < 7; r++) for (let c = 0; c < Math.max(ga.w, gb.w); c++) if ((ga.rows[r]![c] ?? '.') !== (gb.rows[r]![c] ?? '.')) n++;
      return n;
    };
    for (const [a, b] of [['0', 'O'], ['1', 'I'], ['1', 'l'], ['5', 'S'], ['8', 'B'], ['2', 'Z'], ['♯', '#'], ['6', 'G']]) {
      if (!hasGlyph(b!)) continue;
      expect(diff(a!, b!), `${a}/${b}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('largeur d\'un texte = somme des glyphes + 1 px entre chaque ; 𝄪 compte pour un seul caractère', () => {
    expect(textWidth('')).toBe(0);
    expect(textWidth('5')).toBe(5);
    expect(textWidth('12')).toBe(11);
    expect(chars('Fa𝄪')).toEqual(['F', 'a', '𝄪']);
    expect(textWidth('𝄫')).toBe(glyph('♭').w * 2 + 1);
  });

  it('couvre tout ce que la tab peut afficher : notes, accords, cordes, degrés, intervalles, étiquettes', () => {
    const missing = new Set<string>();
    const check = (text: string) => {
      for (const c of chars(text)) if (!hasGlyph(c)) missing.add(`${c} (U+${c.codePointAt(0)!.toString(16)}) dans « ${text} »`);
    };
    const roots: string[] = [];
    for (const l of 'CDEFGAB') for (const a of ['', '#', 'b', '##', 'bb']) roots.push(l + a);
    for (const n of ['fr', 'en'] as NoteNotation[]) {
      for (const r of roots) check(fmtNote(r, n));
      for (const t of Object.values(TUNINGS)) t.strings.forEach((p, i) => check(fmtStringLabel(p, i === t.strings.length - 1, n)));
    }
    for (const style of ['en', 'fr', 'jazz'] as ChordNotation[]) {
      for (const r of ['C', 'D#', 'Eb', 'F#', 'Gb', 'Bb', 'B']) {
        for (const q of CHORD_QUALITIES) check(fmtChord(`${r}${q.suffix}`, style));
        check(fmtChord(`${r}/Bb`, style));
        check(fmtChord(`${r}m7b5/F#`, style));
      }
    }
    for (const def of SCALES) {
      degreeLabels(def).forEach((d) => {
        check(fmtFn(d));
        check(fnToInterval(d) ?? '');
      });
    }
    for (const d of ['9', 'b9', '#9', '11', '#11', '13', 'b13', 'bb7', '##4']) {
      check(fmtFn(d));
      check(fnToInterval(d) ?? '');
    }
    for (const w of ['plaqué', 'arpégé', 'arpège · cases 12–15', 'cases 5–8', 'case 0']) check(w);
    for (const n of ['fr', 'en'] as NoteNotation[]) {
      for (const sys of ['3nps', 'boxes', 'caged', 'symmetric', 'passing-note'] as const) {
        const std = TUNINGS.standard!;
        const id = sys === 'boxes' ? 'pentatonic-minor' : sys === 'symmetric' ? 'whole-tone' : sys === 'passing-note' ? 'bebop-dominant' : 'ionian';
        for (const p of generatePositions(id, 'C', std, sys)) check(fmtPositionLabel(p, n));
      }
    }
    for (const r of ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii°', 'ii7', 'V7', 'Imaj7', '♭II', '♭VII', 'viiø']) check(r);
    for (const c of '0123456789 -+/()=:.,×?↓↑♩') check(c);
    for (const tonic of tonicSpellings(SCALES[0]!, 0)) check(fmtNote(tonic, 'fr'));
    // voicings curés : tout ce que la tab affiche pour eux
    for (const v of VOICINGS) {
      const s = chordToScore(v);
      for (const m of s.measures) {
        if (m.label?.text) check(m.label.text);
        for (const e of m.events) for (const n of e.notes) for (const k of ['note', 'degree', 'interval', 'finger'] as const) check(annotationText(n, k, 'fr'));
      }
    }
    for (const p of generatePositions('pentatonic-minor', 'A', TUNINGS.standard!, 'boxes')) {
      for (const n of positionToScore(p, TUNINGS.standard!).measures.flatMap((m) => m.events.flatMap((e) => e.notes))) check(annotationText(n, 'note', 'fr'));
    }
    expect([...missing]).toEqual([]);
  });
});

describe('fnToInterval / fmtFn', () => {
  it('formats', () => {
    expect(fnToInterval('1')).toBe('P1');
    expect(fnToInterval('b3')).toBe('m3');
    expect(fnToInterval('3')).toBe('M3');
    expect(fnToInterval('#4')).toBe('A4');
    expect(fnToInterval('b5')).toBe('d5');
    expect(fnToInterval('#5')).toBe('A5');
    expect(fnToInterval('b7')).toBe('m7');
    expect(fnToInterval('bb7')).toBe('d7');
    expect(fnToInterval('9')).toBe('M9');
    expect(fnToInterval('?')).toBeNull();
    expect(fmtFn('b3')).toBe('♭3');
    expect(fmtFn('#11')).toBe('♯11');
    expect(fmtFn('bb7')).toBe('𝄫7');
    expect(fmtFn('5')).toBe('5');
  });

  it('cohérent avec la théorie : « b3 » ↔ intervalle tonal « 3m » pour toutes les formules de gamme', () => {
    for (const def of SCALES) {
      for (const iv of def.intervals) {
        const [d] = degreeLabels({ ...def, intervals: [iv] });
        const name = fnToInterval(d!)!;
        // tonal écrit « 3m » (nombre puis qualité), l'affichage « m3 » (qualité puis nombre)
        const num = iv.match(/\d+/)![0];
        const q = iv.replace(num, '');
        expect(name).toBe(`${q}${num}`);
      }
    }
  });
});
