/**
 * Module Accords (D128) : une liste. Chaque forme montre son diagramme et s'écoute sur place,
 * plaquée ou arpégée. Le dictionnaire a sa page (D130).
 */
import { useMemo, useState } from 'react';
import { navigate } from '../../app/router';
import { useSettings } from '../../app/settings';
import { ChordBoxView } from '../../app/ChordBoxView';
import { Chip, Panel, PixelButton } from '../../app/ui';
import { fmtChord } from '../../core/theory';
import type { Voicing } from '../../core/theory/voicings';
import { VOICINGS } from '../../data/voicings';
import { chordGroups } from './list';
import { useChordListen, type ChordStyle } from './useChordListen';

export function ChordsPage() {
  const settings = useSettings();
  const groups = useMemo(() => chordGroups(VOICINGS), []);
  const count = groups.reduce((n, g) => n + g.voicings.length, 0);
  const { sounding, error, listen } = useChordListen();
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
        <ChordBoxView voicing={v} maxScale={2} />
        <div className="chord-main">
          <h3 className="chord-name">{name}</h3>
        </div>
        <div className="chord-side">
          <Chip small selected={on('strum')} ariaLabel={`Écouter ${name} plaqué`} onClick={() => void listen(v, 'strum')}>▶ Plaqué</Chip>
          <Chip small selected={on('arpeggio')} ariaLabel={`Écouter ${name} arpégé`} onClick={() => void listen(v, 'arpeggio')}>▶ Arpégé</Chip>
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
            <h1 className="page-title">Accords</h1>
            <p className="t-small t-dim">{count} formes, en accordage standard</p>
          </div>
          <div className="chord-head-actions">
            <PixelButton variant="quiet" onClick={() => setFolded(allFolded ? new Set() : new Set(groups.map((g) => g.id)))}>
              {allFolded ? 'Déplier tout' : 'Replier tout'}
            </PixelButton>
            <PixelButton onClick={() => navigate('dictionary')}>Dictionnaire</PixelButton>
          </div>
        </header>
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
      </div>
    </main>
  );
}
