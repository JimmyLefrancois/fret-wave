/** Synthèse de fin de session de séquences : une popup, que la session se soit arrêtée seule ou non. */
import { PixelButton } from '../../app/ui';
import type { LoopBilan } from './sequence';

export interface SavedSession {
  verified: boolean;
  loop?: { reps: number; bpm: number; clean: number | null };
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

export function SessionSummary(props: {
  title: string;
  subtitle: string;
  saved: SavedSession;
  bilan: LoopBilan | null;
  autoStopped: boolean;
  /** Numéro de corde affiché à partir de l'indice interne. */
  stringLabel: (string: number) => number;
  onProgress?: () => void;
  onReplay: () => void;
  onClose: () => void;
}) {
  const { title, subtitle, saved, bilan, autoStopped, stringLabel, onProgress, onReplay, onClose } = props;
  const headline = bilan
    ? { value: `${Math.round(bilan.accuracy * 100)}%`, label: 'de notes justes' }
    : saved.loop
      ? { value: plural(saved.loop.reps, 'gamme'), label: `jusqu’à ${saved.loop.bpm} BPM` }
      : { value: 'Enregistré', label: saved.verified ? 'session vérifiée au micro' : 'non vérifié : sans micro, l’app n’entend rien' };
  return (
    <dialog
      ref={(d) => { if (d && !d.open) d.showModal(); }}
      className="play-neck-dialog seq-summary"
      aria-label="Synthèse de la session"
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
    >
      <div className="seq-summary-body">
        <header>
          <h2 className="seq-summary-title">Session terminée</h2>
          <p className="t-small t-dim">{title} · {subtitle}</p>
          {autoStopped && <p className="t-small t-dim">Arrêt automatique : plus aucune note depuis 2 secondes.</p>}
        </header>
        <p className="seq-summary-hero"><strong>{headline.value}</strong> <span className="t-small">{headline.label}</span></p>
        {bilan && (
          <>
            <dl className="loop-stats">
              <div><dt>Gammes</dt><dd>{bilan.tours}</dd></div>
              <div><dt>Propres</dt><dd>{bilan.clean}</dd></div>
              <div><dt>Meilleure suite</dt><dd>{bilan.bestStreak}</dd></div>
              <div><dt>Hors tempo</dt><dd>{bilan.offTime}</dd></div>
              <div><dt>Tempo</dt><dd>{bilan.bpmStart === bilan.bpmEnd ? bilan.bpmEnd : `${bilan.bpmStart} → ${bilan.bpmEnd}`}</dd></div>
            </dl>
            <div className="loop-strip" role="img" aria-label={`${bilan.clean} gammes propres sur ${bilan.tours}`}>
              {bilan.strip.map((clean, i) => <span key={i} className={clean ? 'ok' : 'no'} />)}
            </div>
            {bilan.byBpm.length > 1 && (
              <table className="loop-table">
                <thead><tr><th scope="col">BPM</th><th scope="col">Gammes</th><th scope="col">Propres</th><th scope="col">Erreurs</th></tr></thead>
                <tbody>
                  {bilan.byBpm.map((b) => <tr key={b.bpm}><th scope="row">{b.bpm}</th><td>{b.tours}</td><td>{b.clean}</td><td>{b.errors}</td></tr>)}
                </tbody>
              </table>
            )}
            {bilan.weak.length > 0 && (
              <p className="t-small">À reprendre : {bilan.weak.map((w) => `corde ${stringLabel(w.string)} case ${w.fret} (${w.count})`).join(', ')}.</p>
            )}
          </>
        )}
        <div className="seq-summary-actions">
          <PixelButton variant="quiet" onClick={onClose}>Fermer</PixelButton>
          {onProgress && <PixelButton variant="ghost" onClick={onProgress}>Voir la progression</PixelButton>}
          <PixelButton variant="primary" onClick={onReplay}>▶ Rejouer</PixelButton>
        </div>
      </div>
    </dialog>
  );
}
