/**
 * Module Accords (D128) : une liste, rien d'autre. Chaque forme montre son diagramme
 * et s'écoute sur place, plaquée ou arpégée.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../../app/settings';
import { useDesktop } from '../../app/useDesktop';
import { ChordBoxView } from '../../app/ChordBoxView';
import { Chip, Panel, PixelButton } from '../../app/ui';
import { TabPlayer } from '../../core/audio/tabPlayer';
import { chordToScore } from '../../core/tab';
import { fmtChord, fmtNote } from '../../core/theory';
import { interpretChord } from '../../core/theory/chords';
import type { Voicing } from '../../core/theory/voicings';
import { VOICINGS } from '../../data/voicings';
import { DICT_ADVANCED, DICT_BASIC, DICT_FAMILIES, DICT_TONICS, chordGroups, dictionaryForms } from './list';

type Style = 'strum' | 'arpeggio';

export function ChordsPage() {
  const settings = useSettings();
  const desktop = useDesktop();
  const groups = useMemo(() => chordGroups(VOICINGS), []);
  const count = groups.reduce((n, g) => n + g.voicings.length, 0);
  const [sounding, setSounding] = useState<{ id: string; style: Style } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());
  const allFolded = folded.size === groups.length;
  const toggle = (id: string) => setFolded((prev) => {
    const out = new Set(prev);
    if (out.has(id)) out.delete(id); else out.add(id);
    return out;
  });

  const player = useRef<TabPlayer | null>(null);
  if (player.current === null) player.current = new TabPlayer();
  useEffect(() => {
    const p = player.current!;
    return () => p.dispose();
  }, []);

  const listen = async (v: Voicing, style: Style) => {
    const p = player.current!;
    try {
      await p.init(); // en premier : reprend le contexte audio dans le geste
      p.stop();
      await p.load(chordToScore(v, { style, tempo: 70 }), { loop: false });
      p.onEnded = () => setSounding(null);
      await p.play();
      setSounding({ id: v.id, style });
      setError(null);
    } catch (e) {
      setSounding(null);
      setError(`erreur audio : ${(e as Error).message}`);
    }
  };

  // dictionnaire : tonique + type, puis les variantes de cet accord
  const [dictRoot, setDictRoot] = useState<string>('C');
  const [dictSuffix, setDictSuffix] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [variant, setVariant] = useState(0);
  const symbol = `${dictRoot}${dictSuffix}`;
  const forms = useMemo(() => dictionaryForms(symbol, VOICINGS), [symbol]);
  const form = forms[Math.min(variant, forms.length - 1)] ?? null;
  const info = interpretChord(symbol);
  const pick = (patch: { root?: string; suffix?: string }) => {
    if (patch.root !== undefined) setDictRoot(patch.root);
    if (patch.suffix !== undefined) setDictSuffix(patch.suffix);
    setVariant(0);
  };
  // un type avancé choisi garde sa famille visible
  const showAdvanced = advanced || DICT_ADVANCED.some((t) => t.suffix === dictSuffix);
  const typeChip = (t: { suffix: string; label: string }) => (
    <Chip key={t.label} selected={dictSuffix === t.suffix} onClick={() => pick({ suffix: t.suffix })}>{t.label}</Chip>
  );

  const row = (v: Voicing) => {
    const name = fmtChord(v.chord, settings.chordNotation);
    const on = (style: Style) => sounding?.id === v.id && sounding.style === style;
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
          <PixelButton variant="quiet" onClick={() => setFolded(allFolded ? new Set() : new Set(groups.map((g) => g.id)))}>
            {allFolded ? 'Déplier tout' : 'Replier tout'}
          </PixelButton>
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
        <Panel className="span-12 dict" accent="cyan" label="Dictionnaire" right={<span className="badge">{fmtChord(symbol, settings.chordNotation)}</span>}>
          <div className="dict-chips" role="group" aria-label="Tonique">
            {DICT_TONICS.map((n) => (
              <Chip key={n} selected={dictRoot === n} onClick={() => pick({ root: n })}>{fmtNote(n, settings.noteNotation)}</Chip>
            ))}
          </div>
          <div className="dict-chips" role="group" aria-label="Type d’accord">
            {DICT_BASIC.map(typeChip)}
            <button type="button" className="dict-more" aria-expanded={showAdvanced} onClick={() => { if (showAdvanced) pick({ suffix: DICT_ADVANCED.some((t) => t.suffix === dictSuffix) ? '' : dictSuffix }); setAdvanced(!showAdvanced); }}>
              {showAdvanced ? '▾' : '▸'} Avancé
            </button>
          </div>
          {showAdvanced && (
            <div className="dict-families">
              {DICT_FAMILIES.map((f) => (
                <div key={f.title} className="dict-family" role="group" aria-label={f.title}>
                  <span className="t-small t-dim">{f.title}</span>
                  <div className="dict-chips">{f.types.map(typeChip)}</div>
                </div>
              ))}
            </div>
          )}
          {form ? (
            <>
              <div className="dict-chips" role="group" aria-label="Variante">
                {forms.map((v, i) => (
                  <Chip key={v.id} selected={v.id === form.id} ariaLabel={`Variante ${i + 1}`} onClick={() => setVariant(i)}>{i + 1}</Chip>
                ))}
              </div>
              <div className="dict-result">
                <ChordBoxView voicing={form} maxScale={desktop ? 3 : 2} />
                <div className="dict-info">
                  <h3 className="chord-name">{fmtChord(symbol, settings.chordNotation)}</h3>
                  <p className="t-small">{info.notes.map((n) => fmtNote(n, settings.noteNotation)).join(' – ')}</p>
                  <p className="t-small t-dim">Degrés : {info.degrees.join(' ')}</p>
                  {form.note && <p className="t-small t-dim">{form.note}</p>}
                  <div className="chord-side">
                    <Chip small selected={sounding?.id === form.id && sounding.style === 'strum'} ariaLabel={`Écouter ${symbol} plaqué`} onClick={() => void listen(form, 'strum')}>▶ Plaqué</Chip>
                    <Chip small selected={sounding?.id === form.id && sounding.style === 'arpeggio'} ariaLabel={`Écouter ${symbol} arpégé`} onClick={() => void listen(form, 'arpeggio')}>▶ Arpégé</Chip>
                  </div>
                </div>
              </div>
            </>
          ) : <p className="t-small t-dim">Aucune forme jouable trouvée pour cet accord.</p>}
        </Panel>
      </div>
    </main>
  );
}
