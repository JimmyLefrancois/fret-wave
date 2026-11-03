import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChordBoxView } from '../../app/ChordBoxView';
import { useSettings } from '../../app/settings';
import { Chip, PixelButton } from '../../app/ui';
import type { ChordMarks } from '../../core/progress/chordMarks';
import { fmtChord } from '../../core/theory';
import { VOICINGS } from '../../data/voicings';
import { chordSuggestions, nextChordSuggestion, type ChordSuggestion } from './learn';
import { useChordListen } from './useChordListen';

function Preview({ suggestion }: { suggestion: ChordSuggestion }) {
  const { voicing, reason } = suggestion;
  const { sounding, error, listen } = useChordListen();
  return (
    <div className="chord-learn-body">
      <div className="chord-learn-diagram"><ChordBoxView voicing={voicing} maxScale={3} /></div>
      <div className="chord-learn-guide">
        <p className="t-body">{reason}</p>
        <p className="t-small t-dim">Place tes doigts, puis joue les cordes une par une pour entendre chaque note.</p>
        <p className="t-small t-dim">1 : index · 2 : majeur · 3 : annulaire · 4 : auriculaire<br />× : ne pas jouer · ○ : corde à vide</p>
        {voicing.note && <p className="t-small t-dim">{voicing.note}</p>}
        <div className="row">
          <Chip selected={sounding?.style === 'strum'} onClick={() => void listen(voicing, 'strum')}>Écouter plaqué</Chip>
          <Chip selected={sounding?.style === 'arpeggio'} onClick={() => void listen(voicing, 'arpeggio')}>Écouter arpégé</Chip>
        </div>
        {error && <p role="alert" className="t-small mic-line-error">{error}</p>}
      </div>
    </div>
  );
}

export function ChordLearnDialog({ marks, onKnown, onClose }: {
  marks: ChordMarks;
  onKnown: (id: string) => void;
  onClose: () => void;
}) {
  const settings = useSettings();
  const suggestions = useMemo(() => chordSuggestions(VOICINGS, marks), [marks]);
  const [selected, setSelected] = useState<string | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const suggestion = suggestions.find(s => s.voicing.id === selected) ?? suggestions[0];
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);
  const close = () => dialog.current?.close();
  const another = () => {
    if (!suggestion) return;
    const history = [...seen, suggestion.voicing.id];
    setSeen(history);
    setSelected(nextChordSuggestion(suggestions, history)?.voicing.id ?? null);
  };

  return createPortal(
    <dialog ref={dialog} className="chord-learn-dialog" aria-labelledby="chord-learn-title" onClose={onClose}>
      <header className="chord-learn-head">
        <h2 id="chord-learn-title" className="page-title">
          {suggestion ? `Découvrir ${fmtChord(suggestion.voicing.chord, settings.chordNotation)}` : 'À toi de jouer'}
        </h2>
        <PixelButton variant="quiet" onClick={close}>Fermer</PixelButton>
      </header>
      {suggestion ? <>
        <Preview key={suggestion.voicing.id} suggestion={suggestion} />
        <footer className="chord-learn-actions">
          <p className="t-small t-dim">Prends ton temps. Quand tu connais cette forme, ajoute-la à tes accords connus.</p>
          <div className="row">
            <PixelButton variant="primary" onClick={() => { onKnown(suggestion.voicing.id); close(); }}>Je connais maintenant cet accord</PixelButton>
            {suggestions.length > 1 && <PixelButton variant="quiet" onClick={another}>Un autre accord</PixelButton>}
          </div>
        </footer>
      </> : <div className="chord-learn-guide">
        <p className="t-body">Tu as découvert tous les accords proposés pour ton répertoire.</p>
        <p className="t-small t-dim">Tu peux explorer la liste ou le dictionnaire, et continuer à réviser tes accords connus.</p>
      </div>}
    </dialog>, document.body,
  );
}
