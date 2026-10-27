/**
 * Bandeau d'écoute (phase 3) : ce que le micro entend, en direct — niveau, note, écart en cents.
 *
 * Composant séparé **exprès** : il se re-rend ~47 fois par seconde (une fenêtre toutes les 21 ms) et
 * ne doit pas entraîner avec lui la page entière, ni la tablature (un canvas redessiné 47 fois par
 * seconde coûterait tout le budget d'images du téléphone).
 */
import { useCallback, useSyncExternalStore } from 'react';
import { describeInputError, type InputEngine } from '../core/input/engine';
import { noteNameOf, nearestOpenString, tuneStatus } from '../core/input/match';
import { fmtNote, type NoteNotation, type Tuning } from '../core/theory';

export interface MicStripProps {
  engine: InputEngine | null;
  notation: NoteNotation;
  /** Seuil de détection (dBFS) : repère sur la jauge. */
  thresholdDb: number;
  /** Tolérance d'accord (cents) : la zone verte de la barre. */
  tolerance: number;
  /** Accordage courant : permet de nommer la corde visée. */
  tuning: Tuning;
  a4: number;
  big?: boolean;
}

const MIN_DB = -80;

function dbPct(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(100, ((db - MIN_DB) / -MIN_DB) * 100));
}

export function MicStrip(props: MicStripProps) {
  const { engine, notation, thresholdDb, tolerance, tuning, a4, big } = props;
  const subscribe = useCallback((cb: () => void) => (engine ? engine.subscribe(cb) : () => {}), [engine]);
  const version = useSyncExternalStore(subscribe, () => engine?.version ?? 0, () => 0);
  void version; // le rendu suit la version du moteur

  const state = engine?.state ?? 'idle';
  const info = describeInputError(state, engine?.error ?? null);
  const listening = state === 'listening';
  const f = engine?.last ?? null;
  const note = f?.stable ?? null;
  const level = f?.rmsDb ?? -Infinity;

  const cents = note?.cents ?? 0;
  const status = tuneStatus(cents);
  // 0,6 demi-ton : on ne nomme une corde que si c'est vraiment elle qu'on accorde
  const open = note ? nearestOpenString(tuning, note.midi + note.cents / 100, a4, 0.6) : null;
  const name = note ? fmtNote(noteNameOf(note.midi), notation) + String(Math.floor(note.midi / 12) - 1) : null;

  return (
    <div className={`mic-strip ${big ? 'big' : ''} ${listening ? 'on' : ''}`}>
      <div className="mic-top">
        <span className={`mic-dot ${listening ? 'on' : ''}`} aria-hidden="true" />
        <span className="t-small mic-state">
          {listening ? (note ? 'note entendue' : level > thresholdDb ? 'son capté, note instable' : 'écoute — joue une note') : info.message}
        </span>
        <span className="mic-db">{Number.isFinite(level) ? `${level.toFixed(0)} dBFS` : '—'}</span>
      </div>

      <div className="mic-meter" aria-hidden="true">
        <i style={{ width: `${dbPct(level)}%` }} />
        <b style={{ left: `${dbPct(thresholdDb)}%` }} title={`seuil ${thresholdDb} dBFS`} />
      </div>

      <div className="mic-note">
        {note ? (
          <>
            <span className={`mic-pill ${status}`}>{name}</span>
            <span className={`mic-cents ${status}`}>
              {cents > 0 ? '+' : ''}
              {cents.toFixed(0)} ¢
            </span>
            {open ? <span className="mic-string">corde de {fmtNote(open.pitch, notation)}</span> : null}
          </>
        ) : (
          <span className="t-small t-dim">{listening ? 'aucune note stable pour l’instant' : info.hint}</span>
        )}
      </div>

      {tolerance > 0 && (
        <div className="mic-tol" aria-hidden="true">
          <span style={{ width: `${Math.min(50, tolerance / 2)}%`, left: `${50 - Math.min(50, tolerance / 2) / 2}%` }} />
          {note && <b style={{ left: `${50 + Math.max(-50, Math.min(50, cents / 2))}%` }} />}
        </div>
      )}
    </div>
  );
}
