import { describe, expect, it } from 'vitest';
import { fmtChord, fmtNote, fmtStringLabel, parseChordSymbol, parseNote, toModelNote } from '../src/core/theory/notation';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ACCS = ['bb', 'b', '', '#', '##'];

describe('conversion anglo ↔ solfège', () => {
  it('aller-retour en→fr→en sur les 35 noms de notes', () => {
    let n = 0;
    for (const l of LETTERS) {
      for (const a of ACCS) {
        const en = `${l}${a}`;
        const fr = fmtNote(en, 'fr');
        expect(toModelNote(fr)).toBe(en);
        n++;
      }
    }
    expect(n).toBe(35);
  });

  it('B anglo = Si, pas Si♭ ; Bb = Si♭', () => {
    expect(fmtNote('B', 'fr')).toBe('Si');
    expect(fmtNote('Bb', 'fr')).toBe('Si♭');
    expect(fmtNote('Bb', 'en')).toBe('B♭');
    expect(toModelNote('Si')).toBe('B');
    expect(toModelNote('Sib')).toBe('Bb');
    expect(toModelNote('Si♭')).toBe('Bb');
  });

  it('doubles altérations et octaves', () => {
    expect(fmtNote('F##', 'fr')).toBe('Fa𝄪');
    expect(fmtNote('Bbb', 'fr')).toBe('Si𝄫');
    expect(fmtNote('E2', 'fr')).toBe('Mi2');
    expect(toModelNote('Fa𝄪3')).toBe('F##3');
    expect(toModelNote('Re')).toBe('D');
    expect(toModelNote('Ré')).toBe('D');
    expect(toModelNote('sol#')).toBe('G#');
  });

  it('rejette les entrées invalides', () => {
    for (const bad of ['H', 'Xa', 'Do###', 'Sol♯♯♯', '', '12', 'C b']) expect(parseNote(bad)).toBeNull();
  });

  it('étiquettes de cordes : le mi aigu se distingue par la casse', () => {
    expect(fmtStringLabel('E2', false, 'fr')).toBe('Mi');
    expect(fmtStringLabel('E4', true, 'fr')).toBe('mi');
    expect(fmtStringLabel('E4', true, 'en')).toBe('e');
    expect(fmtStringLabel('Bb3', false, 'fr')).toBe('Si♭');
  });
});

describe('symboles d\'accord', () => {
  it('découpe fondamentale / suffixe / basse', () => {
    expect(parseChordSymbol('Cmaj7/G')).toEqual({ root: 'C', suffix: 'maj7', bass: 'G' });
    expect(parseChordSymbol('F#m7b5')).toEqual({ root: 'F#', suffix: 'm7b5', bass: null });
    expect(parseChordSymbol('Bb')).toEqual({ root: 'Bb', suffix: '', bass: null });
    expect(parseChordSymbol('Bb5')).toEqual({ root: 'Bb', suffix: '5', bass: null }); // Si♭ power chord
    expect(parseChordSymbol('Bbb5')).toEqual({ root: 'Bbb', suffix: '5', bass: null }); // Si𝄫, pas « B avec b5 »
    expect(parseChordSymbol('Z7')).toBeNull();
  });

  it('D8 : affichage anglo par défaut (Am7)', () => {
    expect(fmtChord('Am7')).toBe('Am7');
    expect(fmtChord('F#m7b5')).toBe('F♯m7♭5');
    expect(fmtChord('Cmaj7/G')).toBe('Cmaj7/G');
    expect(fmtChord('Bbm')).toBe('B♭m');
  });

  it('options solfège et jazz', () => {
    expect(fmtChord('Am7', 'fr')).toBe('Lam7');
    expect(fmtChord('G/B', 'fr')).toBe('Sol/Si');
    expect(fmtChord('F#m7b5', 'fr')).toBe('Fa♯m7♭5');
    expect(fmtChord('Am7', 'jazz')).toBe('A-7');
    expect(fmtChord('Cmaj7', 'jazz')).toBe('CΔ');
    expect(fmtChord('F#m7b5', 'jazz')).toBe('F♯ø');
    expect(fmtChord('Bdim', 'jazz')).toBe('B°');
  });
});
