/** Contrôles audio partagés : mixeur (volumes séparés), choix de l'instrument. */
import { useCallback, useState, useSyncExternalStore } from 'react';
import { AudioEngine, INSTRUMENT_IDS } from '../core/audio/engine';
import { CHANNELS, CHANNEL_LABEL, DEFAULT_VOLUMES, sliderToDb, type Channel } from '../core/audio/mixer';

/** Réactivité : le composant se redessine à chaque changement du moteur. */
export function useEngine(): AudioEngine {
  const engine = AudioEngine.get();
  useSyncExternalStore(useCallback((cb: () => void) => engine.subscribe(cb), [engine]), () => engine.version);
  return engine;
}

export const fmtDb = (db: number): string => (db === -Infinity ? '−∞ dB' : `${db.toFixed(1).replace('-', '−')} dB`);

export function Mixer({ channels = CHANNELS, compact = false }: { channels?: readonly Channel[]; compact?: boolean }) {
  const engine = useEngine();
  return (
    <div className={compact ? 'mixer compact' : 'mixer'}>
      {channels.map((c) => (
        <label key={c} className="inline mix-row">
          <span className="mix-name">{CHANNEL_LABEL[c]}</span>
          <input
            type="range" min={0} max={1} step={0.01} value={engine.settings.volumes[c]}
            aria-label={`Volume : ${CHANNEL_LABEL[c]}`}
            data-testid={`vol-${c}`}
            onChange={(e) => engine.setVolume(c, Number(e.target.value))}
          />
          <span className="mix-db small">{fmtDb(sliderToDb(engine.settings.volumes[c]))}</span>
        </label>
      ))}
      {!compact && (
        <button onClick={() => engine.resetVolumes(DEFAULT_VOLUMES)}>Volumes par défaut</button>
      )}
    </div>
  );
}

export const INSTRUMENT_LABEL: Record<string, string> = { nylon: 'Guitare classique (nylon)', electric: 'Guitare électrique (son direct)' };

export function InstrumentPicker() {
  const engine = useEngine();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const change = async (id: string) => {
    setErr(null);
    setBusy(id);
    try {
      await engine.setInstrument(id);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(null);
  };
  const p = engine.progress;
  return (
    <label className="instrument">
      Instrument
      <select value={engine.settings.instrument} onChange={(e) => void change(e.target.value)} disabled={busy !== null} data-testid="instrument">
        {INSTRUMENT_IDS.map((id) => <option key={id} value={id}>{INSTRUMENT_LABEL[id]}{engine.isLoaded(id) ? '' : ' — à télécharger'}</option>)}
      </select>
      {busy && p && <span className="small">chargement {Math.round((100 * p.loadedBytes) / p.totalBytes)} %</span>}
      {err && <span className="small error-text">{err}</span>}
    </label>
  );
}
