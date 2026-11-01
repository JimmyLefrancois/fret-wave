/**
 * Module Accords (D128) : une liste. Chaque forme montre son diagramme et s'écoute sur place,
 * plaquée ou arpégée. Le dictionnaire a sa page (D130). Deux coches discrètes décident de la révision (D139) :
 * ce sont des déclarations, seul le rappel au micro compte au journal.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { useSettings } from '../../app/settings';
import { ChordBoxView } from '../../app/ChordBoxView';
import { Chip, Panel, PixelButton } from '../../app/ui';
import { JOURNAL_SYNCED, progressStore, readChordMarks, toggleChordMark, type ChordMarkKind } from '../../core/progress';
import * as clock from '../../core/clock';
import { fmtChord } from '../../core/theory';
import type { Voicing } from '../../core/theory/voicings';
import { VOICINGS } from '../../data/voicings';
import { chordGroups } from './list';
import { useChordListen, type ChordStyle } from './useChordListen';
import { ChordLearnDialog } from './ChordLearnDialog';

export function ChordsPage({ learning = false }: { learning?: boolean }) {
  const settings = useSettings();
  const groups = useMemo(() => chordGroups(VOICINGS), []);
  const count = groups.reduce((n, g) => n + g.voicings.length, 0);
  const { sounding, error, listen } = useChordListen();
  const [marks, setMarks] = useState(() => readChordMarks(progressStore()));
  const heading = useRef<HTMLHeadingElement>(null);
  const [learned, setLearned] = useState<string | null>(null);
  const learn = (id: string) => {
    const store = progressStore();
    const current = readChordMarks(store);
    // Relire au clic : une synchronisation ne doit pas transformer l'ajout en décochage.
    setMarks(current.known.includes(id) ? current : toggleChordMark(store, 'known', id, clock.now()));
    const voicing = VOICINGS.find(v => v.id === id);
    if (voicing) setLearned(fmtChord(voicing.chord, settings.chordNotation));
  };
  const mark = (kind: ChordMarkKind, id: string) => setMarks(toggleChordMark(progressStore(), kind, id, clock.now()));
  // une coche posée sur un autre appareil arrive avec la synchro
  useEffect(() => {
    const on = () => setMarks(readChordMarks(progressStore()));
    window.addEventListener(JOURNAL_SYNCED, on);
    return () => window.removeEventListener(JOURNAL_SYNCED, on);
  }, []);
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());
  const allFolded = folded.size === groups.length;
  const toggle = (id: string) => setFolded((prev) => {
    const out = new Set(prev);
    if (out.has(id)) out.delete(id); else out.add(id);
    return out;
  });

  const row = (v: Voicing) => {
    const name = fmtChord(v.chord, settings.chordNotation);
    const on = (style: ChordStyle) => sounding?.id === v.id && sounding.style === style;
    return (
      <article key={v.id} className="chord-row">
        <h3 className="chord-name">{name}</h3>
        <ChordBoxView voicing={v} maxScale={2} />
        <div className="chord-side">
          <Chip small selected={on('strum')} ariaLabel={`Écouter ${name} plaqué`} onClick={() => void listen(v, 'strum')}>▶ Plaqué</Chip>
          <Chip small selected={on('arpeggio')} ariaLabel={`Écouter ${name} arpégé`} onClick={() => void listen(v, 'arpeggio')}>▶ Arpégé</Chip>
        </div>
        <div className="chord-marks">
          <label>
            <input type="checkbox" checked={marks.known.includes(v.id)} onChange={() => mark('known', v.id)} aria-label={`Je connais ${name}`} />
            Je connais cet accord
          </label>
          <label>
            <input type="checkbox" checked={marks.noReview.includes(v.id)} onChange={() => mark('noReview', v.id)} aria-label={`Ne pas réviser ${name}`} />
            Ne pas réviser
          </label>
        </div>
        {v.note && <p className="t-small t-dim chord-note">{v.note}</p>}
      </article>
    );
  };

  return (
    <main className="shell play-shell">
      <div className="play-surface chord-surface">
        <header className="page-head">
          <div>
            <h1 ref={heading} tabIndex={-1} className="page-title">Accords</h1>
            <p className="t-small t-dim">{count} formes, en accordage standard</p>
          </div>
          <div className="chord-head-actions">
            <PixelButton variant="quiet" onClick={() => setFolded(allFolded ? new Set() : new Set(groups.map((g) => g.id)))}>
              {allFolded ? 'Déplier tout' : 'Replier tout'}
            </PixelButton>
            <PixelButton onClick={() => navigate('dictionary')}>Dictionnaire</PixelButton>
          </div>
        </header>
        {learned && <p role="status" className="t-small">{learned} fait maintenant partie de tes accords connus.</p>}
        {error && <p className="t-small mic-line-error" role="alert">{error}</p>}
        {groups.map((g) => (
          <Panel
            key={g.id}
            className="span-12"
            label={g.title}
            right={(
              <button
                type="button"
                className="chord-fold"
                aria-expanded={!folded.has(g.id)}
                aria-label={`${folded.has(g.id) ? 'Déplier' : 'Replier'} : ${g.title}`}
                onClick={() => toggle(g.id)}
              >
                <span className="badge">{g.voicings.length} accord{g.voicings.length > 1 ? 's' : ''}</span> {folded.has(g.id) ? '▸' : '▾'}
              </button>
            )}
          >
            {!folded.has(g.id) && <div className="chord-list">{g.voicings.map(row)}</div>}
          </Panel>
        ))}
        {learning && <ChordLearnDialog marks={marks} onKnown={learn} onClose={() => {
          navigate('accords');
          heading.current?.focus();
        }} />}
      </div>
    </main>
  );
}
