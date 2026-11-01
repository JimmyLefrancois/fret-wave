/**
 * Accueil (D139) : ce qui est dû aujourd'hui, gammes et accords, et rien d'autre. Ni plan du jour ni conseil
 * calculé : l'app reste une boîte à outils, l'accueil ne fait que lire les échéances.
 */
import { useEffect, useMemo, useState } from 'react';
import { JOURNAL_SYNCED, progressStore, readAttempts, readChordMarks } from '../core/progress';
import { fmtChord } from '../core/theory';
import * as clock from '../core/clock';
import { VOICINGS } from '../data/voicings';
import { chordReviewSummary } from '../modules/accords/chordReview';
import { reviewDelayText, reviewSummary } from '../modules/gammes/review';
import { navigate } from './router';
import { useSettings } from './settings';
import { Panel, PixelButton } from './ui';

export function HubPage() {
  const settings = useSettings();
  const [synced, setSynced] = useState(0);
  useEffect(() => {
    const on = () => setSynced((n) => n + 1);
    window.addEventListener(JOURNAL_SYNCED, on);
    return () => window.removeEventListener(JOURNAL_SYNCED, on);
  }, []);
  const { scales, chords } = useMemo(() => {
    const store = progressStore();
    const attempts = readAttempts(store);
    const now = clock.now();
    return {
      scales: reviewSummary(attempts, now),
      chords: chordReviewSummary(VOICINGS, attempts, readChordMarks(store), now),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synced]);

  const nothingDue = scales.forms.length === 0 && chords.chords.length === 0;
  const nextDue = [scales.nextDue, chords.nextDue].filter((t): t is number => t !== null);

  return (
    <main className="shell"><div className="hub-surface">
      <header className="page-head">
        <div>
          <h1 className="page-title">Accueil</h1>
          <p className="t-small t-dim">{nothingDue ? 'Rien n’est dû aujourd’hui.' : 'Ce qui est dû aujourd’hui.'}</p>
        </div>
      </header>

      {scales.forms.length > 0 && (
        <Panel className="span-12 review-due" accent="green" active label="Gammes à réviser" right={<span className="badge">{scales.count}</span>}>
          <ul className="review-forms">
            {scales.forms.map((t) => (
              <li key={t.nodeId}>
                <strong>{t.title}</strong>
                <span className="t-small t-dim">{t.positionLabel.split(' · ')[0]} · {t.reason}</span>
              </li>
            ))}
          </ul>
          <PixelButton variant="primary" onClick={() => navigate('review')}>
            ▶ Réviser {scales.forms.length > 1 ? `ces ${scales.forms.length} formes` : 'cette forme'}
          </PixelButton>
        </Panel>
      )}

      {chords.chords.length > 0 && (
        <Panel className="span-12 review-due" accent="green" active label="Accords à réviser" right={<span className="badge">{chords.count}</span>}>
          <ul className="review-forms">
            {chords.chords.map((t) => (
              <li key={t.nodeId}>
                <strong>{fmtChord(t.voicing.chord, settings.chordNotation)}</strong>
                <span className="t-small t-dim">{t.reason}</span>
              </li>
            ))}
          </ul>
          <PixelButton variant="primary" onClick={() => navigate('chordReview')}>
            ▶ Réviser {chords.chords.length > 1 ? `ces ${chords.chords.length} accords` : 'cet accord'}
          </PixelButton>
        </Panel>
      )}

      {nothingDue && (
        <Panel className="span-12" label="Révision">
          {nextDue.length > 0 ? (
            <p className="t-body">Prochaine échéance : {reviewDelayText(Math.min(...nextDue) - clock.now())}.</p>
          ) : (
            <p className="t-body">Rien n’est suivi pour l’instant. Touche « Réviser cette forme » sur une gamme, ou coche « Je connais cet accord » dans la liste.</p>
          )}
          <div className="row">
            <PixelButton onClick={() => navigate('gammes')}>Gammes</PixelButton>
            <PixelButton onClick={() => navigate('accords')}>Accords</PixelButton>
          </div>
        </Panel>
      )}
    </div></main>
  );
}
