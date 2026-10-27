/**
 * Page de contrôle : générateurs (gamme, position, arpège, accord, progression) → TabScore → rendu pixel
 * + lecture sur Tone.Transport avec le son final de la phase 1c (guitare échantillonnée, drone, métronome) et
 * curseur synchronisé. Ce n'est pas l'UI finale (hub, thèmes : suite de la phase 1).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CHORD_QUALITIES, SCALES, TUNINGS, fmtChord, fmtNote, fmtPositionLabel, generatePositions, getScale, positionSupport,
  defaultSystem, tonicSpellings, type ChordNotation, type NoteNotation, type PositionSystem,
} from '../core/theory';
import {
  arpeggioToScore, chordToScore, defaultChordForScale, positionToScore, progressionToScore, scaleToScore, validateScore,
  STRUM_PATTERNS, type AnnotationKind, type Direction, type StrumPatternId, type TabScore,
} from '../core/tab';
import { TabPlayer, scoreTonic } from '../core/audio/tabPlayer';
import { verifyTriggered } from '../core/audio/verify';
import { VOICINGS } from '../data/voicings';
import { InstrumentPicker, Mixer } from './AudioControls';
import { TabView } from './TabView';

type Kind = 'scale' | 'position' | 'arpeggio' | 'chord' | 'progression';

const PRESETS = [
  { id: 'g', label: 'I–V–vi–IV en Sol', ids: ['G-320003', 'D-xx0232', 'Em-022000', 'C-x32010'], romans: ['I', 'V', 'vi', 'IV'] },
  { id: 'a', label: 'I–IV–V en La', ids: ['A-x02220', 'D-xx0232', 'E-022100'], romans: ['I', 'IV', 'V'] },
  { id: 'c', label: 'vi–IV–I–V en Do', ids: ['Am-x02210', 'F-xx3211', 'C-x32010', 'G-320003'], romans: ['vi', 'IV', 'I', 'V'] },
  { id: 'e', label: 'i–VII–VI–VII en Mi m (Em D C D)', ids: ['Em-022000', 'D-xx0232', 'C-x32010', 'D-xx0232'], romans: ['i', '♭VII', '♭VI', '♭VII'] },
] as const;

const SYSTEM_LABEL: Record<PositionSystem, string> = {
  '3nps': '3 notes par corde', caged: 'CAGED', boxes: 'Boxes', symmetric: 'Motifs symétriques', 'passing-note': 'Position + note de passage',
};

const voicingLabel = (id: string, chordN: ChordNotation) => {
  const v = VOICINGS.find((x) => x.id === id)!;
  return `${fmtChord(v.chord, chordN)} · ${v.frets.map((f) => (f === null ? 'x' : f)).join('')} · ${v.palier}`;
};

export function TabPage() {
  const [kind, setKind] = useState<Kind>('scale');
  const [scaleId, setScaleId] = useState('pentatonic-minor');
  const [tonic, setTonic] = useState('A');
  const [tuningId, setTuningId] = useState('standard');
  const [system, setSystem] = useState<PositionSystem>('boxes');
  const [posIndex, setPosIndex] = useState(0);
  const [register, setRegister] = useState(0);
  const [direction, setDirection] = useState<Direction>('updown');
  const [chordQ, setChordQ] = useState('m7');
  const [voicingId, setVoicingId] = useState('Em-022000');
  const [style, setStyle] = useState<'strum' | 'arpeggio' | 'both'>('both');
  const [pattern, setPattern] = useState<StrumPatternId>('universal');
  const [presetId, setPresetId] = useState<(typeof PRESETS)[number]['id']>('g');
  const [noteN, setNoteN] = useState<NoteNotation>('fr');
  const [chordN, setChordN] = useState<ChordNotation>('en');
  const [annotation, setAnnotation] = useState<AnnotationKind>('degree');
  const [mode, setMode] = useState<'scroll' | 'wrap'>('wrap');
  const [scale, setScale] = useState<number | 'auto'>('auto');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [tempo, setTempo] = useState(80);
  const [loop, setLoop] = useState(false);
  const [droneOn, setDroneOn] = useState(false);
  const [metroOn, setMetroOn] = useState(false);
  const [transport, setTransport] = useState<'stopped' | 'playing' | 'paused'>('stopped');
  const playing = transport === 'playing';
  const [status, setStatus] = useState('arrêté');

  const def = getScale(scaleId);
  const tuning = TUNINGS[tuningId]!;
  const support = useMemo(() => positionSupport(scaleId, tuning), [scaleId, tuning]);
  const availableSystems = support.filter((s) => s.available).map((s) => s.system);
  const activeSystem: PositionSystem = availableSystems.includes(system) ? system : defaultSystem(scaleId, tuning) ?? '3nps';
  const tonics = useMemo(() => Array.from({ length: 12 }, (_, pc) => tonicSpellings(def, pc)).flat(), [def]);
  const activeTonic = tonics.includes(tonic) ? tonic : tonics[0]!;
  const positions = useMemo(
    () => generatePositions(scaleId, activeTonic, tuning, activeSystem, { register }),
    [scaleId, activeTonic, tuning, activeSystem, register],
  );
  const pos = positions[Math.min(posIndex, Math.max(0, positions.length - 1))];
  const chordSymbol = useMemo(() => {
    const q = CHORD_QUALITIES.find((c) => c.id === chordQ) ?? CHORD_QUALITIES[0]!;
    return `${activeTonic}${q.suffix}`;
  }, [activeTonic, chordQ]);

  const built = useMemo((): { score: TabScore; problems: string[] } | { error: string } => {
    try {
      let score: TabScore;
      switch (kind) {
        case 'scale':
          score = scaleToScore(scaleId, activeTonic, tuning, { direction, system: activeSystem });
          break;
        case 'position':
          if (!pos) throw new Error('aucune position pour ce système / cet accordage');
          score = positionToScore(pos, tuning, { direction, chord: defaultChordForScale(scaleId, activeTonic) ?? undefined });
          break;
        case 'arpeggio':
          if (!pos) throw new Error('aucune position pour ce système / cet accordage');
          score = arpeggioToScore(pos, chordSymbol, tuning, { direction });
          break;
        case 'chord':
          score = chordToScore(VOICINGS.find((v) => v.id === voicingId)!, { style, pattern });
          break;
        case 'progression': {
          const preset = PRESETS.find((p) => p.id === presetId)!;
          score = progressionToScore(preset.ids.map((id) => VOICINGS.find((v) => v.id === id)!), { pattern, romans: [...preset.romans] });
          break;
        }
      }
      return { score, problems: validateScore(score) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [kind, scaleId, activeTonic, tuning, direction, activeSystem, pos, chordSymbol, voicingId, style, pattern, presetId]);

  // --- lecture
  const player = useRef<TabPlayer | null>(null);
  if (player.current === null) player.current = new TabPlayer();
  const loaded = useRef<{ score: TabScore; loop: boolean } | null>(null);
  const score = 'score' in built ? built.score : null;
  const droneAvailable = score !== null && scoreTonic(score) !== null;

  useEffect(() => {
    // changement de partition : on arrête
    player.current?.stop();
    setTransport('stopped');
    setStatus('arrêté');
  }, [score]);
  useEffect(() => {
    player.current?.setTempo(tempo);
  }, [tempo]);
  useEffect(() => {
    player.current?.setDrone(droneOn);
  }, [droneOn]);
  useEffect(() => {
    player.current?.setMetronome(metroOn);
  }, [metroOn]);
  useEffect(() => {
    const p = player.current!;
    return () => p.dispose();
  }, []);

  const onPlay = async () => {
    if (!score) return;
    const p = player.current!;
    try {
      await p.init(); // en premier : reprend le contexte audio dans le geste de l'utilisateur
      if (!loaded.current || loaded.current.score !== score || loaded.current.loop !== loop) {
        await p.load({ ...score, tempo }, { loop });
        loaded.current = { score, loop };
      }
      p.onEnded = () => {
        setTransport('stopped');
        const r = verifyTriggered(score, p.triggered);
        setStatus(`terminé · ${r.played} notes jouées sur ${r.expected} écrites : ${r.ok ? 'identiques à la tablature' : 'ÉCART avec la tablature'}`);
      };
      await p.play();
      setTransport('playing');
      setStatus(`lecture · latence de sortie ${(p.outputLatency * 1000).toFixed(0)} ms`);
    } catch (e) {
      setStatus(`erreur audio : ${(e as Error).message}`);
      setTransport('stopped');
    }
  };
  const onPause = () => {
    player.current?.pause();
    setTransport('paused');
    setStatus('pause');
  };
  const onStop = () => {
    player.current?.stop();
    setTransport('stopped');
    setStatus('arrêté');
  };

  const first = score?.measures[0]?.label;
  const caption = [first?.chord ? fmtChord(first.chord, chordN) : '', first?.text ?? ''].filter(Boolean).join(' · ');

  const showScaleControls = kind === 'scale' || kind === 'position' || kind === 'arpeggio';
  const label = pos && (kind === 'position' || kind === 'arpeggio') ? fmtPositionLabel(pos, noteN) : '';

  return (
    <main className="wide">
      <h1>Fretwave · tablature pixel</h1>

      <div className="card transport">
        <button onClick={onPlay} disabled={!score || playing}>{transport === 'paused' ? '▶ Reprendre' : '▶ Lecture'}</button>
        <button onClick={onPause} disabled={!playing}>❚❚ Pause</button>
        <button onClick={onStop}>■ Stop</button>
        <label className="inline">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> boucle
        </label>
        <label className="inline">
          ♩ = {tempo}
          <input type="range" min={40} max={200} value={tempo} onChange={(e) => setTempo(Number(e.target.value))} />
        </label>
        <label className="inline">
          <input type="checkbox" checked={reduceMotion} onChange={(e) => setReduceMotion(e.target.checked)} /> réduire les animations
        </label>
        <span className="small" data-testid="status">{status}</span>
        <label className="inline" title={droneAvailable ? '' : 'Pas de fondamentale unique dans une progression'}>
          <input type="checkbox" checked={droneOn && droneAvailable} disabled={!droneAvailable} onChange={(e) => setDroneOn(e.target.checked)} data-testid="drone" /> drone
        </label>
        <label className="inline">
          <input type="checkbox" checked={metroOn} onChange={(e) => setMetroOn(e.target.checked)} data-testid="metronome" /> métronome
        </label>
        <InstrumentPicker />
        <Mixer channels={['master', 'guitar', 'drone', 'metronome']} compact />
        <p className="small">Son : guitare échantillonnée (CC0, voir la page Audio pour les licences). Le son joué est généré depuis les mêmes notes que celles de la tablature.</p>
      </div>

      {'error' in built ? (
        <div className="card error" role="alert">Impossible de générer : {built.error}</div>
      ) : (
        <>
          <p className="small caption">{label || caption}</p>
          {built.problems.length > 0 && <div className="card error">Invariants violés : {built.problems.join(' · ')}</div>}
          <TabView
            score={built.score}
            notes={noteN}
            chords={chordN}
            annotation={annotation}
            mode={mode}
            scale={scale}
            reduceMotion={reduceMotion}
            player={player.current}
            transport={transport}
          />
        </>
      )}
      <div className="card controls">
        <div>
          <label>Générateur</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            <option value="scale">Gamme</option>
            <option value="position">Position</option>
            <option value="arpeggio">Arpège dans une position</option>
            <option value="chord">Accord (plaqué / arpégé)</option>
            <option value="progression">Progression</option>
          </select>
        </div>

        {showScaleControls && (
          <>
            <div>
              <label>Gamme</label>
              <select value={scaleId} onChange={(e) => { setScaleId(e.target.value); setPosIndex(0); }}>
                {SCALES.map((s) => <option key={s.id} value={s.id}>{s.nameFr}</option>)}
              </select>
            </div>
            <div>
              <label>Tonique</label>
              <select value={activeTonic} onChange={(e) => setTonic(e.target.value)}>
                {tonics.map((t) => <option key={t} value={t}>{fmtNote(t, noteN)}</option>)}
              </select>
            </div>
            <div>
              <label>Accordage ({tuning.strings.length} cordes)</label>
              <select value={tuningId} onChange={(e) => { setTuningId(e.target.value); setPosIndex(0); }}>
                {Object.values(TUNINGS).map((t) => <option key={t.id} value={t.id}>{t.nameFr}</option>)}
              </select>
            </div>
            {kind !== 'scale' && (
              <div>
                <label>Système de positions</label>
                <select value={activeSystem} onChange={(e) => { setSystem(e.target.value as PositionSystem); setPosIndex(0); }}>
                  {support.map((s) => (
                    <option key={s.system} value={s.system} disabled={!s.available} title={s.note}>
                      {SYSTEM_LABEL[s.system]}{s.available ? '' : ' — indisponible'}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {kind !== 'scale' && (
              <div>
                <label>Position</label>
                <select value={Math.min(posIndex, Math.max(0, positions.length - 1))} onChange={(e) => setPosIndex(Number(e.target.value))}>
                  {positions.map((p, i) => <option key={p.id} value={i}>{fmtPositionLabel(p, noteN)}</option>)}
                </select>
              </div>
            )}
            {kind !== 'scale' && (
              <div>
                <label>Registre</label>
                <select value={register} onChange={(e) => { setRegister(Number(e.target.value)); setPosIndex(0); }}>
                  <option value={0}>le plus bas</option>
                  <option value={1}>+ 12 cases</option>
                </select>
              </div>
            )}
            {kind === 'arpeggio' && (
              <div>
                <label>Accord ({fmtChord(chordSymbol, chordN)})</label>
                <select value={chordQ} onChange={(e) => setChordQ(e.target.value)}>
                  {CHORD_QUALITIES.map((q) => <option key={q.id} value={q.id}>{q.nameFr}</option>)}
                </select>
              </div>
            )}
            <div>
              <label>Sens</label>
              <select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
                <option value="up">Montée</option>
                <option value="down">Descente</option>
                <option value="updown">Montée + descente</option>
              </select>
            </div>
          </>
        )}

        {kind === 'chord' && (
          <>
            <div>
              <label>Forme d'accord</label>
              <select value={voicingId} onChange={(e) => setVoicingId(e.target.value)}>
                {VOICINGS.map((v) => <option key={v.id} value={v.id}>{voicingLabel(v.id, chordN)}</option>)}
              </select>
            </div>
            <div>
              <label>Écriture</label>
              <select value={style} onChange={(e) => setStyle(e.target.value as typeof style)}>
                <option value="both">plaqué puis arpégé</option>
                <option value="strum">plaqué</option>
                <option value="arpeggio">arpégé</option>
              </select>
            </div>
          </>
        )}
        {kind === 'progression' && (
          <div>
            <label>Progression</label>
            <select value={presetId} onChange={(e) => setPresetId(e.target.value as typeof presetId)}>
              {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        )}
        {(kind === 'chord' || kind === 'progression') && (
          <div>
            <label>Motif de strum</label>
            <select value={pattern} onChange={(e) => setPattern(e.target.value as StrumPatternId)}>
              {(Object.keys(STRUM_PATTERNS) as StrumPatternId[]).map((p) => (
                <option key={p} value={p}>{p === 'quarters' ? '↓ ↓ ↓ ↓ (noires)' : p === 'eighths' ? '↓↑ en croches' : '↓ · ↓ ↑ · ↑ ↓ ↑'}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label>Notes</label>
          <select value={noteN} onChange={(e) => setNoteN(e.target.value as NoteNotation)}>
            <option value="fr">Solfège</option>
            <option value="en">Anglo-saxonne</option>
          </select>
        </div>
        <div>
          <label>Accords</label>
          <select value={chordN} onChange={(e) => setChordN(e.target.value as ChordNotation)}>
            <option value="en">Am7</option>
            <option value="fr">Lam7</option>
            <option value="jazz">A-7</option>
          </select>
        </div>
        <div>
          <label>Annotation</label>
          <select value={annotation} onChange={(e) => setAnnotation(e.target.value as AnnotationKind)}>
            <option value="none">aucune</option>
            <option value="note">nom de la note</option>
            <option value="degree">degré (1 ♭3 5)</option>
            <option value="interval">intervalle</option>
            <option value="finger">doigté</option>
          </select>
        </div>
        <div>
          <label>Disposition</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="wrap">Retour à la ligne (étude)</option>
            <option value="scroll">Défilement continu (jeu)</option>
          </select>
        </div>
        <div>
          <label>Échelle (px CSS / pixel logique)</label>
          <select value={String(scale)} onChange={(e) => setScale(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}>
            <option value="auto">auto</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </div>
      </div>

    </main>
  );
}
