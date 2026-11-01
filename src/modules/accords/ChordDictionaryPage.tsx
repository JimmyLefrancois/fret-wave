/** Dictionnaire d'accords (D129, D130) : tonique + type, puis les variantes de cet accord. */
import { useMemo, useState } from 'react';
import { navigate } from '../../app/router';
import { useSettings } from '../../app/settings';
import { useDesktop } from '../../app/useDesktop';
import { ChordBoxView } from '../../app/ChordBoxView';
import { Chip, Panel, PixelButton } from '../../app/ui';
import { fmtChord, fmtNote } from '../../core/theory';
import { interpretChord } from '../../core/theory/chords';
import { VOICINGS } from '../../data/voicings';
import { DICT_ADVANCED, DICT_BASIC, DICT_FAMILIES, DICT_TONICS, dictionaryForms } from './list';
import { useChordListen } from './useChordListen';

export function ChordDictionaryPage() {
  const settings = useSettings();
  const desktop = useDesktop();
  const { sounding, error, listen } = useChordListen();
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

  return (
    <main className="shell"><div className="tool-surface">
      <header className="page-head">
        <div>
          <h1 className="page-title">Dictionnaire d’accords</h1>
          <p className="t-small t-dim">Choisis la tonique et le type, puis la variante.</p>
        </div>
        <PixelButton variant="quiet" onClick={() => navigate('accords')}>Liste d’accords</PixelButton>
      </header>
      {error && <p className="t-small mic-line-error" role="alert">{error}</p>}
      <Panel className="span-12 dict" accent="cyan">
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
                <h2 className="chord-name">{fmtChord(symbol, settings.chordNotation)}</h2>
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
    </div></main>
  );
}
