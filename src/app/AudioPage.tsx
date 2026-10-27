/**
 * Page de debug audio (phase 1c) : vérifier chaque son, le mixage, la chaîne master et les licences.
 * Chaque test passe par le MÊME chemin que la lecture réelle (TabPlayer → AudioEngine), jamais par un raccourci.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine, INSTRUMENT_IDS } from '../core/audio/engine';
import { DEFAULT_SETTINGS } from '../core/audio/mixer';
import { fetchManifest, type SampleManifest } from '../core/audio/sampleBank';
import { droneMidis } from '../core/audio/drone';
import { TabPlayer } from '../core/audio/tabPlayer';
import { verifyTriggered, type VerifyResult } from '../core/audio/verify';
import { chordToScore, scaleToScore, type TabScore } from '../core/tab';
import { TUNINGS, fretToMidi, tonicSpellings, getScale, fmtNote } from '../core/theory';
import { VOICINGS } from '../data/voicings';
import { INSTRUMENT_LABEL, InstrumentPicker, Mixer, fmtDb, useEngine } from './AudioControls';

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiLabel = (m: number) => `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
const std = TUNINGS.standard!;

interface SeqTest {
  id: string;
  label: string;
  build: () => TabScore;
}

const SEQ_TESTS: SeqTest[] = [
  { id: 'pent', label: 'La min. pentatonique · box 1 · montée + descente', build: () => scaleToScore('pentatonic-minor', 'A', std, { direction: 'updown', tempo: 90 }) },
  { id: 'dorian', label: 'Ré dorien · 3 notes par corde · montée', build: () => scaleToScore('dorian', 'D', std, { direction: 'up', tempo: 90 }) },
  { id: 'major', label: 'Do majeur · 3 notes par corde · montée + descente', build: () => scaleToScore('ionian', 'C', std, { direction: 'updown', tempo: 100 }) },
];

const bar = (db: number, floor = -60) => `${Math.max(0, Math.min(100, ((db - floor) / -floor) * 100))}%`;

function Meter() {
  const engine = AudioEngine.get();
  const [lv, setLv] = useState({ peakDb: -Infinity, rmsDb: -Infinity, compressorDb: 0, limiterDb: 0 });
  const hold = useRef({ db: -Infinity, at: 0 });
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 50) {
        last = t;
        const r = engine.readLevel();
        if (r.peakDb >= hold.current.db || t - hold.current.at > 1500) hold.current = { db: r.peakDb, at: t };
        setLv(r);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);
  return (
    <div className="meter" data-testid="meter">
      <div className="meter-row"><span>crête</span><div className="meter-track"><i className={lv.peakDb > -1 ? 'hot' : ''} style={{ width: bar(lv.peakDb) }} /></div><b>{fmtDb(lv.peakDb)}</b></div>
      <div className="meter-row"><span>RMS</span><div className="meter-track"><i style={{ width: bar(lv.rmsDb) }} /></div><b>{fmtDb(lv.rmsDb)}</b></div>
      <div className="meter-row"><span>compresseur</span><div className="meter-track"><i className="gr" style={{ width: `${Math.min(100, -lv.compressorDb * 5)}%` }} /></div><b>{fmtDb(lv.compressorDb)}</b></div>
      <div className="meter-row"><span>limiteur</span><div className="meter-track"><i className="gr" style={{ width: `${Math.min(100, -lv.limiterDb * 5)}%` }} /></div><b>{fmtDb(lv.limiterDb)}</b></div>
      <p className="small">maintien de crête 1,5 s · plafond du limiteur −1 dBFS</p>
    </div>
  );
}

export function AudioPage() {
  const engine = useEngine();
  const player = useRef<TabPlayer | null>(null);
  if (player.current === null) player.current = new TabPlayer(engine);
  const [status, setStatus] = useState('prêt');
  const [verify, setVerify] = useState<{ label: string; r: VerifyResult; samples: number; synth: number; files: number } | null>(null);
  const [manifests, setManifests] = useState<SampleManifest[]>([]);
  const [info, setInfo] = useState<Array<[string, string]>>([]);

  // --- note unique
  const [string, setString] = useState(0);
  const [fret, setFret] = useState(0);
  const [velocity, setVelocity] = useState(0.8);
  const [planText, setPlanText] = useState('');
  // --- accords
  const [voicingId, setVoicingId] = useState('Em-022000');
  // --- drone / métronome
  const [droneTonic, setDroneTonic] = useState('A');
  const [droneOn, setDroneOn] = useState(false);
  const [bpm, setBpm] = useState(90);
  const [sig, setSig] = useState<'4/4' | '3/4' | '6/8'>('4/4');
  const [metroOn, setMetroOn] = useState(false);

  useEffect(() => {
    const p = player.current!;
    if (import.meta.env.DEV) (window as unknown as { __audioPage?: unknown }).__audioPage = { player: p };
    return () => p.dispose();
  }, []);
  useEffect(() => {
    const t = setInterval(() => setInfo(engine.contextInfo()), 500);
    setInfo(engine.contextInfo());
    return () => clearInterval(t);
  }, [engine]);
  useEffect(() => {
    let alive = true;
    void Promise.all(INSTRUMENT_IDS.map((id) => engine.manifests.get(id) ?? fetchManifest(id))).then((m) => {
      if (alive) setManifests(m);
    }).catch((e) => alive && setStatus(`manifeste illisible : ${(e as Error).message}`));
    return () => {
      alive = false;
    };
  }, [engine]);

  const unlock = async () => {
    await engine.unlock();
    setStatus(`contexte audio : ${engine.contextState}`);
  };

  // --- lecture d'un score par le chemin réel
  const playScore = async (label: string, score: TabScore, opts: { drone?: boolean; metronome?: boolean; loop?: boolean } = {}) => {
    const p = player.current!;
    try {
      await p.init(); // toujours en premier : geste utilisateur
      p.stop();
      setVerify(null);
      await p.load(score, { loop: opts.loop });
      p.setDrone(opts.drone ?? false);
      p.setMetronome(opts.metronome ?? false);
      p.onEnded = () => {
        const r = verifyTriggered(score, p.triggered);
        setVerify({ label, r, samples: p.triggered.filter((t) => t.kind === 'sample').length, synth: p.triggered.filter((t) => t.kind === 'synth').length, files: new Set(p.triggered.map((t) => t.file)).size });
        setStatus(`${label} : terminé`);
      };
      await p.play();
      setStatus(`${label} : lecture`);
    } catch (e) {
      setStatus(`erreur : ${(e as Error).message}`);
    }
  };
  const stopAll = () => {
    player.current?.stop();
    engine.drone?.stop(0.4);
    setDroneOn(false);
    setMetroOn(false);
    setStatus('arrêté');
  };

  const voicing = VOICINGS.find((v) => v.id === voicingId)!;
  const chordTest = (label: string, pattern: 'quarters' | 'eighths' | 'universal', style: 'strum' | 'arpeggio') =>
    void playScore(label, chordToScore(voicing, { pattern, style, tempo: pattern === 'quarters' ? 70 : 80 }));

  // --- note unique
  const midi = fretToMidi(std, string, fret);
  const playNote = (s = string, f = fret, v = velocity) => {
    const m = fretToMidi(std, s, f);
    void (async () => {
      await engine.unlock();
      const info = engine.playNow(s, m, v, 3);
      const plan = engine.guitar?.plan(m, v);
      setPlanText(
        info
          ? `${midiLabel(m)} (MIDI ${m}) → ${info.kind === 'sample' ? `échantillon ${info.file} · couche ${info.layer} · écart ${plan?.shiftSemitones ?? 0} demi-ton(s)` : 'synthèse Karplus-Strong (hors plage)'} · vitesse ×${info.rate.toFixed(4)} · gain ${fmtDb(20 * Math.log10(info.gain))}`
          : 'aucun son chargé',
      );
    })();
  };
  const openStrings = () => void (async () => {
    await engine.unlock();
    const t0 = engine.rawContext.currentTime + 0.05;
    std.strings.forEach((_, s) => engine.guitar?.play({ string: s, midi: fretToMidi(std, s, 0), time: t0 + s * 0.45, velocity: 0.8, releaseAt: null }));
    setStatus('6 cordes à vide, une par une');
  })();
  const outOfRange = () => void (async () => {
    await engine.unlock();
    const t0 = engine.rawContext.currentTime + 0.05;
    [20, 28, 100].forEach((m, i) => engine.guitar?.play({ string: i, midi: m, time: t0 + i * 0.8, velocity: 0.8, releaseAt: null }));
    setStatus('hors plage : MIDI 20, 28, 100 → synthèse Karplus-Strong');
  })();
  const limiterTest = () => {
    const sc = chordToScore(voicing, { pattern: 'eighths', style: 'strum', tempo: 160 });
    void playScore('Test du limiteur (tempo 160, vélocité maximale)', sc);
  };

  // --- drone & métronome
  const toggleDrone = async (on: boolean) => {
    setDroneOn(on);
    await engine.unlock();
    if (on) engine.drone?.start(droneMidis(droneTonic));
    else engine.drone?.stop();
  };
  const toggleMetronome = async (on: boolean) => {
    setMetroOn(on);
    const p = player.current!;
    if (!on) {
      p.stop();
      p.setMetronome(false);
      setStatus('métronome arrêté');
      return;
    }
    await p.init();
    const [num, den] = sig.split('/').map(Number) as [number, number];
    const base = scaleToScore('ionian', 'C', std, { tempo: bpm });
    // partition vide : 4 mesures de silence → seuls les clics sonnent (même Transport, même horloge que les notes)
    const rest = { startTick: 0, durTick: (num * 4 * 480) / den, kind: 'rest' as const, notes: [] };
    const score: TabScore = { ...base, id: 'metronome', kind: 'exercise', tempo: bpm, timeSig: [num, den], measures: Array.from({ length: 4 }, () => ({ events: [{ ...rest }] })) };
    await p.load(score, { loop: true, subdivide: false });
    p.setMetronome(true);
    await p.play();
    setStatus(`métronome ${sig} · ${bpm} BPM`);
  };

  const bank = engine.bank;
  const rootRows = useMemo(() => {
    if (!bank) return [];
    return bank.roots.map((r) => {
      const es = bank.manifest.samples.filter((s) => s.midi === r);
      const ref = es.find((s) => s.layer === 'mf' && s.variant === 1) ?? es[0]!;
      return { midi: r, layers: bank.layers.map((l) => `${l}×${bank.variantsAt(r, l)}`).join(' '), cents: ref.measuredCents, gainDb: ref.gainDb, dur: ref.durationS };
    });
  }, [bank]);

  const tonics = useMemo(() => Array.from({ length: 12 }, (_, pc) => tonicSpellings(getScale('ionian'), pc)[0]!), []);

  return (
    <main className="wide" data-testid="audio-page">
      <h1>Audio · debug (phase 1c)</h1>

      <div className="card">
        <button onClick={() => void unlock()}>Activer le son (geste)</button>{' '}
        <button onClick={stopAll}>■ Tout arrêter</button>
        <span className="small" data-testid="audio-status"> {status}</span>
        <table className="kv">
          <tbody>{info.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody>
        </table>
      </div>

      <div className="card">
        <h2>Mixeur et chaîne master</h2>
        <InstrumentPicker />
        <Mixer />
        <label className="inline mix-row">
          <span className="mix-name">Réverbération</span>
          <input type="range" min={0} max={1} step={0.01} value={engine.settings.reverb} onChange={(e) => engine.update({ reverb: Number(e.target.value) })} data-testid="reverb" />
          <span className="small">{Math.round(engine.settings.reverb * 100)} %</span>
        </label>
        <label className="inline mix-row">
          <span className="mix-name">Écart de strum</span>
          <input type="range" min={4} max={40} step={1} value={engine.settings.strumSpreadMs} onChange={(e) => engine.update({ strumSpreadMs: Number(e.target.value) })} />
          <span className="small">{engine.settings.strumSpreadMs} ms par corde</span>
        </label>
        <label className="inline mix-row">
          <span className="mix-name">Humanisation</span>
          <input type="range" min={0} max={1} step={0.05} value={engine.settings.humanize} onChange={(e) => engine.update({ humanize: Number(e.target.value) })} />
          <span className="small">{Math.round(engine.settings.humanize * 100)} %</span>
        </label>
        <button onClick={() => engine.update({ strumSpreadMs: DEFAULT_SETTINGS.strumSpreadMs, humanize: DEFAULT_SETTINGS.humanize, reverb: DEFAULT_SETTINGS.reverb })}>Jeu et réverb par défaut</button>
        <Meter />
      </div>

      <div className="card">
        <h2>Une note</h2>
        <div className="row">
          <label className="inline">Corde
            <select value={string} onChange={(e) => setString(Number(e.target.value))} data-testid="note-string">
              {std.strings.map((p, s) => <option key={s} value={s}>{s + 1 === 6 ? '1 (aiguë)' : 6 - s} · {p}</option>).reverse()}
            </select>
          </label>
          <label className="inline">Case
            <input type="number" min={0} max={24} value={fret} onChange={(e) => setFret(Math.max(0, Math.min(24, Number(e.target.value))))} data-testid="note-fret" />
          </label>
          <label className="inline">Vélocité
            <input type="range" min={0.1} max={1} step={0.05} value={velocity} onChange={(e) => setVelocity(Number(e.target.value))} />
            <span className="small">{velocity.toFixed(2)}</span>
          </label>
          <span className="small">→ {midiLabel(midi)} (MIDI {midi})</span>
          <button onClick={() => playNote()} data-testid="note-play">▶ Jouer</button>
          <button onClick={openStrings}>6 cordes à vide</button>
          <button onClick={outOfRange}>Hors plage (synthèse)</button>
        </div>
        <p className="small" data-testid="plan">{planText || '—'}</p>
      </div>

      <div className="card">
        <h2>Gammes (chemin réel : TabPlayer → moteur)</h2>
        <div className="row">
          {SEQ_TESTS.map((t) => (
            <button key={t.id} onClick={() => void playScore(t.label, t.build(), { drone: true })} data-testid={`seq-${t.id}`}>▶ {t.label}</button>
          ))}
        </div>
        <p className="small">Le drone de la fondamentale démarre avec la gamme (réglé par son curseur).</p>
      </div>

      <div className="card">
        <h2>Accords : plaqué (strum) et arpégé</h2>
        <div className="row">
          <label className="inline">Forme
            <select value={voicingId} onChange={(e) => setVoicingId(e.target.value)} data-testid="voicing">
              {['Em-022000', 'G-320003', 'C-x32010', 'D-xx0232', 'Am-x02210', 'F-133211'].map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <button onClick={() => chordTest('Plaqué ↓ ↓ ↓ ↓', 'quarters', 'strum')} data-testid="chord-quarters">▶ ↓ ↓ ↓ ↓</button>
          <button onClick={() => chordTest('Plaqué ↓↑ croches', 'eighths', 'strum')}>▶ ↓↑ en croches</button>
          <button onClick={() => chordTest('Plaqué motif universel', 'universal', 'strum')} data-testid="chord-universal">▶ motif universel</button>
          <button onClick={() => chordTest('Arpégé', 'quarters', 'arpeggio')} data-testid="chord-arp">▶ arpégé</button>
          <button onClick={limiterTest}>Test du limiteur</button>
        </div>
      </div>

      <div className="card">
        <h2>Drone et métronome</h2>
        <div className="row">
          <label className="inline">Fondamentale
            <select value={droneTonic} onChange={(e) => { setDroneTonic(e.target.value); if (droneOn) engine.drone?.start(droneMidis(e.target.value)); }}>
              {tonics.map((t) => <option key={t} value={t}>{fmtNote(t, 'fr')}</option>)}
            </select>
          </label>
          <label className="inline"><input type="checkbox" checked={droneOn} onChange={(e) => void toggleDrone(e.target.checked)} data-testid="drone-toggle" /> drone (fond + quinte + octave)</label>
          <span className="small">→ {droneMidis(droneTonic).map(midiLabel).join(' + ')}</span>
        </div>
        <div className="row">
          <label className="inline">♩ = {bpm}
            <input type="range" min={40} max={200} value={bpm} onChange={(e) => { setBpm(Number(e.target.value)); player.current?.setTempo(Number(e.target.value)); }} />
          </label>
          <label className="inline">Signature
            <select value={sig} onChange={(e) => setSig(e.target.value as typeof sig)} disabled={metroOn}>
              <option value="4/4">4/4</option><option value="3/4">3/4</option><option value="6/8">6/8</option>
            </select>
          </label>
          <label className="inline"><input type="checkbox" checked={metroOn} onChange={(e) => void toggleMetronome(e.target.checked)} data-testid="metro-toggle" /> métronome</label>
        </div>
      </div>

      {verify && (
        <div className={verify.r.ok ? 'card ok' : 'card error'} data-testid="verify">
          <b>{verify.label}</b> — notes du score : {verify.r.expected}, notes jouées : {verify.r.played} →{' '}
          <b>{verify.r.ok ? 'identiques (corde + hauteur)' : `ÉCART : manquantes ${verify.r.missing.join(' ')} · en trop ${verify.r.extra.join(' ')}`}</b>
          <div className="small">{verify.samples} notes d’échantillon, {verify.synth} de synthèse, {verify.files} fichiers distincts utilisés.</div>
        </div>
      )}

      <div className="card">
        <h2>Échantillons chargés ({engine.activeInstrument ? INSTRUMENT_LABEL[engine.activeInstrument] : 'aucun'})</h2>
        {bank ? (
          <>
            <p className="small">
              {bank.manifest.samples.length} fichiers · {(bank.manifest.totalBytes / 1e6).toFixed(2)} Mo · plage jouable {midiLabel(bank.range.lo)}–{midiLabel(bank.range.hi)} (écart max {bank.manifest.maxShiftSemitones} demi-tons) · couches : {bank.layers.join(', ')}
            </p>
            <div className="samples-table">
              <table className="kv">
                <thead><tr><th>note</th><th>MIDI</th><th>couches × variantes</th><th>écart mesuré</th><th>gain</th><th>durée</th><th /></tr></thead>
                <tbody>
                  {rootRows.map((r) => (
                    <tr key={r.midi}>
                      <td>{midiLabel(r.midi)}</td><td>{r.midi}</td><td>{r.layers}</td><td>{r.cents > 0 ? '+' : ''}{r.cents} c</td><td>{fmtDb(r.gainDb)}</td><td>{r.dur.toFixed(1)} s</td>
                      <td><button onClick={() => { void engine.unlock().then(() => { engine.playNow(0, r.midi, 0.8, 2.5); setPlanText(`${midiLabel(r.midi)} : échantillon joué tel quel`); }); }}>▶</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <p className="small">Aucun instrument chargé.</p>}
      </div>

      <div className="card" data-testid="credits">
        <h2>Crédits et licences des échantillons</h2>
        {manifests.map((m) => (
          <div key={m.id} className="credit">
            <h3>{m.nameFr} <span className="small">· {m.samples.length} fichiers · {(m.totalBytes / 1e6).toFixed(1)} Mo</span></h3>
            <p><b>Licence : <a href={m.license.url} target="_blank" rel="noreferrer">{m.license.spdx}</a></b> (domaine public ; attribution non obligatoire, donnée ici par courtoisie) · texte : <a href={`samples/${m.id}/${m.license.file}`}>{m.license.file}</a></p>
            <p><b>Source :</b> {m.source.title} — {m.source.author} — <a href={m.source.url} target="_blank" rel="noreferrer">{m.source.url}</a> · version {m.source.version}</p>
            <p className="small">{m.source.recording}</p>
            <ul className="small">{m.modifications.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        ))}
      </div>
    </main>
  );
}
