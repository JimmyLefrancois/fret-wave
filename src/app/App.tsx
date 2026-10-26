/**
 * Écran de contrôle de la phase 1a : explorateur du moteur de théorie (sans tablature ni audio).
 * Sert à vérifier à l'œil l'orthographe, les degrés, les systèmes compatibles et les voicings.
 */
import { useMemo, useState } from 'react';
import {
  SCALES, compatibleSystems, degreeLabels, fmtChord, fmtNote, getScale, scaleNotes, tonicSpellings, pitchClassOf,
  systemsFor, voicingNotes, type ChordNotation, type NoteNotation,
} from '../core/theory';
import { VOICINGS } from '../data/voicings';

const PCS = Array.from({ length: 12 }, (_, i) => i);

export function App() {
  const [scaleId, setScaleId] = useState('dorian');
  const [pc, setPc] = useState(2);
  const [noteN, setNoteN] = useState<NoteNotation>('fr');
  const [chordN, setChordN] = useState<ChordNotation>('en');
  const def = getScale(scaleId);
  const tonics = useMemo(() => tonicSpellings(def, pc), [def, pc]);
  const sys = systemsFor(scaleId);

  return (
    <main>
      <h1>Fretwave · phase 1a · moteur de théorie</h1>

      <div className="card">
        <label>Notation des notes</label>
        <select value={noteN} onChange={(e) => setNoteN(e.target.value as NoteNotation)}>
          <option value="fr">Solfège</option>
          <option value="en">Anglo-saxonne</option>
        </select>
        <label>Notation des accords (défaut : anglo, D8)</label>
        <select value={chordN} onChange={(e) => setChordN(e.target.value as ChordNotation)}>
          <option value="en">Am7</option>
          <option value="fr">Lam7</option>
          <option value="jazz">A-7</option>
        </select>
      </div>

      <div className="card">
        <label>Gamme</label>
        <select value={scaleId} onChange={(e) => setScaleId(e.target.value)}>
          {SCALES.map((s) => <option key={s.id} value={s.id}>{s.nameFr}</option>)}
        </select>
        <label>Tonique (hauteur)</label>
        <select value={pc} onChange={(e) => setPc(Number(e.target.value))}>
          {PCS.map((p) => <option key={p} value={p}>{tonicSpellings(def, p).map((n) => fmtNote(n, noteN)).join(' / ')}</option>)}
        </select>
        {tonics.map((t) => (
          <div key={t}>
            <p><strong>{fmtNote(t, noteN)} {def.nameFr}</strong></p>
            <div className="notes">{scaleNotes(def, t).map((n, i) => <span key={i}>{fmtNote(n, noteN)}</span>)}</div>
            <div className="notes small">{degreeLabels(def).map((d, i) => <span key={i}>{d}</span>)}</div>
            <p className="small">classes de hauteur : {scaleNotes(def, t).map(pitchClassOf).join(' ')}</p>
          </div>
        ))}
        <p className="small">systèmes : {compatibleSystems(scaleId).join(', ')}</p>
        <ul className="small">
          {sys.filter((s) => !s.available && s.note).map((s) => <li key={s.system}>{s.system} indisponible : {s.note}</li>)}
        </ul>
      </div>

      <div className="card">
        <p><strong>Voicings ({VOICINGS.length})</strong></p>
        <table className="small">
          <tbody>
            {VOICINGS.map((v) => (
              <tr key={v.id}>
                <td>{v.palier}</td>
                <td>{fmtChord(v.chord, chordN)}</td>
                <td>{v.frets.map((f) => (f === null ? 'x' : f)).join(' ')}</td>
                <td>{voicingNotes(v).map((n) => fmtNote(n, noteN)).join(' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
